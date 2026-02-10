/**
 * Tenants class for direct component interaction.
 * Permission checks and authz sync are handled here.
 */
import type { ComponentApi } from "../../component/_generated/component.js";
import type { AuthzClient } from "../authz.js";
import {
  DEFAULT_TENANTS_PERMISSION_MAP,
  type TenantsPermissionMap,
} from "../authz.js";
import {
  type Organization,
  type OrganizationWithRole,
  type Member,
  type Team,
  type TeamMember,
  type Invitation,
  type QueryCtx,
  type MutationCtx,
  orgScope,
  generateSlug,
} from "./types.js";

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

  async listOrganizations(ctx: QueryCtx, userId: string): Promise<OrganizationWithRole[]> {
    return await ctx.runQuery(this.component.queries.listUserOrganizations, { userId });
  }

  async getOrganization(ctx: QueryCtx, organizationId: string): Promise<Organization | null> {
    return await ctx.runQuery(this.component.queries.getOrganization, { organizationId });
  }

  async getOrganizationBySlug(ctx: QueryCtx, slug: string): Promise<Organization | null> {
    return await ctx.runQuery(this.component.queries.getOrganizationBySlug, { slug });
  }

  async createOrganization(
    ctx: MutationCtx,
    userId: string,
    name: string,
    options?: { slug?: string; logo?: string; metadata?: Record<string, unknown> }
  ): Promise<string> {
    const createPermission = this.permissionMap.createOrganization;
    if (typeof createPermission === "string") {
      await this.authz.require(ctx, userId, createPermission);
    }
    const slug = options?.slug ?? generateSlug(name);
    const creatorRole = this.options.creatorRole ?? "owner";
    const orgId = await ctx.runMutation(this.component.mutations.createOrganization, {
      userId,
      name,
      slug,
      logo: options?.logo,
      metadata: options?.metadata,
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
      status?: "active" | "suspended" | "archived";
    }
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "updateOrganization", orgScope(organizationId));
    await ctx.runMutation(this.component.mutations.updateOrganization, {
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
    await ctx.runMutation(this.component.mutations.transferOwnership, {
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
    await ctx.runMutation(this.component.mutations.deleteOrganization, { userId, organizationId });
  }

  async listMembers(
    ctx: QueryCtx,
    organizationId: string,
    options?: { status?: "active" | "suspended" | "all" }
  ): Promise<Member[]> {
    return await ctx.runQuery(this.component.queries.listOrganizationMembers, {
      organizationId,
      status: options?.status,
    });
  }

  async countMembers(
    ctx: QueryCtx,
    organizationId: string,
    options?: { status?: "active" | "suspended" | "all" }
  ): Promise<number> {
    return await ctx.runQuery(this.component.queries.countOrganizationMembers, {
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
    return await ctx.runQuery(this.component.queries.listOrganizationMembersPaginated, {
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
    return await ctx.runQuery(this.component.queries.getMember, { organizationId, userId });
  }

  async addMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string,
    role: string
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "addMember", orgScope(organizationId));
    await ctx.runMutation(this.component.mutations.addMember, {
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
    await ctx.runMutation(this.component.mutations.removeMember, {
      userId,
      organizationId,
      memberUserId,
    });
    if (member) {
      await this.authz.revokeRole(ctx, memberUserId, member.role, orgScope(organizationId));
    }
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
    await ctx.runMutation(this.component.mutations.updateMemberRole, {
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
    await ctx.runMutation(this.component.mutations.suspendMember, {
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
    await ctx.runMutation(this.component.mutations.unsuspendMember, {
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
    await ctx.runMutation(this.component.mutations.leaveOrganization, { userId, organizationId });
    await this.authz.revokeRole(ctx, userId, member.role, orgScope(organizationId));
  }

  async listTeams(ctx: QueryCtx, organizationId: string): Promise<Team[]> {
    return await ctx.runQuery(this.component.queries.listTeams, { organizationId });
  }

  async countTeams(ctx: QueryCtx, organizationId: string): Promise<number> {
    return await ctx.runQuery(this.component.queries.countTeams, { organizationId });
  }

  async listTeamsPaginated(
    ctx: QueryCtx,
    organizationId: string,
    paginationOpts: { numItems: number; cursor: string | null }
  ): Promise<{ page: Team[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.queries.listTeamsPaginated, {
      organizationId,
      paginationOpts,
    });
  }

  async getTeam(ctx: QueryCtx, teamId: string): Promise<Team | null> {
    return await ctx.runQuery(this.component.queries.getTeam, { teamId });
  }

  async createTeam(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    name: string,
    description?: string,
    options?: { slug?: string; metadata?: Record<string, unknown> }
  ): Promise<string> {
    await this.authzRequireOperation(ctx, userId, "createTeam", orgScope(organizationId));
    return await ctx.runMutation(this.component.mutations.createTeam, {
      userId,
      organizationId,
      name,
      description,
      slug: options?.slug,
      metadata: options?.metadata,
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
    }
  ): Promise<void> {
    const team = await this.getTeam(ctx, teamId);
    if (!team) throw new Error("Team not found");
    await this.authzRequireOperation(ctx, userId, "updateTeam", orgScope(team.organizationId));
    await ctx.runMutation(this.component.mutations.updateTeam, { userId, teamId, ...updates });
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
    await ctx.runMutation(this.component.mutations.deleteTeam, { userId, teamId });
  }

  async listTeamMembers(ctx: QueryCtx, teamId: string): Promise<TeamMember[]> {
    return await ctx.runQuery(this.component.queries.listTeamMembers, { teamId });
  }

  async listTeamMembersPaginated(
    ctx: QueryCtx,
    teamId: string,
    paginationOpts: { numItems: number; cursor: string | null }
  ): Promise<{ page: TeamMember[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.queries.listTeamMembersPaginated, {
      teamId,
      paginationOpts,
    });
  }

  async addTeamMember(
    ctx: MutationCtx,
    userId: string,
    teamId: string,
    memberUserId: string
  ): Promise<void> {
    const team = await this.getTeam(ctx, teamId);
    if (!team) throw new Error("Team not found");
    await this.authzRequireOperation(ctx, userId, "addTeamMember", orgScope(team.organizationId));
    await ctx.runMutation(this.component.mutations.addTeamMember, {
      userId,
      teamId,
      memberUserId,
    });
    await ctx.runMutation(this.authz.component.rebac.addRelation, {
      subjectType: "user",
      subjectId: memberUserId,
      relation: "member",
      objectType: "team",
      objectId: teamId,
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
    await ctx.runMutation(this.component.mutations.removeTeamMember, {
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
    return await ctx.runQuery(this.component.queries.isTeamMember, { teamId, userId });
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
    return await this.authz.getAuditLog(ctx, options);
  }

  async listInvitations(ctx: QueryCtx, organizationId: string): Promise<Invitation[]> {
    return await ctx.runQuery(this.component.queries.listInvitations, { organizationId });
  }

  async countInvitations(ctx: QueryCtx, organizationId: string): Promise<number> {
    return await ctx.runQuery(this.component.queries.countInvitations, { organizationId });
  }

  async listInvitationsPaginated(
    ctx: QueryCtx,
    organizationId: string,
    paginationOpts: { numItems: number; cursor: string | null }
  ): Promise<{ page: Invitation[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.queries.listInvitationsPaginated, {
      organizationId,
      paginationOpts,
    });
  }

  async getInvitation(ctx: QueryCtx, invitationId: string): Promise<Invitation | null> {
    return await ctx.runQuery(this.component.queries.getInvitation, { invitationId });
  }

  async getPendingInvitations(
    ctx: QueryCtx,
    email: string
  ): Promise<Array<Omit<Invitation, "status">>> {
    return await ctx.runQuery(this.component.queries.getPendingInvitationsForEmail, { email });
  }

  async inviteMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    email: string,
    role: string,
    options?: { teamId?: string; message?: string; expiresAt?: number }
  ): Promise<{ invitationId: string; email: string; expiresAt: number }> {
    await this.authzRequireOperation(ctx, userId, "inviteMember", orgScope(organizationId));
    const expiresAt =
      options?.expiresAt ??
      Date.now() + (this.options.defaultInvitationExpiration ?? 48 * 60 * 60 * 1000);
    return await ctx.runMutation(this.component.mutations.inviteMember, {
      userId,
      organizationId,
      email,
      role,
      teamId: options?.teamId,
      message: options?.message,
      expiresAt,
    });
  }

  async acceptInvitation(
    ctx: MutationCtx,
    invitationId: string,
    acceptingUserId: string,
    options?: { acceptingEmail?: string }
  ): Promise<void> {
    const invitation = await this.getInvitation(ctx, invitationId);
    await ctx.runMutation(this.component.mutations.acceptInvitation, {
      invitationId,
      acceptingUserId,
      acceptingEmail: options?.acceptingEmail,
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
  ): Promise<{ invitationId: string; email: string }> {
    const invitation = await this.getInvitation(ctx, invitationId);
    if (!invitation) throw new Error("Invitation not found");
    await this.authzRequireOperation(ctx, userId, "resendInvitation", orgScope(invitation.organizationId));
    return await ctx.runMutation(this.component.mutations.resendInvitation, {
      userId,
      invitationId,
    });
  }

  async cancelInvitation(ctx: MutationCtx, userId: string, invitationId: string): Promise<void> {
    const invitation = await this.getInvitation(ctx, invitationId);
    if (!invitation) throw new Error("Invitation not found");
    await this.authzRequireOperation(ctx, userId, "cancelInvitation", orgScope(invitation.organizationId));
    await ctx.runMutation(this.component.mutations.cancelInvitation, { userId, invitationId });
  }
}
