import { components } from "./_generated/api.js";
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { getAuthUserId } from "@convex-dev/auth/server";
import { authz } from "./authz.js";

/**
 * Example: Using the Tenants component with makeTenantsAPI + Convex Auth
 *
 * Roles are fully flexible — defined in `authz.ts` using @djpanda/convex-authz.
 * The `creatorRole` option controls what role is assigned when creating an org.
 */
export const {
  // Organizations
  listOrganizations,
  getOrganization,
  getOrganizationBySlug,
  listOrganizationsJoinableByDomain,
  createOrganization,
  updateOrganization,
  generateLogoUploadUrl,
  transferOwnership,
  deleteOrganization,
  joinByDomain,
  // Members
  listMembers,
  listMembersPaginated,
  countMembers,
  getMember,
  getCurrentMember,
  getCurrentUserEmail,
  checkMemberPermission,
  addMember,
  removeMember,
  bulkAddMembers,
  bulkRemoveMembers,
  updateMemberRole,
  suspendMember,
  unsuspendMember,
  leaveOrganization,
  // Teams
  listTeams,
  listTeamsAsTree,
  listTeamsPaginated,
  countTeams,
  getTeam,
  listTeamMembers,
  listTeamMembersPaginated,
  isTeamMember,
  createTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  // Invitations
  listInvitations,
  listInvitationsPaginated,
  countInvitations,
  getInvitation,
  getPendingInvitations,
  inviteMember,
  bulkInviteMembers,
  acceptInvitation,
  resendInvitation,
  cancelInvitation,
  // Authorization
  checkPermission,
  getUserPermissions,
  getUserRoles,
  grantPermission,
  denyPermission,
  getAuditLog,
} = makeTenantsAPI(components.tenants, {
  authz,
  creatorRole: "owner", // role assigned on org creation (matches authz.ts)
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

  // Event hooks
  onOrganizationCreated: async (ctx, data) => console.log(`Organization created: ${data.name}`),
  onOrganizationDeleted: async (ctx, data) => console.log(`Organization deleted: ${data.name}`),
  onMemberAdded: async (ctx, data) => console.log(`Member ${data.userId} added as ${data.role}`),
  onMemberRemoved: async (ctx, data) => console.log(`Member ${data.userId} removed`),
  onMemberRoleChanged: async (ctx, data) => console.log(`Member ${data.userId} role: ${data.oldRole} → ${data.newRole}`),
  onMemberLeft: async (ctx, data) => console.log(`Member ${data.userId} left`),
  onTeamCreated: async (ctx, data) => console.log(`Team created: ${data.name}`),
  onTeamDeleted: async (ctx, data) => console.log(`Team deleted: ${data.name}`),
  onTeamMemberAdded: async (ctx, data) => console.log(`Team member ${data.userId} added`),
  onTeamMemberRemoved: async (ctx, data) => console.log(`Team member ${data.userId} removed`),
  onInvitationCreated: async (ctx, data) => console.log(`Invitation sent to ${data.email}`),
  onInvitationResent: async (ctx, data) => console.log(`Invitation resent to ${data.email}`),
  onInvitationAccepted: async (ctx, data) => console.log(`Invitation accepted by ${data.userId}`),

  defaultInvitationExpiration: 48 * 60 * 60 * 1000, // 48 hours

  // Logo upload: exposes generateLogoUploadUrl mutation
  generateUploadUrl: async (ctx) => await ctx.storage.generateUploadUrl(),
});
