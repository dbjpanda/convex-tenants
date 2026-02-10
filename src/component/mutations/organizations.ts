import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { ensureUniqueSlug } from "../helpers";
import type { Id } from "../_generated/dataModel";

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
    const uniqueSlug = await ensureUniqueSlug(ctx, args.slug);
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: uniqueSlug,
      logo: args.logo ?? null,
      metadata: args.metadata,
      ownerId: args.userId,
      status: "active",
    });
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
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.logo !== undefined) updates.logo = args.logo;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.status !== undefined) updates.status = args.status;
    if (args.slug !== undefined) {
      updates.slug = await ensureUniqueSlug(ctx, args.slug);
    }
    await ctx.db.patch(orgId, updates);
    return null;
  },
});

export const transferOwnership = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    newOwnerUserId: v.string(),
    previousOwnerRole: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
    if (org.ownerId !== args.userId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the current owner can transfer ownership" });
    }
    const newOwnerMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.newOwnerUserId)
      )
      .unique();
    if (!newOwnerMember) {
      throw new ConvexError({ code: "NOT_FOUND", message: "New owner must already be a member of the organization" });
    }
    if (args.newOwnerUserId === args.userId) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "New owner must be a different user" });
    }
    const previousRole = args.previousOwnerRole ?? "admin";
    await ctx.db.patch(orgId, { ownerId: args.newOwnerUserId });
    const currentOwnerMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .unique();
    if (currentOwnerMember) await ctx.db.patch(currentOwnerMember._id, { role: previousRole });
    await ctx.db.patch(newOwnerMember._id, { role: "owner" });
    return null;
  },
});

export const deleteOrganization = mutation({
  args: { userId: v.string(), organizationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    for (const team of teams) {
      const tms = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", team._id)).collect();
      for (const tm of tms) await ctx.db.delete(tm._id);
      await ctx.db.delete(team._id);
    }
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    for (const inv of invitations) await ctx.db.delete(inv._id);
    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);
    await ctx.db.delete(orgId);
    return null;
  },
});
