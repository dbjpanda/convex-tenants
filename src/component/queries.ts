import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";
import { isInvitationExpired } from "./helpers";
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
      status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
      role: v.string(),
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
          status: (org as { status?: "active" | "suspended" | "archived" }).status,
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
      status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
    })
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId as Id<"organizations">);
    if (!org) return null;
    const o = org as { status?: "active" | "suspended" | "archived" };
    return {
      _id: org._id as string,
      _creationTime: org._creationTime,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      metadata: org.metadata,
      ownerId: org.ownerId,
      status: o.status,
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
      status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
    })
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!org) return null;
    const o = org as { status?: "active" | "suspended" | "archived" };
    return {
      _id: org._id as string,
      _creationTime: org._creationTime,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      metadata: org.metadata,
      ownerId: org.ownerId,
      status: o.status,
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
      role: v.string(),
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
 * List organization members with cursor-based pagination.
 * Use with usePaginatedQuery in React or pass paginationOpts from the client.
 * @see https://docs.convex.dev/database/pagination
 */
export const listOrganizationMembersPaginated = query({
  args: {
    organizationId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((member) => ({
        _id: member._id as string,
        _creationTime: member._creationTime,
        organizationId: member.organizationId as string,
        userId: member.userId,
        role: member.role,
      })),
    };
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
      role: v.string(),
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
      slug: v.optional(v.string()),
      organizationId: v.string(),
      description: v.union(v.null(), v.string()),
      metadata: v.optional(v.any()),
    })
  ),
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    return teams.map((team) => {
      const t = team as { slug?: string; metadata?: any };
      return {
        _id: team._id as string,
        _creationTime: team._creationTime,
        name: team.name,
        slug: t.slug,
        organizationId: team.organizationId as string,
        description: team.description,
        metadata: t.metadata,
      };
    });
  },
});

/**
 * List teams with cursor-based pagination.
 * @see https://docs.convex.dev/database/pagination
 */
export const listTeamsPaginated = query({
  args: {
    organizationId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((team) => {
        const t = team as { slug?: string; metadata?: any };
        return {
          _id: team._id as string,
          _creationTime: team._creationTime,
          name: team.name,
          slug: t.slug,
          organizationId: team.organizationId as string,
          description: team.description,
          metadata: t.metadata,
        };
      }),
    };
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
      slug: v.optional(v.string()),
      organizationId: v.string(),
      description: v.union(v.null(), v.string()),
      metadata: v.optional(v.any()),
    })
  ),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId as Id<"teams">);
    if (!team) return null;
    const t = team as { slug?: string; metadata?: any };
    return {
      _id: team._id as string,
      _creationTime: team._creationTime,
      name: team.name,
      slug: t.slug,
      organizationId: team.organizationId as string,
      description: team.description,
      metadata: t.metadata,
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
 * List team members with cursor-based pagination.
 * @see https://docs.convex.dev/database/pagination
 */
export const listTeamMembersPaginated = query({
  args: {
    teamId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId as Id<"teams">))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((tm) => ({
        _id: tm._id as string,
        _creationTime: tm._creationTime,
        teamId: tm.teamId as string,
        userId: tm.userId,
      })),
    };
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
      role: v.string(),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      message: v.optional(v.string()),
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

    return invitations.map((inv) => {
      const i = inv as { message?: string };
      return {
        _id: inv._id as string,
        _creationTime: inv._creationTime,
        organizationId: inv.organizationId as string,
        email: inv.email,
        role: inv.role,
        teamId: inv.teamId ? (inv.teamId as string) : null,
        inviterId: inv.inviterId,
        message: i.message,
        status: inv.status,
        expiresAt: inv.expiresAt,
        isExpired: isInvitationExpired(inv),
      };
    });
  },
});

/**
 * List invitations with cursor-based pagination.
 * @see https://docs.convex.dev/database/pagination
 */
export const listInvitationsPaginated = query({
  args: {
    organizationId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((inv) => {
        const i = inv as { message?: string };
        return {
          _id: inv._id as string,
          _creationTime: inv._creationTime,
          organizationId: inv.organizationId as string,
          email: inv.email,
          role: inv.role,
          teamId: inv.teamId ? (inv.teamId as string) : null,
          inviterId: inv.inviterId,
          message: i.message,
          status: inv.status,
          expiresAt: inv.expiresAt,
          isExpired: isInvitationExpired(inv),
        };
      }),
    };
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
      role: v.string(),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      message: v.optional(v.string()),
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
    const i = invitation as { message?: string };
    return {
      _id: invitation._id as string,
      _creationTime: invitation._creationTime,
      organizationId: invitation.organizationId as string,
      email: invitation.email,
      role: invitation.role,
      teamId: invitation.teamId ? (invitation.teamId as string) : null,
      inviterId: invitation.inviterId,
      message: i.message,
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
      role: v.string(),
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

