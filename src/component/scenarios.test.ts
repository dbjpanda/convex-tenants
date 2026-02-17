/**
 * Real-World Multi-Tenant Scenarios
 *
 * Comprehensive tests for multi-tenant SaaS patterns with the tenants component.
 * These tests simulate real production scenarios with:
 * - Multiple organizations
 * - Complex team hierarchies
 * - Cross-org isolation
 * - Permission boundaries
 * - Edge cases and security scenarios
 */

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema.js";
import { api } from "./_generated/api.js";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts")).filter(
    ([path]) => !path.endsWith(".test.ts")
  )
);

function createTestInstance() {
  return convexTest(schema, modules);
}

// ============================================================================
// Test Data: Multi-Tenant SaaS Structure
// ============================================================================

/**
 * Test Organization Structure:
 *
 * ACME Corp
 * ├── Owner: alice
 * ├── Admin: bob
 * └── Teams
 *     ├── Engineering Team
 *     │   ├── charlie (team member)
 *     │   └── diana (team member)
 *     └── Sales Team
 *         └── eve (team member)
 *
 * BetaCo
 * ├── Owner: frank
 * └── Teams
 *     └── Product Team
 *         └── george (team member)
 *
 * External Users (no org):
 * - henry (will receive invitations)
 */

// ============================================================================
// Scenario 1: Multi-Organization Isolation
// ============================================================================

describe("Scenario: Multi-Organization Isolation", () => {
  it("users in different orgs cannot access each other's resources", async () => {
    const t = createTestInstance();

    // Setup: Create two organizations
    const acmeId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "ACME Corp",
      slug: "acme",
    });

    const betaId = await t.mutation(api.organizations.createOrganization, {
      userId: "frank",
      name: "BetaCo",
      slug: "betaco",
    });

    // Alice can see ACME
    const aliceOrgs = await t.query(api.organizations.listUserOrganizations, {
      userId: "alice",
    });
    expect(aliceOrgs).toHaveLength(1);
    expect(aliceOrgs[0].name).toBe("ACME Corp");

    // Frank can see BetaCo
    const frankOrgs = await t.query(api.organizations.listUserOrganizations, {
      userId: "frank",
    });
    expect(frankOrgs).toHaveLength(1);
    expect(frankOrgs[0].name).toBe("BetaCo");

    // Alice has no membership in BetaCo
    const aliceInBeta = await t.query(api.members.getMember, {
      organizationId: betaId,
      userId: "alice",
    });
    expect(aliceInBeta).toBeNull();

    // Frank has no membership in ACME
    const frankInAcme = await t.query(api.members.getMember, {
      organizationId: acmeId,
      userId: "frank",
    });
    expect(frankInAcme).toBeNull();
  });

  it("teams are isolated between organizations", async () => {
    const t = createTestInstance();

    const acmeId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "ACME Corp",
      slug: "acme",
    });

    const betaId = await t.mutation(api.organizations.createOrganization, {
      userId: "frank",
      name: "BetaCo",
      slug: "betaco",
    });

    // Create teams in each org
    await t.mutation(api.teams.createTeam, {
      userId: "alice",
      organizationId: acmeId,
      name: "ACME Engineering",
    });

    await t.mutation(api.teams.createTeam, {
      userId: "frank",
      organizationId: betaId,
      name: "Beta Product",
    });

    // List teams for ACME
    const acmeTeams = await t.query(api.teams.listTeams, {
      organizationId: acmeId,
    });
    expect(acmeTeams).toHaveLength(1);
    expect(acmeTeams[0].name).toBe("ACME Engineering");

    // List teams for BetaCo
    const betaTeams = await t.query(api.teams.listTeams, {
      organizationId: betaId,
    });
    expect(betaTeams).toHaveLength(1);
    expect(betaTeams[0].name).toBe("Beta Product");
  });
});

// ============================================================================
// Scenario 2: Team-Based Access Control
// ============================================================================

