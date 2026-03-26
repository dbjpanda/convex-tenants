/**
 * Integration tests verifying that bulk member removal and single member
 * removal correctly clean up ReBAC relations across multiple teams.
 *
 * These tests cover the scenario where a member belongs to several teams
 * and ensure ALL team ReBAC relations are removed when the member is
 * removed from the organization (via bulkRemoveMembers, removeMember,
 * or leaveOrganization).
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

function hasRelation(
  t: ReturnType<typeof initConvexTest>,
  identity: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  userId: string,
  teamId: string,
) {
  return identity.query(api.testHelpers.hasAuthzRelation, {
    subjectType: "user",
    subjectId: userId,
    relation: "member",
    objectType: "team",
    objectId: teamId,
  });
}

describe("Bulk member removal with multi-team ReBAC cleanup", () => {
  test("bulkRemoveMembers cleans up team ReBAC relations for all teams", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // 1. Alice creates org with 3 teams
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Bulk ReBAC Org",
    });
    const engineeringId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Engineering",
    });
    const designId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Design",
    });
    const marketingId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Marketing",
    });

    // 2. Alice adds bob and charlie as members
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "charlie", role: "member",
    });

    // 3. Add bob to Engineering + Design teams
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: engineeringId, memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: designId, memberUserId: "bob",
    });

    // 4. Add charlie to Design + Marketing teams
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: designId, memberUserId: "charlie",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: marketingId, memberUserId: "charlie",
    });

    // 5. Verify ReBAC relations exist
    expect(await hasRelation(t, asAlice, "bob", engineeringId)).toBe(true);
    expect(await hasRelation(t, asAlice, "bob", designId)).toBe(true);
    expect(await hasRelation(t, asAlice, "charlie", designId)).toBe(true);
    expect(await hasRelation(t, asAlice, "charlie", marketingId)).toBe(true);

    // 6. Alice bulk-removes [bob, charlie]
    const result = await asAlice.mutation(api.testHelpers.strictBulkRemoveMembers, {
      organizationId: orgId,
      memberUserIds: ["bob", "charlie"],
    });
    expect(result.success).toHaveLength(2);
    expect(result.errors).toHaveLength(0);

    // 7. Verify ALL ReBAC relations are cleaned up
    expect(await hasRelation(t, asAlice, "bob", engineeringId)).toBe(false);
    expect(await hasRelation(t, asAlice, "bob", designId)).toBe(false);
    expect(await hasRelation(t, asAlice, "charlie", designId)).toBe(false);
    expect(await hasRelation(t, asAlice, "charlie", marketingId)).toBe(false);
  });

  test("removeMember cleans up relations across 3+ teams", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // 1. Alice creates org with 4 teams
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Multi-Team Remove Org",
    });
    const team1Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Alpha",
    });
    const team2Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Bravo",
    });
    const team3Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Charlie",
    });
    const team4Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Delta",
    });

    // 2. Alice adds bob as member, adds bob to ALL 4 teams
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: team1Id, memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: team2Id, memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: team3Id, memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: team4Id, memberUserId: "bob",
    });

    // 3. Verify 4 ReBAC relations exist
    expect(await hasRelation(t, asAlice, "bob", team1Id)).toBe(true);
    expect(await hasRelation(t, asAlice, "bob", team2Id)).toBe(true);
    expect(await hasRelation(t, asAlice, "bob", team3Id)).toBe(true);
    expect(await hasRelation(t, asAlice, "bob", team4Id)).toBe(true);

    // 4. Alice removes bob
    await asAlice.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId, memberUserId: "bob",
    });

    // 5. Verify all 4 ReBAC relations are gone
    expect(await hasRelation(t, asAlice, "bob", team1Id)).toBe(false);
    expect(await hasRelation(t, asAlice, "bob", team2Id)).toBe(false);
    expect(await hasRelation(t, asAlice, "bob", team3Id)).toBe(false);
    expect(await hasRelation(t, asAlice, "bob", team4Id)).toBe(false);
  });

  test("leaveOrganization cleans up relations across multiple teams", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // 1. Alice creates org with 3 teams, adds bob to all 3
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Leave Multi-Team Org",
    });
    const frontendId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Frontend",
    });
    const backendId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Backend",
    });
    const infraId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Infra",
    });

    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: frontendId, memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: backendId, memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: infraId, memberUserId: "bob",
    });

    // Verify relations exist
    expect(await hasRelation(t, asAlice, "bob", frontendId)).toBe(true);
    expect(await hasRelation(t, asAlice, "bob", backendId)).toBe(true);
    expect(await hasRelation(t, asAlice, "bob", infraId)).toBe(true);

    // 2. Bob leaves the org
    await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
      organizationId: orgId,
    });

    // 3. Verify all 3 ReBAC relations are gone
    expect(await hasRelation(t, asAlice, "bob", frontendId)).toBe(false);
    expect(await hasRelation(t, asAlice, "bob", backendId)).toBe(false);
    expect(await hasRelation(t, asAlice, "bob", infraId)).toBe(false);
  });
});
