/**
 * User journey tests for re-joining organizations and team member lifecycle.
 *
 * Journey 1: Re-joining after removal — clean slate
 * Journey 2: Re-joining after voluntary leave — same clean slate
 * Journey 3: Team member roles lifecycle
 * Journey 4: Nested teams — parent-child hierarchy
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

/** Helper: check if a ReBAC team-member relation exists in authz. */
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
// Journey 1: Re-joining after removal — clean slate
// ===========================================================================

describe("Journey 1: Re-joining after removal — clean slate", () => {
  test("removed member returns with no prior teams, overrides, or role memory", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // 1. Alice creates org, adds bob as admin
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Rejoin Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // 2. Alice creates Engineering team, adds bob
    const engineeringId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: engineeringId,
      memberUserId: "bob",
    });

    // 3. Alice grants bob direct override "teams:delete"
    await asAlice.mutation(api.testHelpers.strictGrantPermission, {
      organizationId: orgId,
      targetUserId: "bob",
      permission: "teams:delete",
    });

    // 4. Verify: bob has admin role, is in Engineering, has teams:delete override
    const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember?.role).toBe("admin");

    expect(await hasTeamRelation(asAlice, "bob", engineeringId)).toBe(true);

    const teamsDeleteCheck = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:delete",
    });
    expect(teamsDeleteCheck.allowed).toBe(true);

    // 5. Alice removes bob from org
    await asAlice.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });

    // 6. Verify: bob gone from org, gone from team (ReBAC), override cleaned
    const bobAfterRemove = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobAfterRemove).toBeNull();

    expect(await hasTeamRelation(asAlice, "bob", engineeringId)).toBe(false);

    // 7. Alice re-adds bob as "member" (lower role than before)
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // 8. Verify: bob is member (NOT admin — fresh start)
    const bobRejoined = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobRejoined?.role).toBe("member");

    // 9. Verify: bob is NOT in Engineering team (not auto-restored)
    expect(await hasTeamRelation(asAlice, "bob", engineeringId)).toBe(false);

    const bobInTeam = await asBob.query(api.testHelpers.strictIsTeamMember, {
      teamId: engineeringId,
    });
    expect(bobInTeam).toBe(false);

    // 10. Verify: bob does NOT have teams:delete override anymore
    const teamsDeleteAfterRejoin = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:delete",
    });
    expect(teamsDeleteAfterRejoin.allowed).toBe(false);

    // 11. Verify: bob has only member-level permissions
    // member has organizations:read but NOT teams:create or members:add
    const canRead = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:read",
    });
    expect(canRead.allowed).toBe(true);

    const canCreateTeam = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:create",
    });
    expect(canCreateTeam.allowed).toBe(false);

    const canAddMembers = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "members:add",
    });
    expect(canAddMembers.allowed).toBe(false);
  });
});

// ===========================================================================
// Journey 2: Re-joining after voluntary leave — same clean slate
// ===========================================================================

