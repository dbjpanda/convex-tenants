import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - organization status", () => {
  test("createOrganization sets status to active by default", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Active Default Org",
    });

    const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });

    expect(org?.status).toBe("active");
  });

  test("updateOrganization can set status to suspended", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "To Suspend Org",
    });

    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      status: "suspended",
    });

    const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });

    expect(org?.status).toBe("suspended");
  });

  test("updateOrganization can set status to archived", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "To Archive Org",
    });

    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      status: "archived",
    });

    const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });

    expect(org?.status).toBe("archived");
  });

  test("listOrganizations returns status for each org", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Org A",
    });
    const orgBId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Org B",
    });

    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgBId,
      status: "suspended",
    });

    const orgs = await asAlice.query(api.testHelpers.strictListOrganizations, {});
    expect(orgs).toHaveLength(2);
    const orgA = orgs.find((o: any) => o.name === "Org A");
    const orgB = orgs.find((o: any) => o.name === "Org B");
    expect(orgA?.status).toBe("active");
    expect(orgB?.status).toBe("suspended");
  });
});
