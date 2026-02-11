import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** Team doc with optional parentTeamId (for nested teams) */
type TeamDoc = Doc<"teams"> & { parentTeamId?: Id<"teams"> };

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
 * Collect ancestor team IDs by walking parentTeamId up from the given team.
 * Used to detect cycles when setting parentTeamId.
 */
export async function getTeamAncestorIds(
  ctx: MutationCtx,
  teamId: Id<"teams"> | null
): Promise<Set<Id<"teams">>> {
  const seen = new Set<Id<"teams">>();
  if (!teamId) return seen;
  let current: Id<"teams"> | null = teamId;
  while (current) {
    const team: Doc<"teams"> | null = await ctx.db.get(current);
    if (!team) break;
    const parentId: Id<"teams"> | undefined = (team as TeamDoc).parentTeamId;
    if (!parentId) break;
    if (seen.has(parentId)) break;
    seen.add(parentId);
    current = parentId;
  }
  return seen;
}

/**
 * Check if an invitation has expired
 */
export function isInvitationExpired(invitation: Doc<"invitations">): boolean {
  return invitation.expiresAt < Date.now();
}
