/**
 * User journey tests — security boundary enforcement.
 *
 * Journey 1: Member cannot perform admin operations
 * Journey 2: Non-member cannot access organization
 * Journey 3: Admin cannot perform owner-only operations
 * Journey 4: Suspended member is locked out of mutations
 * Journey 5: Cross-org attack prevention
 * Journey 6: Unauthenticated access blocked
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

// ===========================================================================
// Journey 1: Member cannot perform admin operations
// ===========================================================================

describe("Journey 1: Member cannot perform admin operations", () => {
  test("member role is denied all admin/owner mutations", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Step 1: Alice creates org, adds bob as member
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Member Boundary Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // Step 2: Bob tries to add a new member -> fails (members:add denied)
    await expect(
      asBob.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "charlie",
        role: "member",
      })
    ).rejects.toThrow(/Permission denied.*members:add/);

    // Step 3: Bob tries to remove alice -> fails (members:remove denied)
    await expect(
      asBob.mutation(api.testHelpers.strictRemoveMember, {
        organizationId: orgId,
        memberUserId: "alice",
      })
    ).rejects.toThrow(/Permission denied.*members:remove/);

    // Step 4: Bob tries to create a team -> fails (teams:create denied)
    await expect(
      asBob.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Rogue Team",
      })
    ).rejects.toThrow(/Permission denied.*teams:create/);

    // Step 5: Bob tries to update org -> fails (organizations:update denied)
    await expect(
      asBob.mutation(api.testHelpers.strictUpdateOrganization, {
        organizationId: orgId,
        name: "Hijacked Org",
      })
    ).rejects.toThrow(/Permission denied.*organizations:update/);

    // Step 6: Bob tries to invite someone -> fails (invitations:create denied)
    await expect(
      asBob.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "eve@test.com",
        identifierType: "email",
        role: "member",
      })
    ).rejects.toThrow(/Permission denied.*invitations:create/);

    // Step 7: Bob tries to grant permissions -> fails (permissions:grant denied)
    await expect(
      asBob.mutation(api.testHelpers.strictGrantPermission, {
        organizationId: orgId,
        targetUserId: "bob",
        permission: "organizations:delete",
      })
    ).rejects.toThrow(/Permission denied.*permissions:grant/);

    // Step 8: Verify none of the operations actually succeeded
    // Only alice and bob remain as members (charlie was never added)
    const members = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
    });
    expect(members).toHaveLength(2);
    const userIds = members.map((m: any) => m.userId).sort();
    expect(userIds).toEqual(["alice", "bob"]);

    // No teams were created
    const teams = await asAlice.query(api.testHelpers.strictListTeams, {
      organizationId: orgId,
    });
    expect(teams).toHaveLength(0);

    // Org name unchanged
    const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org?.name).toBe("Member Boundary Org");

    // No invitations were created
    const invitations = await asAlice.query(api.testHelpers.strictListInvitations, {
      organizationId: orgId,
    });
    expect(invitations).toHaveLength(0);
  });
});

// ===========================================================================
// Journey 2: Non-member cannot access organization
// ===========================================================================

describe("Journey 2: Non-member cannot access organization", () => {
  test("non-member is completely isolated from an organization", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });

    // Step 1: Alice creates org "Secret Corp"
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Secret Corp",
    });

    // Step 2: Charlie (not a member) tries to list members -> fails
    await expect(
      asCharlie.query(api.testHelpers.strictListMembers, {
        organizationId: orgId,
      })
    ).rejects.toThrow("Not a member of this organization");

    // Step 3: Charlie tries to get org details -> fails
    await expect(
      asCharlie.query(api.testHelpers.strictGetOrganization, {
        organizationId: orgId,
      })
    ).rejects.toThrow("Not a member of this organization");

    // Step 4: Charlie tries to list teams -> fails
    await expect(
      asCharlie.query(api.testHelpers.strictListTeams, {
        organizationId: orgId,
      })
    ).rejects.toThrow("Not a member of this organization");

    // Step 5: Charlie tries to list invitations -> fails
    await expect(
      asCharlie.query(api.testHelpers.strictListInvitations, {
        organizationId: orgId,
      })
    ).rejects.toThrow("Not a member of this organization");

    // Step 6: Charlie tries to check permissions -> rejected (not a member)
    await expect(
      asCharlie.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "organizations:read",
      })
    ).rejects.toThrow("Not a member of this organization");

    // Verify: complete isolation — Charlie's org list does not contain Secret Corp
    const charlieOrgs = await asCharlie.query(api.testHelpers.strictListOrganizations, {});
    expect(charlieOrgs).toHaveLength(0);
  });
});

// ===========================================================================
// Journey 3: Admin cannot perform owner-only operations
// ===========================================================================

describe("Journey 3: Admin cannot perform owner-only operations", () => {
  test("admin has broad access but not destructive owner operations", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Step 1: Alice creates org, adds bob as admin
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Admin Boundary Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // Step 2: Bob CAN add members (admin has members:add) -> succeeds
    await asBob.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "carol",
      role: "member",
    });
    const carol = await asBob.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "carol",
    });
    expect(carol).not.toBeNull();
    expect(carol?.role).toBe("member");

    // Step 3: Bob CAN create teams (admin has teams:create) -> succeeds
    const teamId = await asBob.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Admin Created Team",
    });
    expect(teamId).toBeDefined();

    // Step 4: Bob tries to delete the org -> fails (organizations:delete is owner-only)
    await expect(
      asBob.mutation(api.testHelpers.strictDeleteOrganization, {
        organizationId: orgId,
      })
    ).rejects.toThrow("Only the organization owner can delete the organization");

    // Step 5: Bob tries to update a member's role -> fails (members:updateRole is owner-only)
    await expect(
      asBob.mutation(api.testHelpers.strictUpdateMemberRole, {
        organizationId: orgId,
        memberUserId: "carol",
        role: "admin",
      })
    ).rejects.toThrow(/Permission denied.*members:updateRole/);

    // Verify: org still exists and is unchanged
    const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org?.name).toBe("Admin Boundary Org");

    // Verify: carol is still a member (not promoted to admin)
    const carolAfter = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "carol",
    });
    expect(carolAfter?.role).toBe("member");
  });
});

// ===========================================================================
// Journey 4: Suspended member is locked out of mutations
// ===========================================================================

describe("Journey 4: Suspended member is locked out of mutations", () => {
  test("suspended member cannot perform mutations, restored after unsuspension", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Step 1: Alice creates org, adds bob as admin
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Suspend Boundary Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // Step 2: Bob creates a team (works fine — admin has teams:create)
    const team1Id = await asBob.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Team Before Suspend",
    });
    expect(team1Id).toBeDefined();

    // Step 3: Alice suspends bob
    await asAlice.mutation(api.testHelpers.strictSuspendMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });
    const bobSuspended = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobSuspended?.status).toBe("suspended");

    // Step 4: Bob tries to create another team -> fails (suspended)
    await expect(
      asBob.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Team During Suspend",
      })
    ).rejects.toThrow("Your membership is suspended");

    // Step 5: Bob tries to add a member -> fails (suspended)
    await expect(
      asBob.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "dave",
        role: "member",
      })
    ).rejects.toThrow("Your membership is suspended");

    // Step 6: Bob tries to invite someone -> fails (suspended)
    await expect(
      asBob.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "eve@test.com",
        identifierType: "email",
        role: "member",
      })
    ).rejects.toThrow("Your membership is suspended");

    // Step 7: Alice unsuspends bob
    await asAlice.mutation(api.testHelpers.strictUnsuspendMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });
    const bobUnsuspended = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobUnsuspended?.status).toBe("active");

    // Step 8: Bob creates a team -> works again
    const team2Id = await asBob.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Team After Unsuspend",
    });
    expect(team2Id).toBeDefined();

    // Verify: exactly 2 teams were created (before suspend + after unsuspend)
    const teams = await asAlice.query(api.testHelpers.strictListTeams, {
      organizationId: orgId,
    });
    expect(teams).toHaveLength(2);
    const teamNames = teams.map((t: any) => t.name).sort();
    expect(teamNames).toEqual(["Team After Unsuspend", "Team Before Suspend"]);
  });
});

// ===========================================================================
// Journey 5: Cross-org attack prevention
// ===========================================================================

describe("Journey 5: Cross-org attack prevention", () => {
  test("admin privileges in one org grant zero access in another", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
    const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });

    // Step 1: Alice creates Org A, bob creates Org B
    const orgAId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Org A",
    });
    const orgBId = await asBob.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Org B",
    });

    // Step 2: Alice adds charlie to Org A as admin
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgAId,
      memberUserId: "charlie",
      role: "admin",
    });

    // Verify charlie is admin in Org A (can add members)
    const charlieOrgAPerm = await asCharlie.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgAId,
      permission: "members:add",
    });
    expect(charlieOrgAPerm.allowed).toBe(true);

    // Step 3: Charlie (admin in A) tries to add a member to Org B -> fails (not a member of B)
    await expect(
      asCharlie.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgBId,
        memberUserId: "dave",
        role: "member",
      })
    ).rejects.toThrow("Not a member of this organization");

    // Step 4: Charlie tries to create a team in Org B -> fails
    await expect(
      asCharlie.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgBId,
        name: "Cross-Org Team",
      })
    ).rejects.toThrow("Not a member of this organization");

    // Step 5: Charlie tries to list members of Org B -> fails
    await expect(
      asCharlie.query(api.testHelpers.strictListMembers, {
        organizationId: orgBId,
      })
    ).rejects.toThrow("Not a member of this organization");

    // Step 6: Charlie tries to grant permissions in Org B -> fails
    await expect(
      asCharlie.mutation(api.testHelpers.strictGrantPermission, {
        organizationId: orgBId,
        targetUserId: "charlie",
        permission: "organizations:delete",
      })
    ).rejects.toThrow("Not a member of this organization");

    // Verify: Org B is completely untouched — only bob is a member
    const orgBMembers = await asBob.query(api.testHelpers.strictListMembers, {
      organizationId: orgBId,
    });
    expect(orgBMembers).toHaveLength(1);
    expect(orgBMembers[0].userId).toBe("bob");

    // Verify: Org B has no teams
    const orgBTeams = await asBob.query(api.testHelpers.strictListTeams, {
      organizationId: orgBId,
    });
    expect(orgBTeams).toHaveLength(0);
  });
});

// ===========================================================================
// Journey 6: Unauthenticated access blocked
// ===========================================================================

describe("Journey 6: Unauthenticated access blocked", () => {
  test("all operations require authentication", async () => {
    const t = initConvexTest();

    // Step 1: No identity — try to create an org -> fails (not authenticated)
    await expect(
      t.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Unauthenticated Org",
      })
    ).rejects.toThrow("Not authenticated");

    // Step 2: Try to list orgs -> fails
    await expect(
      t.query(api.testHelpers.strictListOrganizations, {})
    ).rejects.toThrow("Not authenticated");

    // Step 3: Try to get an org -> fails
    await expect(
      t.query(api.testHelpers.strictGetOrganization, {
        organizationId: "nonexistent",
      })
    ).rejects.toThrow("Not authenticated");

    // Step 4: Try to list members -> fails
    await expect(
      t.query(api.testHelpers.strictListMembers, {
        organizationId: "nonexistent",
      })
    ).rejects.toThrow("Not authenticated");

    // Step 5: Try to add a member -> fails
    await expect(
      t.mutation(api.testHelpers.strictAddMember, {
        organizationId: "nonexistent",
        memberUserId: "bob",
        role: "member",
      })
    ).rejects.toThrow("Not authenticated");

    // Step 6: Try to create a team -> fails
    await expect(
      t.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: "nonexistent",
        name: "Ghost Team",
      })
    ).rejects.toThrow("Not authenticated");

    // Step 7: Try to invite someone -> fails
    await expect(
      t.mutation(api.testHelpers.strictInviteMember, {
        organizationId: "nonexistent",
        inviteeIdentifier: "ghost@test.com",
        identifierType: "email",
        role: "member",
      })
    ).rejects.toThrow("Not authenticated");

    // Step 8: Try to check permissions -> fails
    await expect(
      t.query(api.testHelpers.strictCheckPermission, {
        organizationId: "nonexistent",
        permission: "organizations:read",
      })
    ).rejects.toThrow("Not authenticated");

    // Step 9: Try to grant a permission -> fails
    await expect(
      t.mutation(api.testHelpers.strictGrantPermission, {
        organizationId: "nonexistent",
        targetUserId: "bob",
        permission: "organizations:delete",
      })
    ).rejects.toThrow("Not authenticated");
  });
});