describe("Scenario: Team-Based Access Control", () => {
  it("team members are tracked correctly", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "ACME Corp",
      slug: "acme",
    });

    // Add members to org
    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "charlie",
      role: "member",
    });

    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "diana",
      role: "member",
    });

    // Create engineering team
    const engTeamId = await t.mutation(api.teams.createTeam, {
      userId: "alice",
      organizationId: orgId,
      name: "Engineering",
    });

    // Add charlie and diana to engineering
    await t.mutation(api.teams.addTeamMember, {
      userId: "alice",
      teamId: engTeamId,
      memberUserId: "charlie",
    });

    await t.mutation(api.teams.addTeamMember, {
      userId: "alice",
      teamId: engTeamId,
      memberUserId: "diana",
    });

    // Check team membership
    const engMembers = await t.query(api.teams.listTeamMembers, {
      teamId: engTeamId,
    });
    expect(engMembers).toHaveLength(2);

    const charlieInEng = await t.query(api.teams.isTeamMember, {
      teamId: engTeamId,
      userId: "charlie",
    });
    expect(charlieInEng).toBe(true);

    const bobInEng = await t.query(api.teams.isTeamMember, {
      teamId: engTeamId,
      userId: "bob",
    });
    expect(bobInEng).toBe(false);
  });

  it("removing org member removes them from all teams", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "ACME Corp",
      slug: "acme",
    });

    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "charlie",
      role: "member",
    });

    const team1Id = await t.mutation(api.teams.createTeam, {
      userId: "alice",
      organizationId: orgId,
      name: "Team 1",
    });

    const team2Id = await t.mutation(api.teams.createTeam, {
      userId: "alice",
      organizationId: orgId,
      name: "Team 2",
    });

    await t.mutation(api.teams.addTeamMember, {
      userId: "alice",
      teamId: team1Id,
      memberUserId: "charlie",
    });

    await t.mutation(api.teams.addTeamMember, {
      userId: "alice",
      teamId: team2Id,
      memberUserId: "charlie",
    });

    // Verify membership
    expect(
      await t.query(api.teams.isTeamMember, {
        teamId: team1Id,
        userId: "charlie",
      })
    ).toBe(true);
    expect(
      await t.query(api.teams.isTeamMember, {
        teamId: team2Id,
        userId: "charlie",
      })
    ).toBe(true);

    // Remove from org
    await t.mutation(api.members.removeMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "charlie",
    });

    // Should be removed from all teams
    expect(
      await t.query(api.teams.isTeamMember, {
        teamId: team1Id,
        userId: "charlie",
      })
    ).toBe(false);
    expect(
      await t.query(api.teams.isTeamMember, {
        teamId: team2Id,
        userId: "charlie",
      })
    ).toBe(false);
  });
});

// ============================================================================
// Scenario 3: Role Hierarchy
// ============================================================================

describe("Scenario: Role Hierarchy (Owner > Admin > Member)", () => {
  it("members have correct roles assigned", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice", // owner
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "charlie",
      role: "member",
    });

    // Owner has owner role
    const alice = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "alice",
    });
    expect(alice).not.toBeNull();
    expect(alice!.role).toBe("owner");

    // Admin has admin role
    const bob = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bob).not.toBeNull();
    expect(bob!.role).toBe("admin");

    // Member has member role
    const charlie = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "charlie",
    });
    expect(charlie).not.toBeNull();
    expect(charlie!.role).toBe("member");

    // Non-member returns null
    const stranger = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "stranger",
    });
    expect(stranger).toBeNull();
  });

  it("owner can transfer ownership", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // Owner can promote to owner
    await t.mutation(api.members.updateMemberRole, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "bob",
      role: "owner",
    });

    const bob = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bob?.role).toBe("owner");
  });
});

// ============================================================================
// Scenario 4: Invitation Flow
// ============================================================================

