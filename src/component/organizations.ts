import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ensureUniqueSlug } from "./helpers";
import type { Id } from "./_generated/dataModel";

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
      allowedDomains: v.optional(v.array(v.string())),
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

        const orgExt = org as { settings?: { allowPublicSignup?: boolean; requireInvitationToJoin?: boolean }; allowedDomains?: string[] };
        return {
          _id: org._id as string,
          _creationTime: org._creationTime,
          name: org.name,
          slug: org.slug,
          logo: org.logo,
          metadata: org.metadata,
          settings: orgExt.settings,
          allowedDomains: orgExt.allowedDomains,
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
      allowedDomains: v.optional(v.array(v.string())),
      ownerId: v.string(),
      status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
    })
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId as Id<"organizations">);
    if (!org) return null;
    const o = org as { status?: "active" | "suspended" | "archived"; settings?: { allowPublicSignup?: boolean; requireInvitationToJoin?: boolean }; allowedDomains?: string[] };
    return {
      _id: org._id as string,
      _creationTime: org._creationTime,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      metadata: org.metadata,
      settings: o.settings,
      allowedDomains: o.allowedDomains,
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
      allowedDomains: v.optional(v.array(v.string())),
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
    const o = org as { status?: "active" | "suspended" | "archived"; settings?: { allowPublicSignup?: boolean; requireInvitationToJoin?: boolean }; allowedDomains?: string[] };
    return {
      _id: org._id as string,
      _creationTime: org._creationTime,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      metadata: org.metadata,
      settings: o.settings,
      allowedDomains: o.allowedDomains,
      ownerId: org.ownerId,
      status: o.status,
    };
  },
});

function domainFromEmailQuery(email: string): string {
  const at = email.trim().toLowerCase().indexOf("@");
  if (at === -1) return "";
  return email.trim().toLowerCase().slice(at + 1);
}

export const listOrganizationsJoinableByDomain = query({
  args: { email: v.string() },
  returns: v.array(
    v.object({
      _id: v.string(),
      name: v.string(),
      slug: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const domain = domainFromEmailQuery(args.email);
    if (!domain) return [];
    const allOrgs = await ctx.db.query("organizations").collect();
    const joinable: { _id: string; name: string; slug: string }[] = [];
    const domainsLower = domain.toLowerCase();
    for (const org of allOrgs) {
      const status = (org as { status?: string }).status ?? "active";
      if (status !== "active") continue;
      const allowedDomains = (org as { allowedDomains?: string[] }).allowedDomains;
      if (!allowedDomains?.length) continue;
      const allowed = allowedDomains.some((d) => d.trim().toLowerCase() === domainsLower);
      if (allowed) joinable.push({ _id: org._id as string, name: org.name, slug: org.slug });
    }
    return joinable;
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
    allowedDomains: v.optional(v.array(v.string())),
    creatorRole: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const uniqueSlug = await ensureUniqueSlug(ctx, args.slug);
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: uniqueSlug,
      logo: args.logo ?? null,
      metadata: args.metadata,
      settings: args.settings,
      allowedDomains: args.allowedDomains,
      ownerId: args.userId,
      status: "active",
    });
    await ctx.db.insert("members", {
      organizationId,
      userId: args.userId,
      role: args.creatorRole ?? "owner",
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
    allowedDomains: v.optional(v.union(v.null(), v.array(v.string()))),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.logo !== undefined) updates.logo = args.logo;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.settings !== undefined) updates.settings = args.settings;
    if (args.allowedDomains !== undefined) updates.allowedDomains = args.allowedDomains ?? undefined;
    if (args.status !== undefined) updates.status = args.status;
    if (args.slug !== undefined) {
      updates.slug = await ensureUniqueSlug(ctx, args.slug);
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
    if (args.newOwnerUserId === args.userId) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", message: "New owner must be a different user" });
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

export const deleteOrganization = mutation({
  args: { userId: v.string(), organizationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    for (const team of teams) {
      const tms = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", team._id)).collect();
      for (const tm of tms) await ctx.db.delete(tm._id);
      await ctx.db.delete(team._id);
    }
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    for (const inv of invitations) await ctx.db.delete(inv._id);
    const members = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);
    await ctx.db.delete(orgId);
    return null;
  },
});
