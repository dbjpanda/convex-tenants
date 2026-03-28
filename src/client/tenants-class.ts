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
  private static readonly DEFAULT_ROLE_HIERARCHY: Record<string, number> = {
    owner: 3,
    admin: 2,
    member: 1,
  };

  private authz: AuthzClient;
  private permissionMap: TenantsPermissionMap;

  constructor(
    private component: ComponentApi,
    private options: {
      authz: AuthzClient;
      creatorRole?: string;
      defaultInvitationExpiration?: number;
      permissionMap?: Partial<TenantsPermissionMap>;
      roleHierarchy?: Record<string, number>;
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

  /** Require a permission for an operation (for use by API layer, e.g. listTeamMembers). */
  async requireOperation(
    ctx: QueryCtx,
    userId: string,
    operation: keyof TenantsPermissionMap,
    scope: { type: string; id: string }
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, operation, scope);
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

  /**
   * Clean up all authz state (roles + permission overrides) for a user in an org scope.
   * Prefers offboardUser (roles + overrides) > revokeAllRoles > individual revokeRole.
   * Team relations are NOT cleaned here — use cleanupTeamRelations separately.
   */
  private async cleanupMemberAuthz(
    ctx: MutationCtx,
    memberUserId: string,
    organizationId: string,
    role: string,
    actorId?: string
  ): Promise<void> {
    if (this.authz.offboardUser) {
      await this.authz.offboardUser(ctx, memberUserId, {
        scope: orgScope(organizationId),
        actorId,
        removeOverrides: true,
        removeRelationships: false,
      });
    } else if (this.authz.revokeAllRoles) {
      await this.authz.revokeAllRoles(ctx, memberUserId, orgScope(organizationId), actorId);
    } else {
      await this.authz.revokeRole(ctx, memberUserId, role, orgScope(organizationId), actorId);
    }
  }

  /**
   * Remove all team ReBAC relations for a user within an organization.
   * Uses listUserTeamMemberships (by_user index) for O(userTeams) instead of O(allTeams).
   * Must be called BEFORE DB deletion (so team membership is still queryable).
   */
  private async cleanupTeamRelations(
    ctx: MutationCtx,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const memberships = await ctx.runQuery(
      this.component.teams.listUserTeamMemberships,
      { organizationId, userId }
    );
    for (const { teamId } of memberships) {
      await this.authz.removeRelation(
        ctx,
        { type: "user", id: userId },
        "member",
        { type: "team", id: teamId },
      );
    }
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
    if (!slug) {
      throw new Error("Organization name must contain at least one alphanumeric character to generate a valid slug");
    }
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
    const creatorRole = this.options.creatorRole ?? "owner";
    await this.authz.revokeRole(ctx, userId, creatorRole, orgScope(organizationId));
    await this.authz.assignRole(ctx, userId, previousRole, orgScope(organizationId), undefined, userId);
    await this.authz.assignRole(ctx, newOwnerUserId, creatorRole, orgScope(organizationId), undefined, userId);
  }

  async deleteOrganization(
    ctx: MutationCtx,
    userId: string,
    organizationId: string
  ): Promise<void> {
    await this.authzRequireOperation(ctx, userId, "deleteOrganization", orgScope(organizationId));
    const membersResult = await this.listMembers(ctx, organizationId);
    const members = Array.isArray(membersResult) ? membersResult : membersResult.page;
    const teamsResult = await this.listTeams(ctx, organizationId);
    const teams = Array.isArray(teamsResult) ? teamsResult : teamsResult.page;
    // Clean up all team relations
    for (const team of teams) {
      const tmsResult = await this.listTeamMembers(ctx, team._id);
      const tms = Array.isArray(tmsResult) ? tmsResult : tmsResult.page;
      for (const tm of tms) {
        await this.authz.removeRelation(
          ctx,
          { type: "user", id: tm.userId },
          "member",
          { type: "team", id: team._id },
        );
      }
    }
    // Clean up all member authz state (roles + overrides)
    for (const member of members) {
      await this.cleanupMemberAuthz(ctx, member.userId, organizationId, member.role, userId);
    }
    // DB delete
    await ctx.runMutation(this.component.organizations.deleteOrganization, { userId, organizationId });
  }

  async listMembers(
    ctx: QueryCtx,
    organizationId: string,
    options?: {
      status?: "active" | "suspended" | "all";
      sortBy?: "role" | "joinedAt" | "createdAt" | "userId";
      sortOrder?: "asc" | "desc";
      paginationOpts?: { numItems: number; cursor: string | null };
    }
  ): Promise<Member[] | { page: Member[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.members.listOrganizationMembers, {
      organizationId,
      status: options?.status,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
      paginationOpts: options?.paginationOpts,
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
    minRole: string
  ): Promise<{ hasPermission: boolean; currentRole: string | null; isSuspended?: boolean }> {
    const member = await this.getMember(ctx, organizationId, userId);
    if (!member) return { hasPermission: false, currentRole: null };
    if (member.status === "suspended") {
      return { hasPermission: false, currentRole: member.role, isSuspended: true };
    }
    const hierarchy = this.options.roleHierarchy ?? Tenants.DEFAULT_ROLE_HIERARCHY;
    const getLevel = (role: string) => hierarchy[role] ?? 0;
    const hasPermission = getLevel(member.role) >= getLevel(minRole);
    return { hasPermission, currentRole: member.role };
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
    // Clean up team relations BEFORE DB delete (so isTeamMember still works)
    await this.cleanupTeamRelations(ctx, organizationId, memberUserId);
    // DB delete
    await ctx.runMutation(this.component.members.removeMember, {
      userId,
      organizationId,
      memberUserId,
    });
    // Clean up authz roles + overrides
    if (member) {
      await this.cleanupMemberAuthz(ctx, memberUserId, organizationId, member.role, userId);
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
    // Collect team memberships BEFORE the mutation deletes the DB rows.
    // Uses listUserTeamMemberships (by_user index) — O(userTeams) per user, not O(allTeams).
    const teamMembershipsByUser: Record<string, string[]> = {};
    for (const memberUserId of memberUserIds) {
      const member = await this.getMember(ctx, organizationId, memberUserId);
      if (member) rolesByUser[memberUserId] = member.role;
      const memberships = await ctx.runQuery(
        this.component.teams.listUserTeamMemberships,
        { organizationId, userId: memberUserId }
      );
      if (memberships.length > 0) {
        teamMembershipsByUser[memberUserId] = memberships.map((m: { teamId: string }) => m.teamId);
      }
    }
    const result = await ctx.runMutation(this.component.members.bulkRemoveMembers, {
      userId,
      organizationId,
      memberUserIds,
    });
    for (const memberUserId of result.success) {
      const role = rolesByUser[memberUserId];
      if (role) {
        await this.cleanupMemberAuthz(ctx, memberUserId, organizationId, role, userId);
      }
      const teamIds = teamMembershipsByUser[memberUserId] ?? [];
      for (const teamId of teamIds) {
        await this.authz.removeRelation(
          ctx,
          { type: "user", id: memberUserId },
          "member",
          { type: "team", id: teamId },
        );
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
      const membersResult = await this.listMembers(ctx, organizationId, { status: "active" });
      const members = Array.isArray(membersResult) ? membersResult : membersResult.page;
      const ownerCount = members.filter((m: Member) => m.role === creatorRole).length;
      if (ownerCount <= 1) {
        throw new Error("Cannot leave: you are the last owner. Transfer ownership first.");
      }
    }
    // Clean up team relations BEFORE DB delete
    await this.cleanupTeamRelations(ctx, organizationId, userId);
    // DB delete
    await ctx.runMutation(this.component.members.leaveOrganization, { userId, organizationId });
    // Clean up authz roles + overrides
    await this.cleanupMemberAuthz(ctx, userId, organizationId, member.role, userId);
  }

  async listTeams(
    ctx: QueryCtx,
    organizationId: string,
    options?: {
      parentTeamId?: string | null;
      sortBy?: "name" | "createdAt" | "slug";
      sortOrder?: "asc" | "desc";
      paginationOpts?: { numItems: number; cursor: string | null };
    }
  ): Promise<Team[] | { page: Team[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.teams.listTeams, {
      organizationId,
      parentTeamId: options?.parentTeamId,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
      paginationOpts: options?.paginationOpts,
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
    const tmsResult = await this.listTeamMembers(ctx, teamId);
    const tms = Array.isArray(tmsResult) ? tmsResult : tmsResult.page;
    for (const tm of tms) {
      await this.authz.removeRelation(
        ctx,
        { type: "user", id: tm.userId },
        "member",
        { type: "team", id: teamId },
      );
    }
    await ctx.runMutation(this.component.teams.deleteTeam, { userId, teamId });
  }

  async listTeamMembers(
    ctx: QueryCtx,
    teamId: string,
    options?: {
      sortBy?: "userId" | "role" | "createdAt";
      sortOrder?: "asc" | "desc";
      paginationOpts?: { numItems: number; cursor: string | null };
    }
  ): Promise<TeamMember[] | { page: TeamMember[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.teams.listTeamMembers, {
      teamId,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
      paginationOpts: options?.paginationOpts,
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
    await this.authz.addRelation(
      ctx,
      { type: "user", id: memberUserId },
      "member",
      { type: "team", id: teamId },
    );
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
    await this.authz.removeRelation(
      ctx,
      { type: "user", id: memberUserId },
      "member",
      { type: "team", id: teamId },
    );
  }

  async isTeamMember(ctx: QueryCtx, teamId: string, userId: string): Promise<boolean> {
    return await this.authz.hasRelation(
      ctx,
      { type: "user", id: userId },
      "member",
      { type: "team", id: teamId },
    );
  }

  async can(
    ctx: QueryCtx,
    userId: string,
    permission: string,
    organizationId: string
  ): Promise<boolean> {
    return await this.authz.can(ctx, userId, permission, orgScope(organizationId));
  }

  async canAny(
    ctx: QueryCtx,
    userId: string,
    permissions: string[],
    organizationId: string
  ): Promise<boolean> {
    if (this.authz.canAny) {
      return await this.authz.canAny(ctx, userId, permissions, orgScope(organizationId));
    }
    // Fallback: check each permission individually
    for (const perm of permissions) {
      if (await this.authz.can(ctx, userId, perm, orgScope(organizationId))) {
        return true;
      }
    }
    return false;
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

  async hasRole(
    ctx: QueryCtx,
    userId: string,
    role: string,
    organizationId: string
  ): Promise<boolean> {
    if (this.authz.hasRole) {
      return await this.authz.hasRole(ctx, userId, role, orgScope(organizationId));
    }
    // Fallback: get all roles and check
    const roles = await this.authz.getUserRoles(ctx, userId, orgScope(organizationId));
    return Array.isArray(roles) && roles.some((r: any) => (typeof r === "string" ? r : r.role) === role);
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
    const callerLimit = options?.limit ?? 50;
    const result = await this.authz.getAuditLog(ctx, { ...options, limit: callerLimit, scope });
    // If authz honored the scope filter, return directly.
    // If it returned unscoped results (older authz), filter client-side.
    if (Array.isArray(result)) {
      const matchesScope = (entry: { scope?: { type?: string; id?: string } }) =>
        entry.scope?.type === scope.type && entry.scope?.id === scope.id;
      const allMatch = result.length === 0 || result.every(matchesScope);
      return allMatch ? result.slice(0, callerLimit) : result.filter(matchesScope).slice(0, callerLimit);
    }
    return result;
  }

  async recomputeUser(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    targetUserId: string
  ): Promise<void> {
    // Require permissions:grant (admin-level operation)
    await this.authzRequireOperation(ctx, userId, "grantPermission", orgScope(organizationId));
    if (this.authz.recomputeUser) {
      await this.authz.recomputeUser(ctx, targetUserId);
    }
  }

  async listInvitations(
    ctx: QueryCtx,
    organizationId: string,
    options?: {
      sortBy?: "inviteeIdentifier" | "expiresAt" | "createdAt";
      sortOrder?: "asc" | "desc";
      paginationOpts?: { numItems: number; cursor: string | null };
    }
  ): Promise<Invitation[] | { page: Invitation[]; isDone: boolean; continueCursor: string }> {
    return await ctx.runQuery(this.component.invitations.listInvitations, {
      organizationId,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder,
      paginationOpts: options?.paginationOpts,
    });
  }

  async countInvitations(ctx: QueryCtx, organizationId: string, options?: { status?: "pending" | "accepted" | "cancelled" | "expired" | "all" }): Promise<number> {
    return await ctx.runQuery(this.component.invitations.countInvitations, { organizationId, ...(options?.status ? { status: options.status } : {}) } as { organizationId: string });
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
    options?: { acceptingUserIdentifier?: string; skipIdentifierCheck?: boolean }
  ): Promise<void> {
    const invitation = await this.getInvitation(ctx, invitationId);
    await ctx.runMutation(this.component.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId,
      acceptingUserIdentifier: options?.acceptingUserIdentifier,
      skipIdentifierCheck: options?.skipIdentifierCheck,
    } as { invitationId: string; acceptingUserId: string; acceptingUserIdentifier?: string });
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
        await this.authz.addRelation(
          ctx,
          { type: "user", id: acceptingUserId },
          "member",
          { type: "team", id: invitation.teamId },
        );
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
