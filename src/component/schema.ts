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
    /** Domains that can join without invitation (e.g. ["acme.com"]). Used for domain-based auto-join. */
    allowedDomains: v.optional(v.array(v.string())),
    ownerId: v.string(), // References parent app's users table
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("archived"))), // default active
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"]),

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
    .index("by_organization_and_user", ["organizationId", "userId"]),

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
    email: v.string(),
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
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_email_and_status", ["email", "status"]),
});
