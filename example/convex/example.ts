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
 * This pattern creates a re-exported API with automatic authentication.
 */
const api = makeTenantsAPI(components.tenants, {
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
// Export all tenants API functions
// ================================

// Organization Operations
export const listOrganizations = api.listOrganizations;
export const getOrganization = api.getOrganization;
export const getOrganizationBySlug = api.getOrganizationBySlug;
export const createOrganization = api.createOrganization;
export const updateOrganization = api.updateOrganization;
export const deleteOrganization = api.deleteOrganization;

// Member Operations
export const listMembers = api.listMembers;
export const getMember = api.getMember;
export const getCurrentMember = api.getCurrentMember;
export const checkPermission = api.checkPermission;
export const addMember = api.addMember;
export const removeMember = api.removeMember;
export const updateMemberRole = api.updateMemberRole;
export const leaveOrganization = api.leaveOrganization;

// Team Operations
export const listTeams = api.listTeams;
export const getTeam = api.getTeam;
export const listTeamMembers = api.listTeamMembers;
export const isTeamMember = api.isTeamMember;
export const createTeam = api.createTeam;
export const updateTeam = api.updateTeam;
export const deleteTeam = api.deleteTeam;
export const addTeamMember = api.addTeamMember;
export const removeTeamMember = api.removeTeamMember;

// Invitation Operations
export const listInvitations = api.listInvitations;
export const getInvitation = api.getInvitation;
export const getPendingInvitations = api.getPendingInvitations;
export const inviteMember = api.inviteMember;
export const acceptInvitation = api.acceptInvitation;
export const resendInvitation = api.resendInvitation;
export const cancelInvitation = api.cancelInvitation;

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
