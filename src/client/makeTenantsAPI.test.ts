import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentApi } from "../component/_generated/component.js";
import { makeTenantsAPI } from "./makeTenantsAPI.js";

function createMockComponent(): ComponentApi {
  return {
    organizations: {} as any,
    members: {} as any,
    teams: {} as any,
    invitations: {} as any,
  };
}

describe("makeTenantsAPI", () => {
  let component: ComponentApi;
  let mockCtx: {
    runQuery: ReturnType<typeof vi.fn>;
    runMutation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    component = createMockComponent();
    mockCtx = {
      runQuery: vi.fn(),
      runMutation: vi.fn(),
    };
  });

  describe("auth enforcement", () => {
    it("listOrganizations throws when auth returns null", async () => {
      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => null,
      });

      const handler = (api.listOrganizations as any)._handler;
      await expect(handler(mockCtx, {})).rejects.toThrow("Not authenticated");
      expect(mockCtx.runQuery).not.toHaveBeenCalled();
    });

    it("getOrganization throws when auth returns null", async () => {
      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => null,
      });

      const handler = (api.getOrganization as any)._handler;
      await expect(
        handler(mockCtx, { organizationId: "org_1" })
      ).rejects.toThrow("Not authenticated");
    });

    it("createOrganization throws when auth returns null", async () => {
      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => null,
      });

      const handler = (api.createOrganization as any)._handler;
      await expect(
        handler(mockCtx, { name: "Test Org" })
      ).rejects.toThrow("Not authenticated");
      expect(mockCtx.runMutation).not.toHaveBeenCalled();
    });
  });

  describe("membership enforcement", () => {
    it("getOrganization throws when user is not a member", async () => {
      mockCtx.runQuery
        .mockResolvedValueOnce(null); // getMember returns null = not a member

      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => "user_1",
      });

      const handler = (api.getOrganization as any)._handler;
      await expect(
        handler(mockCtx, { organizationId: "org_1" })
      ).rejects.toThrow("Not a member of this organization");
    });
  });

  describe("maxOrganizations", () => {
    it("createOrganization throws when limit reached", async () => {
      // listOrganizations returns 1 org, maxOrganizations is 1
      mockCtx.runQuery.mockResolvedValue([
        { _id: "o1", name: "Existing", slug: "existing", role: "owner" },
      ]);

      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => "user_1",
        maxOrganizations: 1,
      });

      const handler = (api.createOrganization as any)._handler;
      await expect(
        handler(mockCtx, { name: "Second Org" })
      ).rejects.toThrow(/maximum|Maximum/i);

      expect(mockCtx.runMutation).not.toHaveBeenCalled();
    });
  });

  describe("requireActiveMembership", () => {
    it("throws when member is suspended", async () => {
      mockCtx.runQuery.mockResolvedValue({
        _id: "m1",
        organizationId: "org_1",
        userId: "user_1",
        role: "member",
        status: "suspended",
      });

      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => "user_1",
      });

      const handler = (api.addMember as any)._handler;
      await expect(
        handler(mockCtx, {
          organizationId: "org_1",
          memberUserId: "user_2",
          role: "member",
        })
      ).rejects.toThrow("Your membership is suspended");
    });
  });

  describe("getCurrentUserEmail", () => {
    it("returns null when auth returns null", async () => {
      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => null,
        getUser: async () => ({ name: "Test", email: "test@example.com" }),
      });

      const handler = (api.getCurrentUserEmail as any)._handler;
      const result = await handler(mockCtx, {});
      expect(result).toBeNull();
    });

    it("returns null when getUser is not provided", async () => {
      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => "user_1",
      });

      const handler = (api.getCurrentUserEmail as any)._handler;
      const result = await handler(mockCtx, {});
      expect(result).toBeNull();
    });

    it("returns email when auth and getUser return user with email", async () => {
      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => "user_1",
        getUser: async () => ({ name: "Alice", email: "alice@example.com" }),
      });

      const handler = (api.getCurrentUserEmail as any)._handler;
      const result = await handler(mockCtx, {});
      expect(result).toBe("alice@example.com");
    });

    it("returns null when getUser returns null", async () => {
      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => "user_1",
        getUser: async () => null,
      });

      const handler = (api.getCurrentUserEmail as any)._handler;
      const result = await handler(mockCtx, {});
      expect(result).toBeNull();
    });

    it("returns null when getUser returns user without email", async () => {
      const api = makeTenantsAPI(component, {
        authz: createMockAuthz(),
        auth: async () => "user_1",
        getUser: async () => ({ name: "Alice" }),
      });

      const handler = (api.getCurrentUserEmail as any)._handler;
      const result = await handler(mockCtx, {});
      expect(result).toBeNull();
    });
  });
});

function createMockAuthz() {
  return {
    component: {
      rebac: {
        addRelation: vi.fn().mockResolvedValue(undefined),
        removeRelation: vi.fn().mockResolvedValue(undefined),
      },
    } as any,
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
