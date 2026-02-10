import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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
    const existing = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.memberUserId)
      )
      .unique();
    if (existing) {
      throw new ConvexError({ code: "ALREADY_EXISTS", message: "User is already a member of this organization" });
    }
    await ctx.db.insert("members", {
      organizationId: orgId,
      userId: args.memberUserId,
      role: args.role,
      status: "active",
    });
    return null;
  },
});

export const removeMember = mutation({
  args: { userId: v.string(), organizationId: v.string(), memberUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.memberUserId)
      )
      .unique();
    if (!member) throw new ConvexError({ code: "NOT_FOUND", message: "Member not found" });
    const org = await ctx.db.get(orgId);
    if (org && args.memberUserId === org.ownerId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot remove the organization owner. Transfer ownership first.",
      });
    }
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    for (const team of teams) {
      const tm = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", team._id).eq("userId", args.memberUserId)
        )
        .unique();
      if (tm) await ctx.db.delete(tm._id);
    }
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
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.memberUserId)
      )
      .unique();
    if (!member) throw new ConvexError({ code: "NOT_FOUND", message: "Member not found" });
    await ctx.db.patch(member._id, { role: args.role });
    return null;
  },
});

export const suspendMember = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    memberUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const org = await ctx.db.get(orgId);
    if (org && args.memberUserId === org.ownerId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot suspend the organization owner. Transfer ownership first.",
      });
    }
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.memberUserId)
      )
      .unique();
    if (!member) throw new ConvexError({ code: "NOT_FOUND", message: "Member not found" });
    await ctx.db.patch(member._id, { status: "suspended", suspendedAt: Date.now() });
    return null;
  },
});

export const unsuspendMember = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    memberUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.memberUserId)
      )
      .unique();
    if (!member) throw new ConvexError({ code: "NOT_FOUND", message: "Member not found" });
    await ctx.db.patch(member._id, { status: "active" });
    return null;
  },
});

export const leaveOrganization = mutation({
  args: { userId: v.string(), organizationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const org = await ctx.db.get(orgId);
    if (org && args.userId === org.ownerId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Cannot leave organization as the owner. Transfer ownership or delete the organization first.",
      });
    }
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .unique();
    if (!member) {
      throw new ConvexError({ code: "NOT_FOUND", message: "You are not a member of this organization" });
    }
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    for (const team of teams) {
      const tm = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("userId", args.userId))
        .unique();
      if (tm) await ctx.db.delete(tm._id);
    }
    await ctx.db.delete(member._id);
    return null;
  },
});
