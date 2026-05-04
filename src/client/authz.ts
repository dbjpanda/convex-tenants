/**
 * @djpanda/convex-tenants — Authorization defaults
 *
 * Exports the default permissions, roles, and permission map
 * required by the tenants component. Consumers extend these with
 * app-specific definitions by passing multiple objects to
 * `definePermissions` / `defineRoles` from `@djpanda/convex-authz`.
 */

import { definePermissions, defineRoles } from "@djpanda/convex-authz";

// ============================================================================
// AuthzClient Interface
// ============================================================================

/** Subject or object in a ReBAC relationship. */
export interface RelationEntity {
  type: string;
  id: string;
}

/**
 * Interface for the authz client accepted by the Tenants class.
 *
 * This matches the shape of `Authz` from `@djpanda/convex-authz` v2.
 * Create your instance following the authz component docs and pass it
 * directly — no wrapper needed.
 *
 * **v2 migration:** `IndexedAuthz` was removed — use `Authz` directly.
 * The `Authz` constructor now requires a `tenantId` parameter.
 * ReBAC methods (`addRelation`, `removeRelation`, `hasRelation`) are
 * now on the `Authz` class directly instead of `component.rebac.*`.
 */
export interface AuthzClient {
  /** Check if a user has a permission (returns boolean). */
  can(ctx: any, userId: string, permission: string, scope?: { type: string; id: string }): Promise<boolean>;

  /** Require a permission or throw an error. */
  require(ctx: any, userId: string, permission: string, scope?: { type: string; id: string }): Promise<void>;

  /** Assign a role to a user. */
  assignRole(ctx: any, userId: string, role: string, scope?: { type: string; id: string }, expiresAt?: number, actorId?: string): Promise<string>;

  /** Revoke a role from a user. */
  revokeRole(ctx: any, userId: string, role: string, scope?: { type: string; id: string }, actorId?: string): Promise<boolean>;

  /** Get all roles for a user. */
  getUserRoles(ctx: any, userId: string, scope?: { type: string; id: string }): Promise<any>;

  /** Get effective permissions for a user. */
  getUserPermissions(ctx: any, userId: string, scope?: { type: string; id: string }): Promise<any>;

  /** Check if a user has a specific role (O(1) lookup). */
  hasRole?(ctx: any, userId: string, role: string, scope?: { type: string; id: string }): Promise<boolean>;

  /** Grant a direct permission override. */
  grantPermission(ctx: any, userId: string, permission: string, scope?: { type: string; id: string }, reason?: string, expiresAt?: number, actorId?: string): Promise<string>;

  /** Deny a permission (explicit override). */
  denyPermission(ctx: any, userId: string, permission: string, scope?: { type: string; id: string }, reason?: string, expiresAt?: number, actorId?: string): Promise<string>;

  /** Get audit log entries. */
  getAuditLog(ctx: any, options?: { userId?: string; action?: string; limit?: number; scope?: { type: string; id: string } }): Promise<any>;

  /** Add a ReBAC relationship tuple. */
  addRelation(ctx: any, subject: RelationEntity, relation: string, object: RelationEntity, options?: { caveat?: string; caveatContext?: unknown; createdBy?: string }): Promise<string>;

  /** Remove a ReBAC relationship tuple. */
  removeRelation(ctx: any, subject: RelationEntity, relation: string, object: RelationEntity, actorId?: string): Promise<boolean>;

  /** Check if a ReBAC relationship exists. */
  hasRelation(ctx: any, subject: RelationEntity, relation: string, object: RelationEntity): Promise<boolean>;

  // -- v2 bulk methods --

  /** Check if user has any of the given permissions. */
  canAny?(ctx: any, userId: string, permissions: string[], scope?: { type: string; id: string }): Promise<boolean>;

  /** Assign multiple roles to a user in one call (max 20). */
  assignRoles?(ctx: any, userId: string, roles: Array<{ role: string; scope?: { type: string; id: string }; expiresAt?: number }>, actorId?: string): Promise<{ assigned: number; assignmentIds: string[] }>;

  /** Revoke multiple roles from a user in one call (max 20). */
  revokeRoles?(ctx: any, userId: string, roles: Array<{ role: string; scope?: { type: string; id: string } }>, actorId?: string): Promise<{ revoked: number }>;

  /** Revoke all roles for a user, optionally scoped. */
  revokeAllRoles?(ctx: any, userId: string, scope?: { type: string; id: string }, actorId?: string): Promise<number>;

  /** Remove all roles, overrides, attributes, and optionally relationships for a user. */
  offboardUser?(ctx: any, userId: string, options?: { scope?: { type: string; id: string }; actorId?: string; removeAttributes?: boolean; removeOverrides?: boolean; removeRelationships?: boolean }): Promise<any>;

  /** Full user deprovision — wipe all authz data for a user. */
  deprovisionUser?(ctx: any, userId: string, options?: { actorId?: string; enableAudit?: boolean }): Promise<any>;

  /** Rebuild effective permissions/roles for a user (after schema/role changes). */
  recomputeUser?(ctx: any, userId: string): Promise<void>;

  /**
   * Re-materialize permissions for every user holding the given role.
   * Requires an ActionCtx — pages through assignments and runs one mutation per user.
   * Call after editing `defineRoles(...)` and redeploying so existing members
   * see the updated permission set. Available in @djpanda/convex-authz >= 2.3.0.
   */
  syncRole?(ctx: any, role: string): Promise<{ usersProcessed: number }>;

  /**
   * Re-materialize permissions for every user holding any role in the catalog.
   * Convenience wrapper that iterates `syncRole` across all configured roles.
   * Available in @djpanda/convex-authz >= 2.3.0.
   */
  syncRoles?(ctx: any): Promise<{ rolesProcessed: number; usersProcessed: number }>;
}

