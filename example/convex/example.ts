import { mutation, query } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Example: Using the Tenants component with makeTenantsAPI + Convex Auth
 *
 * One destructure exports everything — the recommended DX pattern.
 * Authentication is handled via @convex-dev/auth (email + password).
 */
export const {
  // Organizations
  listOrganizations, getOrganization, getOrganizationBySlug,
  createOrganization, updateOrganization, deleteOrganization,
  // Members
  listMembers, getMember, getCurrentMember, checkPermission,
  addMember, removeMember, updateMemberRole, leaveOrganization,
  // Teams
  listTeams, getTeam, listTeamMembers, isTeamMember,
  createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember,
  // Invitations
  listInvitations, getInvitation, getPendingInvitations,
  inviteMember, acceptInvitation, resendInvitation, cancelInvitation,
} = makeTenantsAPI(components.tenants, {
  auth: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId ?? null;
  },

  getUser: async (ctx, userId) => {
    // Query the Convex Auth users table for user details
    const user = await ctx.db.get(userId as any);
    if (!user) return null;
    return {
      name: (user as any).name ?? (user as any).email ?? "Unknown",
      email: (user as any).email ?? undefined,
    };
  },

  onInvitationCreated: async (_ctx, invitation) => {
    // In a real app, you'd send an invitation email
    console.log(`[Example] Invitation created for ${invitation.email}`);
    console.log(`  Organization: ${invitation.organizationName}`);
    console.log(`  Role: ${invitation.role}`);
    console.log(`  Expires: ${new Date(invitation.expiresAt).toISOString()}`);
  },

  defaultInvitationExpiration: 48 * 60 * 60 * 1000, // 48 hours
});

// ================================
// Strict Auth API (for testing auth enforcement, enrichment, and callbacks)
// Returns null when no identity — unlike the main API which uses getAuthUserId.
// ================================

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

// Strict Auth Exports — queries return safe defaults, mutations throw when unauthenticated
export const strictListOrganizations = strictApi.listOrganizations;
export const strictCreateOrganization = strictApi.createOrganization;
export const strictGetCurrentMember = strictApi.getCurrentMember;
export const strictCheckPermission = strictApi.checkPermission;
export const strictIsTeamMember = strictApi.isTeamMember;
export const strictAddMember = strictApi.addMember;
export const strictCreateTeam = strictApi.createTeam;
export const strictAddTeamMember = strictApi.addTeamMember;
export const strictListMembers = strictApi.listMembers;
export const strictGetMember = strictApi.getMember;
export const strictListTeamMembers = strictApi.listTeamMembers;
export const strictInviteMember = strictApi.inviteMember;
export const strictAcceptInvitation = strictApi.acceptInvitation;
export const strictResendInvitation = strictApi.resendInvitation;
export const strictLeaveOrganization = strictApi.leaveOrganization;
export const strictCancelInvitation = strictApi.cancelInvitation;

// Query to read callback invocations (for testing onInvitationCreated/onInvitationResent)
export const getCallbackLogs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("callbackLog").collect();
  },
});

// ================================
// Direct component API functions (for testing / demo)
// ================================

/**
 * Create organization using authenticated user
 */
export const directCreateOrganization = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.runMutation(components.tenants.mutations.createOrganization, {
      userId,
      name: args.name,
      slug: args.slug,
    });
  },
});

/**
 * List organizations for authenticated user
 */
export const directListOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.runQuery(components.tenants.queries.listUserOrganizations, {
      userId,
    });
  },
});
