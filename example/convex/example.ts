import { mutation, query } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { v } from "convex/values";
import type { Auth } from "convex/server";

/**
 * Demo user ID - used when no authentication is configured
 * In a real app, you would use proper authentication
 */
const DEMO_USER_ID = "demo-user-123";

/**
 * Example: Using the Tenants component with makeTenantsAPI
 *
 * One destructure exports everything — the recommended DX pattern.
 * In a real app you'd use `getAuthUserId` from `@convex-dev/auth/server`
 * instead of the demo fallback.
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
    return await getAuthUserId(ctx);
  },

  getUser: async (_ctx, userId) => {
    // In a real app, you'd fetch user data from your users table
    if (userId === DEMO_USER_ID) {
      return {
        name: "Demo User",
        email: "demo@example.com",
      };
    }
    return {
      name: `User ${userId.slice(0, 6)}`,
      email: `${userId.slice(0, 6)}@example.com`,
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
// Returns null when no identity — unlike the demo API which falls back to DEMO_USER_ID.
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
// Demo API functions that use demo user
// ================================

/**
 * Create organization using demo user (no auth required)
 */
export const directCreateOrganization = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getDemoUserId(ctx);

    return await ctx.runMutation(components.tenants.mutations.createOrganization, {
      userId,
      name: args.name,
      slug: args.slug,
    });
  },
});

/**
 * List organizations for demo user (no auth required)
 */
export const directListOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getDemoUserId(ctx);

    return await ctx.runQuery(components.tenants.queries.listUserOrganizations, {
      userId,
    });
  },
});

// ================================
// Auth helpers
// ================================

/**
 * Get authenticated user ID, or null if not authenticated
 */
async function getAuthUserId(ctx: { auth: Auth }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  // Use demo user if not authenticated
  return identity?.subject ?? DEMO_USER_ID;
}

/**
 * Get demo user ID for demo purposes
 * In production, you would require real authentication
 */
async function getDemoUserId(ctx: { auth: Auth }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  // Use real user if authenticated, otherwise use demo user
  return identity?.subject ?? DEMO_USER_ID;
}