describe("Scenario: Complete Invitation Flow", () => {
  it("full invitation lifecycle: create → accept → member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "ACME Corp",
      slug: "acme",
    });

    // Create invitation
    const { invitationId, inviteeIdentifier, expiresAt } = await t.mutation(
      api.invitations.inviteMember,
      {
        userId: "alice",
        organizationId: orgId,
        inviteeIdentifier: "henry@example.com",
        identifierType: "email",
        role: "member",
      }
    );

    expect(inviteeIdentifier).toBe("henry@example.com");
    expect(expiresAt).toBeGreaterThan(Date.now());

    // Check invitation status
    let invitation = await t.query(api.invitations.getInvitation, { invitationId });
    expect(invitation?.status).toBe("pending");

    // Accept invitation
    await t.mutation(api.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId: "henry",
    });

    // Verify henry is now a member
    const henry = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "henry",
    });
    expect(henry).not.toBeNull();
    expect(henry?.role).toBe("member");

    // Invitation should be marked accepted
    invitation = await t.query(api.invitations.getInvitation, { invitationId });
    expect(invitation?.status).toBe("accepted");
  });

  it("invitation with team assignment", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "ACME Corp",
      slug: "acme",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "alice",
      organizationId: orgId,
      name: "Engineering",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "alice",
      organizationId: orgId,
      inviteeIdentifier: "engineer@example.com",
      identifierType: "email",
      role: "member",
      teamId,
    });

    await t.mutation(api.invitations.acceptInvitation, {
      invitationId,
      acceptingUserId: "henry",
    });

    // Should be member of org
    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "henry",
    });
    expect(member).not.toBeNull();

    // Should also be in the team
    const isTeamMember = await t.query(api.teams.isTeamMember, {
      teamId,
      userId: "henry",
    });
    expect(isTeamMember).toBe(true);
  });

  it("cancelled invitation cannot be accepted", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "ACME Corp",
      slug: "acme",
    });

    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "alice",
      organizationId: orgId,
      inviteeIdentifier: "henry@example.com",
      identifierType: "email",
      role: "member",
    });

    // Cancel the invitation
    await t.mutation(api.invitations.cancelInvitation, {
      userId: "alice",
      invitationId,
    });

    // Trying to accept should fail
    await expect(
      t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "henry",
      })
    ).rejects.toThrow();
  });

  it("user with pending invitations across multiple orgs", async () => {
    const t = createTestInstance();

    const org1Id = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "Org One",
      slug: "org-one",
    });

    const org2Id = await t.mutation(api.organizations.createOrganization, {
      userId: "bob",
      name: "Org Two",
      slug: "org-two",
    });

    const org3Id = await t.mutation(api.organizations.createOrganization, {
      userId: "charlie",
      name: "Org Three",
      slug: "org-three",
    });

    // Invite henry to all three orgs
    await t.mutation(api.invitations.inviteMember, {
      userId: "alice",
      organizationId: org1Id,
      inviteeIdentifier: "henry@example.com",
      identifierType: "email",
      role: "member",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "bob",
      organizationId: org2Id,
      inviteeIdentifier: "henry@example.com",
      identifierType: "email",
      role: "admin",
    });

    await t.mutation(api.invitations.inviteMember, {
      userId: "charlie",
      organizationId: org3Id,
      inviteeIdentifier: "henry@example.com",
      identifierType: "email",
      role: "member",
    });

    // Get all pending invitations
    const pending = await t.query(api.invitations.getPendingInvitationsForIdentifier, {
      identifier: "henry@example.com",
    });

    expect(pending).toHaveLength(3);

    // Accept one invitation
    await t.mutation(api.invitations.acceptInvitation, {
      invitationId: pending[0]._id,
      acceptingUserId: "henry",
    });

    // Should still have 2 pending
    const stillPending = await t.query(api.invitations.getPendingInvitationsForIdentifier, {
      identifier: "henry@example.com",
    });
    expect(stillPending).toHaveLength(2);
  });
});

// ============================================================================
// Scenario 5: User with Multiple Organization Memberships
// ============================================================================

describe("Scenario: User with Multiple Org Memberships", () => {
  it("user can have different roles in different orgs", async () => {
    const t = createTestInstance();

    await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "Org One",
      slug: "org-one",
    });

    const org2Id = await t.mutation(api.organizations.createOrganization, {
      userId: "bob",
      name: "Org Two",
      slug: "org-two",
    });

    // Alice is owner of org1
    // Add alice as member to org2
    await t.mutation(api.members.addMember, {
      userId: "bob",
      organizationId: org2Id,
      memberUserId: "alice",
      role: "member",
    });

    // Get all of alice's organizations
    const aliceOrgs = await t.query(api.organizations.listUserOrganizations, {
      userId: "alice",
    });

    expect(aliceOrgs).toHaveLength(2);

    const org1Membership = aliceOrgs.find((o: any) => o.name === "Org One");
    const org2Membership = aliceOrgs.find((o: any) => o.name === "Org Two");

    expect(org1Membership?.role).toBe("owner");
    expect(org2Membership?.role).toBe("member");
  });

  it("leaving one org does not affect membership in others", async () => {
    const t = createTestInstance();

    const org1Id = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "Org One",
      slug: "org-one",
    });

    const org2Id = await t.mutation(api.organizations.createOrganization, {
      userId: "bob",
      name: "Org Two",
      slug: "org-two",
    });

    // Add alice to org2
    await t.mutation(api.members.addMember, {
      userId: "bob",
      organizationId: org2Id,
      memberUserId: "alice",
      role: "admin",
    });

    // Alice leaves org2
    await t.mutation(api.members.leaveOrganization, {
      userId: "alice",
      organizationId: org2Id,
    });

    // Alice should still be in org1
    const org1Member = await t.query(api.members.getMember, {
      organizationId: org1Id,
      userId: "alice",
    });
    expect(org1Member).not.toBeNull();
    expect(org1Member?.role).toBe("owner");

    // Alice should not be in org2
    const org2Member = await t.query(api.members.getMember, {
      organizationId: org2Id,
      userId: "alice",
    });
    expect(org2Member).toBeNull();
  });
});

