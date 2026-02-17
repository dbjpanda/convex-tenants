import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// Queries
// ============================================================================

export const listOrganizationMembers = query({
  args: {
    organizationId: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("all"))),
    sortBy: v.optional(v.union(v.literal("role"), v.literal("joinedAt"), v.literal("createdAt"), v.literal("userId"))),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
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
    let filtered =
      statusFilter === "all"
        ? members
        : members.filter((m) => (m.status ?? "active") === statusFilter);

    const sortBy = args.sortBy ?? "createdAt";
    const order = args.sortOrder ?? "desc";
    const mult = order === "asc" ? 1 : -1;
    filtered = [...filtered].sort((a, b) => {
      let va: string | number = a.userId;
      let vb: string | number = b.userId;
      if (sortBy === "role") { va = a.role; vb = b.role; }
      else if (sortBy === "joinedAt") { va = a.joinedAt ?? a._creationTime; vb = b.joinedAt ?? b._creationTime; }
      else if (sortBy === "createdAt") { va = a._creationTime; vb = b._creationTime; }
      return va < vb ? -mult : va > vb ? mult : 0;
    });

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

const ROLE_HIERARCHY = {
  owner: 3,
  admin: 2,
  member: 1,
} as const;

export const checkMemberPermission = query({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    minRole: v.union(v.literal("member"), v.literal("admin"), v.literal("owner")),
  },
  returns: v.object({
    hasPermission: v.boolean(),
    currentRole: v.union(
      v.null(),
      v.union(v.literal("owner"), v.literal("admin"), v.literal("member"))
    ),
  }),
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("userId", args.userId)
      )
      .unique();

    if (!member) return { hasPermission: false, currentRole: null };

    const role = member.role as "owner" | "admin" | "member";
    const hasPermission =
      ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[args.minRole];

    return { hasPermission, currentRole: role };
  },
});

// ============================================================================
// Mutations
// ============================================================================

function domainFromEmail(email: string): string {
  const at = email.trim().toLowerCase().indexOf("@");
  if (at === -1) return "";
  return email.trim().toLowerCase().slice(at + 1);
}

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
    const joinedAt = Date.now();
    await ctx.db.insert("members", {
      organizationId: orgId,
      userId: args.memberUserId,
      role: args.role,
      status: "active",
      joinedAt,
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

const bulkAddMemberItemValidator = v.object({ memberUserId: v.string(), role: v.string() });

export const bulkAddMembers = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    members: v.array(bulkAddMemberItemValidator),
  },
  returns: v.object({
    success: v.array(v.string()),
    errors: v.array(v.object({ userId: v.string(), code: v.string(), message: v.string() })),
  }),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const success: string[] = [];
    const errors: { userId: string; code: string; message: string }[] = [];

    for (const m of args.members) {
      try {
        const existing = await ctx.db
          .query("members")
          .withIndex("by_organization_and_user", (q) =>
            q.eq("organizationId", orgId).eq("userId", m.memberUserId)
          )
          .unique();
        if (existing) {
          errors.push({
            userId: m.memberUserId,
            code: "ALREADY_EXISTS",
            message: "User is already a member of this organization",
          });
          continue;
        }
        const joinedAt = Date.now();
        await ctx.db.insert("members", {
          organizationId: orgId,
          userId: m.memberUserId,
          role: m.role,
          status: "active",
          joinedAt,
        });
        success.push(m.memberUserId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ userId: m.memberUserId, code: "ERROR", message: msg });
      }
    }
    return { success, errors };
  },
});

export const bulkRemoveMembers = mutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    memberUserIds: v.array(v.string()),
  },
  returns: v.object({
    success: v.array(v.string()),
    errors: v.array(v.object({ userId: v.string(), code: v.string(), message: v.string() })),
  }),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const org = await ctx.db.get(orgId);
    const success: string[] = [];
    const errors: { userId: string; code: string; message: string }[] = [];

    for (const memberUserId of args.memberUserIds) {
      try {
        const member = await ctx.db
          .query("members")
          .withIndex("by_organization_and_user", (q) =>
            q.eq("organizationId", orgId).eq("userId", memberUserId)
          )
          .unique();
        if (!member) {
          errors.push({ userId: memberUserId, code: "NOT_FOUND", message: "Member not found" });
          continue;
        }
        if (org && memberUserId === org.ownerId) {
          errors.push({
            userId: memberUserId,
            code: "FORBIDDEN",
            message: "Cannot remove the organization owner. Transfer ownership first.",
          });
          continue;
        }
        const teams = await ctx.db
          .query("teams")
          .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
          .collect();
        for (const team of teams) {
          const tm = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) =>
              q.eq("teamId", team._id).eq("userId", memberUserId)
            )
            .unique();
          if (tm) await ctx.db.delete(tm._id);
        }
        await ctx.db.delete(member._id);
        success.push(memberUserId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ userId: memberUserId, code: "ERROR", message: msg });
      }
    }
    return { success, errors };
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
