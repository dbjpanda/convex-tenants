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

// Step 3: Create the Authz client
export const authz = new Authz(components.authz, { permissions, roles });
