import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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
 * Count teams in an organization.
 */
export const countTeams = query({
  args: { organizationId: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();
    return teams.length;
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
