import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

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
 * Ensure a team slug is unique within an organization (append number if needed).
 * Use when creating/updating a team with a slug.
 */
export async function ensureUniqueTeamSlug(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_organization_and_slug", (q) =>
        q.eq("organizationId", organizationId).eq("slug", slug)
      )
      .first();

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Check if an invitation has expired
 */
export function isInvitationExpired(invitation: Doc<"invitations">): boolean {
  return invitation.expiresAt < Date.now();
}
