import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * List all members of an organization (without user data enrichment).
 * Optional status filter: "active" | "suspended" | "all". Default "active".
 */
export const listOrganizationMembers = query({
  args: {
    organizationId: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("all"))),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      userId: v.string(),
      role: v.string(),
      status: v.optional(v.union(v.literal("active"), v.literal("suspended"))),
      suspendedAt: v.optional(v.number()),
      joinedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    const statusFilter = args.status ?? "active";
    const filtered =
      statusFilter === "all"
        ? members
        : members.filter((m) => (m.status ?? "active") === statusFilter);

    return filtered.map((member) => ({
      _id: member._id as string,
      _creationTime: member._creationTime,
      organizationId: member.organizationId as string,
      userId: member.userId,
      role: member.role,
      status: member.status,
      suspendedAt: member.suspendedAt,
      joinedAt: member.joinedAt,
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
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const statusFilter = args.status ?? "active";
    const filteredPage =
      statusFilter === "all"
        ? result.page
        : result.page.filter((m) => (m.status ?? "active") === statusFilter);
    return {
      ...result,
      page: filteredPage.map((member) => ({
        _id: member._id as string,
        _creationTime: member._creationTime,
        organizationId: member.organizationId as string,
        userId: member.userId,
        role: member.role,
        status: member.status,
        suspendedAt: member.suspendedAt,
        joinedAt: member.joinedAt,
      })),
    };
  },
});

/**
 * Count members in an organization.
 * Optional status: "active" | "suspended" | "all". Default "active".
 */
export const countOrganizationMembers = query({
  args: {
    organizationId: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("all"))),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();
    const statusFilter = args.status ?? "active";
    if (statusFilter === "all") return members.length;
    return members.filter((m) => (m.status ?? "active") === statusFilter).length;
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
      status: v.optional(v.union(v.literal("active"), v.literal("suspended"))),
      suspendedAt: v.optional(v.number()),
      joinedAt: v.optional(v.number()),
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
      status: member.status,
      suspendedAt: member.suspendedAt,
      joinedAt: member.joinedAt,
    };
  },
});
