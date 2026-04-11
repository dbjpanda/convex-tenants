import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Tenants Component Schema
 *
 * This schema defines tables for multi-tenant organization and team management.
 * All userId fields are strings because they reference the parent app's user table.
 */
export default defineSchema({
  // Organizations table
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logo: v.union(v.null(), v.string()),
    metadata: v.optional(v.any()),
    /** Structured settings (typed). Use metadata for fully custom data. */
    settings: v.optional(
      v.object({
        allowPublicSignup: v.optional(v.boolean()),
        requireInvitationToJoin: v.optional(v.boolean()),
      })
    ),
    ownerId: v.string(), // References parent app's users table
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))), // default active
    /**
     * Set when a delete has been requested. A scheduled internalAction drains the
     * org's child tables in batches and then removes the org doc itself. Presence
     * of this field indicates the org is being torn down asynchronously.
     */
    deletionScheduledAt: v.optional(v.number()),
    /**
     * Counts re-scheduling attempts of the delete action when `_finalizeOrganizationDelete`
     * finds that a racing insert landed after the drain loop. Bounded retry prevents
     * infinite re-scheduling if a consumer keeps inserting into a deleting org.
     */
    deleteRetryCount: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  // Organization members table
  members: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(), // References parent app's users table
    role: v.string(), // Flexible: developer defines roles in authz.ts
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"))), // default active; suspended = soft disable
    suspendedAt: v.optional(v.number()), // set when status becomes suspended
    joinedAt: v.optional(v.number()), // timestamp when member was added; set on addMember
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_organization_and_user", ["organizationId", "userId"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_user_and_status", ["userId", "status"]),

  // Teams table
  teams: defineTable({
    name: v.string(),
    slug: v.optional(v.string()), // URL-friendly, unique per organization
    organizationId: v.id("organizations"),
    parentTeamId: v.optional(v.id("teams")), // Optional parent for nested teams
    description: v.union(v.null(), v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_slug", ["organizationId", "slug"])
    .index("by_organization_and_parent", ["organizationId", "parentTeamId"])
    .index("by_parent", ["parentTeamId"]),

  // Team members table
  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.string(), // References parent app's users table
    role: v.optional(v.string()), // Optional role within the team (e.g. "lead", "member")
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_team_and_user", ["teamId", "userId"]),

  // Invitations table
  invitations: defineTable({
    organizationId: v.id("organizations"),
    inviteeIdentifier: v.string(), // Flexible: email, phone, username, etc.
    identifierType: v.optional(v.string()), // Optional: "email", "phone", "username", etc.
    role: v.string(), // Flexible: developer defines roles in authz.ts
    teamId: v.union(v.null(), v.id("teams")),
    inviterId: v.string(), // References parent app's users table
    inviterName: v.optional(v.string()), // Stored at invite time for display
    message: v.optional(v.string()), // Optional custom message from inviter
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("cancelled"),
      v.literal("expired")
    ),
    expiresAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_invitee_identifier_and_status", ["inviteeIdentifier", "status"])
    .index("by_org_invitee_and_status", ["organizationId", "inviteeIdentifier", "status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_org_and_team", ["organizationId", "teamId"]),
});
