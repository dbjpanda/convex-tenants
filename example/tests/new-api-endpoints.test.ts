import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("new API endpoints", () => {
  describe("hasRole", () => {
    test("owner has role 'owner'", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "HasRole Owner Org",
      });

      const result = await asAlice.query(api.testHelpers.strictHasRole, {
        organizationId: orgId,
        role: "owner",
      });

      expect(result).toBe(true);
    });

    test("owner does NOT have role 'admin'", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "HasRole Not Admin Org",
      });

      const result = await asAlice.query(api.testHelpers.strictHasRole, {
        organizationId: orgId,
        role: "admin",
      });

      expect(result).toBe(false);
    });

    test("added member with role 'member' has that role", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "HasRole Member Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      const result = await asBob.query(api.testHelpers.strictHasRole, {
        organizationId: orgId,
        role: "member",
      });

      expect(result).toBe(true);
    });

    test("non-member cannot call hasRole", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "HasRole Non Member Org",
      });

      await expect(
        asBob.query(api.testHelpers.strictHasRole, {
          organizationId: orgId,
          role: "owner",
        })
      ).rejects.toThrow("Not a member of this organization");
    });
  });

  describe("checkAnyPermission", () => {
    test("owner with ['members:add', 'teams:create'] returns allowed true", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "CheckAny Owner Org",
      });

      const result = await asAlice.query(api.testHelpers.strictCheckAnyPermission, {
        organizationId: orgId,
        permissions: ["members:add", "teams:create"],
      });

      expect(result.allowed).toBe(true);
    });

    test("member with ['members:add', 'teams:create'] returns allowed false", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "CheckAny Member Denied Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // member role only has organizations:read and invitations:list
      const result = await asBob.query(api.testHelpers.strictCheckAnyPermission, {
        organizationId: orgId,
        permissions: ["members:add", "teams:create"],
      });

      expect(result.allowed).toBe(false);
    });

    test("member with ['organizations:read', 'teams:create'] returns allowed true (at least one matches)", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "CheckAny Member Partial Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // member has organizations:read but NOT teams:create — at least one matches
      const result = await asBob.query(api.testHelpers.strictCheckAnyPermission, {
        organizationId: orgId,
        permissions: ["organizations:read", "teams:create"],
      });

      expect(result.allowed).toBe(true);
    });

    test("non-member cannot call checkAnyPermission", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "CheckAny Non Member Org",
      });

      await expect(
        asBob.query(api.testHelpers.strictCheckAnyPermission, {
          organizationId: orgId,
          permissions: ["organizations:read"],
        })
      ).rejects.toThrow("Not a member of this organization");
    });
  });

  describe("recomputeUser", () => {
    test("owner can call recomputeUser for a member", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Recompute Owner Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // Owner has permissions:grant — should succeed without throwing
      await expect(
        asAlice.mutation(api.testHelpers.strictRecomputeUser, {
          organizationId: orgId,
          targetUserId: "bob",
        })
      ).resolves.not.toThrow();
    });

    test("member cannot call recomputeUser (needs permissions:grant)", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Recompute Member Denied Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // member role does not have permissions:grant — should throw
      await expect(
        asBob.mutation(api.testHelpers.strictRecomputeUser, {
          organizationId: orgId,
          targetUserId: "alice",
        })
      ).rejects.toThrow();
    });
  });
});
