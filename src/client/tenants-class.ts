/**
 * Tenants class for direct component interaction.
 * Permission checks and authz sync are handled here.
 */
import type { ComponentApi } from "../component/_generated/component.js";
import type { AuthzClient } from "./authz.js";
import {
  DEFAULT_TENANTS_PERMISSION_MAP,
  type TenantsPermissionMap,
} from "./authz.js";
import type {
  Organization,
  OrganizationWithRole,
  Member,
  Team,
  TeamMember,
  Invitation,
  QueryCtx,
  MutationCtx,
} from "./types.js";
import { orgScope, generateSlug } from "./helpers.js";

export type { QueryCtx, MutationCtx };

/**
 * Tenants class for direct component interaction.
 *
 * Requires an `Authz` instance (from `@djpanda/convex-authz`). The class:
 * - Checks permissions before mutations (via configurable permission map)
 * - Syncs role assignments / revocations (via authz)
 * - Syncs team membership relations (via ReBAC)
 */
export class Tenants {
  private authz: AuthzClient;
  private permissionMap: TenantsPermissionMap;

  constructor(
    private component: ComponentApi,
    private options: {
      authz: AuthzClient;
      creatorRole?: string;
      defaultInvitationExpiration?: number;
      permissionMap?: Partial<TenantsPermissionMap>;
    }
  ) {
    this.authz = options.authz;
    this.permissionMap = {
      ...DEFAULT_TENANTS_PERMISSION_MAP,
      ...options.permissionMap,
    };
  }

  private async authzRequireOperation(
    ctx: QueryCtx,
    userId: string,
    operation: keyof TenantsPermissionMap,
    scope: { type: string; id: string }
  ): Promise<void> {
    const permission = this.permissionMap[operation];
    if (permission === false) return;
    await this.authz.require(ctx, userId, permission, scope);
  }

  private async resolvePermissionScope(
    ctx: QueryCtx,
    organizationId: string,
    scope?: { type: string; id: string }
  ): Promise<{ type: string; id: string }> {
    if (!scope) return orgScope(organizationId);
    if (scope.type === "organization") {
      if (scope.id !== organizationId) throw new Error("Permission scope organization mismatch");
      return scope;
    }
    if (scope.type === "team") {
      const team = await this.getTeam(ctx, scope.id);
      if (!team || team.organizationId !== organizationId) {
        throw new Error("Permission scope team must belong to organization");
      }
      return scope;
    }
    throw new Error("Unsupported permission scope type");
  }

  async listOrganizations(
    ctx: QueryCtx,
    userId: string,
    options?: { sortBy?: "name" | "createdAt" | "slug"; sortOrder?: "asc" | "desc" }
  ): Promise<OrganizationWithRole[]> {
    return await ctx.runQuery(this.component.organizations.listUserOrganizations, {
      userId,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
    });
  }

  async getOrganization(ctx: QueryCtx, organizationId: string): Promise<Organization | null> {
    return await ctx.runQuery(this.component.organizations.getOrganization, { organizationId });
  }

  async getOrganizationBySlug(ctx: QueryCtx, slug: string): Promise<Organization | null> {
    return await ctx.runQuery(this.component.organizations.getOrganizationBySlug, { slug });
  }

  async createOrganization(
    ctx: MutationCtx,
    userId: string,
    name: string,
    options?: {
      slug?: string;
      logo?: string;
      metadata?: Record<string, unknown>;
      settings?: { allowPublicSignup?: boolean; requireInvitationToJoin?: boolean };
    }
  ): Promise<string> {
    const createPermission = this.permissionMap.createOrganization;
    if (typeof createPermission === "string") {
      await this.authz.require(ctx, userId, createPermission);
    }
    const slug = options?.slug ?? generateSlug(name);
    const creatorRole = this.options.creatorRole ?? "owner";
    const orgId = await ctx.runMutation(this.component.organizations.createOrganization, {
      userId,
      name,
      slug,
      logo: options?.logo,
      metadata: options?.metadata,
      settings: options?.settings,
      creatorRole,
    });
    await this.authz.assignRole(ctx, userId, creatorRole, orgScope(orgId), undefined, userId);
    return orgId;
  }