// ============================================================================
// Default Permission Map
// ============================================================================

/**
 * Default permission map for tenants operations.
 *
 * Maps each guarded operation to the permission string that is checked.
 * Pass a partial override to the `Tenants` constructor or `makeTenantsAPI`
 * to rename permissions or set `false` to skip the check entirely.
 *
 * @example
 * ```ts
 * import { DEFAULT_TENANTS_PERMISSION_MAP } from "@djpanda/convex-tenants";
 *
 * // Use a coarser "teams:manage" permission for all team mutations
 * const permissionMap = {
 *   ...DEFAULT_TENANTS_PERMISSION_MAP,
 *   addTeamMember: "teams:manage",
 *   removeTeamMember: "teams:manage",
 * };
 * ```
 */
export const DEFAULT_TENANTS_PERMISSION_MAP = {
  createOrganization: false as const, // Optional: set to a permission string to gate org creation (e.g. "organizations:create")
  updateOrganization: "organizations:update",
  deleteOrganization: "organizations:delete",
  addMember: "members:add",
  removeMember: "members:remove",
  updateMemberRole: "members:updateRole",
  suspendMember: "members:suspend",
  unsuspendMember: "members:unsuspend",
  listMembers: "members:list",
  createTeam: "teams:create",
  updateTeam: "teams:update",
  deleteTeam: "teams:delete",
  addTeamMember: "teams:addMember",
  updateTeamMemberRole: "teams:updateMemberRole",
  removeTeamMember: "teams:removeMember",
  listTeams: "teams:list",
  listTeamMembers: "teams:listMembers",
  inviteMember: "invitations:create",
  bulkInviteMembers: "invitations:create",
  bulkAddMembers: "members:add",
  bulkRemoveMembers: "members:remove",
  resendInvitation: "invitations:resend",
  cancelInvitation: "invitations:cancel",
  grantPermission: "permissions:grant",
  denyPermission: "permissions:deny",
  getAuditLog: "permissions:viewLog",
} as const;

/**
 * A mapping from tenants operation names to permission strings (or `false`
 * to skip the check for that operation).
 */
export type TenantsPermissionMap = {
  [K in keyof typeof DEFAULT_TENANTS_PERMISSION_MAP]: string | false;
};

// ============================================================================
// Default Permissions
// ============================================================================

/**
 * Default permissions required by the tenants component.
 *
 * Use these directly or extend with app-specific permissions by
 * passing multiple objects to `definePermissions()`.
 *
 * @example
 * ```ts
 * import { definePermissions } from "@djpanda/convex-authz";
 * import { TENANTS_PERMISSIONS } from "@djpanda/convex-tenants";
 *
 * const permissions = definePermissions(TENANTS_PERMISSIONS, {
 *   billing: { manage: true, view: true },
 * });
 * ```
 */
export const TENANTS_PERMISSIONS = definePermissions({
  organizations: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  members: {
    add: true,
    remove: true,
    updateRole: true,
    suspend: true,
    unsuspend: true,
    list: true,
  },
  teams: {
    create: true,
    update: true,
    delete: true,
    addMember: true,
    updateMemberRole: true,
    removeMember: true,
    list: true, // list teams (names/metadata only)
    listMembers: true, // list members of a team
  },
  invitations: {
    create: true,
    cancel: true,
    resend: true,
    list: true,
  },
  permissions: {
    grant: true,
    deny: true,
    viewLog: true,
  },
});

// ============================================================================
// Default Roles
// ============================================================================

/**
 * Default roles provided by the tenants component.
 *
 * Use these directly or extend with app-specific roles by
 * passing multiple role objects to `defineRoles()`.
 *
 * @example
 * ```ts
 * import { defineRoles } from "@djpanda/convex-authz";
 * import { TENANTS_ROLES } from "@djpanda/convex-tenants";
 *
 * const roles = defineRoles(permissions, TENANTS_ROLES, {
 *   owner: { billing: ["manage", "view"] },     // extend existing role
 *   billing_admin: { billing: ["manage"] },      // add new role
 * });
 * ```
 */
export const TENANTS_ROLES = defineRoles(TENANTS_PERMISSIONS, {
  owner: {
    organizations: ["create", "read", "update", "delete"],
    members: ["add", "remove", "updateRole", "suspend", "unsuspend", "list"],
    teams: [
      "create",
      "update",
      "delete",
      "addMember",
      "updateMemberRole",
      "removeMember",
      "list",
      "listMembers",
    ],
    invitations: ["create", "cancel", "resend", "list"],
    permissions: ["grant", "deny", "viewLog"],
  },
  admin: {
    organizations: ["read", "update"],
    members: ["add", "remove", "suspend", "unsuspend", "list"],
    teams: [
      "create",
      "update",
      "delete",
      "addMember",
      "updateMemberRole",
      "removeMember",
      "list",
      "listMembers",
    ],
    invitations: ["create", "cancel", "resend", "list"],
    permissions: ["grant", "deny", "viewLog"],
  },
  member: {
    organizations: ["read"],
    members: ["list"],
    teams: ["list", "listMembers"],
    invitations: ["list"],
  },
});

/**
 * List of permission strings required by the tenants component.
 *
 * Useful for validation or documentation purposes.
 * Excludes entries set to `false` (e.g. createOrganization when not gated).
 */
export const TENANTS_REQUIRED_PERMISSIONS: readonly string[] = (
  Object.values(DEFAULT_TENANTS_PERMISSION_MAP).filter(
    (p) => typeof p === "string"
  ) as string[]
);
