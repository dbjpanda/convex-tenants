import { components } from "./_generated/api.js";
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { getAuthUserId } from "@convex-dev/auth/server";

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
    console.log(`  Invited by: ${invitation.inviterName ?? "Unknown"}`);
    console.log(`  Expires: ${new Date(invitation.expiresAt).toISOString()}`);
  },

  onInvitationResent: async (_ctx, invitation) => {
    // In a real app, you'd resend the invitation email
    console.log(`[Example] Invitation resent to ${invitation.email}`);
    console.log(`  Organization: ${invitation.organizationName}`);
    console.log(`  Role: ${invitation.role}`);
    console.log(`  Resent by: ${invitation.inviterName ?? "Unknown"}`);
    console.log(`  Expires: ${new Date(invitation.expiresAt).toISOString()}`);
  },

  defaultInvitationExpiration: 48 * 60 * 60 * 1000, // 48 hours
});
