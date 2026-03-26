/**
 * User journey tests — onBefore hooks for member/team/leave operations
 * and deny permission overriding role-based grants.
 *
 * Journey 1: onBefore hooks fire for member operations (updateRole, remove)
 * Journey 2: onBefore hooks fire for team operations (update, delete)
 * Journey 3: onBefore hook for leave organization
 * Journey 4: Deny permission overrides role grant
 * Journey 5: Deny + Grant interaction (deny wins over explicit grant)
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

// ---------------------------------------------------------------------------
// Shared helper: filter callback logs by type
// ---------------------------------------------------------------------------
async function getLogsOfType(
  runner: ReturnType<typeof initConvexTest>,
  type: string,
) {
  const logs = await runner.query(api.testHelpers.getCallbackLogs, {});
  return logs.filter((l: any) => l.type === type);
}

// ===========================================================================
// Journey 1: onBefore hooks fire for member operations
// ===========================================================================

describe("Journey 1: onBefore hooks fire for member operations", () => {
  test("onBeforeUpdateMemberRole and onBeforeRemoveMember fire with correct data", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // Step 1: Alice creates org via onBeforeCreateOrg
    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "Hooks Member Ops Org",
    });
    expect(orgId).toBeDefined();

    // Step 2: Alice adds bob via onBeforeAddMember
    await asAlice.mutation(api.testHelpers.onBeforeAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // Step 3: Alice updates bob's role via onBeforeUpdateMemberRole
    await asAlice.mutation(api.testHelpers.onBeforeUpdateMemberRole, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // Step 4: Check callbackLogs: "onBeforeUpdateMemberRole" present
    const updateRoleLogs = await getLogsOfType(t, "onBeforeUpdateMemberRole");
    expect(updateRoleLogs).toHaveLength(1);
    expect(updateRoleLogs[0].data.organizationId).toBe(orgId);
    expect(updateRoleLogs[0].data.memberUserId).toBe("bob");
    expect(updateRoleLogs[0].data.role).toBe("admin");

    // Step 5: Alice removes bob via onBeforeRemoveMember
    await asAlice.mutation(api.testHelpers.onBeforeRemoveMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });

    // Step 6: Check: "onBeforeRemoveMember" present with correct data
    const removeLogs = await getLogsOfType(t, "onBeforeRemoveMember");
    expect(removeLogs).toHaveLength(1);
    expect(removeLogs[0].data.organizationId).toBe(orgId);
    expect(removeLogs[0].data.memberUserId).toBe("bob");
  });
});

// ===========================================================================
// Journey 2: onBefore hooks fire for team operations
// ===========================================================================

describe("Journey 2: onBefore hooks fire for team operations", () => {
  test("onBeforeUpdateTeam and onBeforeDeleteTeam fire with correct data", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // Step 1: Alice creates org and team via onBefore hooks
    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "Hooks Team Ops Org",
    });
    const teamId = await asAlice.mutation(api.testHelpers.onBeforeCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
    });
    expect(teamId).toBeDefined();

    // Step 2: Alice updates team name via onBeforeUpdateTeam
    await asAlice.mutation(api.testHelpers.onBeforeUpdateTeam, {
      teamId,
      name: "Platform Engineering",
    });

    // Step 3: Check: "onBeforeUpdateTeam" present with correct data
    const updateTeamLogs = await getLogsOfType(t, "onBeforeUpdateTeam");
    expect(updateTeamLogs).toHaveLength(1);
    expect(updateTeamLogs[0].data.teamId).toBe(teamId);
    expect(updateTeamLogs[0].data.name).toBe("Platform Engineering");

    // Step 4: Alice deletes team via onBeforeDeleteTeam
    await asAlice.mutation(api.testHelpers.onBeforeDeleteTeam, {
      teamId,
    });

    // Step 5: Check: "onBeforeDeleteTeam" present with correct data
    const deleteTeamLogs = await getLogsOfType(t, "onBeforeDeleteTeam");
    expect(deleteTeamLogs).toHaveLength(1);
    expect(deleteTeamLogs[0].data.teamId).toBe(teamId);
  });
});

// ===========================================================================
// Journey 3: onBefore hook for leave organization
// ===========================================================================

describe("Journey 3: onBefore hook for leave organization", () => {
  test("onBeforeLeaveOrganization fires when member leaves", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Step 1: Alice creates org via onBeforeCreateOrg, adds bob
    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "Hooks Leave Org",
    });
    await asAlice.mutation(api.testHelpers.onBeforeAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // Step 2: Bob leaves via onBeforeLeaveOrg
    await asBob.mutation(api.testHelpers.onBeforeLeaveOrg, {
      organizationId: orgId,
    });

    // Step 3: Check: "onBeforeLeaveOrganization" present with { organizationId }
    const leaveLogs = await getLogsOfType(t, "onBeforeLeaveOrganization");
    expect(leaveLogs).toHaveLength(1);
    expect(leaveLogs[0].data.organizationId).toBe(orgId);
  });
});

// ===========================================================================
// Journey 4: Deny permission overrides role grant
// ===========================================================================

describe("Journey 4: Deny permission overrides role grant", () => {
  test("explicit deny removes admin's role-based permission", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Step 1: Alice creates org, adds bob as admin
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Deny Override Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // Step 2: Verify bob has "members:add" (admin role grants it)
    const beforeDeny = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "members:add",
    });
    expect(beforeDeny.allowed).toBe(true);

    // Step 3: Alice denies bob "members:add" with reason "Under review"
    const denyId = await asAlice.mutation(api.testHelpers.strictDenyPermission, {
      organizationId: orgId,
      targetUserId: "bob",
      permission: "members:add",
      reason: "Under review",
    });
    expect(denyId).toBeDefined();

    // Step 4: Verify bob NO LONGER has "members:add"
    const afterDeny = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "members:add",
    });
    expect(afterDeny.allowed).toBe(false);

    // Step 5: Bob tries to actually add a member — should FAIL
    await expect(
      asBob.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "charlie",
        role: "member",
      })
    ).rejects.toThrow(/Permission denied.*members:add/);

    // Step 6: Verify explicit deny beats role-based permission
    // Bob still has the admin role, but the deny overrides
    const hasAdminRole = await asBob.query(api.testHelpers.strictHasRole, {
      organizationId: orgId,
      role: "admin",
    });
    expect(hasAdminRole).toBe(true);

    // Despite having admin role, the permission is denied
    const stillDenied = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "members:add",
    });
    expect(stillDenied.allowed).toBe(false);
  });
});

// ===========================================================================
// Journey 5: Deny + Grant interaction
// ===========================================================================

describe("Journey 5: Deny + Grant interaction", () => {
  test("deny overrides explicit grant — deny always wins", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Step 1: Alice creates org, adds bob as member
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Deny Grant Interaction Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // Step 2: Member doesn't have "teams:create"
    const baseline = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:create",
    });
    expect(baseline.allowed).toBe(false);

    // Step 3: Alice grants bob "teams:create" — bob can now create teams
    const grantId = await asAlice.mutation(api.testHelpers.strictGrantPermission, {
      organizationId: orgId,
      targetUserId: "bob",
      permission: "teams:create",
    });
    expect(grantId).toBeDefined();

    const afterGrant = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:create",
    });
    expect(afterGrant.allowed).toBe(true);

    // Verify bob can actually create a team
    const teamId = await asBob.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Bob's Granted Team",
    });
    expect(teamId).toBeDefined();

    // Step 4: Alice denies bob "teams:create" — deny should override the grant
    const denyId = await asAlice.mutation(api.testHelpers.strictDenyPermission, {
      organizationId: orgId,
      targetUserId: "bob",
      permission: "teams:create",
    });
    expect(denyId).toBeDefined();

    // Step 5: Verify bob CANNOT create teams (deny wins over grant)
    const afterDeny = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:create",
    });
    expect(afterDeny.allowed).toBe(false);

    // Bob tries to create another team — should fail
    await expect(
      asBob.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Denied Team",
      })
    ).rejects.toThrow(/Permission denied.*teams:create/);
  });
});
