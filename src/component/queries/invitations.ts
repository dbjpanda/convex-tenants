import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { isInvitationExpired } from "../helpers";
import type { Id } from "../_generated/dataModel";

/**
 * List invitations for an organization
 */
export const listInvitations = query({
  args: {
    organizationId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      email: v.string(),
      role: v.string(),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      message: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("cancelled"),
        v.literal("expired")
      ),
      expiresAt: v.number(),
      isExpired: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();

    return invitations.map((inv) => {
      const i = inv as { message?: string };
      return {
        _id: inv._id as string,
        _creationTime: inv._creationTime,
        organizationId: inv.organizationId as string,
        email: inv.email,
        role: inv.role,
        teamId: inv.teamId ? (inv.teamId as string) : null,
        inviterId: inv.inviterId,
        message: i.message,
        status: inv.status,
        expiresAt: inv.expiresAt,
        isExpired: isInvitationExpired(inv),
      };
    });
  },
});

/**
 * Count invitations for an organization.
 */
export const countInvitations = query({
  args: { organizationId: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .collect();
    return invitations.length;
  },
});

/**
 * List invitations with cursor-based pagination.
 * @see https://docs.convex.dev/database/pagination
 */
export const listInvitationsPaginated = query({
  args: {
    organizationId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((inv) => {
        const i = inv as { message?: string };
        return {
          _id: inv._id as string,
          _creationTime: inv._creationTime,
          organizationId: inv.organizationId as string,
          email: inv.email,
          role: inv.role,
          teamId: inv.teamId ? (inv.teamId as string) : null,
          inviterId: inv.inviterId,
          message: i.message,
          status: inv.status,
          expiresAt: inv.expiresAt,
          isExpired: isInvitationExpired(inv),
        };
      }),
    };
  },
});

/**
 * Get invitation details by ID
 */
export const getInvitation = query({
  args: {
    invitationId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      email: v.string(),
      role: v.string(),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      message: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("cancelled"),
        v.literal("expired")
      ),
      expiresAt: v.number(),
      isExpired: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId as Id<"invitations">);
    if (!invitation) return null;
    const i = invitation as { message?: string };
    return {
      _id: invitation._id as string,
      _creationTime: invitation._creationTime,
      organizationId: invitation.organizationId as string,
      email: invitation.email,
      role: invitation.role,
      teamId: invitation.teamId ? (invitation.teamId as string) : null,
      inviterId: invitation.inviterId,
      message: i.message,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      isExpired: isInvitationExpired(invitation),
    };
  },
});

/**
 * Get pending invitations for an email
 */
export const getPendingInvitationsForEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      email: v.string(),
      role: v.string(),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      expiresAt: v.number(),
      isExpired: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_email_and_status", (q) =>
        q.eq("email", args.email).eq("status", "pending")
      )
      .collect();

    return invitations
      .filter((inv) => !isInvitationExpired(inv))
      .map((inv) => ({
        _id: inv._id as string,
        _creationTime: inv._creationTime,
        organizationId: inv.organizationId as string,
        email: inv.email,
        role: inv.role,
        teamId: inv.teamId ? (inv.teamId as string) : null,
        inviterId: inv.inviterId,
        expiresAt: inv.expiresAt,
        isExpired: false,
      }));
  },
});
