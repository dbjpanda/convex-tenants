/**
 * @djpanda/convex-tenants — Core API
 *
 * Re-exports Tenants, makeTenantsAPI, types, and helpers.
 * Authorization (authz) is required — if you don't need a particular
 * permission check, set the operation to `false` in the permissionMap option.
 */

import type { ComponentApi } from "../../component/_generated/component.js";

export type { ComponentApi };

export {
  type OrgRole,
  type InvitationRole,
  type Organization,
  type OrganizationWithRole,
  type Member,
  type MemberStatus,
  type MemberWithUser,
  type Team,
  type TeamMember,
  type Invitation,
  type QueryCtx,
  type MutationCtx,
  orgScope,
  normalizeEmail,
  generateSlug,
} from "./types.js";

export { Tenants } from "./tenants-class.js";
export { makeTenantsAPI } from "./makeTenantsAPI.js";
