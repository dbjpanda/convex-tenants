/**
 * Test-only Convex exports.
 *
 * These use `ctx.auth.getUserIdentity()` instead of Convex Auth's
 * `getAuthUserId`, because `convex-test` simulates auth via `withIdentity()`
 * which only populates `ctx.auth` — not the full Convex Auth session flow.
 */
import { mutation, query } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { v } from "convex/values";
import { authz } from "./authz.js";

const strictApi = makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },

  getUser: async (_ctx, userId) => ({
    name: `User ${userId}`,
    email: `${userId}@test.com`,
  }),

  validateInvitationAccept: async (_ctx, { invitation, acceptingUserIdentifier }) => {
    const normalize = (s: string) => s.trim().toLowerCase();
    if (normalize(acceptingUserIdentifier) !== normalize(invitation.inviteeIdentifier)) {
      return { allowed: false, reason: "Invitation identifier does not match authenticated user" };
    }
    return { allowed: true };
  },

  // Organization callbacks
  onBeforeCreateOrganization: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeCreateOrganization", data });
  },
  onOrganizationCreated: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "organizationCreated", data });
  },
  onOrganizationDeleted: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "organizationDeleted", data });
  },

  // Member callbacks
  onMemberAdded: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "memberAdded", data });
  },
  onMemberRemoved: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "memberRemoved", data });
  },
  onMemberRoleChanged: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "memberRoleChanged", data });
  },
  onMemberLeft: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "memberLeft", data });
  },

  // Team callbacks
  onTeamCreated: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "teamCreated", data });
  },
  onTeamDeleted: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "teamDeleted", data });
  },
  onTeamMemberAdded: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "teamMemberAdded", data });
  },
  onTeamMemberRemoved: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "teamMemberRemoved", data });
  },

  // Invitation callbacks
  onInvitationCreated: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "invitationCreated", data });
  },
  onInvitationResent: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "invitationResent", data });
  },
  onInvitationAccepted: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "invitationAccepted", data });
  },
});

// API with onBeforeCreateOrganization that throws (for testing validation block)
const apiWithOnBeforeThrow = makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },
  getUser: async (_ctx, userId) => ({ name: `User ${userId}`, email: `${userId}@test.com` }),
  onBeforeCreateOrganization: async () => {
    throw new Error("Blocked by onBeforeCreateOrganization");
  },
});

// API with limits (for testing maxOrganizations, maxMembers, maxTeams)
const apiWithLimits = makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },
  getUser: async (_ctx, userId) => ({ name: `User ${userId}`, email: `${userId}@test.com` }),
  maxOrganizations: 1,
  maxMembers: 2,
  maxTeams: 1,
});

// API with generateUploadUrl (for testing generateLogoUploadUrl mutation)
const apiWithUploadUrl = makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },
  getUser: async (_ctx, userId) => ({ name: `User ${userId}`, email: `${userId}@test.com` }),
  generateUploadUrl: async () => "https://fake-upload-url.test/convex-upload",
});

