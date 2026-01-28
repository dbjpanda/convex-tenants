import { v, ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import { components } from "./_generated/api";
import {
  requireRole,
  ensureUniqueSlug,
  isSoleOwner,
  isInvitationExpired,
  toAuthzRole,
} from "./helpers";
import type { Id } from "./_generated/dataModel";

/**
 * Organization Operations
 */

export const createOrganization = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Ensure slug is unique
    const uniqueSlug = await ensureUniqueSlug(ctx, args.slug);

    // Create organization
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: uniqueSlug,
      logo: args.logo ?? null,
      metadata: args.metadata,
      ownerId: args.userId,
    });

    // Add creator as owner
    await ctx.db.insert("members", {
      organizationId,
      userId: args.userId,
      role: "owner",
    });

    // Sync role to authz - assign org:owner role
    await ctx.runMutation(components.authz.mutations.assignRole, {
      userId: args.userId,
      role: toAuthzRole("owner"),
      scope: { type: "organization", id: organizationId as string },
      assignedBy: args.userId,
    });

    return organizationId as string;
  },
});

export const updateOrganization = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    logo: v.optional(v.union(v.null(), v.string())),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    // Check permissions (admin or owner)
    await requireRole(ctx, orgId, args.userId, "admin");

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.logo !== undefined) updates.logo = args.logo;
    if (args.metadata !== undefined) updates.metadata = args.metadata;

    // Handle slug update separately to ensure uniqueness
    if (args.slug !== undefined) {
      const uniqueSlug = await ensureUniqueSlug(ctx, args.slug);
      updates.slug = uniqueSlug;
    }

    await ctx.db.patch(orgId, updates);
    return null;
  },
});

export const deleteOrganization = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    // Check permissions (owner only)
    await requireRole(ctx, orgId, args.userId, "owner");

    // Get all members to revoke their roles
    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Revoke authz roles for all members
    for (const member of members) {
      await ctx.runMutation(components.authz.mutations.revokeRole, {
        userId: member.userId,
        role: toAuthzRole(member.role),
        scope: { type: "organization", id: args.organizationId },
      });
    }

    // Delete all related data
    // 1. Delete all team members
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    for (const team of teams) {
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();

      for (const tm of teamMembers) {
        // Revoke team membership in authz
        await ctx.runMutation(components.authz.rebac.removeRelation, {
          subjectType: "user",
          subjectId: tm.userId,
          relation: "member",
          objectType: "team",
          objectId: team._id as string,
        });
        await ctx.db.delete(tm._id);
      }

      await ctx.db.delete(team._id);
    }

    // 2. Delete all invitations
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
    }

    // 3. Delete all members
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // 4. Delete organization
    await ctx.db.delete(orgId);

    return null;
  },
});

/**
 * Member Operations
 */

export const addMember = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    memberUserId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    // Check permissions (admin or owner)
    await requireRole(ctx, orgId, args.userId, "admin");

    // Check if user is already a member
    const existing = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.memberUserId)
      )
      .unique();

    if (existing) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "User is already a member of this organization",
      });
    }

    // Add member
    await ctx.db.insert("members", {
      organizationId: orgId,
      userId: args.memberUserId,
      role: args.role,
    });

    // Sync role to authz
    await ctx.runMutation(components.authz.mutations.assignRole, {
      userId: args.memberUserId,
      role: toAuthzRole(args.role),
      scope: { type: "organization", id: args.organizationId },
      assignedBy: args.userId,
    });

    return null;
  },
});

export const removeMember = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    memberUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    // Check permissions (admin or owner)
    await requireRole(ctx, orgId, args.userId, "admin");

    // Get the member to remove
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.memberUserId)
      )
      .unique();

    if (!member) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Member not found",
      });
    }

    // Cannot remove an owner
    if (member.role === "owner") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot remove an owner. Transfer ownership first.",
      });
    }

    // Remove from all teams and revoke team memberships in authz
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    for (const team of teams) {
      const teamMembership = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", team._id).eq("userId", args.memberUserId)
        )
        .unique();

      if (teamMembership) {
        await ctx.runMutation(components.authz.rebac.removeRelation, {
          subjectType: "user",
          subjectId: args.memberUserId,
          relation: "member",
          objectType: "team",
          objectId: team._id as string,
        });
        await ctx.db.delete(teamMembership._id);
      }
    }

    // Revoke role in authz
    await ctx.runMutation(components.authz.mutations.revokeRole, {
      userId: args.memberUserId,
      role: toAuthzRole(member.role),
      scope: { type: "organization", id: args.organizationId },
    });

    // Remove member
    await ctx.db.delete(member._id);

    return null;
  },
});

