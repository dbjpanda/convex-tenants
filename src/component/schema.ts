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
    ownerId: v.string(), // References parent app's users table
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  // Organization members table
  members: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(), // References parent app's users table
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_organization_and_user", ["organizationId", "userId"]),

  // Teams table
  teams: defineTable({
    name: v.string(),
    organizationId: v.id("organizations"),
    description: v.union(v.null(), v.string()),
  }).index("by_organization", ["organizationId"]),

  // Team members table
  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.string(), // References parent app's users table
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_team_and_user", ["teamId", "userId"]),

  // Invitations table
  invitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    teamId: v.union(v.null(), v.id("teams")),
    inviterId: v.string(), // References parent app's users table
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
