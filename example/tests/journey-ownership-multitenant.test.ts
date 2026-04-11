/**
 * User journey tests for ownership transfer flows and multi-tenant isolation.
 *
 * Journey 1: Ownership transfer — complete flow with role changes
 * Journey 2: Transfer ownership edge cases
 * Journey 3: Multi-tenant stress — 3 orgs, overlapping members, full isolation
 * Journey 4: Rapid state transitions — consistency under churn
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

// ---------------------------------------------------------------------------
// Helper: check if a ReBAC team-member relation exists in the authz component
// ---------------------------------------------------------------------------
function hasTeamRelation(
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

// ===========================================================================
// Journey 1: Ownership transfer — complete flow with role changes
// ===========================================================================

describe("Journey 1: Ownership transfer — complete flow with role changes", () => {
  test("chain of ownership transfers preserves correct roles for all members", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org, adds bob(admin), charlie(member)
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Ownership Chain Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "charlie",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 2: Verify initial roles
    // -----------------------------------------------------------------------
    const aliceMember = await asAlice.query(api.testHelpers.strictGetCurrentMember, {
      organizationId: orgId,
    });
    expect(aliceMember?.role).toBe("owner");

    const bobMember = await asBob.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember?.role).toBe("admin");

    const charlieMember = await asCharlie.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "charlie",
    });
    expect(charlieMember?.role).toBe("member");

    // -----------------------------------------------------------------------
    // Step 3: Alice transfers ownership to bob, with previousOwnerRole: "admin"
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgId,
      newOwnerUserId: "bob",
      previousOwnerRole: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 4: Verify: bob is now owner, alice is now admin
    // -----------------------------------------------------------------------
    const bobAfterFirstTransfer = await asBob.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobAfterFirstTransfer?.role).toBe("owner");

    const aliceAfterFirstTransfer = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "alice",
    });
    expect(aliceAfterFirstTransfer?.role).toBe("admin");

    // -----------------------------------------------------------------------
    // Step 5: Verify: bob can now delete the org (owner-only permission)
    // -----------------------------------------------------------------------
    const bobCanDelete = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(bobCanDelete.allowed).toBe(true);

    // -----------------------------------------------------------------------
    // Step 6: Verify: alice can no longer delete the org (now admin)
    // -----------------------------------------------------------------------
    const aliceCanDelete = await asAlice.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(aliceCanDelete.allowed).toBe(false);

    // -----------------------------------------------------------------------
    // Step 7: Bob transfers ownership to charlie, previousOwnerRole: "member"
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgId,
      newOwnerUserId: "charlie",
      previousOwnerRole: "member",
    });

    // -----------------------------------------------------------------------
    // Step 8: Verify: charlie is owner, bob is member
    // -----------------------------------------------------------------------
    const charlieAfterSecondTransfer = await asCharlie.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "charlie",
    });
    expect(charlieAfterSecondTransfer?.role).toBe("owner");

    const bobAfterSecondTransfer = await asBob.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobAfterSecondTransfer?.role).toBe("member");

    // -----------------------------------------------------------------------
    // Step 9: Verify: original owner (alice) is still admin (unchanged by bob's transfer)
    // -----------------------------------------------------------------------
    const aliceAfterSecondTransfer = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "alice",
    });
    expect(aliceAfterSecondTransfer?.role).toBe("admin");
  });
});

// ===========================================================================
// Journey 2: Transfer ownership edge cases
// ===========================================================================

describe("Journey 2: Transfer ownership edge cases", () => {
  test("various invalid transfer attempts fail, valid transfer succeeds", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org, adds bob as admin
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Edge Cases Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice tries to transfer to herself -> should fail
    // -----------------------------------------------------------------------
    await expect(
      asAlice.mutation(api.testHelpers.strictTransferOwnership, {
        organizationId: orgId,
        newOwnerUserId: "alice",
      })
    ).rejects.toThrow("Cannot transfer ownership to yourself");

    // -----------------------------------------------------------------------
    // Step 3: Alice tries to transfer to "stranger" (non-member) -> should fail
    // -----------------------------------------------------------------------
    await expect(
      asAlice.mutation(api.testHelpers.strictTransferOwnership, {
        organizationId: orgId,
        newOwnerUserId: "stranger",
      })
    ).rejects.toThrow("New owner must already be a member of the organization");

    // -----------------------------------------------------------------------
    // Step 4: Bob (admin) tries to transfer ownership -> should fail
    // -----------------------------------------------------------------------
    await expect(
      asBob.mutation(api.testHelpers.strictTransferOwnership, {
        organizationId: orgId,
        newOwnerUserId: "alice",
      })
    ).rejects.toThrow("Only the current owner can transfer ownership");

    // -----------------------------------------------------------------------
    // Step 5: Alice successfully transfers to bob
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgId,
      newOwnerUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 6: Verify: bob is owner
    // -----------------------------------------------------------------------
    const bobMember = await asBob.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember?.role).toBe("owner");
  });
});

// ===========================================================================
// Journey 3: Multi-tenant stress — 3 orgs, overlapping members, full isolation
// ===========================================================================

describe("Journey 3: Multi-tenant stress — 3 orgs, overlapping members, full isolation", () => {
  test("operations in one org do not affect other orgs", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });
    const asDiana = t.withIdentity({ subject: "diana", issuer: "https://test.com" });
    const asEve = t.withIdentity({ subject: "eve", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Create 3 orgs: Alice owns OrgA, Bob owns OrgB, Charlie owns OrgC
    // -----------------------------------------------------------------------
    const orgAId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Org A",
    });
    const orgBId = await asBob.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Org B",
    });
    const orgCId = await asCharlie.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Org C",
    });

    // -----------------------------------------------------------------------
    // Step 2: Add diana to ALL 3 orgs: admin in A, member in B, admin in C
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgAId, memberUserId: "diana", role: "admin",
    });
    await asBob.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgBId, memberUserId: "diana", role: "member",
    });
    await asCharlie.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgCId, memberUserId: "diana", role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 3: Add eve to OrgA(member) and OrgB(admin)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgAId, memberUserId: "eve", role: "member",
    });
    await asBob.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgBId, memberUserId: "eve", role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 4: Create teams: "Alpha" in OrgA, "Beta" in OrgB, "Gamma" in OrgC
    // -----------------------------------------------------------------------
    const alphaId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgAId, name: "Alpha",
    });
    const betaId = await asBob.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgBId, name: "Beta",
    });
    const gammaId = await asCharlie.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgCId, name: "Gamma",
    });

    // -----------------------------------------------------------------------
    // Step 5: Add diana to all 3 teams, eve to Alpha and Beta
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: alphaId, memberUserId: "diana",
    });
    await asBob.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: betaId, memberUserId: "diana",
    });
    await asCharlie.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: gammaId, memberUserId: "diana",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: alphaId, memberUserId: "eve",
    });
    await asBob.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: betaId, memberUserId: "eve",
    });

    // -----------------------------------------------------------------------
    // Step 6: Verify ReBAC: diana has relation to all 3 teams, eve to 2 teams
    // -----------------------------------------------------------------------
    expect(await hasTeamRelation(asDiana, "diana", alphaId)).toBe(true);
    expect(await hasTeamRelation(asDiana, "diana", betaId)).toBe(true);
    expect(await hasTeamRelation(asDiana, "diana", gammaId)).toBe(true);

    expect(await hasTeamRelation(asEve, "eve", alphaId)).toBe(true);
    expect(await hasTeamRelation(asEve, "eve", betaId)).toBe(true);

    // -----------------------------------------------------------------------
    // Step 7: Verify permissions: diana is admin in A (can add members),
    //         member in B (cannot add members)
    // -----------------------------------------------------------------------
    const dianaOrgAPerms = await asDiana.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgAId, permission: "members:add",
    });
    expect(dianaOrgAPerms.allowed).toBe(true);

    const dianaOrgBPerms = await asDiana.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgBId, permission: "members:add",
    });
    expect(dianaOrgBPerms.allowed).toBe(false);

    // -----------------------------------------------------------------------
    // Step 8: Verify: eve is member in A (can't create teams),
    //         admin in B (can create teams)
    // -----------------------------------------------------------------------
    const eveOrgAPerms = await asEve.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgAId, permission: "teams:create",
    });
    expect(eveOrgAPerms.allowed).toBe(false);

    const eveOrgBPerms = await asEve.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgBId, permission: "teams:create",
    });
    expect(eveOrgBPerms.allowed).toBe(true);

    // -----------------------------------------------------------------------
    // Step 9: Remove diana from OrgB only
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgBId, memberUserId: "diana",
    });

    // -----------------------------------------------------------------------
    // Step 10: Verify: diana still in OrgA + OrgC with teams (not affected)
    // -----------------------------------------------------------------------
    const dianaOrgA = await asDiana.query(api.testHelpers.strictGetMember, {
      organizationId: orgAId, userId: "diana",
    });
    expect(dianaOrgA).not.toBeNull();
    expect(dianaOrgA?.role).toBe("admin");

    const dianaOrgC = await asDiana.query(api.testHelpers.strictGetMember, {
      organizationId: orgCId, userId: "diana",
    });
    expect(dianaOrgC).not.toBeNull();
    expect(dianaOrgC?.role).toBe("admin");

    // -----------------------------------------------------------------------
    // Step 11: Verify: diana's ReBAC relation to Beta team is gone
    // -----------------------------------------------------------------------
    expect(await hasTeamRelation(asAlice, "diana", betaId)).toBe(false);

    // -----------------------------------------------------------------------
    // Step 12: Verify: diana's ReBAC relations to Alpha and Gamma still exist
    // -----------------------------------------------------------------------
    expect(await hasTeamRelation(asAlice, "diana", alphaId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "diana", gammaId)).toBe(true);

    // -----------------------------------------------------------------------
    // Step 13: Delete OrgA entirely
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictDeleteOrganization, {
      organizationId: orgAId,
    });
    // Deletion cascade runs in a scheduled internalAction — drain it.
    await t.finishInProgressScheduledFunctions();

    // -----------------------------------------------------------------------
    // Step 14: Verify: diana and eve's OrgA memberships gone,
    //          OrgB and OrgC unaffected
    // -----------------------------------------------------------------------
    // Diana's OrgA membership is gone
    await expect(
      asDiana.query(api.testHelpers.strictGetOrganization, { organizationId: orgAId })
    ).rejects.toThrow("Not a member of this organization");

    // Eve's OrgA membership is gone
    await expect(
      asEve.query(api.testHelpers.strictGetOrganization, { organizationId: orgAId })
    ).rejects.toThrow("Not a member of this organization");

    // OrgB and OrgC still exist and are accessible
    const orgB = await asBob.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgBId,
    });
    expect(orgB).not.toBeNull();
    expect(orgB?.name).toBe("Org B");

    const orgC = await asCharlie.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgCId,
    });
    expect(orgC).not.toBeNull();
    expect(orgC?.name).toBe("Org C");

    // -----------------------------------------------------------------------
    // Step 15: Verify: diana still admin in OrgC, eve still admin in OrgB
    // -----------------------------------------------------------------------
    const dianaOrgCFinal = await asDiana.query(api.testHelpers.strictGetMember, {
      organizationId: orgCId, userId: "diana",
    });
    expect(dianaOrgCFinal?.role).toBe("admin");

    const eveOrgBFinal = await asEve.query(api.testHelpers.strictGetMember, {
      organizationId: orgBId, userId: "eve",
    });
    expect(eveOrgBFinal?.role).toBe("admin");
  });
});

// ===========================================================================
// Journey 4: Rapid state transitions — consistency under churn
// ===========================================================================

describe("Journey 4: Rapid state transitions — consistency under churn", () => {
  test("rapid role changes and member churn maintain consistent state", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Rapid Transitions Org",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice adds bob as member
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 3: Immediately update bob to admin
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateMemberRole, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 4: Transfer ownership to bob (only transferOwnership may grant owner role)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgId,
      newOwnerUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 5: Verify: bob is owner (not stuck at member or admin)
    // -----------------------------------------------------------------------
    const bobRole = await asBob.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobRole?.role).toBe("owner");

    // -----------------------------------------------------------------------
    // Step 6: Alice adds charlie, diana, eve as members
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "charlie", role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "diana", role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "eve", role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 7: Alice creates Team1, Team2
    // -----------------------------------------------------------------------
    const team1Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Team1",
    });
    const team2Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Team2",
    });

    // -----------------------------------------------------------------------
    // Step 8: Add charlie to Team1, diana to Team2, eve to both
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: team1Id, memberUserId: "charlie",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: team2Id, memberUserId: "diana",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: team1Id, memberUserId: "eve",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: team2Id, memberUserId: "eve",
    });

    // Verify initial team membership state
    expect(await hasTeamRelation(asAlice, "charlie", team1Id)).toBe(true);
    expect(await hasTeamRelation(asAlice, "diana", team2Id)).toBe(true);
    expect(await hasTeamRelation(asAlice, "eve", team1Id)).toBe(true);
    expect(await hasTeamRelation(asAlice, "eve", team2Id)).toBe(true);

    // -----------------------------------------------------------------------
    // Step 9: Remove charlie -> verify only charlie's Team1 relation gone
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId, memberUserId: "charlie",
    });
    expect(await hasTeamRelation(asAlice, "charlie", team1Id)).toBe(false);
    // diana and eve unaffected
    expect(await hasTeamRelation(asAlice, "diana", team2Id)).toBe(true);
    expect(await hasTeamRelation(asAlice, "eve", team1Id)).toBe(true);
    expect(await hasTeamRelation(asAlice, "eve", team2Id)).toBe(true);

    // -----------------------------------------------------------------------
    // Step 10: Remove diana -> verify only diana's Team2 relation gone
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId, memberUserId: "diana",
    });
    expect(await hasTeamRelation(asAlice, "diana", team2Id)).toBe(false);
    // eve still in both teams
    expect(await hasTeamRelation(asAlice, "eve", team1Id)).toBe(true);
    expect(await hasTeamRelation(asAlice, "eve", team2Id)).toBe(true);

    // -----------------------------------------------------------------------
    // Step 11: Eve should still be in both teams
    // -----------------------------------------------------------------------
    const asEve = t.withIdentity({ subject: "eve", issuer: "https://test.com" });
    expect(await asEve.query(api.testHelpers.strictIsTeamMember, { teamId: team1Id })).toBe(true);
    expect(await asEve.query(api.testHelpers.strictIsTeamMember, { teamId: team2Id })).toBe(true);

    // -----------------------------------------------------------------------
    // Step 12: Remove eve -> verify both team relations gone
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId, memberUserId: "eve",
    });
    expect(await hasTeamRelation(asAlice, "eve", team1Id)).toBe(false);
    expect(await hasTeamRelation(asAlice, "eve", team2Id)).toBe(false);

    // -----------------------------------------------------------------------
    // Step 13: Verify: only alice and bob remain
    // -----------------------------------------------------------------------
    const remainingMembers = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(remainingMembers).toHaveLength(2);
    const remainingUserIds = remainingMembers.map((m: any) => m.userId).sort();
    expect(remainingUserIds).toEqual(["alice", "bob"]);
  });
});
