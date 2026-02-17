import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "./_generated/server";
import { isInvitationExpired } from "./helpers";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// Queries
// ============================================================================

export const listInvitations = query({
  args: {
    organizationId: v.string(),
    sortBy: v.optional(v.union(v.literal("inviteeIdentifier"), v.literal("expiresAt"), v.literal("createdAt"))),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      inviteeIdentifier: v.string(),
      identifierType: v.optional(v.string()),
      role: v.string(),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      inviterName: v.optional(v.string()),
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

    const sortBy = args.sortBy ?? "createdAt";
    const order = args.sortOrder ?? "desc";
    const mult = order === "asc" ? 1 : -1;
    const sorted = [...invitations].sort((a, b) => {
      const va = sortBy === "inviteeIdentifier" ? a.inviteeIdentifier : sortBy === "expiresAt" ? a.expiresAt : a._creationTime;
      const vb = sortBy === "inviteeIdentifier" ? b.inviteeIdentifier : sortBy === "expiresAt" ? b.expiresAt : b._creationTime;
      return va < vb ? -mult : va > vb ? mult : 0;
    });

    return sorted.map((inv) => {
      const i = inv as { message?: string; inviterName?: string; identifierType?: string };
      return {
        _id: inv._id as string,
        _creationTime: inv._creationTime,
        organizationId: inv.organizationId as string,
        inviteeIdentifier: inv.inviteeIdentifier,
        identifierType: i.identifierType,
        role: inv.role,
        teamId: inv.teamId ? (inv.teamId as string) : null,
        inviterId: inv.inviterId,
        inviterName: i.inviterName,
        message: i.message,
        status: inv.status,
        expiresAt: inv.expiresAt,
        isExpired: isInvitationExpired(inv),
      };
    });
  },
});

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
        const i = inv as { message?: string; inviterName?: string; identifierType?: string };
        return {
          _id: inv._id as string,
          _creationTime: inv._creationTime,
          organizationId: inv.organizationId as string,
          inviteeIdentifier: inv.inviteeIdentifier,
          identifierType: i.identifierType,
          role: inv.role,
          teamId: inv.teamId ? (inv.teamId as string) : null,
          inviterId: inv.inviterId,
          inviterName: i.inviterName,
          message: i.message,
          status: inv.status,
          expiresAt: inv.expiresAt,
          isExpired: isInvitationExpired(inv),
        };
      }),
    };
  },
});

export const getInvitation = query({
  args: { invitationId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      organizationName: v.string(),
      inviteeIdentifier: v.string(),
      identifierType: v.optional(v.string()),
      role: v.string(),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      inviterName: v.optional(v.string()),
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
    
    // Fetch organization to get its name
    const organization = await ctx.db.get(invitation.organizationId);
    if (!organization) return null;
    
    const i = invitation as { message?: string; inviterName?: string; identifierType?: string };
    return {
      _id: invitation._id as string,
      _creationTime: invitation._creationTime,
      organizationId: invitation.organizationId as string,
      organizationName: organization.name,
      inviteeIdentifier: invitation.inviteeIdentifier,
      identifierType: i.identifierType,
      role: invitation.role,
      teamId: invitation.teamId ? (invitation.teamId as string) : null,
      inviterId: invitation.inviterId,
      inviterName: i.inviterName,
      message: i.message,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      isExpired: isInvitationExpired(invitation),
    };
  },
});

export const getPendingInvitationsForIdentifier = query({
  args: { identifier: v.string() },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      organizationId: v.string(),
      organizationName: v.string(),
      inviteeIdentifier: v.string(),
      identifierType: v.optional(v.string()),
      role: v.string(),
      teamId: v.union(v.null(), v.string()),
      inviterId: v.string(),
      inviterName: v.optional(v.string()),
      expiresAt: v.number(),
      isExpired: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_invitee_identifier_and_status", (q) =>
        q.eq("inviteeIdentifier", args.identifier).eq("status", "pending")
      )
      .collect();

    const result = [];
    for (const inv of invitations.filter((inv) => !isInvitationExpired(inv))) {
      const organization = await ctx.db.get(inv.organizationId);
      if (!organization) continue;
      
      const i = inv as { inviterName?: string; identifierType?: string };
      result.push({
        _id: inv._id as string,
        _creationTime: inv._creationTime,
        organizationId: inv.organizationId as string,
        organizationName: organization.name,
        inviteeIdentifier: inv.inviteeIdentifier,
        identifierType: i.identifierType,
        role: inv.role,
        teamId: inv.teamId ? (inv.teamId as string) : null,
        inviterId: inv.inviterId,
        inviterName: i.inviterName,
        expiresAt: inv.expiresAt,
        isExpired: false,
      });
    }
    return result;
  },
});

