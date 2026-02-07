import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Role hierarchy for permission checks
 */
export const ROLE_HIERARCHY = {
  owner: 3,
  admin: 2,
  member: 1,
} as const;

/**
 * Get a member's role in an organization
 */
export async function getMemberRole(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: string
): Promise<"owner" | "admin" | "member" | null> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_organization_and_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId)
    )
    .unique();

  return member?.role ?? null;
}

/**
 * Require that a user has at least a certain role in an organization
 * Throws ConvexError if the user doesn't have sufficient permissions
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: string,
  minRole: "member" | "admin" | "owner"
): Promise<Doc<"members">> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_organization_and_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId)
    )
    .unique();

  if (!member) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization",
    });
  }

  const userRoleLevel = ROLE_HIERARCHY[member.role];
  const requiredRoleLevel = ROLE_HIERARCHY[minRole];

  if (userRoleLevel < requiredRoleLevel) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `This action requires ${minRole} role or higher`,
    });
  }

  return member;
}

/**
 * Generate a URL-safe slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Ensure a slug is unique by appending a number if needed
 */
export async function ensureUniqueSlug(
  ctx: MutationCtx,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Check if a user is the sole owner of an organization
 */
export async function isSoleOwner(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: string
): Promise<boolean> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_organization_and_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId)
    )
    .unique();

  if (!member || member.role !== "owner") {
    return false;
  }

  // Check if there are other owners
  const allMembers = await ctx.db
    .query("members")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const ownerCount = allMembers.filter((m) => m.role === "owner").length;
  return ownerCount === 1;
}

/**
 * Check if an invitation has expired
 */
export function isInvitationExpired(invitation: Doc<"invitations">): boolean {
  return invitation.expiresAt < Date.now();
}

/**
 * Convert org role to authz role format
 */
export function toAuthzRole(role: "owner" | "admin" | "member"): string {
  return `org:${role}`;
}
