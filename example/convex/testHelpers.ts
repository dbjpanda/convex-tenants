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

const strictApi = makeTenantsAPI(components.tenants, {
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },

  getUser: async (_ctx, userId) => ({
    name: `User ${userId}`,
    email: `${userId}@test.com`,
  }),

  onInvitationCreated: async (ctx, invitation) => {
    await ctx.db.insert("callbackLog", {
      type: "invitationCreated",
      data: {
        invitationId: invitation.invitationId,
        email: invitation.email,
        organizationId: invitation.organizationId,
        organizationName: invitation.organizationName,
        role: invitation.role,
        inviterName: invitation.inviterName ?? null,
        expiresAt: invitation.expiresAt,
      },
    });
  },

  onInvitationResent: async (ctx, invitation) => {
    await ctx.db.insert("callbackLog", {
      type: "invitationResent",
      data: {
        invitationId: invitation.invitationId,
        email: invitation.email,
        organizationId: invitation.organizationId,
        organizationName: invitation.organizationName,
        role: invitation.role,
        inviterName: invitation.inviterName ?? null,
        expiresAt: invitation.expiresAt,
      },
    });
  },
});

// Strict Auth Exports — all 30 makeTenantsAPI functions
// Organizations
export const strictListOrganizations = strictApi.listOrganizations;
export const strictGetOrganization = strictApi.getOrganization;
export const strictGetOrganizationBySlug = strictApi.getOrganizationBySlug;
export const strictCreateOrganization = strictApi.createOrganization;
export const strictUpdateOrganization = strictApi.updateOrganization;
export const strictDeleteOrganization = strictApi.deleteOrganization;
// Members
export const strictListMembers = strictApi.listMembers;
export const strictGetMember = strictApi.getMember;
export const strictGetCurrentMember = strictApi.getCurrentMember;
export const strictCheckPermission = strictApi.checkPermission;
export const strictAddMember = strictApi.addMember;
export const strictRemoveMember = strictApi.removeMember;
export const strictUpdateMemberRole = strictApi.updateMemberRole;
export const strictLeaveOrganization = strictApi.leaveOrganization;
// Teams
export const strictListTeams = strictApi.listTeams;
export const strictGetTeam = strictApi.getTeam;
export const strictListTeamMembers = strictApi.listTeamMembers;
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
