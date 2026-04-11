import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { query, mutation, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { ensureUniqueSlug } from "./helpers";
import type { Id } from "./_generated/dataModel";

/** Max rows deleted per drain mutation invocation. Kept well under Convex's
 *  per-mutation write/read limits (8K writes / 16K reads / 30s). */
const DELETE_BATCH_SIZE = 200;

const organizationSettingsValidator = v.optional(
  v.object({
    allowPublicSignup: v.optional(v.boolean()),
    requireInvitationToJoin: v.optional(v.boolean()),
  })
);

// ============================================================================
// Queries
// ============================================================================

export const listUserOrganizations = query({
  args: {
    userId: v.string(),
    sortBy: v.optional(v.union(v.literal("name"), v.literal("createdAt"), v.literal("slug"))),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    /**
     * Optional membership status filter. Defaults to "active" so callers do not
     * have to paginate through suspended memberships. Pass "all" to get the
     * legacy behavior of listing every membership regardless of status.
     */
    status: v.optional(
      v.union(v.literal("active"), v.literal("suspended"), v.literal("all"))
    ),
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      logo: v.union(v.null(), v.string()),
      metadata: v.optional(v.any()),
      settings: v.optional(
        v.object({
          allowPublicSignup: v.optional(v.boolean()),
          requireInvitationToJoin: v.optional(v.boolean()),
        })
      ),
      ownerId: v.string(),
      status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
      role: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const statusFilter = args.status ?? "active";
    let memberships;
    if (statusFilter === "suspended") {
      memberships = await ctx.db
        .query("members")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", args.userId).eq("status", "suspended")
        )
        .collect();
    } else {
      // "active" and "all" both use the legacy by_user index so that rows
      // predating the `status` field (where status === undefined) are still
      // visible. For "active", treat undefined as active.
      const all = await ctx.db
        .query("members")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      memberships =
        statusFilter === "all"
          ? all
          : all.filter((m) => (m.status ?? "active") === "active");
    }

    const organizations = await Promise.all(
      memberships.map(async (membership) => {
        const org = await ctx.db.get(membership.organizationId);
        if (!org) return null;

        const orgExt = org as { settings?: { allowPublicSignup?: boolean; requireInvitationToJoin?: boolean } };
        return {
          _id: org._id as string,
          _creationTime: org._creationTime,
          name: org.name,
          slug: org.slug,
          logo: org.logo,
          metadata: org.metadata,
          settings: orgExt.settings,
          ownerId: org.ownerId,
          status: (org as { status?: "active" | "suspended" | "archived" }).status,
          role: membership.role,
        };
      })
    );

    const list = organizations.filter((org): org is NonNullable<typeof org> => org !== null);
    const sortBy = args.sortBy ?? "name";
    const order = args.sortOrder ?? "asc";
    const mult = order === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const va = sortBy === "name" ? a.name : sortBy === "slug" ? a.slug : a._creationTime;
      const vb = sortBy === "name" ? b.name : sortBy === "slug" ? b.slug : b._creationTime;
      return va < vb ? -mult : va > vb ? mult : 0;
    });
    return list;
  },
});

export const getOrganization = query({
  args: { organizationId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      logo: v.union(v.null(), v.string()),
      metadata: v.optional(v.any()),
      settings: v.optional(
        v.object({
          allowPublicSignup: v.optional(v.boolean()),
          requireInvitationToJoin: v.optional(v.boolean()),
        })
      ),
      ownerId: v.string(),
      status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
    })
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId as Id<"organizations">);
    if (!org) return null;
    const o = org as { status?: "active" | "suspended" | "archived"; settings?: { allowPublicSignup?: boolean; requireInvitationToJoin?: boolean } };
    return {
      _id: org._id as string,
      _creationTime: org._creationTime,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      metadata: org.metadata,
      settings: o.settings,
      ownerId: org.ownerId,
      status: o.status,
    };
  },
});

