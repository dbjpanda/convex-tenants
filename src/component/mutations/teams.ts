import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { ensureUniqueTeamSlug } from "../helpers";
import type { Id } from "../_generated/dataModel";

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
    const baseSlug =
      args.slug ??
      (args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team");
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
    if (!team) throw new ConvexError({ code: "NOT_FOUND", message: "Team not found" });
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
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
  args: { userId: v.string(), teamId: v.string(), memberUserId: v.string() },
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
    await ctx.db.insert("teamMembers", { teamId, userId: args.memberUserId });
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