// Strict Auth Exports — all 30 makeTenantsAPI functions
// Organizations
export const strictListOrganizations = strictApi.listOrganizations;
export const strictGetOrganization = strictApi.getOrganization;
export const strictGetOrganizationBySlug = strictApi.getOrganizationBySlug;
export const strictCreateOrganization = strictApi.createOrganization;
export const strictCreateOrganizationBlockedByOnBefore = apiWithOnBeforeThrow.createOrganization;
export const strictCreateOrganizationWithLimits = apiWithLimits.createOrganization;
export const strictAddMemberWithLimits = apiWithLimits.addMember;
export const strictCreateTeamWithLimits = apiWithLimits.createTeam;
export const strictListOrganizationsWithLimits = apiWithLimits.listOrganizations;
export const strictGenerateLogoUploadUrl = apiWithUploadUrl.generateLogoUploadUrl;
export const strictUpdateOrganization = strictApi.updateOrganization;
export const strictTransferOwnership = strictApi.transferOwnership;
export const strictDeleteOrganization = strictApi.deleteOrganization;
// Members
export const strictListMembers = strictApi.listMembers;
export const strictCountMembers = strictApi.countMembers;
export const strictGetMember = strictApi.getMember;
export const strictGetCurrentMember = strictApi.getCurrentMember;
export const strictGetCurrentUserEmail = strictApi.getCurrentUserEmail;
export const strictAddMember = strictApi.addMember;
export const strictRemoveMember = strictApi.removeMember;
export const strictUpdateMemberRole = strictApi.updateMemberRole;
export const strictSuspendMember = strictApi.suspendMember;
export const strictUnsuspendMember = strictApi.unsuspendMember;
export const strictLeaveOrganization = strictApi.leaveOrganization;
export const strictBulkAddMembers = strictApi.bulkAddMembers;
export const strictBulkRemoveMembers = strictApi.bulkRemoveMembers;
// Teams
export const strictListTeams = strictApi.listTeams;
export const strictListTeamsAsTree = strictApi.listTeamsAsTree;
export const strictCountTeams = strictApi.countTeams;
export const strictGetTeam = strictApi.getTeam;
export const strictListTeamMembers = strictApi.listTeamMembers;
export const strictIsTeamMember = strictApi.isTeamMember;
export const strictCreateTeam = strictApi.createTeam;
export const strictUpdateTeam = strictApi.updateTeam;
export const strictDeleteTeam = strictApi.deleteTeam;
export const strictAddTeamMember = strictApi.addTeamMember;
export const strictUpdateTeamMemberRole = strictApi.updateTeamMemberRole;
export const strictRemoveTeamMember = strictApi.removeTeamMember;
// Invitations
export const strictListInvitations = strictApi.listInvitations;
export const strictBulkInviteMembers = strictApi.bulkInviteMembers;
export const strictCountInvitations = strictApi.countInvitations;
export const strictGetInvitation = strictApi.getInvitation;
export const strictGetPendingInvitations = strictApi.getPendingInvitations;
export const strictInviteMember = strictApi.inviteMember;
export const strictAcceptInvitation = strictApi.acceptInvitation;
export const strictResendInvitation = strictApi.resendInvitation;
export const strictCancelInvitation = strictApi.cancelInvitation;

// Authorization
export const strictCheckPermission = strictApi.checkPermission;
export const strictCheckAnyPermission = strictApi.checkAnyPermission;
export const strictGetUserPermissions = strictApi.getUserPermissions;
export const strictGetUserRoles = strictApi.getUserRoles;
export const strictHasRole = strictApi.hasRole;
export const strictGrantPermission = strictApi.grantPermission;
export const strictDenyPermission = strictApi.denyPermission;
export const strictGetAuditLog = strictApi.getAuditLog;
export const strictRecomputeUser = strictApi.recomputeUser;

// Query to read callback invocations (for testing onInvitationCreated/onInvitationResent)
export const getCallbackLogs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("callbackLog").collect();
  },
});

// ================================
// API with validateInvitationCreate (rejects non-email identifiers)
// ================================

const apiWithValidateCreate = makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },
  getUser: async (_ctx, userId) => ({ name: `User ${userId}`, email: `${userId}@test.com` }),
  validateInvitationCreate: async (_ctx, data) => {
    if (!data.inviteeIdentifier.includes("@")) {
      return { allowed: false, reason: "Only email identifiers are allowed" };
    }
    return { allowed: true };
  },
});

export const validateCreateInviteMember = apiWithValidateCreate.inviteMember;
export const validateCreateBulkInviteMembers = apiWithValidateCreate.bulkInviteMembers;
export const validateCreateOrg = apiWithValidateCreate.createOrganization;

// ================================
// API with validateInvitationAccept (rejects mismatched domains)
// ================================

const apiWithValidateAccept = makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },
  getUser: async (_ctx, userId) => ({ name: `User ${userId}`, email: `${userId}@test.com` }),
  validateInvitationAccept: async (_ctx, { invitation, acceptingUserIdentifier }) => {
    const invitedDomain = invitation.inviteeIdentifier.split("@")[1]?.toLowerCase();
    const userDomain = acceptingUserIdentifier.split("@")[1]?.toLowerCase();
    if (invitedDomain !== userDomain) {
      return { allowed: false, reason: "Email domain does not match invitation" };
    }
    return { allowed: true };
  },
});

