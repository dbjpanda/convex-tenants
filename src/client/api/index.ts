/**
 * @djpanda/convex-tenants — Core API
 *
 * Re-exports Tenants, makeTenantsAPI, types, and helpers.
 * Authorization (authz) is required — if you don't need a particular
 * permission check, set the operation to `false` in the permissionMap option.
 */

import type { ComponentApi } from "../../component/_generated/component.js";

export type { ComponentApi };

export type {
  OrgRole,
  InvitationRole,
  Organization,
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
