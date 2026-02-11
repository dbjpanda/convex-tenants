import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * List all organizations a user belongs to
 */
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

/**
 * Get organization details by ID
 */
export const getOrganization = query({
  args: {
    organizationId: v.string(),
  },
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

/**
 * Get organization by slug
 */
export const getOrganizationBySlug = query({
  args: {
    slug: v.string(),
  },
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

/**
 * List organizations that allow join-by-domain for the given email (email's domain in allowedDomains).
 * Does not require authentication; used to show "Organizations you can join" for the user's email.
 */
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
