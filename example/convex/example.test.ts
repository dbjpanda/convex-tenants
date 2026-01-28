import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api } from "./_generated/api";

describe("tenants example", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  test("create organization with direct component call", async () => {
    const t = initConvexTest();

    // Use asUser helper for authenticated calls
    const asUser = t.withIdentity({
      subject: "user123",
      issuer: "https://example.com",
    });

    const orgId = await asUser.mutation(api.example.directCreateOrganization, {
      name: "Test Org",
      slug: "test-org",
    });

    expect(orgId).toBeDefined();
    expect(typeof orgId).toBe("string");
  });

  test("list organizations returns empty for new user", async () => {
    const t = initConvexTest();

    // Use asUser helper for authenticated calls
    const asUser = t.withIdentity({
      subject: "user456",
      issuer: "https://example.com",
    });

    const orgs = await asUser.query(api.example.directListOrganizations, {});

    expect(orgs).toEqual([]);
  });

  test("create and list organizations", async () => {
    const t = initConvexTest();

    // Use asUser helper for authenticated calls
    const asUser = t.withIdentity({
      subject: "user789",
      issuer: "https://example.com",
    });

    // Create an organization
    const orgId = await asUser.mutation(api.example.directCreateOrganization, {
      name: "My Org",
      slug: "my-org",
    });

    expect(orgId).toBeDefined();

    // List organizations - should include the one we just created
    const orgs = await asUser.query(api.example.directListOrganizations, {});

    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe("My Org");
    expect(orgs[0].slug).toBe("my-org");
    expect(orgs[0].role).toBe("owner");
  });
});
