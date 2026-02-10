/**
 * @djpanda/convex-tenants — Core API
 *
 * The `Tenants` class and `makeTenantsAPI` factory. Authorization (authz)
 * is required — if you don't need a particular permission check, set the
 * operation to `false` in the `permissionMap` option.
 */

import type {
  Auth,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
import type { AuthzClient } from "./authz.js";
import {
  DEFAULT_TENANTS_PERMISSION_MAP,
  type TenantsPermissionMap,
} from "./authz.js";

// Re-export ComponentApi for consumers
export type { ComponentApi };

// ============================================================================
// Types
// ============================================================================

/**
 * Role types for organization members.
 * Flexible: developer defines available roles in authz.ts.
 */
export type OrgRole = string;

/**
 * Role types for invitations.
 * Flexible: developer defines available roles in authz.ts.
 */
export type InvitationRole = string;

/**
 * Organization object type
 */
export interface Organization {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  logo: string | null;
  metadata?: Record<string, unknown>;
  ownerId: string;
}

/**
 * Organization with role info
 */
export interface OrganizationWithRole extends Organization {
  role: OrgRole;
}

/**
 * Member object type
 */
export interface Member {
  _id: string;
  _creationTime: number;
  organizationId: string;
  userId: string;
  role: OrgRole;
}

/**
 * Member with user info enrichment
 */
export interface MemberWithUser extends Member {
  user?: {
    name?: string;
    email?: string;
  } | null;
}

/**
 * Team object type
 */
export interface Team {
  _id: string;
  _creationTime: number;
  name: string;
  organizationId: string;
  description: string | null;
}

/**
 * Team member object type
 */
export interface TeamMember {
  _id: string;
  _creationTime: number;
  teamId: string;
  userId: string;
}

/**
 * Invitation object type
 */
export interface Invitation {
  _id: string;
  _creationTime: number;
  organizationId: string;
  email: string;
  role: InvitationRole;
  teamId: string | null;
  inviterId: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expiresAt: number;
  isExpired: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/** Create an organization scope object for authz. */
function orgScope(organizationId: string): { type: string; id: string } {
  return { type: "organization", id: organizationId };
}

/** Normalize email for strict invitation comparisons. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Generate a URL-safe slug from a name.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================================
// Context Types
// ============================================================================

type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;

// ============================================================================
// Tenants Class
// ============================================================================

/**
 * Tenants class for direct component interaction.
 *
 * Requires an `Authz` instance (from `@djpanda/convex-authz`). The class:
 * - Checks permissions before mutations (via configurable permission map)
 * - Syncs role assignments / revocations (via `authz.assignRole()` / `authz.revokeRole()`)
 * - Syncs team membership relations (via ReBAC)
 *
 * Permission strings checked by each operation are configurable via the
 * `permissionMap` option. Defaults are defined in
 * {@link DEFAULT_TENANTS_PERMISSION_MAP}. Set an operation to `false` to
 * skip the permission check entirely.
 *
 * @example
 * ```ts
 * import { components } from "./_generated/api";
 * import { Tenants } from "@djpanda/convex-tenants";
 * import { authz } from "./authz";
 *
 * // With default permission strings
 * const tenants = new Tenants(components.tenants, { authz });
 *
 * // With custom permission mapping
 * const tenants = new Tenants(components.tenants, {
 *   authz,
 *   permissionMap: {
 *     addTeamMember: "teams:manage",
 *     removeTeamMember: "teams:manage",
 *     createTeam: false, // skip check — anyone can create teams
 *   },
 * });
 * ```
 */
export class Tenants {
  private authz: AuthzClient;
  private permissionMap: TenantsPermissionMap;

  constructor(
    private component: ComponentApi,
    private options: {
      /**
       * An `Authz` (or `IndexedAuthz`) instance from `@djpanda/convex-authz`.
       *
       * Define permissions and roles in a separate file (e.g. `convex/authz.ts`)
       * following the authz component's documented pattern:
       * ```ts
       * import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
       * import { TENANTS_PERMISSIONS, TENANTS_ROLES } from "@djpanda/convex-tenants";
       * const permissions = definePermissions(TENANTS_PERMISSIONS);
       * const roles = defineRoles(permissions, TENANTS_ROLES);
       * export const authz = new Authz(components.authz, { permissions, roles });
       * ```
       */
      authz: AuthzClient;
      /**
       * The role to assign when a user creates an organization.
       * Defaults to `"owner"`. Must match a role defined in your authz config.
       */
      creatorRole?: string;
      defaultInvitationExpiration?: number; // Default: 48 hours
      /**
       * Override the default permission strings used by each operation.
       *
       * Keys are operation names (e.g. `"addTeamMember"`). Values are
       * either a permission string (e.g. `"teams:manage"`) or `false`
       * to skip the check entirely.
       *
       * Defaults to {@link DEFAULT_TENANTS_PERMISSION_MAP}.
       */
      permissionMap?: Partial<TenantsPermissionMap>;
    }
  ) {
    this.authz = options.authz;
    this.permissionMap = {
      ...DEFAULT_TENANTS_PERMISSION_MAP,
      ...options.permissionMap,
    };
  }

  // ================================
  // Authorization Helpers (internal)
  // ================================

  /**
   * Check a permission for a specific tenants operation.
   *
   * The actual permission string is resolved from the permission map.
   * If the operation is mapped to `false`, the check is skipped.
   */
  private async authzRequireOperation(
    ctx: QueryCtx,
    userId: string,
    operation: keyof TenantsPermissionMap,
    scope: { type: string; id: string }
  ): Promise<void> {
    const permission = this.permissionMap[operation];
    if (permission === false) return; // Explicitly disabled
    await this.authz.require(ctx, userId, permission, scope);
  }

  /**
   * Restrict direct permission overrides to org/team scopes in the same org.
   */
  private async resolvePermissionScope(
    ctx: QueryCtx,
    organizationId: string,
    scope?: { type: string; id: string }
  ): Promise<{ type: string; id: string }> {
    if (!scope) {
      return orgScope(organizationId);
    }

    if (scope.type === "organization") {
      if (scope.id !== organizationId) {
        throw new Error("Permission scope organization mismatch");
      }
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

  // ================================
  // Organization Operations
  // ================================

  async listOrganizations(
    ctx: QueryCtx,
    userId: string
  ): Promise<OrganizationWithRole[]> {
    return await ctx.runQuery(this.component.queries.listUserOrganizations, {
      userId,
    });
  }

  async getOrganization(
    ctx: QueryCtx,
    organizationId: string
  ): Promise<Organization | null> {
    return await ctx.runQuery(this.component.queries.getOrganization, {
      organizationId,
    });
  }

  async getOrganizationBySlug(
    ctx: QueryCtx,
    slug: string
  ): Promise<Organization | null> {
    return await ctx.runQuery(this.component.queries.getOrganizationBySlug, {
      slug,
    });
  }

  /**
   * Create a new organization and assign the creator role.
   *
   * Note: `createOrganization` is intentionally not gated by the permission
   * map because there is no existing organization to scope the check against.
   * To restrict org creation, gate it at the `makeTenantsAPI` level or in
   * your own mutation wrapper.
   */
  async createOrganization(
    ctx: MutationCtx,
    userId: string,
    name: string,
    options?: {
      slug?: string;
      logo?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const slug = options?.slug ?? generateSlug(name);
    const creatorRole = this.options.creatorRole ?? "owner";
    const orgId = await ctx.runMutation(
      this.component.mutations.createOrganization,
      {
        userId,
        name,
        slug,
        logo: options?.logo,
        metadata: options?.metadata,
        creatorRole,
      }
    );

    // Sync: assign creator role in authz
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
    }
  ): Promise<void> {
    await this.authzRequireOperation(
      ctx, userId, "updateOrganization", orgScope(organizationId)
    );

    await ctx.runMutation(this.component.mutations.updateOrganization, {
      userId,
      organizationId,
      ...updates,
    });
  }

  async deleteOrganization(
    ctx: MutationCtx,
    userId: string,
    organizationId: string
  ): Promise<void> {
    await this.authzRequireOperation(
      ctx, userId, "deleteOrganization", orgScope(organizationId)
    );

    // Pre-query data for authz cleanup
    const members = await this.listMembers(ctx, organizationId);
    const teams = await this.listTeams(ctx, organizationId);

    // Revoke all roles
    for (const member of members) {
      await this.authz.revokeRole(
        ctx, member.userId, member.role, orgScope(organizationId)
      );
    }

    // Remove all team membership relations
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

    // Delete organization (cascading CRUD)
    await ctx.runMutation(this.component.mutations.deleteOrganization, {
      userId,
      organizationId,
    });
  }

  // ================================
  // Member Operations
  // ================================

  async listMembers(ctx: QueryCtx, organizationId: string): Promise<Member[]> {
    return await ctx.runQuery(
      this.component.queries.listOrganizationMembers,
      { organizationId }
    );
  }

  async getMember(
    ctx: QueryCtx,
    organizationId: string,
    userId: string
  ): Promise<Member | null> {
    return await ctx.runQuery(this.component.queries.getMember, {
      organizationId,
      userId,
    });
  }

  async addMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string,
    role: string
  ): Promise<void> {
    await this.authzRequireOperation(
      ctx, userId, "addMember", orgScope(organizationId)
    );

    await ctx.runMutation(this.component.mutations.addMember, {
      userId,
      organizationId,
      memberUserId,
      role,
    });

    // Sync: assign role in authz
    await this.authz.assignRole(
      ctx, memberUserId, role, orgScope(organizationId), undefined, userId
    );
  }

  async removeMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string
  ): Promise<void> {
    await this.authzRequireOperation(
      ctx, userId, "removeMember", orgScope(organizationId)
    );

    // Pre-query for authz cleanup
    const member = await this.getMember(ctx, organizationId, memberUserId);

    if (member) {
      // Remove team membership relations
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

    // Remove member (cascading team cleanup)
    await ctx.runMutation(this.component.mutations.removeMember, {
      userId,
      organizationId,
      memberUserId,
    });

    // Sync: revoke role in authz
    if (member) {
      await this.authz.revokeRole(
        ctx, memberUserId, member.role, orgScope(organizationId)
      );
    }
  }

  async updateMemberRole(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    memberUserId: string,
    role: string
  ): Promise<void> {
    await this.authzRequireOperation(
      ctx, userId, "updateMemberRole", orgScope(organizationId)
    );

    // Pre-query old role
    const member = await this.getMember(ctx, organizationId, memberUserId);
    const previousRole = member?.role;

    await ctx.runMutation(this.component.mutations.updateMemberRole, {
      userId,
      organizationId,
      memberUserId,
      role,
    });

    // Sync: revoke old, assign new
    if (previousRole) {
      await this.authz.revokeRole(
        ctx, memberUserId, previousRole, orgScope(organizationId)
      );
    }
    await this.authz.assignRole(
      ctx, memberUserId, role, orgScope(organizationId), undefined, userId
    );
  }

  async leaveOrganization(
    ctx: MutationCtx,
    userId: string,
    organizationId: string
  ): Promise<void> {
    // Pre-query for validation + authz cleanup
    const member = await this.getMember(ctx, organizationId, userId);
    if (!member) {
      throw new Error("Not a member of this organization");
    }

    // Prevent last-owner from leaving
    const creatorRole = this.options.creatorRole ?? "owner";
    if (member.role === creatorRole) {
      const members = await this.listMembers(ctx, organizationId);
      const ownerCount = members.filter((m) => m.role === creatorRole).length;
      if (ownerCount <= 1) {
        throw new Error(
          "Cannot leave: you are the last owner. Transfer ownership first."
        );
      }
    }

    // Remove team membership relations
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

    await ctx.runMutation(this.component.mutations.leaveOrganization, {
      userId,
      organizationId,
    });

    // Sync: revoke role in authz
    await this.authz.revokeRole(
      ctx, userId, member.role, orgScope(organizationId)
    );
  }

  // ================================
  // Team Operations
  // ================================

  async listTeams(ctx: QueryCtx, organizationId: string): Promise<Team[]> {
    return await ctx.runQuery(this.component.queries.listTeams, {
      organizationId,
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
    description?: string
  ): Promise<string> {
    await this.authzRequireOperation(
      ctx, userId, "createTeam", orgScope(organizationId)
    );

    return await ctx.runMutation(this.component.mutations.createTeam, {
      userId,
      organizationId,
      name,
      description,
    });
  }

  async updateTeam(
    ctx: MutationCtx,
    userId: string,
    teamId: string,
    updates: {
      name?: string;
      description?: string | null;
    }
  ): Promise<void> {
    const team = await this.getTeam(ctx, teamId);
    if (!team) {
      throw new Error("Team not found");
    }
    await this.authzRequireOperation(
      ctx, userId, "updateTeam", orgScope(team.organizationId)
    );

    await ctx.runMutation(this.component.mutations.updateTeam, {
      userId,
      teamId,
      ...updates,
    });
  }

  async deleteTeam(
    ctx: MutationCtx,
    userId: string,
    teamId: string
  ): Promise<void> {
    const team = await this.getTeam(ctx, teamId);
    if (!team) {
      throw new Error("Team not found");
    }
    await this.authzRequireOperation(
      ctx, userId, "deleteTeam", orgScope(team.organizationId)
    );

    // Pre-query for authz cleanup
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

    await ctx.runMutation(this.component.mutations.deleteTeam, {
      userId,
      teamId,
    });
  }

  async listTeamMembers(
    ctx: QueryCtx,
    teamId: string
  ): Promise<TeamMember[]> {
    return await ctx.runQuery(this.component.queries.listTeamMembers, {
      teamId,
    });
  }

  async addTeamMember(
    ctx: MutationCtx,
    userId: string,
    teamId: string,
    memberUserId: string
  ): Promise<void> {
    const team = await this.getTeam(ctx, teamId);
    if (!team) {
      throw new Error("Team not found");
    }
    await this.authzRequireOperation(
      ctx, userId, "addTeamMember", orgScope(team.organizationId)
    );

    await ctx.runMutation(this.component.mutations.addTeamMember, {
      userId,
      teamId,
      memberUserId,
    });

    // Sync: add team relation in authz
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
    if (!team) {
      throw new Error("Team not found");
    }
    await this.authzRequireOperation(
      ctx, userId, "removeTeamMember", orgScope(team.organizationId)
    );

    await ctx.runMutation(this.component.mutations.removeTeamMember, {
      userId,
      teamId,
      memberUserId,
    });

    // Sync: remove team relation in authz
    await ctx.runMutation(this.authz.component.rebac.removeRelation, {
      subjectType: "user",
      subjectId: memberUserId,
      relation: "member",
      objectType: "team",
      objectId: teamId,
    });
  }

  async isTeamMember(
    ctx: QueryCtx,
    teamId: string,
    userId: string
  ): Promise<boolean> {
    return await ctx.runQuery(this.component.queries.isTeamMember, {
      teamId,
      userId,
    });
  }

  // ================================
  // Authorization (Public API)
  // ================================

  /** Check if a user has a specific permission in an organization. */
  async can(
    ctx: QueryCtx,
    userId: string,
    permission: string,
    organizationId: string
  ): Promise<boolean> {
    return await this.authz.can(ctx, userId, permission, orgScope(organizationId));
  }

  /** Require a specific permission or throw. */
  async require(
    ctx: QueryCtx,
    userId: string,
    permission: string,
    organizationId: string
  ): Promise<void> {
    await this.authz.require(ctx, userId, permission, orgScope(organizationId));
  }

  /** Get effective permissions for a user in an organization. */
  async getUserPermissions(
    ctx: QueryCtx,
    userId: string,
    organizationId: string
  ) {
    return await this.authz.getUserPermissions(
      ctx, userId, orgScope(organizationId)
    );
  }

  /** Get roles assigned to a user, optionally scoped to an organization. */
  async getUserRoles(
    ctx: QueryCtx,
    userId: string,
    organizationId?: string
  ) {
    return await this.authz.getUserRoles(
      ctx, userId, organizationId ? orgScope(organizationId) : undefined
    );
  }

  /**
   * Grant a direct permission to a user.
   *
   * Requires `permissions:grant` in the specified organization (configurable
   * via the permission map).
   */
  async grantPermission(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    targetUserId: string,
    permission: string,
    options?: {
      scope?: { type: string; id: string };
      reason?: string;
      expiresAt?: number;
    }
  ): Promise<string> {
    await this.authzRequireOperation(
      ctx, userId, "grantPermission", orgScope(organizationId)
    );
    const validatedScope = await this.resolvePermissionScope(
      ctx,
      organizationId,
      options?.scope
    );
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

  /**
   * Deny a permission for a user.
   *
   * Requires `permissions:deny` in the specified organization (configurable
   * via the permission map).
   */
  async denyPermission(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    targetUserId: string,
    permission: string,
    options?: {
      scope?: { type: string; id: string };
      reason?: string;
      expiresAt?: number;
    }
  ): Promise<string> {
    await this.authzRequireOperation(
      ctx, userId, "denyPermission", orgScope(organizationId)
    );
    const validatedScope = await this.resolvePermissionScope(
      ctx,
      organizationId,
      options?.scope
    );
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

  /** Get audit log entries. */
  async getAuditLog(
    ctx: QueryCtx,
    userId: string,
    organizationId: string,
    options?: {
      userId?: string;
      action?: string;
      limit?: number;
    }
  ) {
    await this.authzRequireOperation(
      ctx,
      userId,
      "getAuditLog",
      orgScope(organizationId)
    );
    return await this.authz.getAuditLog(ctx, options);
  }

  // ================================
  // Invitation Operations
  // ================================

  async listInvitations(
    ctx: QueryCtx,
    organizationId: string
  ): Promise<Invitation[]> {
    return await ctx.runQuery(this.component.queries.listInvitations, {
      organizationId,
    });
  }

  async getInvitation(
    ctx: QueryCtx,
    invitationId: string
  ): Promise<Invitation | null> {
    return await ctx.runQuery(this.component.queries.getInvitation, {
      invitationId,
    });
  }

  async getPendingInvitations(
    ctx: QueryCtx,
    email: string
  ): Promise<Array<Omit<Invitation, "status">>> {
    return await ctx.runQuery(
      this.component.queries.getPendingInvitationsForEmail,
      { email }
    );
  }

  async inviteMember(
    ctx: MutationCtx,
    userId: string,
    organizationId: string,
    email: string,
    role: string,
    options?: {
      teamId?: string;
      expiresAt?: number;
    }
  ): Promise<{ invitationId: string; email: string; expiresAt: number }> {
    await this.authzRequireOperation(
      ctx, userId, "inviteMember", orgScope(organizationId)
    );

    const expiresAt =
      options?.expiresAt ??
      Date.now() +
        (this.options.defaultInvitationExpiration ?? 48 * 60 * 60 * 1000);

    return await ctx.runMutation(this.component.mutations.inviteMember, {
      userId,
      organizationId,
      email,
      role,
      teamId: options?.teamId,
      expiresAt,
    });
  }

  async acceptInvitation(
    ctx: MutationCtx,
    invitationId: string,
    acceptingUserId: string,
    options?: { acceptingEmail?: string }
  ): Promise<void> {
    // Pre-query invitation for authz sync
    const invitation = await this.getInvitation(ctx, invitationId);

    await ctx.runMutation(this.component.mutations.acceptInvitation, {
      invitationId,
      acceptingUserId,
      acceptingEmail: options?.acceptingEmail,
    });

    // Sync: assign role in authz
    if (invitation) {
      await this.authz.assignRole(
        ctx,
        acceptingUserId,
        invitation.role,
        orgScope(invitation.organizationId),
        undefined,
        invitation.inviterId
      );

      // Sync: add team relation if applicable
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
    // Resolve org scope from invitation for permission check
    const invitation = await this.getInvitation(ctx, invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }
    await this.authzRequireOperation(
      ctx, userId, "resendInvitation", orgScope(invitation.organizationId)
    );

    return await ctx.runMutation(this.component.mutations.resendInvitation, {
      userId,
      invitationId,
    });
  }

  async cancelInvitation(
    ctx: MutationCtx,
    userId: string,
    invitationId: string
  ): Promise<void> {
    // Resolve org scope from invitation for permission check
    const invitation = await this.getInvitation(ctx, invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }
    await this.authzRequireOperation(
      ctx, userId, "cancelInvitation", orgScope(invitation.organizationId)
    );

    await ctx.runMutation(this.component.mutations.cancelInvitation, {
      userId,
      invitationId,
    });
  }
}

// ============================================================================
// API Factory
// ============================================================================

/**
 * Create an API for tenants that can be re-exported from your app.
 *
 * Requires an `Authz` instance (from `@djpanda/convex-authz`).
 *
 * Use the exported `TENANTS_PERMISSIONS` and `TENANTS_ROLES` as defaults
 * and extend them by passing extra objects to `definePermissions` /
 * `defineRoles` from `@djpanda/convex-authz`.
 *
 * Permission strings are configurable via the `permissionMap` option
 * (defaults to {@link DEFAULT_TENANTS_PERMISSION_MAP}).
 *
 * @example
 * ```ts
 * // convex/authz.ts — use exported defaults + app-specific extensions
 * import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
 * import { TENANTS_PERMISSIONS, TENANTS_ROLES } from "@djpanda/convex-tenants";
 * import { components } from "./_generated/api";
 *
 * const permissions = definePermissions(TENANTS_PERMISSIONS, {
 *   billing: { manage: true, view: true },
 * });
 *
 * const roles = defineRoles(permissions, TENANTS_ROLES, {
 *   owner: { billing: ["manage", "view"] },
 *   billing_admin: { organizations: ["read"], billing: ["manage", "view"] },
 * });
 *
 * export const authz = new Authz(components.authz, { permissions, roles });
 * ```
 *
 * ```ts
 * // convex/tenants.ts — wire everything together
 * import { makeTenantsAPI } from "@djpanda/convex-tenants";
 * import { components } from "./_generated/api";
 * import { getAuthUserId } from "@convex-dev/auth/server";
 * import { authz } from "./authz";
 *
 * export const {
 *   createOrganization, updateOrganization, deleteOrganization,
 *   addMember, removeMember, updateMemberRole,
 *   // ... other exports
 *   checkPermission, getUserPermissions, getUserRoles,
 * } = makeTenantsAPI(components.tenants, {
 *   authz,
 *   creatorRole: "owner",
 *   auth: async (ctx) => await getAuthUserId(ctx),
 * });
 * ```
 */
export function makeTenantsAPI(
  component: ComponentApi,
  options: {
    /** Authentication function that returns the current user's ID. */
    auth: (ctx: { auth: Auth }) => Promise<string | null>;

    /**
     * An `Authz` (or `IndexedAuthz`) instance from `@djpanda/convex-authz`.
     * Mutations are gated by permission checks and roles/relations are
     * synced to authz automatically.
     */
    authz: AuthzClient;

    /**
     * The role to assign when a user creates an organization.
     * Defaults to `"owner"`. Must match a role defined in your authz config.
     */
    creatorRole?: string;

    /**
     * Override the default permission strings used by each operation.
     *
     * Defaults to {@link DEFAULT_TENANTS_PERMISSION_MAP}.
     */
    permissionMap?: Partial<TenantsPermissionMap>;

    /** Optional function to get user details for member enrichment. */
    getUser?: (
      ctx: { db: any },
      userId: string
    ) => Promise<{ name?: string; email?: string } | null>;

    // ================================
    // Organization Callbacks
    // ================================

    onOrganizationCreated?: (
      ctx: any,
      data: { organizationId: string; name: string; slug: string; ownerId: string }
    ) => Promise<void>;

    onOrganizationDeleted?: (
      ctx: any,
      data: { organizationId: string; name: string; deletedBy: string }
    ) => Promise<void>;

    // ================================
    // Member Callbacks
    // ================================

    onMemberAdded?: (
      ctx: any,
      data: { organizationId: string; userId: string; role: OrgRole; addedBy: string }
    ) => Promise<void>;

    onMemberRemoved?: (
      ctx: any,
      data: { organizationId: string; userId: string; removedBy: string }
    ) => Promise<void>;

    onMemberRoleChanged?: (
      ctx: any,
      data: { organizationId: string; userId: string; oldRole: OrgRole; newRole: OrgRole; changedBy: string }
    ) => Promise<void>;

    onMemberLeft?: (
      ctx: any,
      data: { organizationId: string; userId: string }
    ) => Promise<void>;

    // ================================
    // Team Callbacks
    // ================================

    onTeamCreated?: (
      ctx: any,
      data: { teamId: string; name: string; organizationId: string; createdBy: string }
    ) => Promise<void>;

    onTeamDeleted?: (
      ctx: any,
      data: { teamId: string; name: string; organizationId: string; deletedBy: string }
    ) => Promise<void>;

    onTeamMemberAdded?: (
      ctx: any,
      data: { teamId: string; userId: string; addedBy: string }
    ) => Promise<void>;

    onTeamMemberRemoved?: (
      ctx: any,
      data: { teamId: string; userId: string; removedBy: string }
    ) => Promise<void>;

    // ================================
    // Invitation Callbacks
    // ================================

    onInvitationCreated?: (
      ctx: any,
      invitation: { invitationId: string; email: string; organizationId: string; organizationName: string; role: InvitationRole; inviterName?: string; expiresAt: number }
    ) => Promise<void>;

    onInvitationResent?: (
      ctx: any,
      invitation: { invitationId: string; email: string; organizationId: string; organizationName: string; role: InvitationRole; inviterName?: string; expiresAt: number }
    ) => Promise<void>;

    onInvitationAccepted?: (
      ctx: any,
      data: { invitationId: string; organizationId: string; organizationName: string; userId: string; role: InvitationRole; email: string }
    ) => Promise<void>;

    defaultInvitationExpiration?: number;
  }
) {
  const tenants = new Tenants(component, {
    authz: options.authz,
    creatorRole: options.creatorRole,
    defaultInvitationExpiration: options.defaultInvitationExpiration,
    permissionMap: options.permissionMap,
  });

  async function requireAuth(ctx: { auth: Auth }): Promise<string> {
    const userId = await options.auth(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return userId;
  }

  /** Verify the user is a member of the organization. */
  async function requireMembership(
    ctx: QueryCtx,
    userId: string,
    organizationId: string
  ): Promise<Member> {
    const member = await tenants.getMember(ctx, organizationId, userId);
    if (!member) {
      throw new Error("Not a member of this organization");
    }
    return member;
  }

  return {
    // ================================
    // Organization Queries
    // ================================
    listOrganizations: queryGeneric({
      args: {},
      handler: async (ctx) => {
        const userId = await requireAuth(ctx);
        return await tenants.listOrganizations(ctx, userId);
      },
    }),

    getOrganization: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.getOrganization(ctx, args.organizationId);
      },
    }),

    getOrganizationBySlug: queryGeneric({
      args: { slug: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const org = await tenants.getOrganizationBySlug(ctx, args.slug);
        if (org) {
          await requireMembership(ctx, userId, org._id);
        }
        return org;
      },
    }),

    // ================================
    // Organization Mutations
    // ================================
    createOrganization: mutationGeneric({
      args: {
        name: v.string(),
        slug: v.optional(v.string()),
        logo: v.optional(v.string()),
        metadata: v.optional(v.any()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const organizationId = await tenants.createOrganization(
          ctx, userId, args.name,
          { slug: args.slug, logo: args.logo, metadata: args.metadata }
        );

        if (options.onOrganizationCreated) {
          const org = await tenants.getOrganization(ctx, organizationId);
          await options.onOrganizationCreated(ctx, {
            organizationId,
            name: org?.name ?? args.name,
            slug: org?.slug ?? args.slug ?? "",
            ownerId: userId,
          });
        }

        return organizationId;
      },
    }),

    updateOrganization: mutationGeneric({
      args: {
        organizationId: v.string(),
        name: v.optional(v.string()),
        slug: v.optional(v.string()),
        logo: v.optional(v.union(v.null(), v.string())),
        metadata: v.optional(v.any()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.updateOrganization(ctx, userId, args.organizationId, {
          name: args.name, slug: args.slug, logo: args.logo, metadata: args.metadata,
        });
      },
    }),

    deleteOrganization: mutationGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);

        let orgName = "Unknown";
        if (options.onOrganizationDeleted) {
          const org = await tenants.getOrganization(ctx, args.organizationId);
          orgName = org?.name ?? "Unknown";
        }

        await tenants.deleteOrganization(ctx, userId, args.organizationId);

        if (options.onOrganizationDeleted) {
          await options.onOrganizationDeleted(ctx, {
            organizationId: args.organizationId, name: orgName, deletedBy: userId,
          });
        }
      },
    }),

    // ================================
    // Member Queries
    // ================================
    listMembers: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);

        const members = await tenants.listMembers(ctx, args.organizationId);
        if (options.getUser) {
          return await Promise.all(
            members.map(async (member) => ({
              ...member, user: await options.getUser!(ctx, member.userId),
            }))
          );
        }
        return members;
      },
    }),

    getMember: queryGeneric({
      args: { organizationId: v.string(), userId: v.string() },
      handler: async (ctx, args) => {
        const callerId = await requireAuth(ctx);
        await requireMembership(ctx, callerId, args.organizationId);

        const member = await tenants.getMember(ctx, args.organizationId, args.userId);
        if (member && options.getUser) {
          return { ...member, user: await options.getUser(ctx, member.userId) };
        }
        return member;
      },
    }),

    getCurrentMember: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.getMember(ctx, args.organizationId, userId);
      },
    }),

    // ================================
    // Member Mutations
    // ================================
    addMember: mutationGeneric({
      args: { organizationId: v.string(), memberUserId: v.string(), role: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.addMember(ctx, userId, args.organizationId, args.memberUserId, args.role);
        if (options.onMemberAdded) {
          await options.onMemberAdded(ctx, {
            organizationId: args.organizationId, userId: args.memberUserId, role: args.role, addedBy: userId,
          });
        }
      },
    }),

    removeMember: mutationGeneric({
      args: { organizationId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.removeMember(ctx, userId, args.organizationId, args.memberUserId);
        if (options.onMemberRemoved) {
          await options.onMemberRemoved(ctx, {
            organizationId: args.organizationId, userId: args.memberUserId, removedBy: userId,
          });
        }
      },
    }),

    updateMemberRole: mutationGeneric({
      args: { organizationId: v.string(), memberUserId: v.string(), role: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        let oldRole: OrgRole | null = null;
        if (options.onMemberRoleChanged) {
          const member = await tenants.getMember(ctx, args.organizationId, args.memberUserId);
          oldRole = member?.role ?? null;
        }
        await tenants.updateMemberRole(ctx, userId, args.organizationId, args.memberUserId, args.role);
        if (options.onMemberRoleChanged && oldRole) {
          await options.onMemberRoleChanged(ctx, {
            organizationId: args.organizationId, userId: args.memberUserId,
            oldRole, newRole: args.role, changedBy: userId,
          });
        }
      },
    }),

    leaveOrganization: mutationGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.leaveOrganization(ctx, userId, args.organizationId);
        if (options.onMemberLeft) {
          await options.onMemberLeft(ctx, { organizationId: args.organizationId, userId });
        }
      },
    }),

    // ================================
    // Team Queries
    // ================================
    listTeams: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.listTeams(ctx, args.organizationId);
      },
    }),

    getTeam: queryGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const team = await tenants.getTeam(ctx, args.teamId);
        if (team) {
          await requireMembership(ctx, userId, team.organizationId);
        }
        return team;
      },
    }),

    listTeamMembers: queryGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const team = await tenants.getTeam(ctx, args.teamId);
        if (team) {
          await requireMembership(ctx, userId, team.organizationId);
        }

        const members = await tenants.listTeamMembers(ctx, args.teamId);
        if (options.getUser) {
          return await Promise.all(
            members.map(async (member) => ({
              ...member, user: await options.getUser!(ctx, member.userId),
            }))
          );
        }
        return members;
      },
    }),

    isTeamMember: queryGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.isTeamMember(ctx, args.teamId, userId);
      },
    }),

    // ================================
    // Team Mutations
    // ================================
    createTeam: mutationGeneric({
      args: { organizationId: v.string(), name: v.string(), description: v.optional(v.string()) },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const teamId = await tenants.createTeam(ctx, userId, args.organizationId, args.name, args.description);
        if (options.onTeamCreated) {
          await options.onTeamCreated(ctx, {
            teamId, name: args.name, organizationId: args.organizationId, createdBy: userId,
          });
        }
        return teamId;
      },
    }),

    updateTeam: mutationGeneric({
      args: { teamId: v.string(), name: v.optional(v.string()), description: v.optional(v.union(v.null(), v.string())) },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.updateTeam(ctx, userId, args.teamId, { name: args.name, description: args.description });
      },
    }),

    deleteTeam: mutationGeneric({
      args: { teamId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        let teamName = "Unknown";
        let teamOrgId = "";
        if (options.onTeamDeleted) {
          const team = await tenants.getTeam(ctx, args.teamId);
          teamName = team?.name ?? "Unknown";
          teamOrgId = team?.organizationId ?? "";
        }
        await tenants.deleteTeam(ctx, userId, args.teamId);
        if (options.onTeamDeleted) {
          await options.onTeamDeleted(ctx, {
            teamId: args.teamId, name: teamName, organizationId: teamOrgId, deletedBy: userId,
          });
        }
      },
    }),

    addTeamMember: mutationGeneric({
      args: { teamId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.addTeamMember(ctx, userId, args.teamId, args.memberUserId);
        if (options.onTeamMemberAdded) {
          await options.onTeamMemberAdded(ctx, { teamId: args.teamId, userId: args.memberUserId, addedBy: userId });
        }
      },
    }),

    removeTeamMember: mutationGeneric({
      args: { teamId: v.string(), memberUserId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.removeTeamMember(ctx, userId, args.teamId, args.memberUserId);
        if (options.onTeamMemberRemoved) {
          await options.onTeamMemberRemoved(ctx, { teamId: args.teamId, userId: args.memberUserId, removedBy: userId });
        }
      },
    }),

    // ================================
    // Invitation Queries
    // ================================
    listInvitations: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await requireMembership(ctx, userId, args.organizationId);
        return await tenants.listInvitations(ctx, args.organizationId);
      },
    }),

    getInvitation: queryGeneric({
      args: { invitationId: v.string() },
      handler: async (ctx, args) => {
        // Invitation ID is a capability token — auth is optional to
        // support the pre-login acceptance flow, but if the user IS
        // authenticated we still return the invitation (needed for UI).
        return await tenants.getInvitation(ctx, args.invitationId);
      },
    }),

    getPendingInvitations: queryGeneric({
      args: { email: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        if (!options.getUser) {
          throw new Error(
            "getUser callback with email is required for getPendingInvitations"
          );
        }

        const user = await options.getUser(ctx, userId);
        const userEmail = user?.email;
        if (!userEmail) {
          throw new Error(
            "Authenticated user email is required for getPendingInvitations"
          );
        }

        if (normalizeEmail(args.email) !== normalizeEmail(userEmail)) {
          throw new Error("Cannot query invitations for another email");
        }

        return await tenants.getPendingInvitations(ctx, normalizeEmail(userEmail));
      },
    }),

    // ================================
    // Invitation Mutations
    // ================================
    inviteMember: mutationGeneric({
      args: { organizationId: v.string(), email: v.string(), role: v.string(), teamId: v.optional(v.string()) },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const result = await tenants.inviteMember(ctx, userId, args.organizationId, args.email, args.role, { teamId: args.teamId });
        if (options.onInvitationCreated) {
          const org = await tenants.getOrganization(ctx, args.organizationId);
          let inviterName: string | undefined;
          if (options.getUser) {
            const user = await options.getUser(ctx, userId);
            inviterName = user?.name;
          }
          await options.onInvitationCreated(ctx, {
            invitationId: result.invitationId, email: result.email,
            organizationId: args.organizationId, organizationName: org?.name ?? "Unknown",
            role: args.role, inviterName, expiresAt: result.expiresAt,
          });
        }
        return result;
      },
    }),

    acceptInvitation: mutationGeneric({
      args: { invitationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        if (!options.getUser) {
          throw new Error(
            "getUser callback with email is required for invitation acceptance"
          );
        }

        const user = await options.getUser(ctx, userId);
        const acceptingEmail = user?.email;
        if (!acceptingEmail) {
          throw new Error(
            "Authenticated user email is required for invitation acceptance"
          );
        }

        let invitationData: { organizationId: string; role: InvitationRole; email: string } | null = null;
        if (options.onInvitationAccepted) {
          const inv = await tenants.getInvitation(ctx, args.invitationId);
          if (inv) {
            invitationData = { organizationId: inv.organizationId, role: inv.role, email: inv.email };
          }
        }
        await tenants.acceptInvitation(ctx, args.invitationId, userId, {
          acceptingEmail,
        });
        if (options.onInvitationAccepted && invitationData) {
          const org = await tenants.getOrganization(ctx, invitationData.organizationId);
          await options.onInvitationAccepted(ctx, {
            invitationId: args.invitationId, organizationId: invitationData.organizationId,
            organizationName: org?.name ?? "Unknown", userId, role: invitationData.role, email: invitationData.email,
          });
        }
      },
    }),

    resendInvitation: mutationGeneric({
      args: { invitationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const result = await tenants.resendInvitation(ctx, userId, args.invitationId);
        if (options.onInvitationResent) {
          const invitation = await tenants.getInvitation(ctx, args.invitationId);
          if (invitation) {
            const org = await tenants.getOrganization(ctx, invitation.organizationId);
            let inviterName: string | undefined;
            if (options.getUser) {
              const user = await options.getUser(ctx, invitation.inviterId);
              inviterName = user?.name;
            }
            await options.onInvitationResent(ctx, {
              invitationId: result.invitationId, email: result.email,
              organizationId: invitation.organizationId, organizationName: org?.name ?? "Unknown",
              role: invitation.role, inviterName, expiresAt: invitation.expiresAt,
            });
          }
        }
        return result;
      },
    }),

    cancelInvitation: mutationGeneric({
      args: { invitationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        await tenants.cancelInvitation(ctx, userId, args.invitationId);
      },
    }),

    // ================================
    // Authorization (requires authz component)
    // ================================

    checkPermission: queryGeneric({
      args: { organizationId: v.string(), permission: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        const allowed = await tenants.can(ctx, userId, args.permission, args.organizationId);
        return { allowed, reason: allowed ? "Allowed" : "Permission denied" };
      },
    }),

    getUserPermissions: queryGeneric({
      args: { organizationId: v.string() },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.getUserPermissions(ctx, userId, args.organizationId);
      },
    }),

    getUserRoles: queryGeneric({
      args: { organizationId: v.optional(v.string()) },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.getUserRoles(ctx, userId, args.organizationId);
      },
    }),

    grantPermission: mutationGeneric({
      args: {
        organizationId: v.string(),
        targetUserId: v.string(),
        permission: v.string(),
        scope: v.optional(v.object({ type: v.string(), id: v.string() })),
        reason: v.optional(v.string()),
        expiresAt: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.grantPermission(
          ctx, userId, args.organizationId, args.targetUserId, args.permission,
          { scope: args.scope, reason: args.reason, expiresAt: args.expiresAt }
        );
      },
    }),

    denyPermission: mutationGeneric({
      args: {
        organizationId: v.string(),
        targetUserId: v.string(),
        permission: v.string(),
        scope: v.optional(v.object({ type: v.string(), id: v.string() })),
        reason: v.optional(v.string()),
        expiresAt: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.denyPermission(
          ctx, userId, args.organizationId, args.targetUserId, args.permission,
          { scope: args.scope, reason: args.reason, expiresAt: args.expiresAt }
        );
      },
    }),

    getAuditLog: queryGeneric({
      args: {
        organizationId: v.string(),
        userId: v.optional(v.string()),
        action: v.optional(v.string()),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        const userId = await requireAuth(ctx);
        return await tenants.getAuditLog(
          ctx,
          userId,
          args.organizationId,
          { userId: args.userId, action: args.action, limit: args.limit }
        );
      },
    }),
  };
}
