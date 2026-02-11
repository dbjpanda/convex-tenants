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

function domainFromEmail(email: string): string {
  const at = email.trim().toLowerCase().indexOf("@");
  if (at === -1) return "";
  return email.trim().toLowerCase().slice(at + 1);
}

/**
 * Join an organization by domain: user's email domain must be in the org's allowedDomains.
 */
export const joinByDomain = mutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    userEmail: v.string(),
    role: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const org = await ctx.db.get(orgId);
    if (!org) throw new ConvexError({ code: "NOT_FOUND", message: "Organization not found" });
    const status = (org as { status?: string }).status ?? "active";
    if (status !== "active") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Organization is not accepting new members by domain",
      });
    }
    const allowedDomains = (org as { allowedDomains?: string[] }).allowedDomains;
    if (!allowedDomains?.length) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Organization does not allow domain-based join",
      });
    }
    const domain = domainFromEmail(args.userEmail);
    if (!domain || !allowedDomains.map((d) => d.trim().toLowerCase()).includes(domain)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Your email domain is not allowed to join this organization",
      });
    }
    const existing = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", args.userId)
      )
      .unique();
    if (existing) {
      throw new ConvexError({ code: "ALREADY_EXISTS", message: "You are already a member of this organization" });
    }
    const joinedAt = Date.now();
    await ctx.db.insert("members", {
      organizationId: orgId,
      userId: args.userId,
      role: args.role ?? "member",
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
