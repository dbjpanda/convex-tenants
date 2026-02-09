import type { Doc } from "./_generated/dataModel";
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
 * Check if an invitation has expired
 */
export function isInvitationExpired(invitation: Doc<"invitations">): boolean {
  return invitation.expiresAt < Date.now();
}