export const validateAcceptInviteMember = apiWithValidateAccept.inviteMember;
export const validateAcceptCreateOrg = apiWithValidateAccept.createOrganization;
export const validateAcceptAddMember = apiWithValidateAccept.addMember;
export const validateAcceptAcceptInvitation = apiWithValidateAccept.acceptInvitation;
export const validateAcceptGetInvitation = apiWithValidateAccept.getInvitation;

// ================================
// API with permissionMap overrides
// ================================

const apiWithPermissionMapOverrides = makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },
  getUser: async (_ctx, userId) => ({ name: `User ${userId}`, email: `${userId}@test.com` }),
  permissionMap: {
    deleteOrganization: false,  // Skip authz check for delete
    createTeam: "organizations:read",  // Use a different permission
  },
});

export const permMapCreateOrg = apiWithPermissionMapOverrides.createOrganization;
export const permMapDeleteOrg = apiWithPermissionMapOverrides.deleteOrganization;
export const permMapAddMember = apiWithPermissionMapOverrides.addMember;
export const permMapCreateTeam = apiWithPermissionMapOverrides.createTeam;
export const permMapListMembers = apiWithPermissionMapOverrides.listMembers;

// ================================
// API with ALL onBefore hooks (log to callbackLog)
// ================================

const apiWithAllOnBefore = makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },
  getUser: async (_ctx, userId) => ({ name: `User ${userId}`, email: `${userId}@test.com` }),
  onBeforeCreateOrganization: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeCreateOrganization", data });
  },
  onBeforeUpdateOrganization: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeUpdateOrganization", data });
  },
  onBeforeDeleteOrganization: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeDeleteOrganization", data });
  },
  onBeforeAddMember: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeAddMember", data });
  },
  onBeforeRemoveMember: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeRemoveMember", data });
  },
  onBeforeUpdateMemberRole: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeUpdateMemberRole", data });
  },
  onBeforeLeaveOrganization: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeLeaveOrganization", data });
  },
  onBeforeCreateTeam: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeCreateTeam", data });
  },
  onBeforeUpdateTeam: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeUpdateTeam", data });
  },
  onBeforeDeleteTeam: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeDeleteTeam", data });
  },
  onBeforeInviteMember: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "onBeforeInviteMember", data });
  },
});

export const onBeforeCreateOrg = apiWithAllOnBefore.createOrganization;
export const onBeforeUpdateOrg = apiWithAllOnBefore.updateOrganization;
export const onBeforeDeleteOrg = apiWithAllOnBefore.deleteOrganization;
export const onBeforeAddMember = apiWithAllOnBefore.addMember;
export const onBeforeRemoveMember = apiWithAllOnBefore.removeMember;
export const onBeforeUpdateMemberRole = apiWithAllOnBefore.updateMemberRole;
export const onBeforeLeaveOrg = apiWithAllOnBefore.leaveOrganization;
export const onBeforeCreateTeam = apiWithAllOnBefore.createTeam;
export const onBeforeUpdateTeam = apiWithAllOnBefore.updateTeam;
export const onBeforeDeleteTeam = apiWithAllOnBefore.deleteTeam;
export const onBeforeInviteMember = apiWithAllOnBefore.inviteMember;
export const onBeforeListMembers = apiWithAllOnBefore.listMembers;
export const onBeforeListTeams = apiWithAllOnBefore.listTeams;
export const onBeforeGetCurrentMember = apiWithAllOnBefore.getCurrentMember;

// ================================
// Direct component API (for testing the lower-level component calls)
// ================================

export const directCreateOrganization = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.runMutation(components.tenants.organizations.createOrganization, {
      userId: identity.subject,
      name: args.name,
      slug: args.slug,
    });
  },
});

/**
 * Test helper: check if a ReBAC relation exists in the authz component.
 * Used by rebac-relations.test.ts to verify addRelation/removeRelation calls.
 */
export const hasAuthzRelation = query({
  args: {
    subjectType: v.string(),
    subjectId: v.string(),
    relation: v.string(),
    objectType: v.string(),
    objectId: v.string(),
  },
  handler: async (ctx, args) => {
    return await authz.hasRelation(
      ctx,
      { type: args.subjectType, id: args.subjectId },
      args.relation,
      { type: args.objectType, id: args.objectId },
    );
  },
});

export const directListOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(components.tenants.organizations.listUserOrganizations, {
      userId: identity.subject,
    });
  },
});
