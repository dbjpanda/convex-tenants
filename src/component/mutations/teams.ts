import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { ensureUniqueTeamSlug, getTeamAncestorIds } from "../helpers";
import type { Id } from "../_generated/dataModel";

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
