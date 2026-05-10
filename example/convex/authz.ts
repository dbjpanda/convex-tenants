/**
 * Authorization configuration.
 *
 * Uses the default permissions and roles exported by @djpanda/convex-tenants,
 * extended with app-specific permissions via definePermissions / defineRoles
 * from @djpanda/convex-authz.
 *
 * To customize, simply add additional objects as extra arguments.
 */
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { TENANTS_PERMISSIONS, TENANTS_ROLES } from "@djpanda/convex-tenants";
import { components } from "./_generated/api.js";

// Step 1: Define permissions — pass tenants defaults + app-specific resources
const permissions = definePermissions(TENANTS_PERMISSIONS, {
  // Add app-specific resources here:
  // billing: {
  //   manage: true,
  //   view: true,
  //   export: true,
  // },
  // projects: {
  //   create: true,
  //   read: true,
  //   update: true,
  //   delete: true,
  // },
});

// Step 2: Define roles — pass tenants defaults + app-specific extensions
const roles = defineRoles(permissions, TENANTS_ROLES, {
  // Extend existing roles with app-specific permissions:
  // owner: {
  //   billing: ["manage", "view", "export"],
  //   projects: ["create", "read", "update", "delete"],
  // },
  // admin: {
  //   billing: ["view"],
  //   projects: ["create", "read", "update"],
  // },
  // member: {
  //   projects: ["read"],
  // },

  // Add custom roles:
  // billing_admin: {
  //   organizations: ["read"],
  //   billing: ["manage", "view", "export"],
  // },
});

// Step 3: Create the Authz client.
// `tenantId` is required by authz; pass any constant (e.g. your app name).
// Multi-tenant isolation is handled by tenants — every org-scoped authz
// operation is routed through `withTenant(organizationId)` so authz tables
// (custom roles, user attributes, permission overrides, relationships,
// audit log) partition correctly per organization. The constructor's
// `tenantId` only governs the bare-instance pre-org-creation permission
// check (e.g. gating `createOrganization`).
export const authz = new Authz(components.authz, { permissions, roles, tenantId: "my-app" });

// IMPORTANT: After editing the `roles` definition above and redeploying,
// existing users still carry the OLD materialized permissions. Re-materialize
// them by running the prebuilt action exposed by makeTenantsAPI:
//
//   npx convex run tenants:syncRoles
//   npx convex run tenants:syncRole '{"role":"member"}'  # per-role variant
//
// Both are idempotent. Requires @djpanda/convex-authz >= 2.3.0.
