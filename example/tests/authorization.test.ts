import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - authorization API", () => {
  describe("authorization API", () => {
    test("checkPermission returns allowed for owner", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Check Permission Org",
      });

      const result = await asAlice.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "organizations:update",
      });

      expect(result.allowed).toBe(true);
    });

    test("checkPermission returns denied for non-owner permission", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Deny Permission Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // Member should not have organizations:delete
      const result = await asBob.query(api.testHelpers.strictCheckPermission, {
        organizationId: orgId,
        permission: "organizations:delete",
      });

      expect(result.allowed).toBe(false);
    });

    test("checkPermission throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictCheckPermission, {
          organizationId: "nonexistent",
          permission: "organizations:read",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("getUserPermissions returns permissions for user", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Get Permissions Org",
      });

      const perms = await asAlice.query(api.testHelpers.strictGetUserPermissions, {
        organizationId: orgId,
      });

      expect(perms).toBeDefined();
      // Owner should have permissions
      expect(perms.permissions.length).toBeGreaterThan(0);
    });

    test("getUserPermissions throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetUserPermissions, {
          organizationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("getUserRoles returns roles for user", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Get Roles Org",
      });

      const roles = await asAlice.query(api.testHelpers.strictGetUserRoles, {
        organizationId: orgId,
      });

      expect(roles).toBeDefined();
      expect(Array.isArray(roles)).toBe(true);
      // Owner should have the owner role
      expect(roles.length).toBeGreaterThan(0);
    });

    test("getUserRoles throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetUserRoles, {
          organizationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("getAuditLog returns audit entries", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      // Create an org to generate audit entries
      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Audit Org",
      });

      const logs = await asAlice.query(api.testHelpers.strictGetAuditLog, {
        organizationId: orgId,
      });

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
    });

    test("getAuditLog throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.query(api.testHelpers.strictGetAuditLog, {
          organizationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("grantPermission grants permission to user", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Grant Perm Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // Owner grants a direct permission to bob
      const permId = await asAlice.mutation(api.testHelpers.strictGrantPermission, {
        organizationId: orgId,
        targetUserId: "bob",
        permission: "organizations:delete",
      });

      expect(permId).toBeDefined();
      expect(typeof permId).toBe("string");
    });

    test("grantPermission throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictGrantPermission, {
          organizationId: "nonexistent",
          targetUserId: "bob",
          permission: "organizations:delete",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("grantPermission rejects cross-organization scope override", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgAId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Grant Scope Org A",
      });
      const orgBId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Grant Scope Org B",
      });

      await expect(
        asAlice.mutation(api.testHelpers.strictGrantPermission, {
          organizationId: orgAId,
          targetUserId: "bob",
          permission: "organizations:update",
          scope: { type: "organization", id: orgBId },
        })
      ).rejects.toThrow("Permission scope organization mismatch");
    });

    test("denyPermission denies permission for user", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Deny Perm Org",
      });

      await asAlice.mutation(api.testHelpers.strictAddMember, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "member",
      });

      // Owner denies a permission for bob
      const denyId = await asAlice.mutation(api.testHelpers.strictDenyPermission, {
        organizationId: orgId,
        targetUserId: "bob",
        permission: "members:read",
      });

      expect(denyId).toBeDefined();
      expect(typeof denyId).toBe("string");
    });

    test("denyPermission throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictDenyPermission, {
          organizationId: "nonexistent",
          targetUserId: "bob",
          permission: "members:read",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("denyPermission rejects cross-organization scope override", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      const orgAId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Deny Scope Org A",
      });
      const orgBId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Deny Scope Org B",
      });

      await expect(
        asAlice.mutation(api.testHelpers.strictDenyPermission, {
          organizationId: orgAId,
          targetUserId: "bob",
          permission: "organizations:update",
          scope: { type: "organization", id: orgBId },
        })
      ).rejects.toThrow("Permission scope organization mismatch");
    });
  });
});
