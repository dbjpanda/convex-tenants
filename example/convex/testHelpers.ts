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

  // Organization callbacks
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

// Strict Auth Exports — all 30 makeTenantsAPI functions
// Organizations
export const strictListOrganizations = strictApi.listOrganizations;
export const strictGetOrganization = strictApi.getOrganization;
export const strictGetOrganizationBySlug = strictApi.getOrganizationBySlug;
export const strictCreateOrganization = strictApi.createOrganization;
export const strictUpdateOrganization = strictApi.updateOrganization;
export const strictTransferOwnership = strictApi.transferOwnership;
export const strictDeleteOrganization = strictApi.deleteOrganization;
// Members
export const strictListMembers = strictApi.listMembers;
export const strictGetMember = strictApi.getMember;
export const strictGetCurrentMember = strictApi.getCurrentMember;
export const strictAddMember = strictApi.addMember;
export const strictRemoveMember = strictApi.removeMember;
export const strictUpdateMemberRole = strictApi.updateMemberRole;
export const strictLeaveOrganization = strictApi.leaveOrganization;
// Teams
export const strictListTeams = strictApi.listTeams;
export const strictGetTeam = strictApi.getTeam;
export const strictListTeamMembers = strictApi.listTeamMembers;
export const strictListTeamMembersPaginated = strictApi.listTeamMembersPaginated;
export const strictIsTeamMember = strictApi.isTeamMember;
export const strictCreateTeam = strictApi.createTeam;
export const strictUpdateTeam = strictApi.updateTeam;
export const strictDeleteTeam = strictApi.deleteTeam;
export const strictAddTeamMember = strictApi.addTeamMember;
export const strictRemoveTeamMember = strictApi.removeTeamMember;
// Invitations
export const strictListInvitations = strictApi.listInvitations;
export const strictGetInvitation = strictApi.getInvitation;
export const strictGetPendingInvitations = strictApi.getPendingInvitations;
export const strictInviteMember = strictApi.inviteMember;
export const strictAcceptInvitation = strictApi.acceptInvitation;
export const strictResendInvitation = strictApi.resendInvitation;
export const strictCancelInvitation = strictApi.cancelInvitation;

// Authorization
export const strictCheckPermission = strictApi.checkPermission;
export const strictGetUserPermissions = strictApi.getUserPermissions;
export const strictGetUserRoles = strictApi.getUserRoles;
export const strictGrantPermission = strictApi.grantPermission;
export const strictDenyPermission = strictApi.denyPermission;
export const strictGetAuditLog = strictApi.getAuditLog;

// Query to read callback invocations (for testing onInvitationCreated/onInvitationResent)
export const getCallbackLogs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("callbackLog").collect();
  },
});

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

    return await ctx.runMutation(components.tenants.mutations.createOrganization, {
      userId: identity.subject,
      name: args.name,
      slug: args.slug,
    });
  },
});

export const directListOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(components.tenants.queries.listUserOrganizations, {
      userId: identity.subject,
    });
  },
});
