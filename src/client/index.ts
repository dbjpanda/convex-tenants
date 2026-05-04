/**
 * @djpanda/convex-tenants — Client entry point
 *
 * Re-exports everything from the authz defaults and the core API.
 */

// Authorization defaults: AuthzClient, permissions, roles, permission map
export {
  type AuthzClient,
  type RelationEntity,
  DEFAULT_TENANTS_PERMISSION_MAP,
  type TenantsPermissionMap,
  TENANTS_PERMISSIONS,
  TENANTS_ROLES,
  TENANTS_REQUIRED_PERMISSIONS,
} from "./authz.js";

// Re-export authz utility types so consumers don't need a second import
// when they want to type their own AuthzClient<P, R> annotations.
export type {
  PermissionDefinition,
  RoleDefinition,
  PermissionArg,
} from "@djpanda/convex-authz";

// Core API: Tenants class, makeTenantsAPI, types, helpers
export type { ComponentApi } from "../component/_generated/component.js";
export type {
  OrgRole,
  InvitationRole,
  Organization,
  OrganizationSettings,
  OrganizationWithRole,
  Member,
  MemberStatus,
  MemberWithUser,
  Team,
  TeamMember,
  Invitation,
  QueryCtx,
  MutationCtx,
} from "./types.js";

export { orgScope, normalizeEmail, generateSlug } from "./helpers.js";
export { Tenants } from "./tenants-class.js";
export { makeTenantsAPI } from "./makeTenantsAPI.js";
