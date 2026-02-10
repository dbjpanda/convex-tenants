/**
 * @djpanda/convex-tenants — Client entry point
 *
 * Re-exports everything from the authz defaults and the core API.
 */

// Authorization defaults: AuthzClient, permissions, roles, permission map
export {
  type AuthzClient,
  DEFAULT_TENANTS_PERMISSION_MAP,
  type TenantsPermissionMap,
  TENANTS_PERMISSIONS,
  TENANTS_ROLES,
  TENANTS_REQUIRED_PERMISSIONS,
} from "./authz.js";

// Core API: Tenants class, makeTenantsAPI, types, generateSlug
export {
  type ComponentApi,
  type OrgRole,
  type InvitationRole,
  type Organization,
  type OrganizationWithRole,
  type Member,
  type MemberWithUser,
  type Team,
  type TeamMember,
  type Invitation,
  Tenants,
  makeTenantsAPI,
  generateSlug,
} from "./api/index.js";
