/**
 * User journey tests — pagination, filtering, sorting, permission checks,
 * self-operations edge cases, and minimal-org behavior.
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

// ===========================================================================
// Journey 1: Paginated member listing
// ===========================================================================

describe("Journey 1: Paginated member listing", () => {
  test("paginating through members returns all members across pages", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // Step 1: Alice creates org
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Pagination Org",
    });

    // Step 2: Alice adds 5 members
    for (const name of ["bob", "charlie", "diana", "eve", "frank"]) {
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: name,
        role: "member",
      });
    }

    // Step 3: First page — numItems: 2, cursor: null
    const page1 = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
      paginationOpts: { numItems: 2, cursor: null },
    });

    // Step 4: Verify first page has 2 members and is not done
    expect(page1.page).toHaveLength(2);
    expect(page1.isDone).toBe(false);
    expect(page1.continueCursor).toBeDefined();
    expect(page1.continueCursor).not.toBeNull();

    // Step 5: Second page
    const page2 = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
      paginationOpts: { numItems: 2, cursor: page1.continueCursor },
    });

    // Step 6: Verify second page has 2 members and is not done
    expect(page2.page).toHaveLength(2);
    expect(page2.isDone).toBe(false);

    // Step 7–8: Continue paginating until isDone is true, collecting all remaining pages
    const allPages: any[][] = [page1.page, page2.page];
    let currentCursor = page2.continueCursor;
    let lastIsDone = page2.isDone;

    while (!lastIsDone) {
      const nextPage = await asAlice.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
        paginationOpts: { numItems: 2, cursor: currentCursor },
      });
      allPages.push(nextPage.page);
      currentCursor = nextPage.continueCursor;
      lastIsDone = nextPage.isDone;
    }

    // Step 9: Total across all pages should be 6 (alice + 5 added)
    const allUserIds = allPages.flat().map((m: any) => m.userId);
    expect(allUserIds).toHaveLength(6);

    // All 6 members should be present (no duplicates)
    const uniqueUserIds = new Set(allUserIds);
    expect(uniqueUserIds.size).toBe(6);
    expect(uniqueUserIds).toContain("alice");
    expect(uniqueUserIds).toContain("bob");
    expect(uniqueUserIds).toContain("charlie");
    expect(uniqueUserIds).toContain("diana");
    expect(uniqueUserIds).toContain("eve");
    expect(uniqueUserIds).toContain("frank");
  });
});

// ===========================================================================
// Journey 2: Member filtering by status
// ===========================================================================

describe("Journey 2: Member filtering by status", () => {
  test("filtering members by active, suspended, and all statuses", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // Step 1: Alice creates org, adds bob, charlie, diana
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Status Filter Org",
    });
    for (const name of ["bob", "charlie", "diana"]) {
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: name,
        role: "member",
      });
    }

    // Step 2: Alice suspends bob
    await asAlice.mutation(api.testHelpers.strictSuspendMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });

    // Step 3: countMembers with status "active" -> 3 (alice, charlie, diana)
    const activeCount = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
      status: "active",
    });
    expect(activeCount).toBe(3);

    // Step 4: countMembers with status "suspended" -> 1 (bob)
    const suspendedCount = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
      status: "suspended",
    });
    expect(suspendedCount).toBe(1);

    // Step 5: countMembers with status "all" -> 4
    const allCount = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
      status: "all",
    });
    expect(allCount).toBe(4);

    // Step 6: listMembers with status "suspended" -> only bob
    const suspendedMembers = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
      status: "suspended",
    });
    expect(suspendedMembers).toHaveLength(1);
    expect(suspendedMembers[0].userId).toBe("bob");

    // Step 7: listMembers with status "active" -> 3 members, bob NOT included
    const activeMembers = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
      status: "active",
    });
    expect(activeMembers).toHaveLength(3);
    const activeUserIds = activeMembers.map((m: any) => m.userId);
    expect(activeUserIds).not.toContain("bob");
    expect(activeUserIds).toContain("alice");
    expect(activeUserIds).toContain("charlie");
    expect(activeUserIds).toContain("diana");

    // Step 8: listMembers with status "all" -> all 4
    const allMembers = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
      status: "all",
    });
    expect(allMembers).toHaveLength(4);
  });
});

// ===========================================================================
// Journey 3: Member sorting
// ===========================================================================

describe("Journey 3: Member sorting", () => {
  test("sorting members by role in ascending and descending order", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // Step 1: Alice creates org, adds bob(admin), charlie(member), diana(admin)
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Sorting Org",
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
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "diana",
      role: "admin",
    });

    // Step 2: listMembers with sortBy: "role", sortOrder: "asc"
    const ascending = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
      sortBy: "role",
      sortOrder: "asc",
    });

    // Step 3: Verify members sorted by role alphabetically (admin, admin, member, owner)
    const rolesAsc = ascending.map((m: any) => m.role);
    expect(rolesAsc).toEqual(["admin", "admin", "member", "owner"]);

    // Step 4: listMembers with sortBy: "role", sortOrder: "desc"
    const descending = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
      sortBy: "role",
      sortOrder: "desc",
    });

    // Step 5: Verify reversed
    const rolesDesc = descending.map((m: any) => m.role);
    expect(rolesDesc).toEqual(["owner", "member", "admin", "admin"]);
  });
});

// ===========================================================================
// Journey 4: checkMemberPermission — role hierarchy in action
// ===========================================================================

describe("Journey 4: checkMemberPermission — role hierarchy in action", () => {
  test("role hierarchy checks work correctly for owner, admin, member, non-member, and suspended", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // Step 1: Alice creates org, adds bob(admin), charlie(member)
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Permission Check Org",
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

    // Step 2: alice (owner) with minRole "owner" -> true (owner >= owner)
    const aliceOwnerCheck = await asAlice.query(api.testHelpers.strictCheckMemberPermission, {
      organizationId: orgId,
      userId: "alice",
      minRole: "owner",
    });
    expect(aliceOwnerCheck.hasPermission).toBe(true);
    expect(aliceOwnerCheck.currentRole).toBe("owner");

    // Step 3: alice (owner) with minRole "admin" -> true (owner >= admin)
    const aliceAdminCheck = await asAlice.query(api.testHelpers.strictCheckMemberPermission, {
      organizationId: orgId,
      userId: "alice",
      minRole: "admin",
    });
    expect(aliceAdminCheck.hasPermission).toBe(true);

    // Step 4: bob (admin) with minRole "admin" -> true (admin >= admin)
    const bobAdminCheck = await asAlice.query(api.testHelpers.strictCheckMemberPermission, {
      organizationId: orgId,
      userId: "bob",
      minRole: "admin",
    });
    expect(bobAdminCheck.hasPermission).toBe(true);
    expect(bobAdminCheck.currentRole).toBe("admin");

    // Step 5: bob (admin) with minRole "owner" -> false (admin < owner)
    const bobOwnerCheck = await asAlice.query(api.testHelpers.strictCheckMemberPermission, {
      organizationId: orgId,
      userId: "bob",
      minRole: "owner",
    });
    expect(bobOwnerCheck.hasPermission).toBe(false);
    expect(bobOwnerCheck.currentRole).toBe("admin");

    // Step 6: charlie (member) with minRole "member" -> true
    const charlieMemberCheck = await asAlice.query(api.testHelpers.strictCheckMemberPermission, {
      organizationId: orgId,
      userId: "charlie",
      minRole: "member",
    });
    expect(charlieMemberCheck.hasPermission).toBe(true);
    expect(charlieMemberCheck.currentRole).toBe("member");

    // Step 7: charlie (member) with minRole "admin" -> false (member < admin)
    const charlieAdminCheck = await asAlice.query(api.testHelpers.strictCheckMemberPermission, {
      organizationId: orgId,
      userId: "charlie",
      minRole: "admin",
    });
    expect(charlieAdminCheck.hasPermission).toBe(false);
    expect(charlieAdminCheck.currentRole).toBe("member");

    // Step 8: non-member "stranger" with minRole "member" -> { hasPermission: false, currentRole: null }
    const strangerCheck = await asAlice.query(api.testHelpers.strictCheckMemberPermission, {
      organizationId: orgId,
      userId: "stranger",
      minRole: "member",
    });
    expect(strangerCheck.hasPermission).toBe(false);
    expect(strangerCheck.currentRole).toBeNull();

    // Step 9: Suspend bob
    await asAlice.mutation(api.testHelpers.strictSuspendMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });

    // Step 10: bob (suspended) with minRole "member" -> { hasPermission: false, isSuspended: true }
    const bobSuspendedCheck = await asAlice.query(api.testHelpers.strictCheckMemberPermission, {
      organizationId: orgId,
      userId: "bob",
      minRole: "member",
    });
    expect(bobSuspendedCheck.hasPermission).toBe(false);
    expect(bobSuspendedCheck.isSuspended).toBe(true);
    expect(bobSuspendedCheck.currentRole).toBe("admin");
  });
});

// ===========================================================================
// Journey 5: Edge cases — self-operations
// ===========================================================================

describe("Journey 5: Edge cases — self-operations", () => {
  test("owner cannot remove self, can downgrade another member, and can leave after ownership transfer", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Step 1: Alice creates org (sole owner)
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Self Operations Org",
    });

    // Step 2: Alice tries to remove herself -> should fail (owner can't be removed)
    await expect(
      asAlice.mutation(api.testHelpers.strictRemoveMember, {
        organizationId: orgId,
        memberUserId: "alice",
      })
    ).rejects.toThrow("Cannot remove the organization owner");

    // Step 3: Alice adds bob as admin
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // Step 4: Alice (owner) updates bob's role to "member"
    //         Only owner has members:updateRole permission; this verifies the
    //         owner can change other members' roles freely.
    await asAlice.mutation(api.testHelpers.strictUpdateMemberRole, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // Verify bob's role was changed
    const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember?.role).toBe("member");

    // Step 5: Alice adds charlie as owner (transferOwnership makes charlie owner)
    //         First promote bob back to admin so there's a proper second admin
    await asAlice.mutation(api.testHelpers.strictUpdateMemberRole, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });
    await asAlice.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgId,
      newOwnerUserId: "bob",
      previousOwnerRole: "admin",
    });

    // Verify transfer happened
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

    // Step 6: Now alice can leave (not sole owner)
    await asAlice.mutation(api.testHelpers.strictLeaveOrganization, {
      organizationId: orgId,
    });

    // Verify alice is gone
    const members = await asBob.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe("bob");
  });
});

// ===========================================================================
// Journey 6: Edge case — operations on empty/minimal org
// ===========================================================================

describe("Journey 6: Edge case — operations on empty/minimal org", () => {
  test("minimal org operations work correctly with single member and no teams/invitations", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // Step 1: Alice creates org (just alice, no teams, no invitations)
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Minimal Org",
    });

    // Step 2: listMembers -> just alice
    const members = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe("alice");
    expect(members[0].role).toBe("owner");

    // Step 3: countMembers -> 1
    const memberCount = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
    });
    expect(memberCount).toBe(1);

    // Step 4: listTeams -> empty
    const teams = await asAlice.query(api.testHelpers.strictListTeams, {
      organizationId: orgId,
    });
    expect(teams).toHaveLength(0);

    // Step 5: countTeams -> 0
    const teamCount = await asAlice.query(api.testHelpers.strictCountTeams, {
      organizationId: orgId,
    });
    expect(teamCount).toBe(0);

    // Step 6: listInvitations -> empty
    const invitations = await asAlice.query(api.testHelpers.strictListInvitations, {
      organizationId: orgId,
    });
    expect(invitations).toHaveLength(0);

    // Step 7: countInvitations -> 0
    const invitationCount = await asAlice.query(api.testHelpers.strictCountInvitations, {
      organizationId: orgId,
    });
    expect(invitationCount).toBe(0);

    // Step 8: Alice creates and immediately deletes a team -> no error, clean state
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Ephemeral Team",
    });
    expect(teamId).toBeDefined();

    await asAlice.mutation(api.testHelpers.strictDeleteTeam, {
      teamId,
    });

    // Verify team is gone and org state is clean
    const teamsAfterDelete = await asAlice.query(api.testHelpers.strictListTeams, {
      organizationId: orgId,
    });
    expect(teamsAfterDelete).toHaveLength(0);

    const teamCountAfterDelete = await asAlice.query(api.testHelpers.strictCountTeams, {
      organizationId: orgId,
    });
    expect(teamCountAfterDelete).toBe(0);
  });
});