// ============================================================================
// Mutations
// ============================================================================

export const inviteMember = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    inviteeIdentifier: v.string(),
    identifierType: v.optional(v.string()),
    role: v.string(),
    teamId: v.optional(v.string()),
    message: v.optional(v.string()),
    inviterName: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    invitationId: v.string(),
    inviteeIdentifier: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const normalizedIdentifier = args.inviteeIdentifier.trim().toLowerCase();
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
      .withIndex("by_invitee_identifier_and_status", (q) =>
        q.eq("inviteeIdentifier", normalizedIdentifier).eq("status", "pending")
      )
      .first();
    if (existing && existing.organizationId === orgId) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "A pending invitation already exists for this identifier",
      });
    }
    const expiresAt = args.expiresAt ?? Date.now() + 48 * 60 * 60 * 1000;
    const invitationId = await ctx.db.insert("invitations", {
      organizationId: orgId,
      inviteeIdentifier: normalizedIdentifier,
      identifierType: args.identifierType,
      role: args.role,
      teamId: args.teamId ? (args.teamId as Id<"teams">) : null,
      inviterId: args.userId,
      inviterName: args.inviterName,
      message: args.message,
      status: "pending",
      expiresAt,
    });
    return { invitationId: invitationId as string, inviteeIdentifier: normalizedIdentifier, expiresAt };
  },
});

export const acceptInvitation = mutation({
  args: {
    invitationId: v.string(),
    acceptingUserId: v.string(),
    acceptingUserIdentifier: v.optional(v.string()),
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
    // No hardcoded validation - validation will be done via callback in makeTenantsAPI
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
  returns: v.object({ invitationId: v.string(), inviteeIdentifier: v.string() }),
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
    return { invitationId: invitation._id as string, inviteeIdentifier: invitation.inviteeIdentifier };
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

const invitationItemValidator = v.object({
  inviteeIdentifier: v.string(),
  identifierType: v.optional(v.string()),
  role: v.string(),
  message: v.optional(v.string()),
  teamId: v.optional(v.string()),
});

export const bulkInviteMembers = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    invitations: v.array(invitationItemValidator),
    inviterName: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    success: v.array(v.object({ invitationId: v.string(), inviteeIdentifier: v.string(), expiresAt: v.number() })),
    errors: v.array(v.object({ inviteeIdentifier: v.string(), code: v.string(), message: v.string() })),
  }),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const defaultExpiresAt = args.expiresAt ?? Date.now() + 48 * 60 * 60 * 1000;
    const success: { invitationId: string; inviteeIdentifier: string; expiresAt: number }[] = [];
    const errors: { inviteeIdentifier: string; code: string; message: string }[] = [];

    for (const inv of args.invitations) {
      const normalizedIdentifier = inv.inviteeIdentifier.trim().toLowerCase();
      try {
        if (inv.teamId) {
          const team = await ctx.db.get(inv.teamId as Id<"teams">);
          if (!team) {
            errors.push({ inviteeIdentifier: normalizedIdentifier, code: "NOT_FOUND", message: "Team not found" });
            continue;
          }
          if (team.organizationId !== orgId) {
            errors.push({
              inviteeIdentifier: normalizedIdentifier,
              code: "FORBIDDEN",
              message: "Team must belong to the organization",
            });
            continue;
          }
        }
        const existing = await ctx.db
          .query("invitations")
          .withIndex("by_invitee_identifier_and_status", (q) =>
            q.eq("inviteeIdentifier", normalizedIdentifier).eq("status", "pending")
          )
          .first();
        if (existing && existing.organizationId === orgId) {
          errors.push({
            inviteeIdentifier: normalizedIdentifier,
            code: "ALREADY_EXISTS",
            message: "A pending invitation already exists for this identifier",
          });
          continue;
        }
        const invitationId = await ctx.db.insert("invitations", {
          organizationId: orgId,
          inviteeIdentifier: normalizedIdentifier,
          identifierType: inv.identifierType,
          role: inv.role,
          teamId: inv.teamId ? (inv.teamId as Id<"teams">) : null,
          inviterId: args.userId,
          inviterName: args.inviterName,
          message: inv.message,
          status: "pending",
          expiresAt: defaultExpiresAt,
        });
        success.push({
          invitationId: invitationId as string,
          inviteeIdentifier: normalizedIdentifier,
          expiresAt: defaultExpiresAt,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ inviteeIdentifier: normalizedIdentifier, code: "ERROR", message: msg });
      }
    }
    return { success, errors };
  },
});
