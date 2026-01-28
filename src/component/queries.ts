import { v } from "convex/values";
import { query } from "./_generated/server";
import { getMemberRole, isInvitationExpired } from "./helpers";
import type { Id } from "./_generated/dataModel";

/**
 * List all organizations a user belongs to
 */
export const listUserOrganizations = query({
  args: {
    userId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      logo: v.union(v.null(), v.string()),
      metadata: v.optional(v.any()),
      ownerId: v.string(),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    })
  ),
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const organizations = await Promise.all(
      memberships.map(async (membership) => {
        const org = await ctx.db.get(membership.organizationId);
        if (!org) return null;

        return {
          _id: org._id as string,
          _creationTime: org._creationTime,
          name: org.name,
          slug: org.slug,
          logo: org.logo,
          metadata: org.metadata,
          ownerId: org.ownerId,
          role: membership.role,
        };
      })
    );

    return organizations.filter((org) => org !== null);
  },
});

/**
 * Get organization details by ID
 */
export const getOrganization = query({
  args: {
    organizationId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      logo: v.union(v.null(), v.string()),
      metadata: v.optional(v.any()),
      ownerId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId as Id<"organizations">);
    if (!org) return null;

    return {
      _id: org._id as string,
      _creationTime: org._creationTime,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      metadata: org.metadata,
      ownerId: org.ownerId,
    };
  },
});

/**
 * Get organization by slug
 */
export const getOrganizationBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      logo: v.union(v.null(), v.string()),
      metadata: v.optional(v.any()),
      ownerId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!org) return null;

    return {
      _id: org._id as string,
      _creationTime: org._creationTime,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      metadata: org.metadata,
      ownerId: org.ownerId,
    };
  },
});

/**
 * List all members of an organization (without user data enrichment)
 */
export const listOrganizationMembers = query({
  args: {
    organizationId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      userId: v.string(),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    })
  ),
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    return members.map((member) => ({
      _id: member._id as string,
      _creationTime: member._creationTime,
      organizationId: member.organizationId as string,
      userId: member.userId,
      role: member.role,
    }));
  },
});

/**
 * Get a specific member's details and role
 */
export const getMember = query({
  args: {
    organizationId: v.string(),
    userId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      userId: v.string(),
      role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    })
  ),
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("userId", args.userId)
      )
      .unique();

    if (!member) return null;

    return {
      _id: member._id as string,
      _creationTime: member._creationTime,
      organizationId: member.organizationId as string,
      userId: member.userId,
      role: member.role,
    };
  },
});

/**
 * List all teams in an organization
 */
export const listTeams = query({
  args: {
    organizationId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      name: v.string(),
      organizationId: v.string(),
      description: v.union(v.null(), v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    return teams.map((team) => ({
      _id: team._id as string,
      _creationTime: team._creationTime,
      name: team.name,
      organizationId: team.organizationId as string,
      description: team.description,
    }));
  },
});

/**
 * Get team details
 */
export const getTeam = query({
  args: {
    teamId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      name: v.string(),
      organizationId: v.string(),
      description: v.union(v.null(), v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId as Id<"teams">);
    if (!team) return null;

    return {
      _id: team._id as string,
      _creationTime: team._creationTime,
      name: team.name,
      organizationId: team.organizationId as string,
      description: team.description,
    };
  },
});

/**
 * List all members of a specific team
 */
export const listTeamMembers = query({
  args: {
    teamId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      teamId: v.string(),
      userId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId as Id<"teams">))
      .collect();

    return teamMembers.map((tm) => ({
      _id: tm._id as string,
      _creationTime: tm._creationTime,
      teamId: tm.teamId as string,
      userId: tm.userId,
    }));
  },
});

/**
 * List invitations for an organization
 */
export const listInvitations = query({
  args: {
    organizationId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      email: v.string(),
      role: v.union(v.literal("admin"), v.literal("member")),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("cancelled"),
        v.literal("expired")
      ),
      expiresAt: v.number(),
      isExpired: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    return invitations.map((inv) => ({
      _id: inv._id as string,
      _creationTime: inv._creationTime,
      organizationId: inv.organizationId as string,
      email: inv.email,
      role: inv.role,
      teamId: inv.teamId ? (inv.teamId as string) : null,
      inviterId: inv.inviterId,
      status: inv.status,
      expiresAt: inv.expiresAt,
      isExpired: isInvitationExpired(inv),
    }));
  },
});

/**
 * Get invitation details by ID
 */
export const getInvitation = query({
  args: {
    invitationId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      email: v.string(),
      role: v.union(v.literal("admin"), v.literal("member")),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("cancelled"),
        v.literal("expired")
      ),
      expiresAt: v.number(),
      isExpired: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId as Id<"invitations">);
    if (!invitation) return null;

    return {
      _id: invitation._id as string,
      _creationTime: invitation._creationTime,
      organizationId: invitation.organizationId as string,
      email: invitation.email,
      role: invitation.role,
      teamId: invitation.teamId ? (invitation.teamId as string) : null,
      inviterId: invitation.inviterId,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      isExpired: isInvitationExpired(invitation),
    };
  },
});

/**
 * Get pending invitations for an email
 */
export const getPendingInvitationsForEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      email: v.string(),
      role: v.union(v.literal("admin"), v.literal("member")),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      expiresAt: v.number(),
      isExpired: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_email_and_status", (q) =>
        q.eq("email", args.email).eq("status", "pending")
      )
      .collect();

    return invitations
      .filter((inv) => !isInvitationExpired(inv))
      .map((inv) => ({
        _id: inv._id as string,
        _creationTime: inv._creationTime,
        organizationId: inv.organizationId as string,
        email: inv.email,
        role: inv.role,
        teamId: inv.teamId ? (inv.teamId as string) : null,
        inviterId: inv.inviterId,
        expiresAt: inv.expiresAt,
        isExpired: false,
      }));
  },
});

/**
 * Check if a user has at least a certain role in an organization
 */
export const checkMemberPermission = query({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    minRole: v.union(v.literal("member"), v.literal("admin"), v.literal("owner")),
  },
  returns: v.object({
    hasPermission: v.boolean(),
    currentRole: v.union(
      v.null(),
      v.union(v.literal("owner"), v.literal("admin"), v.literal("member"))
    ),
  }),
  handler: async (ctx, args) => {
    const role = await getMemberRole(
      ctx,
      args.organizationId as Id<"organizations">,
      args.userId
    );

    if (!role) {
      return { hasPermission: false, currentRole: null };
    }

    const ROLE_HIERARCHY = {
      owner: 3,
      admin: 2,
      member: 1,
    } as const;

    const hasPermission =
      ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[args.minRole];

    return { hasPermission, currentRole: role };
  },
});

/**
 * Check if a user is a member of a team
 */
export const isTeamMember = query({
  args: {
    teamId: v.string(),
    userId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId as Id<"teams">).eq("userId", args.userId)
      )
      .unique();

    return membership !== null;
  },
});
