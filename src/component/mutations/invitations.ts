import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { isInvitationExpired } from "../helpers";
import type { Id } from "../_generated/dataModel";

export const inviteMember = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    email: v.string(),
    role: v.string(),
    teamId: v.optional(v.string()),
    message: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    invitationId: v.string(),
    email: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const normalizedEmail = args.email.trim().toLowerCase();
    if (args.teamId) {
      const team = await ctx.db.get(args.teamId as Id<"teams">);
      if (!team) throw new ConvexError({ code: "NOT_FOUND", message: "Team not found" });
      if (team.organizationId !== orgId) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Team must belong to the invitation organization",
        });
      }
    }
    const existing = await ctx.db
      .query("invitations")
      .withIndex("by_email_and_status", (q) =>
        q.eq("email", normalizedEmail).eq("status", "pending")
      )
      .first();
    if (existing && existing.organizationId === orgId) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "A pending invitation already exists for this email",
      });
    }
    const expiresAt = args.expiresAt ?? Date.now() + 48 * 60 * 60 * 1000;
    const invitationId = await ctx.db.insert("invitations", {
      organizationId: orgId,
      email: normalizedEmail,
      role: args.role,
      teamId: args.teamId ? (args.teamId as Id<"teams">) : null,
      inviterId: args.userId,
      message: args.message,
      status: "pending",
      expiresAt,
    });
    return { invitationId: invitationId as string, email: normalizedEmail, expiresAt };
  },
});

export const acceptInvitation = mutation({
  args: {
    invitationId: v.string(),
    acceptingUserId: v.string(),
    acceptingEmail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitationId = args.invitationId as Id<"invitations">;
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) throw new ConvexError({ code: "NOT_FOUND", message: "Invitation not found" });
    if (invitation.status !== "pending") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `Invitation has already been ${invitation.status}`,
      });
    }
    if (isInvitationExpired(invitation)) {
      await ctx.db.patch(invitationId, { status: "expired" });
      throw new ConvexError({ code: "EXPIRED", message: "Invitation has expired" });
    }
    const existingMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", invitation.organizationId).eq("userId", args.acceptingUserId)
      )
      .unique();
    if (existingMember) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "You are already a member of this organization",
      });
    }
    if (
      args.acceptingEmail &&
      args.acceptingEmail.trim().toLowerCase() !== invitation.email.trim().toLowerCase()
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Invitation email does not match authenticated user",
      });
    }
    await ctx.db.insert("members", {
      organizationId: invitation.organizationId,
      userId: args.acceptingUserId,
      role: invitation.role,
    });
    if (invitation.teamId) {
      const team = await ctx.db.get(invitation.teamId);
      if (!team || team.organizationId !== invitation.organizationId) {
        throw new ConvexError({
          code: "INVALID_STATE",
          message: "Invitation team is invalid for this organization",
        });
      }
      const existingTm = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", invitation.teamId as Id<"teams">).eq("userId", args.acceptingUserId)
        )
        .unique();
      if (!existingTm) {
        await ctx.db.insert("teamMembers", {
          teamId: invitation.teamId,
          userId: args.acceptingUserId,
        });
      }
    }
    await ctx.db.patch(invitationId, { status: "accepted" });
    return null;
  },
});

export const resendInvitation = mutation({
  args: { userId: v.string(), invitationId: v.string() },
  returns: v.object({ invitationId: v.string(), email: v.string() }),
  handler: async (ctx, args) => {
    const invitationId = args.invitationId as Id<"invitations">;
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) throw new ConvexError({ code: "NOT_FOUND", message: "Invitation not found" });
    if (invitation.status !== "pending") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `Cannot resend ${invitation.status} invitation`,
      });
    }
    if (isInvitationExpired(invitation)) {
      await ctx.db.patch(invitationId, { status: "expired" });
      throw new ConvexError({
        code: "EXPIRED",
        message: "Invitation has expired. Please create a new one.",
      });
    }
    return { invitationId: invitation._id as string, email: invitation.email };
  },
});

export const cancelInvitation = mutation({
  args: { userId: v.string(), invitationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitationId = args.invitationId as Id<"invitations">;
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) throw new ConvexError({ code: "NOT_FOUND", message: "Invitation not found" });
    if (invitation.status !== "pending") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: `Invitation has already been ${invitation.status}`,
      });
    }
    await ctx.db.patch(invitationId, { status: "cancelled" });
    return null;
  },
});
