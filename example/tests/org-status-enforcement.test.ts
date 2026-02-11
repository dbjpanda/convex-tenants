import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - organization status enforcement", () => {
  test("mutations are rejected when organization is suspended", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "To Suspend",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      status: "suspended",
    });

    await expect(
      asBob.mutation(api.testHelpers.strictUpdateMemberRole, {
        organizationId: orgId,
        memberUserId: "bob",
        role: "admin",
      })
    ).rejects.toThrow("Organization is suspended");

    await expect(
      asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "New Team",
      })
    ).rejects.toThrow("Organization is suspended");
  });

  test("updateOrganization with status active can reactivate suspended org", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Reactivate Me",
    });
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      status: "suspended",
    });

    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      status: "active",
    });

    const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org?.status).toBe("active");
  });

  test("listOrganizations with status filter returns only matching orgs", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const id1 = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Active One",
    });
    const id2 = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "To Suspend Two",
    });
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: id2,
      status: "suspended",
    });

    const activeOnly = await asAlice.query(api.testHelpers.strictListOrganizations, {
      status: "active",
    });
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].name).toBe("Active One");

    const suspendedOnly = await asAlice.query(api.testHelpers.strictListOrganizations, {
      status: "suspended",
    });
    expect(suspendedOnly).toHaveLength(1);
    expect(suspendedOnly[0].name).toBe("To Suspend Two");
  });
});
