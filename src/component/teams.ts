import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "./_generated/server";
import { ensureUniqueTeamSlug, getTeamAncestorIds } from "./helpers";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// Queries
// ============================================================================

export const listTeams = query({
  args: {
    organizationId: v.string(),
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

export type TreeNode = {
  team: {
    _id: string;
    _creationTime: number;
    name: string;
    slug?: string;
    organizationId: string;
    parentTeamId?: string;
    description: string | null;
    metadata?: unknown;
  };
  children: TreeNode[];
};

export const listTeamsAsTree = query({
  args: { organizationId: v.string() },
  returns: v.array(
    v.object({
      team: teamShape,
      children: v.any(),
    })
  ),
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    function toTeam(t: (typeof all)[0]): TreeNode["team"] {
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

    const byParent = new Map<string | undefined, TreeNode[]>();
    for (const t of all) {
      const team = toTeam(t);
      const pid = (t as { parentTeamId?: Id<"teams"> }).parentTeamId as string | undefined;
      const node: TreeNode = { team, children: [] };
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

export const getTeam = query({
  args: { teamId: v.string() },
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

// ============================================================================
// Mutations
// ============================================================================

export const createTeam = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    parentTeamId: v.optional(v.id("teams")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    if (args.parentTeamId) {
      const parent = await ctx.db.get(args.parentTeamId);
      if (!parent) throw new ConvexError({ code: "NOT_FOUND", message: "Parent team not found" });
      if (parent.organizationId !== orgId) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Parent team must belong to the same organization",
        });
      }
    }
    const baseSlug =
      args.slug ??
      (args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team");
    const uniqueSlug = await ensureUniqueTeamSlug(ctx, orgId, baseSlug);
    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      slug: uniqueSlug,
      organizationId: orgId,
      parentTeamId: args.parentTeamId,
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
    parentTeamId: v.optional(v.union(v.null(), v.id("teams"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teamId = args.teamId as Id<"teams">;
    const team = await ctx.db.get(teamId);
    if (!team) throw new ConvexError({ code: "NOT_FOUND", message: "Team not found" });
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.parentTeamId !== undefined) {
      const newParentId = args.parentTeamId;
      if (newParentId === teamId) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: "Team cannot be its own parent",
        });
      }
      if (newParentId) {
        const parentTeam = await ctx.db.get(newParentId);
        if (!parentTeam) throw new ConvexError({ code: "NOT_FOUND", message: "Parent team not found" });
        if (parentTeam.organizationId !== team.organizationId) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Parent team must belong to the same organization",
          });
        }
        const ancestorsOfNewParent = await getTeamAncestorIds(ctx, newParentId);
        if (ancestorsOfNewParent.has(teamId)) {
          throw new ConvexError({
            code: "INVALID_ARGUMENT",
            message: "Setting this parent would create a cycle in the team hierarchy",
          });
        }
      }
      updates.parentTeamId = newParentId ?? undefined;
    }
    if (args.slug !== undefined) {
      updates.slug = await ensureUniqueTeamSlug(ctx, team.organizationId, args.slug);
    }
    await ctx.db.patch(teamId, updates);
    return null;
  },
});

export const deleteTeam = mutation({
  args: { userId: v.string(), teamId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teamId = args.teamId as Id<"teams">;
    const team = await ctx.db.get(teamId);
    if (!team) throw new ConvexError({ code: "NOT_FOUND", message: "Team not found" });
    const teamWithParent = team as { parentTeamId?: Id<"teams"> };
    const childTeams = await ctx.db
      .query("teams")
      .withIndex("by_parent", (q) => q.eq("parentTeamId", teamId))
      .collect();
    for (const child of childTeams) {
      await ctx.db.patch(child._id, { parentTeamId: teamWithParent.parentTeamId });
    }
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .collect();
    for (const tm of teamMembers) await ctx.db.delete(tm._id);
    await ctx.db.delete(teamId);
    return null;
  },
});

export const addTeamMember = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    memberUserId: v.string(),
    role: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teamId = args.teamId as Id<"teams">;
    const team = await ctx.db.get(teamId);
    if (!team) throw new ConvexError({ code: "NOT_FOUND", message: "Team not found" });
    const orgMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", team.organizationId).eq("userId", args.memberUserId)
      )
      .unique();
    if (!orgMember) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "User must be a member of the organization first",
      });
    }
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", teamId).eq("userId", args.memberUserId)
      )
      .unique();
    if (existing) {
      throw new ConvexError({ code: "ALREADY_EXISTS", message: "User is already a member of this team" });
    }
    await ctx.db.insert("teamMembers", {
      teamId,
      userId: args.memberUserId,
      role: args.role,
    });
    return null;
  },
});

export const updateTeamMemberRole = mutation({
  args: {
    userId: v.string(),
    teamId: v.string(),
    memberUserId: v.string(),
    role: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teamId = args.teamId as Id<"teams">;
    const tm = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", teamId).eq("userId", args.memberUserId)
      )
      .unique();
    if (!tm) throw new ConvexError({ code: "NOT_FOUND", message: "User is not a member of this team" });
    await ctx.db.patch(tm._id, { role: args.role });
    return null;
  },
});

export const removeTeamMember = mutation({
  args: { userId: v.string(), teamId: v.string(), memberUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const teamId = args.teamId as Id<"teams">;
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", teamId).eq("userId", args.memberUserId)
      )
      .unique();
    if (!teamMember) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User is not a member of this team" });
    }
    await ctx.db.delete(teamMember._id);
    return null;
  },
});
