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
    component: {} as any,
    can: vi.fn().mockResolvedValue(true),
    require: vi.fn().mockResolvedValue(undefined),
    assignRole: vi.fn().mockResolvedValue("role-id"),
    revokeRole: vi.fn().mockResolvedValue(true),
    getUserRoles: vi.fn().mockResolvedValue([]),
    getUserPermissions: vi.fn().mockResolvedValue([]),
    grantPermission: vi.fn().mockResolvedValue("override-id"),
    denyPermission: vi.fn().mockResolvedValue("override-id"),
    getAuditLog: vi.fn().mockResolvedValue([]),
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
    it("calls component.members.checkMemberPermission with correct args", async () => {
      (ctx.runQuery as ReturnType<typeof vi.fn>).mockResolvedValue({
        hasPermission: true,
        currentRole: "owner",
      });

      const tenants = new Tenants(component, { authz });
      const result = await tenants.checkMemberPermission(
        ctx as any,
        "org_1",
        "user_1",
        "admin"
      );

      expect(ctx.runQuery).toHaveBeenCalledWith(
        component.members.checkMemberPermission,
        { organizationId: "org_1", userId: "user_1", minRole: "admin" }
      );
      expect(result).toEqual({ hasPermission: true, currentRole: "owner" });
    });
  });
});