// ============================================================================
// Scenario 6: Organization Deletion Cascade
// ============================================================================

describe("Scenario: Organization Deletion Cascade", () => {
  it("deleting org removes all members, teams, and invitations", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "ACME Corp",
      slug: "acme",
    });

    // Add members
    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "charlie",
      role: "member",
    });

    // Create teams
    const team1Id = await t.mutation(api.teams.createTeam, {
      userId: "alice",
      organizationId: orgId,
      name: "Team 1",
    });

    await t.mutation(api.teams.addTeamMember, {
      userId: "alice",
      teamId: team1Id,
      memberUserId: "bob",
    });

    // Create invitations
    await t.mutation(api.invitations.inviteMember, {
      userId: "alice",
      organizationId: orgId,
      inviteeIdentifier: "pending@example.com",
      identifierType: "email",
      role: "member",
    });

    // Delete the organization
    await t.mutation(api.organizations.deleteOrganization, {
      userId: "alice",
      organizationId: orgId,
    });

    // Verify everything is gone
    const org = await t.query(api.organizations.getOrganization, {
      organizationId: orgId,
    });
    expect(org).toBeNull();

    const teams = await t.query(api.teams.listTeams, {
      organizationId: orgId,
    });
    expect(teams).toHaveLength(0);

    const members = await t.query(api.members.listOrganizationMembers, {
      organizationId: orgId,
    });
    expect(members).toHaveLength(0);
  });
});

// ============================================================================
// Scenario 7: Slug Uniqueness and Generation
// ============================================================================

describe("Scenario: Slug Management", () => {
  it("auto-generates unique slugs for duplicates", async () => {
    const t = createTestInstance();

    await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "Test Corp",
      slug: "test-corp",
    });

    await t.mutation(api.organizations.createOrganization, {
      userId: "bob",
      name: "Test Corp",
      slug: "test-corp",
    });

    await t.mutation(api.organizations.createOrganization, {
      userId: "charlie",
      name: "Test Corp",
      slug: "test-corp",
    });

    // All should have different slugs
    const aliceOrg = await t.query(api.organizations.getOrganizationBySlug, {
      slug: "test-corp",
    });

    // Should find only one with the base slug
    expect(aliceOrg).not.toBeNull();
    expect(aliceOrg?.ownerId).toBe("alice");

    // The others should have modified slugs (can't directly query them without knowing the exact slug)
    const charlieOrgs = await t.query(api.organizations.listUserOrganizations, {
      userId: "charlie",
    });
    expect(charlieOrgs).toHaveLength(1);
    expect(charlieOrgs[0].slug).not.toBe("test-corp");
    expect(charlieOrgs[0].slug).toMatch(/^test-corp-/);
  });
});

// ============================================================================
// Scenario 8: Edge Cases
// ============================================================================

describe("Scenario: Edge Cases", () => {
  it("existing member cannot accept invitation to same org", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "Test Org",
      slug: "test-org",
    });

    // Add bob as member
    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // Create invitation for bob (different email, but same user will accept)
    const { invitationId } = await t.mutation(api.invitations.inviteMember, {
      userId: "alice",
      organizationId: orgId,
      inviteeIdentifier: "bob-other@example.com",
      identifierType: "email",
      role: "admin",
    });

    // Bob trying to accept should fail since he's already a member
    await expect(
      t.mutation(api.invitations.acceptInvitation, {
        invitationId,
        acceptingUserId: "bob",
      })
    ).rejects.toThrow();
  });

  it("user can be in many teams within same org", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "alice",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "alice",
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // Create many teams and add bob to all
    const teamIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const teamId = await t.mutation(api.teams.createTeam, {
        userId: "alice",
        organizationId: orgId,
        name: `Team ${i}`,
      });
      teamIds.push(teamId);

      await t.mutation(api.teams.addTeamMember, {
        userId: "alice",
        teamId,
        memberUserId: "bob",
      });
    }

    // Bob should be in all teams
    for (const teamId of teamIds) {
      const isMember = await t.query(api.teams.isTeamMember, {
        teamId,
        userId: "bob",
      });
      expect(isMember).toBe(true);
    }
  });
});
