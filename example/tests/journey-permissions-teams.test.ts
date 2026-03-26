/**
 * User journey tests for permissions and team operations.
 *
 * Journey 1: Permission escalation via role change
 * Journey 2: Team lifecycle with cascading cleanup
 * Journey 3: Multi-org isolation — permissions don't bleed
 * Journey 4: checkAnyPermission in action
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

describe("Journey: Permissions & Teams", () => {
  // ────────────────────────────────────────────────────────────────────
  // Journey 1: Permission escalation via role change
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 1: Permission escalation via role change", () => {
    test("member gains permissions after being upgraded to admin", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      // 1. Alice creates org, adds bob as "member"
      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Escalation Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // 2. Verify: bob CANNOT create teams
      const teamsCreateBefore = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "teams:create",
      });
      expect(teamsCreateBefore.allowed).toBe(false);

      // 3. Verify: bob CANNOT add members
      const membersAddBefore = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "members:add",
      });
      expect(membersAddBefore.allowed).toBe(false);

      // 4. Alice upgrades bob to "admin"
      await asAlice.mutation(api.testHelpers.strictUpdateMemberRole, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "admin",
      });

      // 5. Verify: bob CAN now create teams
      const teamsCreateAfter = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "teams:create",
      });
      expect(teamsCreateAfter.allowed).toBe(true);

      // 6. Verify: bob CAN now add members
      const membersAddAfter = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "members:add",
      });
      expect(membersAddAfter.allowed).toBe(true);

      // 7. Bob creates a team "Backend" (proving he actually can)
      const teamId = await asBob.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Backend",
      });
      expect(teamId).toBeDefined();
      const team = await asBob.query(api.testHelpers.strictGetTeam, { teamId });
      expect(team?.name).toBe("Backend");

      // 8. Bob adds charlie as member (proving he actually can)
      await asBob.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "charlie",
        role: "member",
      });
      const charlie = await asBob.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "charlie",
      });
      expect(charlie).not.toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Journey 2: Team lifecycle with cascading cleanup
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 2: Team lifecycle with cascading cleanup", () => {
    test("deleting a team and removing a member cascades correctly", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      // 1. Alice creates org, adds bob + charlie + diana as members
      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Cascade Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId, memberUserId: "bob", role: "member",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId, memberUserId: "charlie", role: "member",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId, memberUserId: "diana", role: "member",
      });

      // 2. Alice creates "Frontend" team, adds bob + charlie
      const frontendId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId, name: "Frontend",
      });
      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId: frontendId, memberUserId: "bob",
      });
      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId: frontendId, memberUserId: "charlie",
      });

      // 3. Alice creates "Backend" team, adds charlie + diana
      const backendId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId, name: "Backend",
      });
      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId: backendId, memberUserId: "charlie",
      });
      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId: backendId, memberUserId: "diana",
      });

      // 4. Verify: charlie is in both teams
      expect(await hasTeamRelation(asAlice, "charlie", frontendId)).toBe(true);
      expect(await hasTeamRelation(asAlice, "charlie", backendId)).toBe(true);

      // 5. Alice deletes "Frontend" team
      await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId: frontendId });

      // 6. Verify: bob and charlie no longer in Frontend (ReBAC gone)
      expect(await hasTeamRelation(asAlice, "bob", frontendId)).toBe(false);
      expect(await hasTeamRelation(asAlice, "charlie", frontendId)).toBe(false);

      // 7. Verify: charlie still in Backend (not affected)
      expect(await hasTeamRelation(asAlice, "charlie", backendId)).toBe(true);

      // 8. Verify: diana still in Backend
      expect(await hasTeamRelation(asAlice, "diana", backendId)).toBe(true);

      // 9. Alice removes charlie from org
      await asAlice.mutation(api.testHelpers.strictRemoveMember, {
        organizationId: orgId, memberUserId: "charlie",
      });

      // 10. Verify: charlie no longer in Backend team either (cascading removal)
      expect(await hasTeamRelation(asAlice, "charlie", backendId)).toBe(false);

      // 11. Verify: diana still in Backend (not affected by charlie's removal)
      expect(await hasTeamRelation(asAlice, "diana", backendId)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Journey 3: Multi-org isolation — permissions don't bleed
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 3: Multi-org isolation — permissions don't bleed", () => {
    test("same user has different permissions in different orgs", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
      const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });

      // 1. Alice creates Org A, bob creates Org B
      const orgAId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Org A",
      });
      const orgBId = await asBob.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Org B",
      });

      // 2. Alice adds charlie to Org A as admin
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgAId, memberUserId: "charlie", role: "admin",
      });

      // 3. Bob adds charlie to Org B as member
      await asBob.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgBId, memberUserId: "charlie", role: "member",
      });

      // 4. Verify: charlie has admin perms in Org A (checkPermission "members:add" -> true)
      const charlieOrgA = await asCharlie.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgAId, permission: "members:add",
      });
      expect(charlieOrgA.allowed).toBe(true);

      // 5. Verify: charlie does NOT have admin perms in Org B (checkPermission "members:add" -> false)
      const charlieOrgB = await asCharlie.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgBId, permission: "members:add",
      });
      expect(charlieOrgB.allowed).toBe(false);

      // 6. Charlie creates a team in Org A (allowed - admin)
      const teamId = await asCharlie.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgAId, name: "Alpha Team",
      });
      expect(teamId).toBeDefined();

      // 7. Charlie tries to create a team in Org B -> should fail (member can't create teams)
      await expect(
        asCharlie.mutation(api.testHelpers.strictCreateTeam, {
          organizationId: orgBId, name: "Beta Team",
        })
      ).rejects.toThrow(/Permission denied.*teams:create/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Journey 4: checkAnyPermission in action
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 4: checkAnyPermission in action", () => {
    test("checkAnyPermission returns true when at least one permission matches", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      // 1. Alice creates org, adds bob as member
      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "AnyPerm Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId, memberUserId: "bob", role: "member",
      });

      // 2. Bob checks if he has ANY of ["members:add", "teams:create"] -> false (member role)
      const check1 = await asBob.query(api.testHelpers.strictCheckAnyPermission, {
        organizationId: orgId,
        permissions: ["members:add", "teams:create"],
      });
      expect(check1.allowed).toBe(false);

      // 3. Bob checks if he has ANY of ["organizations:read", "teams:create"] -> true (has organizations:read)
      const check2 = await asBob.query(api.testHelpers.strictCheckAnyPermission, {
        organizationId: orgId,
        permissions: ["organizations:read", "teams:create"],
      });
      expect(check2.allowed).toBe(true);

      // 4. Alice upgrades bob to admin
      await asAlice.mutation(api.testHelpers.strictUpdateMemberRole, {
        organizationId: orgId, memberUserId: "bob", role: "admin",
      });

      // 5. Bob checks if he has ANY of ["members:add", "teams:create"] -> true
      const check3 = await asBob.query(api.testHelpers.strictCheckAnyPermission, {
        organizationId: orgId,
        permissions: ["members:add", "teams:create"],
      });
      expect(check3.allowed).toBe(true);
    });
  });
});
