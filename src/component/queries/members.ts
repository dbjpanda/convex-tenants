import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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
 * Count members in an organization.
 */
export const countOrganizationMembers = query({
  args: { organizationId: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();
    return members.length;
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
