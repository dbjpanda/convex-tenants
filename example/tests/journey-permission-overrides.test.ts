/**
 * User journey tests for permission overrides (grant/deny).
 *
 * Journey 1: Grant → verify → deny → verify denied
 * Journey 2: getUserPermissions reflects overrides
 * Journey 3: hasRole combined with permission check
 * Journey 4: Admin manages permissions for team members
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("Journey: Permission Overrides", () => {
  // ────────────────────────────────────────────────────────────────────
  // Journey 1: Grant → verify → deny → verify denied
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 1: Grant → verify → deny → verify denied", () => {
    test("grant override enables action, deny override blocks it", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      // 1. Alice creates org, adds bob as member
      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Grant Deny Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // 2. Verify: bob CANNOT create teams (member role doesn't have teams:create)
      const beforeGrant = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "teams:create",
      });
      expect(beforeGrant.allowed).toBe(false);

      // 3. Alice grants bob "teams:create" permission override
      const grantId = await asAlice.mutation(api.testHelpers.strictGrantPermission, {
        organizationId: orgId,
        targetUserId: "bob",
        permission: "teams:create",
      });
      expect(grantId).toBeDefined();

      // 4. Verify: bob CAN now create teams (override grants it)
      const afterGrant = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "teams:create",
      });
      expect(afterGrant.allowed).toBe(true);

      // 5. Bob actually creates a team (proves the grant works at mutation level)
      const teamId = await asBob.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Bob's Team",
      });
      expect(teamId).toBeDefined();
      const team = await asBob.query(api.testHelpers.strictGetTeam, { teamId });
      expect(team?.name).toBe("Bob's Team");

      // 6. Alice denies bob "teams:create" (explicit deny overrides grant)
      const denyId = await asAlice.mutation(api.testHelpers.strictDenyPermission, {
        organizationId: orgId,
        targetUserId: "bob",
        permission: "teams:create",
      });
      expect(denyId).toBeDefined();

      // 7. Verify: bob CANNOT create teams anymore
      const afterDeny = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "teams:create",
      });
      expect(afterDeny.allowed).toBe(false);

      // 8. Bob tries to create another team → should fail
      await expect(
        asBob.mutation(api.testHelpers.strictCreateTeam, {
          organizationId: orgId,
          name: "Denied Team",
        })
      ).rejects.toThrow(/Permission denied.*teams:create/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Journey 2: getUserPermissions reflects overrides
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 2: getUserPermissions reflects overrides", () => {
    test("granted permission appears in getUserPermissions", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      // 1. Alice creates org, adds bob as admin
      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Perms Reflect Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "admin",
      });

      // 2. Bob checks getUserPermissions → should have admin-level permissions
      const permsBefore = await asBob.query(api.testHelpers.strictGetUserPermissions, {
        organizationId: orgId,
      });
      expect(Array.isArray(permsBefore)).toBe(true);
      expect(permsBefore.length).toBeGreaterThan(0);

      // Admin does NOT have organizations:delete — confirm it's absent
      const hasDeleteBefore = permsBefore.some((p: any) =>
        typeof p === "string"
          ? p === "organizations:delete"
          : p.permission === "organizations:delete"
      );
      expect(hasDeleteBefore).toBe(false);

      // 3. Alice grants bob "organizations:delete" — a permission admin doesn't normally have
      await asAlice.mutation(api.testHelpers.strictGrantPermission, {
        organizationId: orgId,
        targetUserId: "bob",
        permission: "organizations:delete",
      });

      // 4. Bob checks getUserPermissions → should now include organizations:delete
      const permsAfter = await asBob.query(api.testHelpers.strictGetUserPermissions, {
        organizationId: orgId,
      });
      expect(Array.isArray(permsAfter)).toBe(true);
      expect(permsAfter.length).toBeGreaterThan(permsBefore.length);

      const hasDeleteAfter = permsAfter.some((p: any) =>
        typeof p === "string"
          ? p === "organizations:delete"
          : p.permission === "organizations:delete"
      );
      expect(hasDeleteAfter).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Journey 3: hasRole combined with permission check
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 3: hasRole combined with permission check", () => {
    test("role changes are reflected in hasRole and checkPermission", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      // 1. Alice creates org, adds bob as member
      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "HasRole Org",
      });
      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // 2. bob.hasRole("member") → true
      const isMember = await asBob.query(api.testHelpers.strictHasRole, {
        organizationId: orgId,
        role: "member",
      });
      expect(isMember).toBe(true);

      // 3. bob.hasRole("admin") → false
      const isAdminBefore = await asBob.query(api.testHelpers.strictHasRole, {
        organizationId: orgId,
        role: "admin",
      });
      expect(isAdminBefore).toBe(false);

      // 4. bob.checkPermission("members:add") → false (member role doesn't have it)
      const membersAddBefore = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "members:add",
      });
      expect(membersAddBefore.allowed).toBe(false);

      // 5. Alice upgrades bob to admin
      await asAlice.mutation(api.testHelpers.strictUpdateMemberRole, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "admin",
      });

      // 6. bob.hasRole("admin") → true
      const isAdminAfter = await asBob.query(api.testHelpers.strictHasRole, {
        organizationId: orgId,
        role: "admin",
      });
      expect(isAdminAfter).toBe(true);

      // 7. bob.hasRole("member") → false (role changed, not accumulated)
      const isMemberAfter = await asBob.query(api.testHelpers.strictHasRole, {
        organizationId: orgId,
        role: "member",
      });
      expect(isMemberAfter).toBe(false);

      // 8. bob.checkPermission("members:add") → true
      const membersAddAfter = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "members:add",
      });
      expect(membersAddAfter.allowed).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Journey 4: Admin manages permissions for team members
  // ────────────────────────────────────────────────────────────────────
  describe("Journey 4: Admin manages permissions for team members", () => {
    test("admin grants targeted permission overrides to team members", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });
      const asCharlie = t.withIdentity({ subject: "charlie", issuer: "https://test.com" });
      const asDiana = t.withIdentity({ subject: "diana", issuer: "https://test.com" });

      // 1. Alice creates org with admin bob and members charlie, diana
      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Team Perms Org",
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
        role: "member",
      });

      // 2. Alice creates Engineering team, adds charlie and diana
      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });
      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "charlie",
      });
      await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
        teamId,
        memberUserId: "diana",
      });

      // Verify baseline: charlie and diana cannot update or delete teams
      const charlieUpdateBefore = await asCharlie.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "teams:update",
      });
      expect(charlieUpdateBefore.allowed).toBe(false);

      const dianaDeleteBefore = await asDiana.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "teams:delete",
      });
      expect(dianaDeleteBefore.allowed).toBe(false);

      // 3. Bob (admin) grants charlie "teams:update" permission
      await asBob.mutation(api.testHelpers.strictGrantPermission, {
        organizationId: orgId,
        targetUserId: "charlie",
        permission: "teams:update",
      });

      // 4. Charlie can now update the team name
      await asCharlie.mutation(api.testHelpers.strictUpdateTeam, {
        teamId,
        name: "Engineering v2",
      });
      const updatedTeam = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
      expect(updatedTeam?.name).toBe("Engineering v2");

      // 5. Bob grants diana "teams:delete" permission
      await asBob.mutation(api.testHelpers.strictGrantPermission, {
        organizationId: orgId,
        targetUserId: "diana",
        permission: "teams:delete",
      });

      // 6. Diana can delete the team
      await asDiana.mutation(api.testHelpers.strictDeleteTeam, { teamId });

      // Verify the team is gone
      const deletedTeam = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
      expect(deletedTeam).toBeNull();

      // 7. Verify: charlie cannot delete teams (only has update override)
      const charlieDeleteCheck = await asCharlie.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "teams:delete",
      });
      expect(charlieDeleteCheck.allowed).toBe(false);
    });
  });
});