export const updateMemberRole = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    memberUserId: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    // Check permissions (owner only)
    await requireRole(ctx, orgId, args.userId, "owner");

    // Get the member to update
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.memberUserId)
      )
      .unique();

    if (!member) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Member not found",
      });
    }

    const previousRole = member.role;

    // Update role
    await ctx.db.patch(member._id, { role: args.role });

    // Sync role change to authz - revoke old role, assign new role
    await ctx.runMutation(components.authz.mutations.revokeRole, {
      userId: args.memberUserId,
      role: toAuthzRole(previousRole),
      scope: { type: "organization", id: args.organizationId },
    });

    await ctx.runMutation(components.authz.mutations.assignRole, {
      userId: args.memberUserId,
      role: toAuthzRole(args.role),
      scope: { type: "organization", id: args.organizationId },
      assignedBy: args.userId,
    });

    return null;
  },
});

export const leaveOrganization = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    // Check if user is the sole owner
    const isSole = await isSoleOwner(ctx, orgId, args.userId);
    if (isSole) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Cannot leave organization as the sole owner. Transfer ownership or delete the organization first.",
      });
    }

    // Get member record
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .unique();

    if (!member) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "You are not a member of this organization",
      });
    }

    // Remove from all teams and revoke team memberships in authz
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    for (const team of teams) {
      const teamMembership = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", team._id).eq("userId", args.userId)
        )
        .unique();

      if (teamMembership) {
        await ctx.runMutation(components.authz.rebac.removeRelation, {
          subjectType: "user",
          subjectId: args.userId,
          relation: "member",
          objectType: "team",
          objectId: team._id as string,
        });
        await ctx.db.delete(teamMembership._id);
      }
    }

    // Revoke role in authz
    await ctx.runMutation(components.authz.mutations.revokeRole, {
      userId: args.userId,
      role: toAuthzRole(member.role),
      scope: { type: "organization", id: args.organizationId },
    });

    // Remove member
    await ctx.db.delete(member._id);

    return null;
  },
});

/**
 * Team Operations
 */

export const createTeam = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    // Check permissions (admin or owner)
    await requireRole(ctx, orgId, args.userId, "admin");

    // Create team
    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      organizationId: orgId,
      description: args.description ?? null,
    });

    return teamId as string;
  },
});

export const updateTeam = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.null(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teamId = args.teamId as Id<"teams">;

    // Get team to check organization
    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Team not found",
      });
    }

    // Check permissions (admin or owner)
    await requireRole(ctx, team.organizationId, args.userId, "admin");

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(teamId, updates);

    return null;
  },
});

export const deleteTeam = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teamId = args.teamId as Id<"teams">;

    // Get team to check organization
    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Team not found",
      });
    }

    // Check permissions (admin or owner)
    await requireRole(ctx, team.organizationId, args.userId, "admin");

    // Delete all team members and revoke their team memberships in authz
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .collect();

    for (const tm of teamMembers) {
      await ctx.runMutation(components.authz.rebac.removeRelation, {
        subjectType: "user",
        subjectId: tm.userId,
        relation: "member",
        objectType: "team",
        objectId: args.teamId,
      });
      await ctx.db.delete(tm._id);
    }

    // Delete team
    await ctx.db.delete(teamId);

    return null;
  },
});

export const addTeamMember = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    memberUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teamId = args.teamId as Id<"teams">;

    // Get team to check organization
    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Team not found",
      });
    }

    // Check permissions (admin or owner)
    await requireRole(ctx, team.organizationId, args.userId, "admin");

    // Verify the user is a member of the organization
    const orgMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q
          .eq("organizationId", team.organizationId)
          .eq("userId", args.memberUserId)
      )
      .unique();

    if (!orgMember) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "User must be a member of the organization first",
      });
    }

    // Check if already in team
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", teamId).eq("userId", args.memberUserId)
      )
      .unique();

    if (existing) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "User is already a member of this team",
      });
    }

    // Add to team
    await ctx.db.insert("teamMembers", {
      teamId,
      userId: args.memberUserId,
    });

    // Sync team membership to authz
    await ctx.runMutation(components.authz.rebac.addRelation, {
      subjectType: "user",
      subjectId: args.memberUserId,
      relation: "member",
      objectType: "team",
      objectId: args.teamId,
    });

    return null;
  },
});

export const removeTeamMember = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    memberUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teamId = args.teamId as Id<"teams">;

    // Get team to check organization
    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Team not found",
      });
    }

    // Check permissions (admin or owner)
    await requireRole(ctx, team.organizationId, args.userId, "admin");

    // Get team member record
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", teamId).eq("userId", args.memberUserId)
      )
      .unique();

    if (!teamMember) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User is not a member of this team",
      });
    }

    // Remove team membership in authz
    await ctx.runMutation(components.authz.rebac.removeRelation, {
      subjectType: "user",
      subjectId: args.memberUserId,
      relation: "member",
      objectType: "team",
      objectId: args.teamId,
    });

    // Remove from team
    await ctx.db.delete(teamMember._id);

    return null;
  },
});

