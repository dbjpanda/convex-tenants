import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation } from "./_generated/server";
import { isInvitationExpired } from "./helpers";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// Queries
// ============================================================================

const invitationShape = v.object({
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
});

export const listInvitations = query({
  args: {
    organizationId: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("accepted"), v.literal("cancelled"), v.literal("expired"))),
    sortBy: v.optional(v.union(v.literal("inviteeIdentifier"), v.literal("expiresAt"), v.literal("createdAt"))),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: v.optional(paginationOptsValidator),
  },
  returns: v.union(
    v.array(invitationShape),
    v.object({
      page: v.array(invitationShape),
      isDone: v.boolean(),
      continueCursor: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    if (args.paginationOpts) {
      const result = args.status !== undefined
        ? await ctx.db
            .query("invitations")
            .withIndex("by_organization_and_status", (q) =>
              q.eq("organizationId", orgId).eq("status", args.status!)
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("invitations")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", orgId)
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
    }
    const invitations = args.status !== undefined
      ? await ctx.db
          .query("invitations")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", orgId).eq("status", args.status!)
          )
          .collect()
      : await ctx.db
          .query("invitations")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", orgId)
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
  args: {
    organizationId: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("accepted"), v.literal("cancelled"), v.literal("expired"), v.literal("all"))),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const statusFilter = args.status ?? "pending";
    if (statusFilter === "all") {
      const invitations = await ctx.db
        .query("invitations")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
      return invitations.length;
    }
    // Use targeted index — only fetches invitations with matching status
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", orgId).eq("status", statusFilter)
      )
      .collect();
    return invitations.length;
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
      .withIndex("by_org_invitee_and_status", (q) =>
        q.eq("organizationId", orgId).eq("inviteeIdentifier", normalizedIdentifier).eq("status", "pending")
      )
      .first();
    if (existing) {
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

/**
 * Sentinel token that the trusted wrapper layer (makeTenantsAPI) passes when it
 * has already validated the invitation identifier via a consumer-supplied
 * callback. Direct component callers should NOT use this — it exists only so
 * the wrapper can opt out of the component-level identifier check after doing
 * its own check. This is a soft boundary: any caller who knows this string can
 * bypass the check. A stronger boundary requires Convex component identity
 * primitives that do not yet exist. Tracked in docs/known-limitations.md §4.
 */
const TRUSTED_WRAPPER_SKIP_SENTINEL = "TRUSTED_WRAPPER_SKIP";

export const acceptInvitation = mutation({
  args: {
    invitationId: v.string(),
    acceptingUserId: v.string(),
    acceptingUserIdentifier: v.optional(v.string()),
    /**
     * @deprecated Use `trustedSkipToken` instead. Retained for backwards
     * compatibility with the current wrapper call sites in
     * `src/client/makeTenantsAPI.ts` and `src/client/tenants-class.ts`.
     * A future follow-up should migrate the wrapper and remove this arg.
     */
    skipIdentifierCheck: v.optional(v.boolean()),
    /**
     * Opaque trust token set by the wrapper layer (makeTenantsAPI) when it has
     * already validated the invitation identifier via a consumer callback.
     * Must equal the internal sentinel to take effect. Unknown values are
     * ignored (identifier check is enforced).
     */
    trustedSkipToken: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const skipIdentifier =
      args.skipIdentifierCheck === true ||
      args.trustedSkipToken === TRUSTED_WRAPPER_SKIP_SENTINEL;
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
    // Defense in depth: enforce identifier match at the component level.
    // Direct callers MUST provide acceptingUserIdentifier for identifier-based invitations.
    if (!skipIdentifier && invitation.inviteeIdentifier) {
      if (!args.acceptingUserIdentifier) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "acceptingUserIdentifier is required to accept this invitation",
        });
      }
      const normalize = (s: string) => s.trim().toLowerCase();
      if (normalize(args.acceptingUserIdentifier) !== normalize(invitation.inviteeIdentifier)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Invitation identifier does not match the accepting user",
        });
      }
    }
    await ctx.db.insert("members", {
      organizationId: invitation.organizationId,
      userId: args.acceptingUserId,
      role: invitation.role,
      status: "active",
      joinedAt: Date.now(),
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
    // Verify the caller is an active member of the invitation's organization
    const callerMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", invitation.organizationId).eq("userId", args.userId)
      )
      .unique();
    if (!callerMember || callerMember.status === "suspended") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not an active member of this organization" });
    }
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
    const newExpiresAt = Date.now() + 48 * 60 * 60 * 1000;
    await ctx.db.patch(invitationId, { expiresAt: newExpiresAt });
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
    // Verify the caller is an active member of the invitation's organization
    const callerMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", invitation.organizationId).eq("userId", args.userId)
      )
      .unique();
    if (!callerMember || callerMember.status === "suspended") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not an active member of this organization" });
    }
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
    if (args.invitations.length > 100) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Cannot invite more than 100 members at once" });
    }
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
          .withIndex("by_org_invitee_and_status", (q) =>
            q.eq("organizationId", orgId).eq("inviteeIdentifier", normalizedIdentifier).eq("status", "pending")
          )
          .first();
        if (existing) {
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

// Internal mutation — scheduled by the consumer app via `convex/crons.ts`. Not
// part of the public HTTP surface; callable only via `components.tenants.invitations.pruneExpiredInvitations`
// from consumer crons, actions, or other internal functions.
export const pruneExpiredInvitations = internalMutation({
  args: {
    organizationId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    expired: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 200, 1000));
    const now = Date.now();

    // Fetch candidate pending invitations. When an org is provided we can use
    // the targeted `by_organization_and_status` compound index. Otherwise we
    // fall back to a bounded scan of the `invitations` table — there is no
    // global `by_status` index (see schema.ts), so we rely on `.take(limit)`
    // plus a post-filter to keep this bounded.
    let candidates;
    if (args.organizationId) {
      const orgId = args.organizationId as Id<"organizations">;
      candidates = await ctx.db
        .query("invitations")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", orgId).eq("status", "pending")
        )
        .take(limit);
    } else {
      // No global by_status index — bounded full-table scan capped by `limit`.
      candidates = await ctx.db.query("invitations").take(limit);
    }

    let expired = 0;
    for (const inv of candidates) {
      if (inv.status === "pending" && inv.expiresAt < now) {
        await ctx.db.patch(inv._id, { status: "expired" });
        expired += 1;
      }
    }
    return { scanned: candidates.length, expired };
  },
});
