import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentApi } from "../component/_generated/component.js";
import { Tenants } from "./tenants-class.js";

function createMockCtx() {
  return {
    runQuery: vi.fn(),
    runMutation: vi.fn(),
  };
}

function createMockAuthz() {
  return {
    can: vi.fn().mockResolvedValue(true),
    require: vi.fn().mockResolvedValue(undefined),
    assignRole: vi.fn().mockResolvedValue("role-id"),
    revokeRole: vi.fn().mockResolvedValue(true),
    getUserRoles: vi.fn().mockResolvedValue([]),
    getUserPermissions: vi.fn().mockResolvedValue([]),
    grantPermission: vi.fn().mockResolvedValue("override-id"),
    denyPermission: vi.fn().mockResolvedValue("override-id"),
    getAuditLog: vi.fn().mockResolvedValue([]),
    addRelation: vi.fn().mockResolvedValue("relation-id"),
    removeRelation: vi.fn().mockResolvedValue(true),
    hasRelation: vi.fn().mockResolvedValue(false),
  };
}

function createMockComponent(): ComponentApi {
  return {
    organizations: {} as any,
    members: {} as any,
    teams: {} as any,
    invitations: {} as any,
  };
}

describe("Tenants", () => {
  let ctx: ReturnType<typeof createMockCtx>;
  let authz: ReturnType<typeof createMockAuthz>;
  let component: ComponentApi;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockCtx();
    authz = createMockAuthz();
    component = createMockComponent();
  });

  describe("listOrganizations", () => {
    it("calls component.organizations.listUserOrganizations with userId and options", async () => {
      const orgs = [{ _id: "o1", name: "Org 1", role: "owner" }];
      (ctx.runQuery as ReturnType<typeof vi.fn>).mockResolvedValue(orgs);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.listOrganizations(ctx as any, "user_123", {
        sortBy: "name",
        sortOrder: "asc",
      });

      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.organizations.listUserOrganizations,
        { userId: "user_123", sortBy: "name", sortOrder: "asc" }
      );
      expect(result).toEqual(orgs);
    });
  });

  describe("getOrganization", () => {
    it("calls component.organizations.getOrganization and returns result", async () => {
      const org = { _id: "o1", name: "Acme", slug: "acme", ownerId: "u1" };
      (ctx.runQuery as ReturnType<typeof vi.fn>).mockResolvedValue(org);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.getOrganization(ctx as any, "o1");

      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.organizations.getOrganization,
        { organizationId: "o1" }
      );
      expect(result).toEqual(org);
    });
  });

  describe("permissionMap", () => {
    it("does not call authz.require when permissionMap has operation set to false", async () => {
      (ctx.runQuery as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([]) // listMembers
        .mockResolvedValueOnce([]); // listTeams
      (ctx.runMutation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tenants = new Tenants(component, {
        authz,
        permissionMap: { deleteOrganization: false },
      });

      await tenants.deleteOrganization(ctx as any, "user_123", "o1");

      expect(authz.require).not.toHaveBeenCalled();
      expect(ctx.runMutation).toHaveBeenCalled();
    });

    it("calls authz.require when permissionMap has permission string", async () => {
      (ctx.runQuery as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([{ _id: "o1", role: "owner" }])
        .mockResolvedValueOnce({ _id: "o1", name: "Acme", slug: "acme" })
        .mockResolvedValueOnce(null);
      (ctx.runMutation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tenants = new Tenants(component, {
        authz,
        permissionMap: { updateOrganization: "custom:update" },
      });

      await tenants.updateOrganization(ctx as any, "user_123", "o1", {
        name: "New Name",
      });

      expect(authz.require).toHaveBeenCalledWith(
        expect.anything(),
        "user_123",
        "custom:update",
        { type: "organization", id: "o1" }
      );
    });
  });

  describe("checkMemberPermission", () => {
    it("uses getMember with local hierarchy instead of component query", async () => {
      const member = {
        _id: "m1", _creationTime: 0, organizationId: "org_1",
        userId: "user_1", role: "owner", status: "active",
      };
      (ctx.runQuery as ReturnType<typeof vi.fn>).mockResolvedValue(member);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.checkMemberPermission(
        ctx as any, "org_1", "user_1", "admin"
      );

      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.members.getMember,
        { organizationId: "org_1", userId: "user_1" }
      );
      expect(result).toEqual({ hasPermission: true, currentRole: "owner" });
    });

    it("returns false for non-member", async () => {
      (ctx.runQuery as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.checkMemberPermission(ctx as any, "org_1", "user_1", "member");

      expect(result).toEqual({ hasPermission: false, currentRole: null });
    });

    it("returns isSuspended for suspended members", async () => {
      const member = {
        _id: "m1", _creationTime: 0, organizationId: "org_1",
        userId: "user_1", role: "admin", status: "suspended",
      };
      (ctx.runQuery as ReturnType<typeof vi.fn>).mockResolvedValue(member);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.checkMemberPermission(ctx as any, "org_1", "user_1", "member");

      expect(result).toEqual({ hasPermission: false, currentRole: "admin", isSuspended: true });
    });

    it("custom roles default to level 0", async () => {
      const member = {
        _id: "m1", _creationTime: 0, organizationId: "org_1",
        userId: "user_1", role: "viewer", status: "active",
      };
      (ctx.runQuery as ReturnType<typeof vi.fn>).mockResolvedValue(member);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.checkMemberPermission(ctx as any, "org_1", "user_1", "member");

      expect(result).toEqual({ hasPermission: false, currentRole: "viewer" });
    });

    it("uses custom roleHierarchy when provided", async () => {
      const member = {
        _id: "m1", _creationTime: 0, organizationId: "org_1",
        userId: "user_1", role: "superadmin", status: "active",
      };
      (ctx.runQuery as ReturnType<typeof vi.fn>).mockResolvedValue(member);

      const tenants = new Tenants(component, {
        authz,
        roleHierarchy: { superadmin: 10, admin: 5, member: 1 },
      });
      const result = await tenants.checkMemberPermission(ctx as any, "org_1", "user_1", "admin");

      expect(result).toEqual({ hasPermission: true, currentRole: "superadmin" });
    });

    it("treats all roles as level 0 with empty hierarchy", async () => {
      const member = {
        _id: "m1", _creationTime: 0, organizationId: "org_1",
        userId: "user_1", role: "owner", status: "active",
      };
      (ctx.runQuery as ReturnType<typeof vi.fn>).mockResolvedValue(member);

      const tenants = new Tenants(component, {
        authz,
        roleHierarchy: {},
      });
      const result = await tenants.checkMemberPermission(ctx as any, "org_1", "user_1", "admin");

      // Both owner and admin are level 0 with empty hierarchy → 0 >= 0 → true
      expect(result).toEqual({ hasPermission: true, currentRole: "owner" });
    });

    it("equal roles have permission (same level)", async () => {
      const member = {
        _id: "m1", _creationTime: 0, organizationId: "org_1",
        userId: "user_1", role: "admin", status: "active",
      };
      (ctx.runQuery as ReturnType<typeof vi.fn>).mockResolvedValue(member);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.checkMemberPermission(ctx as any, "org_1", "user_1", "admin");

      // admin (2) >= admin (2) → true
      expect(result).toEqual({ hasPermission: true, currentRole: "admin" });
    });
  });

  describe("isTeamMember", () => {
    it("delegates to authz.hasRelation instead of component query", async () => {
      authz.hasRelation.mockResolvedValue(true);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.isTeamMember(ctx as any, "team_1", "user_1");

      expect(authz.hasRelation).toHaveBeenCalledWith(
        expect.anything(),
        { type: "user", id: "user_1" },
        "member",
        { type: "team", id: "team_1" },
      );
      expect(result).toBe(true);
      expect(ctx.runQuery).not.toHaveBeenCalled();
    });
  });

  describe("getAuditLog", () => {
    it("forwards scope to authz.getAuditLog", async () => {
      authz.require.mockResolvedValue(undefined);
      authz.getAuditLog.mockResolvedValue([]);

      const tenants = new Tenants(component, { authz });
      await tenants.getAuditLog(ctx as any, "user_1", "org_1", { limit: 10 });

      expect(authz.getAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          scope: { type: "organization", id: "org_1" },
          limit: 10,
        }),
      );
    });

    it("filters client-side when authz returns unscoped results", async () => {
      authz.require.mockResolvedValue(undefined);
      authz.getAuditLog.mockResolvedValue([
        { action: "role_assigned", scope: { type: "organization", id: "org_1" } },
        { action: "role_assigned", scope: { type: "organization", id: "org_OTHER" } },
        { action: "role_revoked", scope: { type: "organization", id: "org_1" } },
      ]);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.getAuditLog(ctx as any, "user_1", "org_1");

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { action: "role_assigned", scope: { type: "organization", id: "org_1" } },
        { action: "role_revoked", scope: { type: "organization", id: "org_1" } },
      ]);
    });
  });

  describe("cleanupMemberAuthz fallback chain", () => {
    it("prefers offboardUser over revokeAllRoles for member cleanup", async () => {
      const authzWithBoth = {
        ...createMockAuthz(),
        offboardUser: vi.fn().mockResolvedValue({ rolesRevoked: 1, overridesRemoved: 0 }),
        revokeAllRoles: vi.fn().mockResolvedValue(1),
      };
      const member = { _id: "m1", userId: "bob", role: "member", organizationId: "org_1", _creationTime: 0 };
      (ctx.runQuery as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(member)  // getMember
        .mockResolvedValueOnce([]);     // listTeams (for cleanupTeamRelations)
      (ctx.runMutation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tenants = new Tenants(component, { authz: authzWithBoth });
      await tenants.removeMember(ctx as any, "alice", "org_1", "bob");

      expect(authzWithBoth.offboardUser).toHaveBeenCalledWith(
        expect.anything(), "bob",
        { scope: { type: "organization", id: "org_1" }, actorId: "alice", removeOverrides: true, removeRelationships: false },
      );
      expect(authzWithBoth.revokeAllRoles).not.toHaveBeenCalled();
      expect(authzWithBoth.revokeRole).not.toHaveBeenCalled();
    });

    it("falls back to revokeAllRoles when offboardUser not available", async () => {
      const authzWithRevokeAll = {
        ...createMockAuthz(),
        revokeAllRoles: vi.fn().mockResolvedValue(1),
      };
      const member = { _id: "m1", userId: "bob", role: "member", organizationId: "org_1", _creationTime: 0 };
      (ctx.runQuery as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(member)
        .mockResolvedValueOnce([]);
      (ctx.runMutation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tenants = new Tenants(component, { authz: authzWithRevokeAll });
      await tenants.removeMember(ctx as any, "alice", "org_1", "bob");

      expect(authzWithRevokeAll.revokeAllRoles).toHaveBeenCalledWith(
        expect.anything(), "bob",
        { type: "organization", id: "org_1" }, "alice",
      );
      expect(authzWithRevokeAll.revokeRole).not.toHaveBeenCalled();
    });

    it("falls back to revokeRole when neither offboardUser nor revokeAllRoles available", async () => {
      const member = { _id: "m1", userId: "bob", role: "member", organizationId: "org_1", _creationTime: 0 };
      (ctx.runQuery as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(member)
        .mockResolvedValueOnce([]);
      (ctx.runMutation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const tenants = new Tenants(component, { authz });
      await tenants.removeMember(ctx as any, "alice", "org_1", "bob");

      expect(authz.revokeRole).toHaveBeenCalledWith(
        expect.anything(), "bob", "member",
        { type: "organization", id: "org_1" }, "alice",
      );
    });
  });

  describe("canAny", () => {
    it("delegates to authz.canAny with orgScope", async () => {
      const authzWithCanAny = {
        ...createMockAuthz(),
        canAny: vi.fn().mockResolvedValue(true),
      };

      const tenants = new Tenants(component, { authz: authzWithCanAny });
      const result = await tenants.canAny(
        ctx as any, "user_1", ["members:add", "teams:create"], "org_1"
      );

      expect(authzWithCanAny.canAny).toHaveBeenCalledWith(
        expect.anything(), "user_1",
        ["members:add", "teams:create"],
        { type: "organization", id: "org_1" },
      );
      expect(result).toBe(true);
    });

    it("falls back to individual can() checks when canAny not available", async () => {
      authz.can.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.canAny(
        ctx as any, "user_1", ["members:add", "teams:create"], "org_1"
      );

      expect(result).toBe(true);
      expect(authz.can).toHaveBeenCalledTimes(2);
    });

    it("returns false when no permissions match in fallback mode", async () => {
      authz.can.mockResolvedValue(false);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.canAny(
        ctx as any, "user_1", ["members:add", "teams:create"], "org_1"
      );

      expect(result).toBe(false);
      expect(authz.can).toHaveBeenCalledTimes(2);
    });

    it("short-circuits on first true in fallback mode", async () => {
      authz.can.mockResolvedValueOnce(true);

      const tenants = new Tenants(component, { authz });
      const result = await tenants.canAny(
        ctx as any, "user_1", ["members:add", "teams:create", "teams:delete"], "org_1"
      );

      expect(result).toBe(true);
      // Should stop after first true — only 1 call
      expect(authz.can).toHaveBeenCalledTimes(1);
    });

    it("returns false for empty permissions array", async () => {
      const tenants = new Tenants(component, { authz });
      const result = await tenants.canAny(ctx as any, "user_1", [], "org_1");
      expect(result).toBe(false);
      expect(authz.can).not.toHaveBeenCalled();
    });

    it("returns false for empty array when canAny available", async () => {
      const authzWithCanAny = {
        ...createMockAuthz(),
        canAny: vi.fn().mockResolvedValue(false),
      };
      const tenants = new Tenants(component, { authz: authzWithCanAny });
      const result = await tenants.canAny(ctx as any, "user_1", [], "org_1");
      // canAny delegates to authz even for empty array
      expect(authzWithCanAny.canAny).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("hasRole", () => {
    it("delegates to authz.hasRole with orgScope when available", async () => {
      const authzWithHasRole = {
        ...createMockAuthz(),
        hasRole: vi.fn().mockResolvedValue(true),
      };

      const tenants = new Tenants(component, { authz: authzWithHasRole });
      const result = await tenants.hasRole(ctx as any, "user_1", "admin", "org_1");

      expect(authzWithHasRole.hasRole).toHaveBeenCalledWith(
        expect.anything(), "user_1", "admin",
        { type: "organization", id: "org_1" },
      );
      expect(result).toBe(true);
    });

    it("returns false when authz.hasRole returns false", async () => {
      const authzWithHasRole = {
        ...createMockAuthz(),
        hasRole: vi.fn().mockResolvedValue(false),
      };

      const tenants = new Tenants(component, { authz: authzWithHasRole });
      const result = await tenants.hasRole(ctx as any, "user_1", "admin", "org_1");

      expect(result).toBe(false);
    });

    it("falls back to getUserRoles when hasRole not available", async () => {
      const authzNoHasRole = { ...createMockAuthz() };
      delete (authzNoHasRole as any).hasRole;
      authzNoHasRole.getUserRoles.mockResolvedValue([
        { role: "admin", scope: { type: "organization", id: "org_1" } },
      ]);

      const tenants = new Tenants(component, { authz: authzNoHasRole });
      const result = await tenants.hasRole(ctx as any, "user_1", "admin", "org_1");

      expect(authzNoHasRole.getUserRoles).toHaveBeenCalledWith(
        expect.anything(), "user_1",
        { type: "organization", id: "org_1" },
      );
      expect(result).toBe(true);
    });

    it("fallback returns false when role not present", async () => {
      const authzNoHasRole = { ...createMockAuthz() };
      delete (authzNoHasRole as any).hasRole;
      authzNoHasRole.getUserRoles.mockResolvedValue([
        { role: "member", scope: { type: "organization", id: "org_1" } },
      ]);

      const tenants = new Tenants(component, { authz: authzNoHasRole });
      const result = await tenants.hasRole(ctx as any, "user_1", "admin", "org_1");

      expect(result).toBe(false);
    });

    it("fallback handles string-only roles array", async () => {
      const authzNoHasRole = { ...createMockAuthz() };
      delete (authzNoHasRole as any).hasRole;
      authzNoHasRole.getUserRoles.mockResolvedValue(["admin", "member"]);

      const tenants = new Tenants(component, { authz: authzNoHasRole });
      const result = await tenants.hasRole(ctx as any, "user_1", "admin", "org_1");

      expect(result).toBe(true);
    });

    it("returns false when getUserRoles returns empty array", async () => {
      const authzNoHasRole = { ...createMockAuthz() };
      delete (authzNoHasRole as any).hasRole;
      authzNoHasRole.getUserRoles.mockResolvedValue([]);

      const tenants = new Tenants(component, { authz: authzNoHasRole });
      const result = await tenants.hasRole(ctx as any, "user_1", "admin", "org_1");

      expect(result).toBe(false);
    });
  });

  describe("recomputeUser", () => {
    it("calls authz.recomputeUser when available", async () => {
      const authzWithRecompute = {
        ...createMockAuthz(),
        recomputeUser: vi.fn().mockResolvedValue(undefined),
      };
      authzWithRecompute.require.mockResolvedValue(undefined);

      const tenants = new Tenants(component, { authz: authzWithRecompute });
      await tenants.recomputeUser(ctx as any, "alice", "org_1", "bob");

      expect(authzWithRecompute.require).toHaveBeenCalledWith(
        expect.anything(), "alice", "permissions:grant",
        { type: "organization", id: "org_1" },
      );
      expect(authzWithRecompute.recomputeUser).toHaveBeenCalledWith(
        expect.anything(), "bob",
      );
    });

    it("does nothing when authz.recomputeUser not available", async () => {
      authz.require.mockResolvedValue(undefined);

      const tenants = new Tenants(component, { authz });
      // Should not throw
      await tenants.recomputeUser(ctx as any, "alice", "org_1", "bob");

      expect(authz.require).toHaveBeenCalled();
    });

    it("throws when user lacks grantPermission permission", async () => {
      authz.require.mockRejectedValue(new Error("Permission denied"));

      const tenants = new Tenants(component, { authz });
      await expect(
        tenants.recomputeUser(ctx as any, "alice", "org_1", "bob")
      ).rejects.toThrow("Permission denied");
    });
  });
});