export const getOrganizationBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      logo: v.union(v.null(), v.string()),
      metadata: v.optional(v.any()),
      settings: v.optional(
        v.object({
          allowPublicSignup: v.optional(v.boolean()),
          requireInvitationToJoin: v.optional(v.boolean()),
        })
      ),
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
    const o = org as { status?: "active" | "suspended" | "archived"; settings?: { allowPublicSignup?: boolean; requireInvitationToJoin?: boolean } };
    return {
      _id: org._id as string,
      _creationTime: org._creationTime,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      metadata: org.metadata,
      settings: o.settings,
      ownerId: org.ownerId,
      status: o.status,
    };
  },
});

// ============================================================================
// Mutations
// ============================================================================

export const createOrganization = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.string()),
    metadata: v.optional(v.any()),
    settings: organizationSettingsValidator,
    creatorRole: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (args.metadata !== undefined && JSON.stringify(args.metadata).length > 10000) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Metadata exceeds maximum size of 10KB" });
    }
    const uniqueSlug = await ensureUniqueSlug(ctx, args.slug);
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: uniqueSlug,
      logo: args.logo ?? null,
      metadata: args.metadata,
      settings: args.settings,
      ownerId: args.userId,
      status: "active",
    });
    await ctx.db.insert("members", {
      organizationId,
      userId: args.userId,
      role: args.creatorRole ?? "owner",
      status: "active",
      joinedAt: Date.now(),
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
    settings: organizationSettingsValidator,
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const org = await ctx.db.get(orgId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
    }

    if (args.metadata !== undefined && JSON.stringify(args.metadata).length > 10000) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "Metadata exceeds maximum size of 10KB" });
    }

    // Verify the caller is an admin or owner of this organization
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .unique();
    if (!member || !["admin", "owner"].includes(member.role)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins or owners can update the organization" });
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.logo !== undefined) updates.logo = args.logo;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.settings !== undefined) updates.settings = args.settings;
    if (args.status !== undefined) updates.status = args.status;
    if (args.slug !== undefined) {
      updates.slug = await ensureUniqueSlug(ctx, args.slug, orgId);
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
    // Check self-transfer first, before any DB reads
    if (args.newOwnerUserId === args.userId) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot transfer ownership to yourself" });
    }
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

/**
 * Marks an organization for deletion and schedules asynchronous cascade removal.
 * The deletion is final but not instantaneous — a background internalAction drains
 * the org's teams, teamMembers, invitations, and members in bounded batches before
 * deleting the org doc itself. Consumers see the same signature/return as before.
 */
export const deleteOrganization = mutation({
  args: { userId: v.string(), organizationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const org = await ctx.db.get(orgId);
    if (!org) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
    }
    // Owner-only invariant at the component level — defense in depth
    if (org.ownerId !== args.userId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the organization owner can delete the organization" });
    }
    const orgExt = org as { status?: "active" | "suspended" | "archived"; deletionScheduledAt?: number };
    // Idempotent: if already scheduled, don't re-schedule.
    if (orgExt.deletionScheduledAt !== undefined) {
      return null;
    }
    await ctx.db.patch(orgId, {
      status: "archived",
      deletionScheduledAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.organizations.deleteOrganizationData, {
      organizationId: orgId as string,
    });
    return null;
  },
});

/**
 * Deletes up to DELETE_BATCH_SIZE child rows (teams, teamMembers, invitations,
 * members) belonging to an organization and reports how many rows remain.
 *
 * Safe to call repeatedly and safe to call on an already-drained / deleted org
 * (returns { remaining: 0 } as a no-op).
 */