describe("Journey 2: Re-joining after voluntary leave — same clean slate", () => {
  test("member who voluntarily leaves returns with completely clean state", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // 1. Alice creates org, adds bob as admin
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Voluntary Leave Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // Alice creates 2 teams and adds bob to both
    const team1Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Alpha",
    });
    const team2Id = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Beta",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: team1Id,
      memberUserId: "bob",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: team2Id,
      memberUserId: "bob",
    });

    // 2. Alice grants bob a permission override
    await asAlice.mutation(api.testHelpers.strictGrantPermission, {
      organizationId: orgId,
      targetUserId: "bob",
      permission: "organizations:delete",
    });

    // Verify pre-leave state: admin + 2 teams + override
    const bobBefore = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobBefore?.role).toBe("admin");
    expect(await hasTeamRelation(asAlice, "bob", team1Id)).toBe(true);
    expect(await hasTeamRelation(asAlice, "bob", team2Id)).toBe(true);

    const overrideBefore = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(overrideBefore.allowed).toBe(true);

    // 3. Bob voluntarily leaves the org
    await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
      organizationId: orgId,
    });

    // Verify bob is gone
    const bobAfterLeave = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobAfterLeave).toBeNull();

    // 4. Alice re-adds bob as member
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // 5. Verify: completely clean — no teams, no overrides, member role only
    const bobRejoined = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobRejoined?.role).toBe("member");

    // No teams
    expect(await hasTeamRelation(asAlice, "bob", team1Id)).toBe(false);
    expect(await hasTeamRelation(asAlice, "bob", team2Id)).toBe(false);

    const bobInTeam1 = await asBob.query(api.testHelpers.strictIsTeamMember, {
      teamId: team1Id,
    });
    expect(bobInTeam1).toBe(false);
    const bobInTeam2 = await asBob.query(api.testHelpers.strictIsTeamMember, {
      teamId: team2Id,
    });
    expect(bobInTeam2).toBe(false);

    // No overrides
    const overrideAfterRejoin = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(overrideAfterRejoin.allowed).toBe(false);

    // Member-level permissions only
    const canRead = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:read",
    });
    expect(canRead.allowed).toBe(true);

    const canCreateTeam = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:create",
    });
    expect(canCreateTeam.allowed).toBe(false);
  });
});

// ===========================================================================
// Journey 3: Team member roles lifecycle
// ===========================================================================

describe("Journey 3: Team member roles lifecycle", () => {
  test("team member roles can be assigned, updated, and verified via listTeamMembers", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // 1. Alice creates org, adds bob and charlie as org members
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Team Roles Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "charlie",
      role: "member",
    });

    // 2. Alice creates "Platform" team
    const platformId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Platform",
    });

    // 3. Alice adds bob to Platform team (default role)
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: platformId,
      memberUserId: "bob",
    });

    // 4. Verify: bob's team role via listTeamMembers
    const membersAfterBob = await asAlice.query(api.testHelpers.strictListTeamMembers, {
      teamId: platformId,
    }) as Array<{ userId: string; role?: string }>;
    expect(membersAfterBob).toHaveLength(1);
    const bobEntry = membersAfterBob.find((m) => m.userId === "bob");
    expect(bobEntry).toBeDefined();
    // Default role is undefined (no explicit role set)
    expect(bobEntry!.role).toBeUndefined();

    // 5. Alice updates bob's team role to "lead"
    await asAlice.mutation(api.testHelpers.strictUpdateTeamMemberRole, {
      teamId: platformId,
      memberUserId: "bob",
      role: "lead",
    });

    // 6. Verify: bob's team role is now "lead"
    const membersAfterRoleChange = await asAlice.query(api.testHelpers.strictListTeamMembers, {
      teamId: platformId,
    }) as Array<{ userId: string; role?: string }>;
    const bobAfterUpdate = membersAfterRoleChange.find((m) => m.userId === "bob");
    expect(bobAfterUpdate?.role).toBe("lead");

    // 7. Alice adds charlie to Platform team
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: platformId,
      memberUserId: "charlie",
    });

    // 8. Verify: listTeamMembers shows bob(lead) and charlie(default)
    const allMembers = await asAlice.query(api.testHelpers.strictListTeamMembers, {
      teamId: platformId,
    }) as Array<{ userId: string; role?: string }>;
    expect(allMembers).toHaveLength(2);

    const bobFinal = allMembers.find((m) => m.userId === "bob");
    const charlieFinal = allMembers.find((m) => m.userId === "charlie");
    expect(bobFinal?.role).toBe("lead");
    expect(charlieFinal?.role).toBeUndefined();

    // 9. Alice removes bob from Platform team
    await asAlice.mutation(api.testHelpers.strictRemoveTeamMember, {
      teamId: platformId,
      memberUserId: "bob",
    });

    // 10. Verify: only charlie remains
    const remainingMembers = await asAlice.query(api.testHelpers.strictListTeamMembers, {
      teamId: platformId,
    }) as Array<{ userId: string; role?: string }>;
    expect(remainingMembers).toHaveLength(1);
    expect(remainingMembers[0].userId).toBe("charlie");
  });
});

