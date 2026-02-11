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
    /** If set, filter to only teams with this parent (null = root teams only). */
    parentTeamId: v.optional(v.union(v.null(), v.string())),
    sortBy: v.optional(v.union(v.literal("name"), v.literal("createdAt"), v.literal("slug"))),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.optional(v.string()),
      organizationId: v.string(),
      parentTeamId: v.optional(v.string()),
      description: v.union(v.null(), v.string()),
      metadata: v.optional(v.any()),
    })
  ),
  handler: async (ctx, args) => {
    let teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    if (args.parentTeamId !== undefined) {
      const pid = args.parentTeamId === null ? undefined : (args.parentTeamId as Id<"teams">);
      teams = teams.filter((t) => (t as { parentTeamId?: Id<"teams"> }).parentTeamId === pid);
    }

    const sortBy = args.sortBy ?? "name";
    const order = args.sortOrder ?? "asc";
    const mult = order === "asc" ? 1 : -1;
    const sorted = [...teams].sort((a, b) => {
      const t = (x: typeof a) => (x as { slug?: string }).slug ?? "";
      const va = sortBy === "name" ? a.name : sortBy === "slug" ? t(a) : a._creationTime;
      const vb = sortBy === "name" ? b.name : sortBy === "slug" ? t(b) : b._creationTime;
      return va < vb ? -mult : va > vb ? mult : 0;
    });

    return sorted.map((team) => {
      const t = team as { slug?: string; metadata?: any; parentTeamId?: Id<"teams"> };
      return {
        _id: team._id as string,
        _creationTime: team._creationTime,
        name: team.name,
        slug: t.slug,
        organizationId: team.organizationId as string,
        parentTeamId: t.parentTeamId ? (t.parentTeamId as string) : undefined,
        description: team.description,
        metadata: t.metadata,
      };
    });
  },
});

/** Team shape for tree node (same as listTeams item). */
const teamShape = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.optional(v.string()),
  organizationId: v.string(),
  parentTeamId: v.optional(v.string()),
  description: v.union(v.null(), v.string()),
  metadata: v.optional(v.any()),
});

/**
 * List teams as a tree (nested by parentTeamId). Root teams first, each with children array.
 */
export const listTeamsAsTree = query({
  args: { organizationId: v.string() },
  returns: v.array(
    v.object({
      team: teamShape,
      children: v.any(), // recursive: same structure
    })
  ),
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    function toTeam(t: (typeof all)[0]) {
      const x = t as { slug?: string; metadata?: any; parentTeamId?: Id<"teams"> };
      return {
        _id: t._id as string,
        _creationTime: t._creationTime,
        name: t.name,
        slug: x.slug,
        organizationId: t.organizationId as string,
        parentTeamId: x.parentTeamId ? (x.parentTeamId as string) : undefined,
        description: t.description,
        metadata: x.metadata,
      };
    }

    type TreeNode = { team: ReturnType<typeof toTeam>; children: TreeNode[] };
    const byParent = new Map<string | undefined, TreeNode[]>();
    const nodes = new Map<string, TreeNode>();
    for (const t of all) {
      const team = toTeam(t);
      const pid = (t as { parentTeamId?: Id<"teams"> }).parentTeamId as string | undefined;
      const node: TreeNode = { team, children: [] };
      nodes.set(team._id, node);
      const list = byParent.get(pid ?? undefined) ?? [];
      list.push(node);
      byParent.set(pid ?? undefined, list);
    }
    function buildTree(parentId: string | undefined): TreeNode[] {
      return (byParent.get(parentId) ?? []).map((node) => ({
        ...node,
        children: buildTree(node.team._id),
      }));
    }
    return buildTree(undefined);
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
        const t = team as { slug?: string; metadata?: any; parentTeamId?: Id<"teams"> };
        return {
          _id: team._id as string,
          _creationTime: team._creationTime,
          name: team.name,
          slug: t.slug,
          organizationId: team.organizationId as string,
          parentTeamId: t.parentTeamId ? (t.parentTeamId as string) : undefined,
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
      parentTeamId: v.optional(v.string()),
      description: v.union(v.null(), v.string()),
      metadata: v.optional(v.any()),
    })
  ),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId as Id<"teams">);
    if (!team) return null;
    const t = team as { slug?: string; metadata?: any; parentTeamId?: Id<"teams"> };
    return {
      _id: team._id as string,
      _creationTime: team._creationTime,
      name: team.name,
      slug: t.slug,
      organizationId: team.organizationId as string,
      parentTeamId: t.parentTeamId ? (t.parentTeamId as string) : undefined,
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
    sortBy: v.optional(v.union(v.literal("userId"), v.literal("role"), v.literal("createdAt"))),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      teamId: v.string(),
      userId: v.string(),
      role: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId as Id<"teams">))
      .collect();

    const sortBy = args.sortBy ?? "createdAt";
    const order = args.sortOrder ?? "desc";
    const mult = order === "asc" ? 1 : -1;
    const sorted = [...teamMembers].sort((a, b) => {
      const t = (x: typeof a) => (x as { role?: string }).role ?? "";
      const va = sortBy === "userId" ? a.userId : sortBy === "role" ? t(a) : a._creationTime;
      const vb = sortBy === "userId" ? b.userId : sortBy === "role" ? t(b) : b._creationTime;
      return va < vb ? -mult : va > vb ? mult : 0;
    });

    return sorted.map((tm) => {
      const t = tm as { role?: string };
      return {
        _id: tm._id as string,
        _creationTime: tm._creationTime,
        teamId: tm.teamId as string,
        userId: tm.userId,
        role: t.role,
      };
    });
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
      page: result.page.map((tm) => {
        const t = tm as { role?: string };
        return {
          _id: tm._id as string,
          _creationTime: tm._creationTime,
          teamId: tm.teamId as string,
          userId: tm.userId,
          role: t.role,
        };
      }),
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