export const _drainOrganizationBatch = internalMutation({
  args: { organizationId: v.string() },
  returns: v.object({ remaining: v.number(), deletedThisBatch: v.number() }),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const org = await ctx.db.get(orgId);
    if (!org) {
      // Org already gone — nothing to drain.
      return { remaining: 0, deletedThisBatch: 0 };
    }

    let budget = DELETE_BATCH_SIZE;
    let deleted = 0;

    // 1) teamMembers first (children of teams) — walk teams and take their members.
    if (budget > 0) {
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .take(budget);
      for (const team of teams) {
        if (budget <= 0) break;
        const tms = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .take(budget);
        for (const tm of tms) {
          if (budget <= 0) break;
          await ctx.db.delete(tm._id);
          budget -= 1;
          deleted += 1;
        }
      }
    }

    // 2) teams (only those whose teamMembers are fully drained in this or prior batches)
    if (budget > 0) {
      const teams = await ctx.db
        .query("teams")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .take(budget);
      for (const team of teams) {
        if (budget <= 0) break;
        const anyTm = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .first();
        if (anyTm) continue; // team still has members — skip, next batch handles it
        await ctx.db.delete(team._id);
        budget -= 1;
        deleted += 1;
      }
    }

    // 3) invitations
    if (budget > 0) {
      const invs = await ctx.db
        .query("invitations")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .take(budget);
      for (const inv of invs) {
        if (budget <= 0) break;
        await ctx.db.delete(inv._id);
        budget -= 1;
        deleted += 1;
      }
    }

    // 4) members
    if (budget > 0) {
      const members = await ctx.db
        .query("members")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .take(budget);
      for (const m of members) {
        if (budget <= 0) break;
        await ctx.db.delete(m._id);
        budget -= 1;
        deleted += 1;
      }
    }

    // Count remaining across all child tables (use first() as cheap non-empty probe).
    let remaining = 0;
    const probeTeam = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();
    if (probeTeam) remaining += 1;
    const probeInv = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();
    if (probeInv) remaining += 1;
    const probeMember = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();
    if (probeMember) remaining += 1;
    // teamMembers only exist via a team — covered by probeTeam above.

    return { remaining, deletedThisBatch: deleted };
  },
});

/**
 * Final step of cascade delete: removes the organization document itself once
 * all child tables have been verified empty. No-op if the org is already gone.
 */
/**
 * Hard cap on how many times `deleteOrganizationData` can be re-scheduled after
 * a racing-insert finds child rows during the finalize step. Beyond this, we
 * leave the org in `archived` + `deletionScheduledAt` state and require operator
 * intervention.
 */
const MAX_DELETE_RETRIES = 5;

export const _finalizeOrganizationDelete = internalMutation({
  args: { organizationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const org = await ctx.db.get(orgId);
    if (!org) return null;

    // Invariant check: all child tables must be empty before deleting the org doc.
    const anyTeam = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();
    const anyInv = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();
    const anyMember = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();
    if (anyTeam || anyInv || anyMember) {
      // A racing insert landed after the drain loop finished (e.g. a parallel
      // mutation added an invitation or member before we could delete the org
      // doc). Re-schedule the drain+finalize cycle up to MAX_DELETE_RETRIES
      // times before giving up. The retry counter lives on the org doc so it
      // survives across action restarts.
      const orgExt = org as { deleteRetryCount?: number };
      const retryCount = orgExt.deleteRetryCount ?? 0;
      if (retryCount >= MAX_DELETE_RETRIES) {
        throw new ConvexError({
          code: "INTERNAL",
          message: `Cannot finalize delete after ${MAX_DELETE_RETRIES} retries: organization still has child rows. Manual intervention required.`,
        });
      }
      await ctx.db.patch(orgId, { deleteRetryCount: retryCount + 1 });
      await ctx.scheduler.runAfter(0, internal.organizations.deleteOrganizationData, {
        organizationId: args.organizationId,
      });
      return null;
    }
    await ctx.db.delete(orgId);
    return null;
  },
});

/**
 * Scheduled action that drives cascade deletion of an organization's child
 * tables, then finalizes by removing the org doc. Loops over the drain mutation
 * until no rows remain. Runs outside the transaction so it can iterate safely.
 */
export const deleteOrganizationData = internalAction({
  args: { organizationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Hard upper bound on iterations to prevent runaway loops in case of bugs.
    const MAX_ITERATIONS = 1000;
    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
      const { remaining, deletedThisBatch }: { remaining: number; deletedThisBatch: number } =
        await ctx.runMutation(internal.organizations._drainOrganizationBatch, {
          organizationId: args.organizationId,
        });
      if (remaining === 0) break;
      // Defensive: if a batch made no progress but rows remain, abort to avoid infinite loop.
      if (deletedThisBatch === 0) {
        throw new ConvexError({
          code: "INTERNAL",
          message: "deleteOrganizationData made no progress; aborting to avoid infinite loop",
        });
      }
    }
    await ctx.runMutation(internal.organizations._finalizeOrganizationDelete, {
      organizationId: args.organizationId,
    });
    return null;
  },
});
