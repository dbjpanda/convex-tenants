/**
 * @djpanda/convex-tenants — Authorization defaults
 *
 * Exports the default permissions, roles, and permission map
 * required by the tenants component. Consumers extend these with
 * app-specific definitions by passing multiple objects to
 * `definePermissions` / `defineRoles` from `@djpanda/convex-authz`.
 */

import type { ComponentApi as AuthzComponentApi } from "@djpanda/convex-authz";
import { definePermissions, defineRoles } from "@djpanda/convex-authz";

// ============================================================================
// AuthzClient Interface
// ============================================================================

/**
 * Interface for the authz client accepted by the Tenants class.
 *
 * This matches the shape of both `Authz` and `IndexedAuthz` from
 * `@djpanda/convex-authz`. Create your instance following the authz
 * component docs and pass it directly — no wrapper needed.
 */
export interface AuthzClient {
  /** The underlying authz component API (used for ReBAC operations). */
  component: AuthzComponentApi;

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

  /** Grant a direct permission override. */
  grantPermission(ctx: any, userId: string, permission: string, scope?: { type: string; id: string }, reason?: string, expiresAt?: number, actorId?: string): Promise<string>;

  /** Deny a permission (explicit override). */
  denyPermission(ctx: any, userId: string, permission: string, scope?: { type: string; id: string }, reason?: string, expiresAt?: number, actorId?: string): Promise<string>;

  /** Get audit log entries. */
  getAuditLog(ctx: any, options?: { userId?: string; action?: string; limit?: number }): Promise<any>;
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
  updateOrganization: "organizations:update",
  deleteOrganization: "organizations:delete",
  addMember: "members:add",
  removeMember: "members:remove",
  updateMemberRole: "members:updateRole",
  createTeam: "teams:create",
  updateTeam: "teams:update",
  deleteTeam: "teams:delete",
  addTeamMember: "teams:addMember",
  removeTeamMember: "teams:removeMember",
  inviteMember: "invitations:create",
  resendInvitation: "invitations:resend",
  cancelInvitation: "invitations:cancel",
  grantPermission: "permissions:grant",
  denyPermission: "permissions:deny",
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
    list: true,
  },
  teams: {
    create: true,
    update: true,
    delete: true,
    addMember: true,
    removeMember: true,
    list: true,
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
    members: ["add", "remove", "updateRole", "list"],
    teams: [
      "create",
      "update",
      "delete",
      "addMember",
      "removeMember",
      "list",
    ],
    invitations: ["create", "cancel", "resend", "list"],
    permissions: ["grant", "deny"],
  },
  admin: {
    organizations: ["read", "update"],
    members: ["add", "remove", "list"],
    teams: [
      "create",
      "update",
      "delete",
      "addMember",
      "removeMember",
      "list",
    ],
    invitations: ["create", "cancel", "resend", "list"],
  },
  member: {
    organizations: ["read"],
    members: ["list"],
    teams: ["list"],
    invitations: ["list"],
  },
});

/**
 * List of permission strings required by the tenants component.
 *
 * Useful for validation or documentation purposes.
 */
export const TENANTS_REQUIRED_PERMISSIONS: readonly string[] = Object.values(
  DEFAULT_TENANTS_PERMISSION_MAP
);