  async updateOrganization(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    updates: {
      name?: string;
      slug?: string;
      logo?: string | null;
      metadata?: Record<string, unknown>;
      settings?: { allowPublicSignup?: boolean; requireInvitationToJoin?: boolean };
      status?: "active" | "suspended" | "archived";
    }
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "updateOrganization", orgScope(organizationId));
    await ctx.runMutation(this.component.organizations.updateOrganization, {
      userId,
      organizationId,
      ...updates,
    });
  }

  async transferOwnership(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    newOwnerUserId: string,
    options?: { previousOwnerRole?: string }
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "updateOrganization", orgScope(organizationId));
    const org = await this.getOrganization(ctx, organizationId);
    if (!org || org.ownerId !== userId) {
      throw new Error("Only the current owner can transfer ownership");
    }
    const previousRole = options?.previousOwnerRole ?? "admin";
    await ctx.runMutation(this.component.organizations.transferOwnership, {
      userId,
      organizationId,
      newOwnerUserId,
      previousOwnerRole: previousRole,
    });
    await this.authz.revokeRole(ctx, userId, "owner", orgScope(organizationId));
    await this.authz.assignRole(ctx, userId, previousRole, orgScope(organizationId), undefined, userId);
    await this.authz.assignRole(ctx, newOwnerUserId, "owner", orgScope(organizationId), undefined, userId);
  }

  async deleteOrganization(
    ctx: MutationCtx,
    userId: string,
    organizationId: string
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "deleteOrganization", orgScope(organizationId));
    const members = await this.listMembers(ctx, organizationId);
    const teams = await this.listTeams(ctx, organizationId);
    for (const member of members) {
      await this.authz.revokeRole(ctx, member.userId, member.role, orgScope(organizationId));
    }
    for (const team of teams) {
      const tms = await this.listTeamMembers(ctx, team._id);
      for (const tm of tms) {
        await ctx.runMutation(this.authz.component.rebac.removeRelation, {
          subjectType: "user",
          subjectId: tm.userId,
          relation: "member",
          objectType: "team",
          objectId: team._id,
        });
      }
    }
    await ctx.runMutation(this.component.organizations.deleteOrganization, { userId, organizationId });
  }

  async listMembers(
    ctx: QueryCtx,
    organizationId: string,
    options?: {
      status?: "active" | "suspended" | "all";
      sortBy?: "role" | "joinedAt" | "createdAt" | "userId";
      sortOrder?: "asc" | "desc";
    }
  ): Promise<Member[]> {
    return await ctx.runQuery(this.component.members.listOrganizationMembers, {
      organizationId,
      status: options?.status,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
    });
  }

  async countMembers(
    ctx: QueryCtx,
    organizationId: string,
    options?: { status?: "active" | "suspended" | "all" }
  ): Promise<number> {
    return await ctx.runQuery(this.component.members.countOrganizationMembers, {
      organizationId,
      status: options?.status,
    });
  }

  async listMembersPaginated(
    ctx: QueryCtx,
    organizationId: string,
    paginationOpts: { numItems: number; cursor: string | null },
    options?: { status?: "active" | "suspended" | "all" }
  ): Promise<{ page: Member[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.members.listOrganizationMembersPaginated, {
      organizationId,
      paginationOpts,
      status: options?.status,
    });
  }

  async getMember(
    ctx: QueryCtx,
    organizationId: string,
    userId: string
  ): Promise<Member | null> {
    return await ctx.runQuery(this.component.members.getMember, { organizationId, userId });
  }

  async checkMemberPermission(
    ctx: QueryCtx,
    organizationId: string,
    userId: string,
    minRole: "member" | "admin" | "owner"
  ): Promise<{ hasPermission: boolean; currentRole: "owner" | "admin" | "member" | null }> {
    return await ctx.runQuery(this.component.members.checkMemberPermission, {
      organizationId,
      userId,
      minRole,
    });
  }

  async addMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string,
    role: string
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "addMember", orgScope(organizationId));
    await ctx.runMutation(this.component.members.addMember, {
      userId,
      organizationId,
      memberUserId,
      role,
    });
    await this.authz.assignRole(ctx, memberUserId, role, orgScope(organizationId), undefined, userId);
  }

  async removeMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "removeMember", orgScope(organizationId));
    const member = await this.getMember(ctx, organizationId, memberUserId);
    if (member) {
      const teams = await this.listTeams(ctx, organizationId);
      for (const team of teams) {
        const isMember = await this.isTeamMember(ctx, team._id, memberUserId);
        if (isMember) {
          await ctx.runMutation(this.authz.component.rebac.removeRelation, {
            subjectType: "user",
            subjectId: memberUserId,
            relation: "member",
            objectType: "team",
            objectId: team._id,
          });
        }
      }
    }
    await ctx.runMutation(this.component.members.removeMember, {
      userId,
      organizationId,
      memberUserId,
    });
    if (member) {
      await this.authz.revokeRole(ctx, memberUserId, member.role, orgScope(organizationId));
    }
  }

  async bulkAddMembers(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    members: Array<{ memberUserId: string; role: string }>
  ): Promise<{ success: string[]; errors: Array<{ userId: string; code: string; message: string }> }> {
    await this.authzRequireOperation(ctx, userId, "bulkAddMembers", orgScope(organizationId));
    const result = await ctx.runMutation(this.component.members.bulkAddMembers, {
      userId,
      organizationId,
      members,
    });
    for (const memberUserId of result.success) {
      const m = members.find((x) => x.memberUserId === memberUserId);
      if (m) {
        await this.authz.assignRole(ctx, memberUserId, m.role, orgScope(organizationId), undefined, userId);
      }
    }
    return result;
  }

  async bulkRemoveMembers(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserIds: string[]
  ): Promise<{ success: string[]; errors: Array<{ userId: string; code: string; message: string }> }> {
    await this.authzRequireOperation(ctx, userId, "bulkRemoveMembers", orgScope(organizationId));
    const rolesByUser: Record<string, string> = {};
    const teams = await this.listTeams(ctx, organizationId);
    for (const memberUserId of memberUserIds) {
      const member = await this.getMember(ctx, organizationId, memberUserId);
      if (member) rolesByUser[memberUserId] = member.role;
    }
    const result = await ctx.runMutation(this.component.members.bulkRemoveMembers, {
      userId,
      organizationId,
      memberUserIds,
    });
    for (const memberUserId of result.success) {
      const role = rolesByUser[memberUserId];
      if (role) {
        await this.authz.revokeRole(ctx, memberUserId, role, orgScope(organizationId));
      }
      for (const team of teams) {
        const isMember = await this.isTeamMember(ctx, team._id, memberUserId);
        if (isMember) {
          await ctx.runMutation(this.authz.component.rebac.removeRelation, {
            subjectType: "user",
            subjectId: memberUserId,
            relation: "member",
            objectType: "team",
            objectId: team._id,
          });
        }
      }
    }
    return result;
  }

  async updateMemberRole(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string,
    role: string
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "updateMemberRole", orgScope(organizationId));
    const member = await this.getMember(ctx, organizationId, memberUserId);
    const previousRole = member?.role;
    await ctx.runMutation(this.component.members.updateMemberRole, {
      userId,
      organizationId,
      memberUserId,
      role,
    });
    if (previousRole) {
      await this.authz.revokeRole(ctx, memberUserId, previousRole, orgScope(organizationId));
    }
    await this.authz.assignRole(ctx, memberUserId, role, orgScope(organizationId), undefined, userId);
  }

  async suspendMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "suspendMember", orgScope(organizationId));
    await ctx.runMutation(this.component.members.suspendMember, {
      userId,
      organizationId,
      memberUserId,
    });
  }

  async unsuspendMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "unsuspendMember", orgScope(organizationId));
    await ctx.runMutation(this.component.members.unsuspendMember, {
      userId,
      organizationId,
      memberUserId,
    });
  }

  async leaveOrganization(
    ctx: MutationCtx,
    userId: string,
    organizationId: string
  ): Promise<void> {
    const member = await this.getMember(ctx, organizationId, userId);
    if (!member) throw new Error("Not a member of this organization");
    const creatorRole = this.options.creatorRole ?? "owner";
    if (member.role === creatorRole) {
      const members = await this.listMembers(ctx, organizationId, { status: "active" });
      const ownerCount = members.filter((m) => m.role === creatorRole).length;
      if (ownerCount <= 1) {
        throw new Error("Cannot leave: you are the last owner. Transfer ownership first.");
      }
    }
    const teams = await this.listTeams(ctx, organizationId);
    for (const team of teams) {
      const isMember = await this.isTeamMember(ctx, team._id, userId);
      if (isMember) {
        await ctx.runMutation(this.authz.component.rebac.removeRelation, {
          subjectType: "user",
          subjectId: userId,
          relation: "member",
          objectType: "team",
          objectId: team._id,
        });
      }
    }
    await ctx.runMutation(this.component.members.leaveOrganization, { userId, organizationId });
    await this.authz.revokeRole(ctx, userId, member.role, orgScope(organizationId));
  }

  async listTeams(
    ctx: QueryCtx,
    organizationId: string,
    options?: {
      parentTeamId?: string | null;
      sortBy?: "name" | "createdAt" | "slug";
      sortOrder?: "asc" | "desc";
    }
  ): Promise<Team[]> {
    return await ctx.runQuery(this.component.teams.listTeams, {
      organizationId,
      parentTeamId: options?.parentTeamId,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
    });
  }

  async listTeamsAsTree(
    ctx: QueryCtx,
    organizationId: string
  ): Promise<Array<{ team: Team; children: Array<{ team: Team; children: unknown[] }> }>> {
    return await ctx.runQuery(this.component.teams.listTeamsAsTree, { organizationId });
  }

  async countTeams(ctx: QueryCtx, organizationId: string): Promise<number> {
    return await ctx.runQuery(this.component.teams.countTeams, { organizationId });
  }

  async listTeamsPaginated(
    ctx: QueryCtx,
    organizationId: string,
    paginationOpts: { numItems: number; cursor: string | null }
  ): Promise<{ page: Team[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.teams.listTeamsPaginated, {
      organizationId,
      paginationOpts,
    });
  }

  async getTeam(ctx: QueryCtx, teamId: string): Promise<Team | null> {
    return await ctx.runQuery(this.component.teams.getTeam, { teamId });
  }

  async createTeam(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    name: string,
    description?: string,
    options?: { slug?: string; metadata?: Record<string, unknown>; parentTeamId?: string }
  ): Promise<string> {
    await this.authzRequireOperation(ctx, userId, "createTeam", orgScope(organizationId));
    return await ctx.runMutation(this.component.teams.createTeam, {
      userId,
      organizationId,
      name,
      description,
      slug: options?.slug,
      metadata: options?.metadata,
      parentTeamId: options?.parentTeamId,
    });
  }

  async updateTeam(
    ctx: MutationCtx,
    userId: string,
    teamId: string,
    updates: {
      name?: string;
      slug?: string;
      description?: string | null;
      metadata?: Record<string, unknown>;
      parentTeamId?: string | null;
    }
  ): Promise<void> {
    const team = await this.getTeam(ctx, teamId);
    if (!team) throw new Error("Team not found");
    await this.authzRequireOperation(ctx, userId, "updateTeam", orgScope(team.organizationId));
    await ctx.runMutation(this.component.teams.updateTeam, { userId, teamId, ...updates });
  }

  async deleteTeam(ctx: MutationCtx, userId: string, teamId: string): Promise<void> {
    const team = await this.getTeam(ctx, teamId);
    if (!team) throw new Error("Team not found");
    await this.authzRequireOperation(ctx, userId, "deleteTeam", orgScope(team.organizationId));
    const tms = await this.listTeamMembers(ctx, teamId);
    for (const tm of tms) {
      await ctx.runMutation(this.authz.component.rebac.removeRelation, {
        subjectType: "user",
        subjectId: tm.userId,
        relation: "member",
        objectType: "team",
        objectId: teamId,
      });
    }
    await ctx.runMutation(this.component.teams.deleteTeam, { userId, teamId });
  }

  async listTeamMembers(
    ctx: QueryCtx,
    teamId: string,
    options?: { sortBy?: "userId" | "role" | "createdAt"; sortOrder?: "asc" | "desc" }
  ): Promise<TeamMember[]> {
    return await ctx.runQuery(this.component.teams.listTeamMembers, {
      teamId,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
    });
  }

  async listTeamMembersPaginated(
    ctx: QueryCtx,
    teamId: string,
    paginationOpts: { numItems: number; cursor: string | null }
  ): Promise<{ page: TeamMember[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.teams.listTeamMembersPaginated, {
      teamId,
      paginationOpts,
    });
  }

  async addTeamMember(
    ctx: MutationCtx,
    userId: string,
    teamId: string,
    memberUserId: string,
    options?: { role?: string }
  ): Promise<void> {
    const team = await this.getTeam(ctx, teamId);
    if (!team) throw new Error("Team not found");
    await this.authzRequireOperation(ctx, userId, "addTeamMember", orgScope(team.organizationId));
    await ctx.runMutation(this.component.teams.addTeamMember, {
      userId,
      teamId,
      memberUserId,
      role: options?.role,
    });
    await ctx.runMutation(this.authz.component.rebac.addRelation, {
      subjectType: "user",
      subjectId: memberUserId,
      relation: "member",
      objectType: "team",
      objectId: teamId,
    });
  }

  async updateTeamMemberRole(
    ctx: MutationCtx,
    userId: string,
    teamId: string,
    memberUserId: string,
    role: string
  ): Promise<void> {
    const team = await this.getTeam(ctx, teamId);
    if (!team) throw new Error("Team not found");
    await this.authzRequireOperation(ctx, userId, "updateTeamMemberRole", orgScope(team.organizationId));
    await ctx.runMutation(this.component.teams.updateTeamMemberRole, {
      userId,
      teamId,
      memberUserId,
      role,
    });
  }

  async removeTeamMember(
    ctx: MutationCtx,
    userId: string,
    teamId: string,
    memberUserId: string
  ): Promise<void> {
    const team = await this.getTeam(ctx, teamId);
    if (!team) throw new Error("Team not found");
    await this.authzRequireOperation(ctx, userId, "removeTeamMember", orgScope(team.organizationId));
    await ctx.runMutation(this.component.teams.removeTeamMember, {
      userId,
      teamId,
      memberUserId,
    });
    await ctx.runMutation(this.authz.component.rebac.removeRelation, {
      subjectType: "user",
      subjectId: memberUserId,
      relation: "member",
      objectType: "team",
      objectId: teamId,
    });
  }

  async isTeamMember(ctx: QueryCtx, teamId: string, userId: string): Promise<boolean> {
    return await ctx.runQuery(this.component.teams.isTeamMember, { teamId, userId });
  }

  async can(
    ctx: QueryCtx,
    userId: string,
    permission: string,
    organizationId: string
  ): Promise<boolean> {
    return await this.authz.can(ctx, userId, permission, orgScope(organizationId));
  }

  async require(
    ctx: QueryCtx,
    userId: string,
    permission: string,
    organizationId: string
  ): Promise<void> {
    await this.authz.require(ctx, userId, permission, orgScope(organizationId));
  }

  async getUserPermissions(ctx: QueryCtx, userId: string, organizationId: string) {
    return await this.authz.getUserPermissions(ctx, userId, orgScope(organizationId));
  }

  async getUserRoles(
    ctx: QueryCtx,
    userId: string,
    organizationId?: string
  ) {
    return await this.authz.getUserRoles(
      ctx,
      userId,
      organizationId ? orgScope(organizationId) : undefined
    );
  }

  async grantPermission(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    targetUserId: string,
    permission: string,
    options?: { scope?: { type: string; id: string }; reason?: string; expiresAt?: number }
  ): Promise<string> {
    await this.authzRequireOperation(ctx, userId, "grantPermission", orgScope(organizationId));
    const validatedScope = await this.resolvePermissionScope(ctx, organizationId, options?.scope);
    return await this.authz.grantPermission(
      ctx,
      targetUserId,
      permission,
      validatedScope,
      options?.reason,
      options?.expiresAt,
      userId
    );
  }

  async denyPermission(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    targetUserId: string,
    permission: string,
    options?: { scope?: { type: string; id: string }; reason?: string; expiresAt?: number }
  ): Promise<string> {
    await this.authzRequireOperation(ctx, userId, "denyPermission", orgScope(organizationId));
    const validatedScope = await this.resolvePermissionScope(ctx, organizationId, options?.scope);
    return await this.authz.denyPermission(
      ctx,
      targetUserId,
      permission,
      validatedScope,
      options?.reason,
      options?.expiresAt,
      userId
    );
  }

  async getAuditLog(
    ctx: QueryCtx,
    userId: string,
    organizationId: string,
    options?: { userId?: string; action?: string; limit?: number }
  ) {
    await this.authzRequireOperation(ctx, userId, "getAuditLog", orgScope(organizationId));
    const scope = orgScope(organizationId);
    const result = await this.authz.getAuditLog(ctx, options);
    const matchesScope = (entry: { scope?: { type?: string; id?: string } }) =>
      entry.scope?.type === scope.type && entry.scope?.id === scope.id;
    if (Array.isArray(result)) {
      return result.filter((entry: { scope?: { type?: string; id?: string } }) => matchesScope(entry));
    }
    if (result && Array.isArray((result as { entries?: unknown[] }).entries)) {
      return {
        ...result,
        entries: (result as { entries: { scope?: { type?: string; id?: string } }[] }).entries.filter(matchesScope),
      };
    }
    return result;
  }

  async listInvitations(
    ctx: QueryCtx,
    organizationId: string,
    options?: { sortBy?: "inviteeIdentifier" | "expiresAt" | "createdAt"; sortOrder?: "asc" | "desc" }
  ): Promise<Invitation[]> {
    return await ctx.runQuery(this.component.invitations.listInvitations, {
      organizationId,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
    });
  }

  async countInvitations(ctx: QueryCtx, organizationId: string): Promise<number> {
    return await ctx.runQuery(this.component.invitations.countInvitations, { organizationId });
  }

  async listInvitationsPaginated(
    ctx: QueryCtx,
    organizationId: string,
    paginationOpts: { numItems: number; cursor: string | null }
  ): Promise<{ page: Invitation[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.invitations.listInvitationsPaginated, {
      organizationId,
      paginationOpts,
    });
  }

  async getInvitation(ctx: QueryCtx, invitationId: string): Promise<Invitation | null> {
    return await ctx.runQuery(this.component.invitations.getInvitation, { invitationId });
  }

  async getPendingInvitations(
    ctx: QueryCtx,
    identifier: string
  ): Promise<Array<Omit<Invitation, "status">>> {
    return await ctx.runQuery(this.component.invitations.getPendingInvitationsForIdentifier, { identifier });
  }

  async inviteMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    inviteeIdentifier: string,
    role: string,
    options?: { teamId?: string; message?: string; inviterName?: string; expiresAt?: number; identifierType?: string }
  ): Promise<{ invitationId: string; inviteeIdentifier: string; expiresAt: number }> {
    await this.authzRequireOperation(ctx, userId, "inviteMember", orgScope(organizationId));
    const expiresAt =
      options?.expiresAt ??
      Date.now() + (this.options.defaultInvitationExpiration ?? 48 * 60 * 60 * 1000);
    return await ctx.runMutation(this.component.invitations.inviteMember, {
      userId,
      organizationId,
      inviteeIdentifier,
      identifierType: options?.identifierType,
      role,
      teamId: options?.teamId,
      message: options?.message,
      inviterName: options?.inviterName,
      expiresAt,
    });
  }

  async bulkInviteMembers(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    invitations: Array<{ inviteeIdentifier: string; identifierType?: string; role: string; message?: string; teamId?: string }>,
    options?: { inviterName?: string; expiresAt?: number }
  ): Promise<{
    success: Array<{ invitationId: string; inviteeIdentifier: string; expiresAt: number }>;
    errors: Array<{ inviteeIdentifier: string; code: string; message: string }>;
  }> {
    await this.authzRequireOperation(ctx, userId, "bulkInviteMembers", orgScope(organizationId));
    return await ctx.runMutation(this.component.invitations.bulkInviteMembers, {
      userId,
      organizationId,
      invitations,
      inviterName: options?.inviterName,
      expiresAt: options?.expiresAt,
    });
  }

  async acceptInvitation(
    ctx: MutationCtx,
    invitationId: string,
    acceptingUserId: string,
    options?: { acceptingUserIdentifier?: string }
  ): Promise<void> {
    const invitation = await this.getInvitation(ctx, invitationId);
    await ctx.runMutation(this.component.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId,
      acceptingUserIdentifier: options?.acceptingUserIdentifier,
    });
    if (invitation) {
      await this.authz.assignRole(
        ctx,
        acceptingUserId,
        invitation.role,
        orgScope(invitation.organizationId),
        undefined,
        invitation.inviterId
      );
      if (invitation.teamId) {
        await ctx.runMutation(this.authz.component.rebac.addRelation, {
          subjectType: "user",
          subjectId: acceptingUserId,
          relation: "member",
          objectType: "team",
          objectId: invitation.teamId,
        });
      }
    }
  }

  async resendInvitation(
    ctx: MutationCtx,
    userId: string,
    invitationId: string
  ): Promise<{ invitationId: string; inviteeIdentifier: string }> {
    const invitation = await this.getInvitation(ctx, invitationId);
    if (!invitation) throw new Error("Invitation not found");
    await this.authzRequireOperation(ctx, userId, "resendInvitation", orgScope(invitation.organizationId));
    return await ctx.runMutation(this.component.invitations.resendInvitation, {
      userId,
      invitationId,
    });
  }

  async cancelInvitation(ctx: MutationCtx, userId: string, invitationId: string): Promise<void> {
    const invitation = await this.getInvitation(ctx, invitationId);
    if (!invitation) throw new Error("Invitation not found");
    await this.authzRequireOperation(ctx, userId, "cancelInvitation", orgScope(invitation.organizationId));
    await ctx.runMutation(this.component.invitations.cancelInvitation, { userId, invitationId });
  }
}
