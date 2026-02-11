import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - onBefore hooks", () => {
  test("onBeforeCreateOrganization is called before createOrganization", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "OnBefore Org",
      slug: "onbefore-org",
    });

    const logs = await asAlice.query(api.testHelpers.getCallbackLogs, {});
    const onBefore = logs.find((l: any) => l.type === "onBeforeCreateOrganization");
    expect(onBefore).toBeDefined();
    expect(onBefore.data.name).toBe("OnBefore Org");
    expect(onBefore.data.slug).toBe("onbefore-org");

    const onAfter = logs.find((l: any) => l.type === "organizationCreated");
    expect(onAfter).toBeDefined();
  });

  test("when onBeforeCreateOrganization throws, createOrganization does not create org", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    await expect(
      asAlice.mutation(api.testHelpers.strictCreateOrganizationBlockedByOnBefore, {
        name: "Blocked Org",
        slug: "blocked-org",
      })
    ).rejects.toThrow("Blocked by onBeforeCreateOrganization");

    const orgs = await asAlice.query(api.testHelpers.strictListOrganizations, {});
    const created = orgs.find((o: any) => o.slug === "blocked-org");
    expect(created).toBeUndefined();
  });
});