// ===========================================================================
// Journey 4: Nested teams — parent-child hierarchy
// ===========================================================================

describe("Journey 4: Nested teams — parent-child hierarchy", () => {
  test("team tree structure, reparenting on delete, and membership isolation", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // 1. Alice creates org
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Nested Teams Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // 2. Alice creates "Engineering" team (top level)
    const engineeringId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
    });

    // 3. Alice creates "Backend" team with parentTeamId = Engineering
    const backendId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Backend",
      parentTeamId: engineeringId,
    });

    // 4. Alice creates "Frontend" team with parentTeamId = Engineering
    const frontendId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Frontend",
      parentTeamId: engineeringId,
    });

    // 5. Alice creates "API" team with parentTeamId = Backend (grandchild)
    const apiTeamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "API",
      parentTeamId: backendId,
    });

    // 6. List teams as tree
    const tree = await asAlice.query(api.testHelpers.strictListTeamsAsTree, {
      organizationId: orgId,
    }) as Array<{
      team: { _id: string; name: string; parentTeamId?: string };
      children: Array<{
        team: { _id: string; name: string; parentTeamId?: string };
        children: Array<{
          team: { _id: string; name: string; parentTeamId?: string };
          children: unknown[];
        }>;
      }>;
    }>;

    // 7. Verify: Engineering is at top level with 2 children (Backend, Frontend)
    expect(tree).toHaveLength(1);
    const engineeringNode = tree[0];
    expect(engineeringNode.team.name).toBe("Engineering");
    expect(engineeringNode.children).toHaveLength(2);

    const childNames = engineeringNode.children.map((c) => c.team.name).sort();
    expect(childNames).toEqual(["Backend", "Frontend"]);

    // 8. Verify: Backend has 1 child (API)
    const backendNode = engineeringNode.children.find((c) => c.team.name === "Backend")!;
    expect(backendNode.children).toHaveLength(1);
    expect(backendNode.children[0].team.name).toBe("API");

    // 9. Verify: Frontend has 0 children
    const frontendNode = engineeringNode.children.find((c) => c.team.name === "Frontend")!;
    expect(frontendNode.children).toHaveLength(0);

    // 10. Add bob to Backend team
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId: backendId,
      memberUserId: "bob",
    });

    // 11. Verify: bob is in Backend but NOT in Engineering or API
    //     (team membership is not inherited up or down the hierarchy)
    expect(await hasTeamRelation(asAlice, "bob", backendId)).toBe(true);
    expect(await hasTeamRelation(asAlice, "bob", engineeringId)).toBe(false);
    expect(await hasTeamRelation(asAlice, "bob", apiTeamId)).toBe(false);

    // 12. Delete Backend team
    await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId: backendId });

    // 13. Verify: API team still exists (children are reparented to the
    //     deleted parent's parent, i.e. Engineering)
    const apiTeam = await asAlice.query(api.testHelpers.strictGetTeam, { teamId: apiTeamId });
    expect(apiTeam).not.toBeNull();
    expect(apiTeam?.name).toBe("API");
    // API should now be reparented under Engineering
    expect(apiTeam?.parentTeamId).toBe(engineeringId);

    // Verify the tree structure after deletion: Engineering -> [Frontend, API]
    const treeAfterDelete = await asAlice.query(api.testHelpers.strictListTeamsAsTree, {
      organizationId: orgId,
    }) as Array<{
      team: { _id: string; name: string };
      children: Array<{
        team: { _id: string; name: string };
        children: unknown[];
      }>;
    }>;

    expect(treeAfterDelete).toHaveLength(1);
    const engAfterDelete = treeAfterDelete[0];
    expect(engAfterDelete.team.name).toBe("Engineering");
    expect(engAfterDelete.children).toHaveLength(2);
    const childNamesAfterDelete = engAfterDelete.children.map((c) => c.team.name).sort();
    expect(childNamesAfterDelete).toEqual(["API", "Frontend"]);

    // 14. Verify: bob's ReBAC relation to Backend is cleaned
    expect(await hasTeamRelation(asAlice, "bob", backendId)).toBe(false);
  });
});
