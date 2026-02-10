import { v, ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import {
  ensureUniqueSlug,
  ensureUniqueTeamSlug,
  isInvitationExpired,
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
    creatorRole: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Ensure slug is unique
    const uniqueSlug = await ensureUniqueSlug(ctx, args.slug);

    // Create organization (status defaults to active)
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: uniqueSlug,
      logo: args.logo ?? null,
      metadata: args.metadata,
      ownerId: args.userId,
      status: "active",
    });

    // Add creator as member with the specified role
    await ctx.db.insert("members", {
      organizationId,
      userId: args.userId,
      role: args.creatorRole ?? "owner",
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
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.logo !== undefined) updates.logo = args.logo;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.status !== undefined) updates.status = args.status;

    // Handle slug update separately to ensure uniqueness
    if (args.slug !== undefined) {
      const uniqueSlug = await ensureUniqueSlug(ctx, args.slug);
      updates.slug = uniqueSlug;
    }

    await ctx.db.patch(orgId, updates);
    return null;
  },
});

export const transferOwnership = mutation({
  args: {
    userId: v.string(), // current owner
    organizationId: v.string(),
    newOwnerUserId: v.string(),
    previousOwnerRole: v.optional(v.string()), // role to assign to current owner after transfer (default "admin")
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

    const org = await ctx.db.get(orgId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
    }
    if (org.ownerId !== args.userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only the current owner can transfer ownership",
      });
    }

    const newOwnerMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.newOwnerUserId)
      )
      .unique();

    if (!newOwnerMember) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "New owner must already be a member of the organization",
      });
    }

    if (args.newOwnerUserId === args.userId) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "New owner must be a different user",
      });
    }

    const previousRole = args.previousOwnerRole ?? "admin";

    // Update organization owner
    await ctx.db.patch(orgId, { ownerId: args.newOwnerUserId });

    // Update current owner's member role to previousOwnerRole
    const currentOwnerMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .unique();
    if (currentOwnerMember) {
      await ctx.db.patch(currentOwnerMember._id, { role: previousRole });
    }

    // Update new owner's member role to owner
    await ctx.db.patch(newOwnerMember._id, { role: "owner" });

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

    // Delete all related data
    // 1. Delete all team members and teams
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
    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

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
    role: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

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

    // Cannot remove the structural owner (tracked via ownerId)
    const org = await ctx.db.get(orgId);
    if (org && args.memberUserId === org.ownerId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot remove the organization owner. Transfer ownership first.",
      });
    }

    // Remove from all teams
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
        await ctx.db.delete(teamMembership._id);
      }
    }

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
    role: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;

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

    // Update role
    await ctx.db.patch(member._id, { role: args.role });

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

    // The structural owner (ownerId) cannot leave
    const org = await ctx.db.get(orgId);
    if (org && args.userId === org.ownerId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Cannot leave organization as the owner. Transfer ownership or delete the organization first.",
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

    // Remove from all teams
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
        await ctx.db.delete(teamMembership._id);
      }
    }

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
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const baseSlug = args.slug ?? (args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team");
    const uniqueSlug = await ensureUniqueTeamSlug(ctx, orgId, baseSlug);

    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      slug: uniqueSlug,
      organizationId: orgId,
      description: args.description ?? null,
      metadata: args.metadata,
    });

    return teamId as string;
  },
});

export const updateTeam = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.union(v.null(), v.string())),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teamId = args.teamId as Id<"teams">;

    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Team not found",
      });
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.slug !== undefined) {
      const uniqueSlug = await ensureUniqueTeamSlug(ctx, team.organizationId, args.slug);
      updates.slug = uniqueSlug;
    }

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

    // Get team
    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Team not found",
      });
    }

    // Delete all team members
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .collect();

    for (const tm of teamMembers) {
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
    role: v.string(),
    teamId: v.optional(v.string()),
    message: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    invitationId: v.string(),
    email: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const normalizedEmail = args.email.trim().toLowerCase();

    if (args.teamId) {
      const team = await ctx.db.get(args.teamId as Id<"teams">);
      if (!team) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Team not found",
        });
      }
      if (team.organizationId !== orgId) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Team must belong to the invitation organization",
        });
      }
    }

    // Check for existing pending invitation
    const existing = await ctx.db
      .query("invitations")
      .withIndex("by_email_and_status", (q) =>
        q.eq("email", normalizedEmail).eq("status", "pending")
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
      email: normalizedEmail,
      role: args.role,
      teamId: args.teamId ? (args.teamId as Id<"teams">) : null,
      inviterId: args.userId,
      message: args.message,
      status: "pending",
      expiresAt,
    });

    return {
      invitationId: invitationId as string,
      email: normalizedEmail,
      expiresAt,
    };
  },
});

export const acceptInvitation = mutation({
  args: {
    invitationId: v.string(),
    acceptingUserId: v.string(),
    acceptingEmail: v.optional(v.string()),
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

    if (
      args.acceptingEmail &&
      args.acceptingEmail.trim().toLowerCase() !==
        invitation.email.trim().toLowerCase()
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Invitation email does not match authenticated user",
      });
    }

    // Add user as member
    await ctx.db.insert("members", {
      organizationId: invitation.organizationId,
      userId: args.acceptingUserId,
      role: invitation.role,
    });

    // Add to team if specified
    if (invitation.teamId) {
      const team = await ctx.db.get(invitation.teamId);
      if (!team || team.organizationId !== invitation.organizationId) {
        throw new ConvexError({
          code: "INVALID_STATE",
          message: "Invitation team is invalid for this organization",
        });
      }

      const existingTeamMember = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", invitation.teamId as Id<"teams">).eq("userId", args.acceptingUserId)
        )
        .unique();

      if (!existingTeamMember) {
        await ctx.db.insert("teamMembers", {
          teamId: invitation.teamId,
          userId: args.acceptingUserId,
        });
      }
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

    // Check if still pending
    if (invitation.status !== "pending") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `Cannot resend ${invitation.status} invitation`,
      });
    }

    // Check if expired
    if (isInvitationExpired(invitation)) {
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
