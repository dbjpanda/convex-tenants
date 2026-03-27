/**
 * User journey tests — permission map overrides, onBefore hooks, limits,
 * and logo upload URL configuration.
 *
 * These tests exercise the makeTenantsAPI configuration surface: permissionMap,
 * onBefore* callbacks, max* limits, and generateUploadUrl.
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
// Journey 1: Permission map override — skip authz check
// ===========================================================================

describe("Journey 1: Permission map override — skip authz check", () => {
  test("permissionMap deleteOrganization: false skips authz but owner-only invariant still applies", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.permMapCreateOrg, {
      name: "PermMap Skip Org",
    });

    await asAlice.mutation(api.testHelpers.permMapAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // Member cannot delete even with permissionMap: false — owner-only invariant
    await expect(
      asBob.mutation(api.testHelpers.permMapDeleteOrg, { organizationId: orgId })
    ).rejects.toThrow("Only the organization owner can delete the organization");

    // Owner CAN delete (authz check skipped, owner check passes)
    await asAlice.mutation(api.testHelpers.permMapDeleteOrg, { organizationId: orgId });
    const aliceOrgs = await asAlice.query(api.testHelpers.strictListOrganizations, {});
    const deletedOrg = aliceOrgs.find((o: any) => o._id === orgId);
    expect(deletedOrg).toBeUndefined();
  });
});

// ===========================================================================
// Journey 2: Permission map override — remapped permission
// ===========================================================================

describe("Journey 2: Permission map override — remapped permission", () => {
  test("member can create team when permissionMap remaps createTeam to organizations:read", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org via permMapCreateOrg
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.permMapCreateOrg, {
      name: "PermMap Remap Org",
    });
    expect(orgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Alice adds bob as "member" via permMapAddMember
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.permMapAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 3: permMap config has createTeam: "organizations:read".
    //         Member role has organizations:read, so bob should be able to
    //         create a team even though teams:create is normally admin-only.
    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    // Step 4: Bob (member) creates a team via permMapCreateTeam — should SUCCEED
    // -----------------------------------------------------------------------
    const teamId = await asBob.mutation(api.testHelpers.permMapCreateTeam, {
      organizationId: orgId,
      name: "Bob's Team",
    });
    expect(teamId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 5: Verify team created successfully
    // -----------------------------------------------------------------------
    const team = await asBob.query(api.testHelpers.strictGetTeam, { teamId });
    expect(team).not.toBeNull();
    expect(team?.name).toBe("Bob's Team");
    expect(team?.organizationId).toBe(orgId);
  });
});

// ===========================================================================
// Journey 3: onBefore hook blocks operation
// ===========================================================================

describe("Journey 3: onBefore hook blocks operation", () => {
  test("onBeforeCreateOrganization that throws prevents org creation", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice tries to create org via strictCreateOrganizationBlockedByOnBefore
    // -----------------------------------------------------------------------
    // Step 2: Verify it throws "Blocked by onBeforeCreateOrganization"
    // -----------------------------------------------------------------------
    await expect(
      asAlice.mutation(api.testHelpers.strictCreateOrganizationBlockedByOnBefore, {
        name: "Blocked Org",
      })
    ).rejects.toThrow("Blocked by onBeforeCreateOrganization");

    // -----------------------------------------------------------------------
    // Step 3: Verify no org was created (the hook aborted the operation)
    // -----------------------------------------------------------------------
    const orgs = await asAlice.query(api.testHelpers.strictListOrganizations, {});
    expect(orgs).toHaveLength(0);
  });
});

// ===========================================================================
// Journey 4: onBefore hooks fire for all operations
// ===========================================================================

describe("Journey 4: onBefore hooks fire for all operations", () => {
  test("all onBefore callbacks fire and are logged in correct order", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org via onBeforeCreateOrg
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.onBeforeCreateOrg, {
      name: "Hooks Org",
    });
    expect(orgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Check callbackLogs: "onBeforeCreateOrganization" present
    // -----------------------------------------------------------------------
    const createLogs = await getLogsOfType(t, "onBeforeCreateOrganization");
    expect(createLogs).toHaveLength(1);
    expect(createLogs[0].data.name).toBe("Hooks Org");

    // -----------------------------------------------------------------------
    // Step 3: Alice updates org via onBeforeUpdateOrg
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.onBeforeUpdateOrg, {
      organizationId: orgId,
      name: "Hooks Org Updated",
    });

    // -----------------------------------------------------------------------
    // Step 4: Check: "onBeforeUpdateOrganization" present
    // -----------------------------------------------------------------------
    const updateLogs = await getLogsOfType(t, "onBeforeUpdateOrganization");
    expect(updateLogs).toHaveLength(1);
    expect(updateLogs[0].data.organizationId).toBe(orgId);

    // -----------------------------------------------------------------------
    // Step 5: Alice adds bob via onBeforeAddMember
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.onBeforeAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 6: Check: "onBeforeAddMember" present
    // -----------------------------------------------------------------------
    const addMemberLogs = await getLogsOfType(t, "onBeforeAddMember");
    expect(addMemberLogs).toHaveLength(1);
    expect(addMemberLogs[0].data.memberUserId).toBe("bob");

    // -----------------------------------------------------------------------
    // Step 7: Alice creates team via onBeforeCreateTeam
    // -----------------------------------------------------------------------
    const teamId = await asAlice.mutation(api.testHelpers.onBeforeCreateTeam, {
      organizationId: orgId,
      name: "Hooks Team",
    });
    expect(teamId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 8: Check: "onBeforeCreateTeam" present
    // -----------------------------------------------------------------------
    const createTeamLogs = await getLogsOfType(t, "onBeforeCreateTeam");
    expect(createTeamLogs).toHaveLength(1);
    expect(createTeamLogs[0].data.name).toBe("Hooks Team");

    // -----------------------------------------------------------------------
    // Step 9: Alice invites charlie via onBeforeInviteMember
    // -----------------------------------------------------------------------
    const { invitationId } = await asAlice.mutation(api.testHelpers.onBeforeInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "charlie@test.com",
      identifierType: "email",
      role: "member",
    });
    expect(invitationId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 10: Check: "onBeforeInviteMember" present
    // -----------------------------------------------------------------------
    const inviteLogs = await getLogsOfType(t, "onBeforeInviteMember");
    expect(inviteLogs).toHaveLength(1);

    // -----------------------------------------------------------------------
    // Step 11: Verify all onBefore callbacks fired in correct order
    // -----------------------------------------------------------------------
    const allLogs = await t.query(api.testHelpers.getCallbackLogs, {});
    const onBeforeLogs = allLogs.filter((l: any) => l.type.startsWith("onBefore"));
    expect(onBeforeLogs).toHaveLength(5);

    const types = onBeforeLogs.map((l: any) => l.type);
    expect(types).toEqual([
      "onBeforeCreateOrganization",
      "onBeforeUpdateOrganization",
      "onBeforeAddMember",
      "onBeforeCreateTeam",
      "onBeforeInviteMember",
    ]);
  });
});

// ===========================================================================
// Journey 5: Organization limits enforcement
// ===========================================================================

describe("Journey 5: Organization limits enforcement", () => {
  test("maxOrganizations, maxMembers, and maxTeams are enforced", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org via strictCreateOrganizationWithLimits (maxOrganizations: 1)
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganizationWithLimits, {
      name: "Limits Org",
    });
    expect(orgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Alice tries to create second org — fails with max org limit
    // -----------------------------------------------------------------------
    await expect(
      asAlice.mutation(api.testHelpers.strictCreateOrganizationWithLimits, {
        name: "Second Org",
      })
    ).rejects.toThrow("Maximum number of organizations (1) reached.");

    // -----------------------------------------------------------------------
    // Step 3: In the first org, alice is already a member (count=1)
    // -----------------------------------------------------------------------
    const memberCount = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
    });
    expect(memberCount).toBe(1);

    // -----------------------------------------------------------------------
    // Step 4: Alice adds bob via strictAddMemberWithLimits (maxMembers: 2)
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMemberWithLimits, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    const memberCountAfterBob = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
    });
    expect(memberCountAfterBob).toBe(2);

    // -----------------------------------------------------------------------
    // Step 5: Alice tries to add charlie — fails with max member limit
    // -----------------------------------------------------------------------
    await expect(
      asAlice.mutation(api.testHelpers.strictAddMemberWithLimits, {
        organizationId: orgId,
        memberUserId: "charlie",
        role: "member",
      })
    ).rejects.toThrow("Maximum number of members (2) for this organization reached.");

    // -----------------------------------------------------------------------
    // Step 6: Alice creates a team via strictCreateTeamWithLimits (maxTeams: 1)
    // -----------------------------------------------------------------------
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeamWithLimits, {
      organizationId: orgId,
      name: "First Team",
    });
    expect(teamId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 7: Alice tries to create second team — fails with max team limit
    // -----------------------------------------------------------------------
    await expect(
      asAlice.mutation(api.testHelpers.strictCreateTeamWithLimits, {
        organizationId: orgId,
        name: "Second Team",
      })
    ).rejects.toThrow("Maximum number of teams (1) for this organization reached.");
  });
});

// ===========================================================================
// Journey 6: Logo upload URL
// ===========================================================================

describe("Journey 6: Logo upload URL", () => {
  test("generateLogoUploadUrl returns fake upload URL", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org (needed to be authenticated)
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Upload Org",
    });
    expect(orgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Alice calls strictGenerateLogoUploadUrl
    // -----------------------------------------------------------------------
    const url = await asAlice.mutation(api.testHelpers.strictGenerateLogoUploadUrl, {});

    // -----------------------------------------------------------------------
    // Step 3: Verify returns the fake upload URL string
    // -----------------------------------------------------------------------
    expect(url).toBe("https://fake-upload-url.test/convex-upload");
  });
});
