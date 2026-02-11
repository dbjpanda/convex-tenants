import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - structured org settings", () => {
  test("createOrganization with settings stores and getOrganization returns them", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Settings Org",
      slug: "settings-org",
      settings: {
        allowPublicSignup: true,
        requireInvitationToJoin: false,
      },
    });

    const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org?.settings?.allowPublicSignup).toBe(true);
    expect(org?.settings?.requireInvitationToJoin).toBe(false);
  });

  test("updateOrganization can set and update settings", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Update Settings Org",
      slug: "update-settings",
    });

    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      settings: {
        allowPublicSignup: true,
        requireInvitationToJoin: true,
      },
    });
    let org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org?.settings?.allowPublicSignup).toBe(true);
    expect(org?.settings?.requireInvitationToJoin).toBe(true);

    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      settings: {
        allowPublicSignup: false,
        requireInvitationToJoin: true,
      },
    });
    org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org?.settings?.allowPublicSignup).toBe(false);
    expect(org?.settings?.requireInvitationToJoin).toBe(true);
  });

  test("listUserOrganizations returns settings for each org", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "List Settings Org",
      slug: "list-settings",
      settings: { requireInvitationToJoin: true },
    });

    const orgs = await asAlice.query(api.testHelpers.strictListOrganizations, {});
    const found = orgs.find((o) => o.slug === "list-settings");
    expect(found?.settings?.requireInvitationToJoin).toBe(true);
  });
});
