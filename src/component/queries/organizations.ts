import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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