/**
 * Invitation Operations
 */

export const inviteMember = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    teamId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    invitationId: v.string(),
    email: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    // Check permissions (admin or owner)
    await requireRole(ctx, orgId, args.userId, "admin");

    // Check for existing pending invitation
    const existing = await ctx.db
      .query("invitations")
      .withIndex("by_email_and_status", (q) =>
        q.eq("email", args.email).eq("status", "pending")
      )
      .first();

    if (existing && existing.organizationId === orgId) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "A pending invitation already exists for this email",
      });
    }

    // Default expiration: 48 hours from now
    const expiresAt = args.expiresAt ?? Date.now() + 48 * 60 * 60 * 1000;

    // Create invitation
    const invitationId = await ctx.db.insert("invitations", {
      organizationId: orgId,
      email: args.email,
      role: args.role,
      teamId: args.teamId ? (args.teamId as Id<"teams">) : null,
      inviterId: args.userId,
      status: "pending",
      expiresAt,
    });

    return {
      invitationId: invitationId as string,
      email: args.email,
      expiresAt,
    };
  },
});

export const acceptInvitation = mutation({
  args: {
    invitationId: v.string(),
    acceptingUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitationId = args.invitationId as Id<"invitations">;

    // Get invitation
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Invitation not found",
      });
    }

    // Check if already accepted or cancelled
    if (invitation.status !== "pending") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `Invitation has already been ${invitation.status}`,
      });
    }

    // Check if expired
    if (isInvitationExpired(invitation)) {
      await ctx.db.patch(invitationId, { status: "expired" });
      throw new ConvexError({
        code: "EXPIRED",
        message: "Invitation has expired",
      });
    }

    // Check if user is already a member
    const existingMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q
          .eq("organizationId", invitation.organizationId)
          .eq("userId", args.acceptingUserId)
      )
      .unique();

    if (existingMember) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "You are already a member of this organization",
      });
    }

    // Add user as member
    await ctx.db.insert("members", {
      organizationId: invitation.organizationId,
      userId: args.acceptingUserId,
      role: invitation.role,
    });

    // Sync role to authz
    await ctx.runMutation(components.authz.mutations.assignRole, {
      userId: args.acceptingUserId,
      role: toAuthzRole(invitation.role),
      scope: { type: "organization", id: invitation.organizationId as string },
      assignedBy: invitation.inviterId,
    });

    // Add to team if specified
    if (invitation.teamId) {
      await ctx.db.insert("teamMembers", {
        teamId: invitation.teamId,
        userId: args.acceptingUserId,
      });

      // Sync team membership to authz
      await ctx.runMutation(components.authz.rebac.addRelation, {
        subjectType: "user",
        subjectId: args.acceptingUserId,
        relation: "member",
        objectType: "team",
        objectId: invitation.teamId as string,
      });
    }

    // Mark invitation as accepted
    await ctx.db.patch(invitationId, { status: "accepted" });

    return null;
  },
});

export const resendInvitation = mutation({
  args: {
    userId: v.string(),
    invitationId: v.string(),
  },
  returns: v.object({
    invitationId: v.string(),
    email: v.string(),
  }),
  handler: async (ctx, args) => {
    const invitationId = args.invitationId as Id<"invitations">;

    // Get invitation
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Invitation not found",
      });
    }

    // Check if user has permission (admin/owner or the inviter)
    if (invitation.inviterId !== args.userId) {
      await requireRole(ctx, invitation.organizationId, args.userId, "admin");
    }

    // Check if still pending
    if (invitation.status !== "pending") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `Cannot resend ${invitation.status} invitation`,
      });
    }

    // Check if expired
    if (isInvitationExpired(invitation)) {
      // Update status to expired
      await ctx.db.patch(invitationId, { status: "expired" });
      throw new ConvexError({
        code: "EXPIRED",
        message: "Invitation has expired. Please create a new one.",
      });
    }

    // Return invitation details so the callback can be triggered
    return {
      invitationId: invitation._id as string,
      email: invitation.email,
    };
  },
});

export const cancelInvitation = mutation({
  args: {
    userId: v.string(),
    invitationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitationId = args.invitationId as Id<"invitations">;

    // Get invitation
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Invitation not found",
      });
    }

    // Check if user has permission (admin/owner or the inviter)
    if (invitation.inviterId !== args.userId) {
      await requireRole(ctx, invitation.organizationId, args.userId, "admin");
    }

    // Check if already accepted or cancelled
    if (invitation.status !== "pending") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `Invitation has already been ${invitation.status}`,
      });
    }

    // Cancel invitation
    await ctx.db.patch(invitationId, { status: "cancelled" });

    return null;
  },
});
