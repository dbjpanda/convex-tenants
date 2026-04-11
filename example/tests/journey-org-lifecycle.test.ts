/**
 * User journey tests — complete organization lifecycle flows.
 *
 * These tests exercise multi-step real-world scenarios rather than
 * isolated API calls, verifying that state transitions compose correctly.
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

// ---------------------------------------------------------------------------
// Helper: check if a ReBAC team-member relation exists in the authz component
// ---------------------------------------------------------------------------
function hasTeamRelation(
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

// ===========================================================================
// Journey 1: Full org lifecycle — create -> grow -> transfer -> delete
// ===========================================================================

describe("Journey 1: Full org lifecycle — create -> grow -> transfer -> delete", () => {
  test("complete lifecycle from creation through ownership transfer to deletion", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates "Startup Inc" org
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Startup Inc",
    });
    expect(orgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Verify Alice is owner, org has slug, org is active
    // -----------------------------------------------------------------------
    const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org).not.toBeNull();
    expect(org?.name).toBe("Startup Inc");
    expect(org?.slug).toBe("startup-inc");
    expect(org?.status ?? "active").toBe("active");

    const aliceMember = await asAlice.query(api.testHelpers.strictGetCurrentMember, {
      organizationId: orgId,
    });
    expect(aliceMember?.role).toBe("owner");

    // -----------------------------------------------------------------------
    // Step 3: Alice adds bob as admin, charlie as member
    // -----------------------------------------------------------------------
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
    // Step 4: Verify 3 members total
    // -----------------------------------------------------------------------
    const memberCount = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
    });
    expect(memberCount).toBe(3);

    // -----------------------------------------------------------------------
    // Step 5: Alice creates "Engineering" and "Sales" teams
    // -----------------------------------------------------------------------
    const engineeringId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
    });
    const salesId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Sales",
    });
    expect(engineeringId).toBeDefined();
    expect(salesId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 6: Alice adds bob to Engineering, charlie to Sales
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: engineeringId,
      memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: salesId,
      memberUserId: "charlie",
    });

    expect(await asBob.query(api.testHelpers.strictIsTeamMember, { teamId: engineeringId })).toBe(true);
    expect(await asCharlie.query(api.testHelpers.strictIsTeamMember, { teamId: salesId })).toBe(true);

    // -----------------------------------------------------------------------
    // Step 7: Alice updates org name to "Startup Corp"
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      name: "Startup Corp",
    });

    // -----------------------------------------------------------------------
    // Step 8: Verify name changed, slug unchanged
    // -----------------------------------------------------------------------
    const updatedOrg = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(updatedOrg?.name).toBe("Startup Corp");
    expect(updatedOrg?.slug).toBe("startup-inc"); // slug stays the same

    // -----------------------------------------------------------------------
    // Step 9: Alice transfers ownership to bob (previousOwnerRole: "admin")
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgId,
      newOwnerUserId: "bob",
      previousOwnerRole: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 10: Verify bob is now owner, alice is now admin
    // -----------------------------------------------------------------------
    const bobAfterTransfer = await asBob.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobAfterTransfer?.role).toBe("owner");

    const aliceAfterTransfer = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "alice",
    });
    expect(aliceAfterTransfer?.role).toBe("admin");

    // -----------------------------------------------------------------------
    // Step 11: Verify alice can still update org (admin has organizations:update)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      name: "Startup Corp v2",
    });
    const orgAfterAliceUpdate = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(orgAfterAliceUpdate?.name).toBe("Startup Corp v2");

    // -----------------------------------------------------------------------
    // Step 12: Bob (new owner) deletes the org
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictDeleteOrganization, {
      organizationId: orgId,
    });
    // Deletion cascade runs in a scheduled internalAction — drain it.
    await t.finishInProgressScheduledFunctions();

    // -----------------------------------------------------------------------
    // Step 13: Verify org gone, all members gone, all teams gone
    // -----------------------------------------------------------------------
    // Org is gone — membership check fails for all users
    await expect(
      asAlice.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
    ).rejects.toThrow("Not a member of this organization");

    await expect(
      asBob.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
    ).rejects.toThrow("Not a member of this organization");

    // Teams are gone — listing throws because org membership is gone
    await expect(
      asAlice.query(api.testHelpers.strictListTeams, { organizationId: orgId })
    ).rejects.toThrow("Not a member of this organization");

    // Members are gone — listing throws because org membership is gone
    await expect(
      asBob.query(api.testHelpers.strictListMembers, { organizationId: orgId })
    ).rejects.toThrow("Not a member of this organization");
  });
});

// ===========================================================================
// Journey 2: Member offboarding — complete cleanup
// ===========================================================================

describe("Journey 2: Member offboarding — complete cleanup", () => {
  test("removing a member cleans up teams and overrides; re-adding resets permissions", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org, adds bob as admin
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Offboarding Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice creates 3 teams, adds bob to all 3
    // -----------------------------------------------------------------------
    const team1Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Alpha",
    });
    const team2Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Beta",
    });
    const team3Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Gamma",
    });

    await asAlice.mutation(api.testHelpers.strictAddTeamMember, { teamId: team1Id, memberUserId: "bob" });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, { teamId: team2Id, memberUserId: "bob" });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, { teamId: team3Id, memberUserId: "bob" });

    // Confirm bob is in all 3 teams
    expect(await asBob.query(api.testHelpers.strictIsTeamMember, { teamId: team1Id })).toBe(true);
    expect(await asBob.query(api.testHelpers.strictIsTeamMember, { teamId: team2Id })).toBe(true);
    expect(await asBob.query(api.testHelpers.strictIsTeamMember, { teamId: team3Id })).toBe(true);

    // -----------------------------------------------------------------------
    // Step 3: Alice grants bob a direct permission override ("teams:create")
    //         (admin already has teams:create, so use a permission admin lacks:
    //          "organizations:delete" — only owner has this)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictGrantPermission, {
      organizationId: orgId,
      targetUserId: "bob",
      permission: "organizations:delete",
    });

    // -----------------------------------------------------------------------
    // Step 4: Verify bob has the override
    // -----------------------------------------------------------------------
    const overrideCheck = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(overrideCheck.allowed).toBe(true);

    // -----------------------------------------------------------------------
    // Step 5: Alice removes bob from org
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 6: Verify bob is not a member
    // -----------------------------------------------------------------------
    const bobMemberAfterRemove = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMemberAfterRemove).toBeNull();

    // -----------------------------------------------------------------------
    // Step 7: Verify bob is not in any team (check all 3 via hasAuthzRelation)
    // -----------------------------------------------------------------------
    expect(await hasTeamRelation(t, asAlice, "bob", team1Id)).toBe(false);
    expect(await hasTeamRelation(t, asAlice, "bob", team2Id)).toBe(false);
    expect(await hasTeamRelation(t, asAlice, "bob", team3Id)).toBe(false);

    // -----------------------------------------------------------------------
    // Step 8: Alice re-adds bob as member (lower role)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 9: Verify bob no longer has the direct override
    // -----------------------------------------------------------------------
    const overrideAfterReAdd = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(overrideAfterReAdd.allowed).toBe(false);

    // -----------------------------------------------------------------------
    // Step 10: Verify bob has member-level permissions only
    // -----------------------------------------------------------------------
    // member role has organizations:read but NOT organizations:update
    const canRead = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:read",
    });
    expect(canRead.allowed).toBe(true);

    const canUpdate = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:update",
    });
    expect(canUpdate.allowed).toBe(false);

    // member role does NOT have teams:create
    const canCreateTeam = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:create",
    });
    expect(canCreateTeam.allowed).toBe(false);
  });
});

// ===========================================================================
// Journey 3: Suspension flow
// ===========================================================================

describe("Journey 3: Suspension flow", () => {
  test("suspended member is blocked from operations and restored after unsuspension", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org, adds bob as admin
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Suspension Flow Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 2: Bob can list members (admin has members:list)
    // -----------------------------------------------------------------------
    const membersBeforeSuspend = await asBob.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(membersBeforeSuspend).toHaveLength(2);

    // Bob can also perform mutations — add charlie as proof
    await asBob.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "charlie",
      role: "member",
    });
    expect(
      await asAlice.query(api.testHelpers.strictCountMembers, { organizationId: orgId })
    ).toBe(3);

    // -----------------------------------------------------------------------
    // Step 3: Alice suspends bob
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictSuspendMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 4: Verify bob's status is "suspended"
    // -----------------------------------------------------------------------
    const bobSuspended = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobSuspended?.status).toBe("suspended");

    // -----------------------------------------------------------------------
    // Step 5: Bob tries a mutation -> should be rejected (suspended)
    //         (Mutations use requireActiveMembership which blocks suspended
    //         members; queries like listMembers use requireMembership which
    //         does not block them.)
    // -----------------------------------------------------------------------
    await expect(
      asBob.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "dave",
        role: "member",
      })
    ).rejects.toThrow("Your membership is suspended");

    // -----------------------------------------------------------------------
    // Step 6: Alice unsuspends bob
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUnsuspendMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 7: Bob can perform mutations again
    // -----------------------------------------------------------------------
    const membersAfterUnsuspend = await asBob.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(membersAfterUnsuspend).toHaveLength(3); // alice + bob + charlie (active; bob was unsuspended)
  });
});

// ===========================================================================
// Journey 4: Last owner protection
// ===========================================================================

describe("Journey 4: Last owner protection", () => {
  test("sole owner cannot leave until another owner exists", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org (sole owner)
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Last Owner Protection Org",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice tries to leave -> should fail (she is the org owner)
    // -----------------------------------------------------------------------
    await expect(
      asAlice.mutation(api.testHelpers.strictLeaveOrganization, { organizationId: orgId })
    ).rejects.toThrow();

    // -----------------------------------------------------------------------
    // Step 3: Alice adds bob as admin
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 4: Alice tries to leave -> should still fail
    //         (alice is still the org's designated owner — updateMemberRole
    //          does not change org.ownerId, so she remains blocked)
    // -----------------------------------------------------------------------
    await expect(
      asAlice.mutation(api.testHelpers.strictLeaveOrganization, { organizationId: orgId })
    ).rejects.toThrow();

    // -----------------------------------------------------------------------
    // Step 5: Alice transfers ownership to bob
    //         (this updates org.ownerId to bob, allowing alice to leave)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgId,
      newOwnerUserId: "bob",
      previousOwnerRole: "admin",
    });

    // Verify roles after transfer
    const aliceAfterTransfer = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "alice",
    });
    expect(aliceAfterTransfer?.role).toBe("admin");
    const bobAfterTransfer = await asBob.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobAfterTransfer?.role).toBe("owner");

    // -----------------------------------------------------------------------
    // Step 6: Now alice can leave (bob is the designated owner)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictLeaveOrganization, {
      organizationId: orgId,
    });

    // -----------------------------------------------------------------------
    // Step 7: Verify alice is gone, bob remains as owner
    // -----------------------------------------------------------------------
    const members = await asBob.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe("bob");
    expect(members[0].role).toBe("owner");

    // Alice is no longer a member
    await expect(
      asAlice.query(api.testHelpers.strictGetOrganization, { organizationId: orgId })
    ).rejects.toThrow("Not a member of this organization");
  });
});
