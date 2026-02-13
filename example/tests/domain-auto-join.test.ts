import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - domain auto-join", () => {
  test("getCurrentUserEmail returns current user email from auth + getUser", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const aliceEmail = await asAlice.query(api.testHelpers.strictGetCurrentUserEmail, {});
    expect(aliceEmail).toBe("alice@test.com");

    const bobEmail = await asBob.query(api.testHelpers.strictGetCurrentUserEmail, {});
    expect(bobEmail).toBe("bob@test.com");
  });

  test("getCurrentUserEmail returns null when not authenticated", async () => {
    const t = initConvexTest();

    const email = await t.query(api.testHelpers.strictGetCurrentUserEmail, {});
    expect(email).toBeNull();
  });

  test("createOrganization with allowedDomains stores and getOrganization returns them", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Acme Corp",
      slug: "acme",
      allowedDomains: ["acme.com", "acme.io"],
    });

    const org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org?.allowedDomains).toEqual(["acme.com", "acme.io"]);
  });

  test("updateOrganization can set and clear allowedDomains", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Update Domains Org",
      slug: "update-domains",
    });

    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      allowedDomains: ["company.com"],
    });
    let org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org?.allowedDomains).toEqual(["company.com"]);

    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      allowedDomains: null,
    });
    org = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(org?.allowedDomains).toBeUndefined();
  });

  test("listOrganizationsJoinableByDomain returns orgs where email domain is allowed", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Acme",
      slug: "acme",
      allowedDomains: ["acme.com"],
    });
    await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Other",
      slug: "other",
      allowedDomains: ["other.org"],
    });

    const joinable = await asAlice.query(api.testHelpers.strictListOrganizationsJoinableByDomain, {
      email: "bob@acme.com",
    });
    expect(joinable).toHaveLength(1);
    expect(joinable[0].slug).toBe("acme");
    expect(joinable[0].name).toBe("Acme");

    const joinableOther = await asAlice.query(api.testHelpers.strictListOrganizationsJoinableByDomain, {
      email: "bob@other.org",
    });
    expect(joinableOther).toHaveLength(1);
    expect(joinableOther[0].slug).toBe("other");
  });

  test("joinByDomain adds member when email domain is in allowedDomains", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Join By Domain Org",
      slug: "join-domain",
      allowedDomains: ["test.com"],
    });

    await asBob.mutation(api.testHelpers.strictJoinByDomain, {
      organizationId: orgId,
      userEmail: "bob@test.com",
      role: "member",
    });

    const member = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(member).not.toBeNull();
    expect(member?.role).toBe("member");
  });

  test("joinByDomain throws when email domain is not allowed", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Strict Domain Org",
      slug: "strict-domain",
      allowedDomains: ["acme.com"],
    });

    await expect(
      asBob.mutation(api.testHelpers.strictJoinByDomain, {
        organizationId: orgId,
        userEmail: "bob@other.com",
        role: "member",
      })
    ).rejects.toThrow(/email domain|not allowed/i);
  });

  test("joinByDomain throws when already a member", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Already Member Org",
      slug: "already-member",
      allowedDomains: ["test.com"],
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    await expect(
      asBob.mutation(api.testHelpers.strictJoinByDomain, {
        organizationId: orgId,
        userEmail: "bob@test.com",
        role: "admin",
      })
    ).rejects.toThrow(/already a member|ALREADY_EXISTS/i);
  });
});
