/**
 * Cross-organization authz isolation.
 *
 * Verifies that every authz write performed by tenants is partitioned by
 * `organizationId` via `withTenant(orgId)`, not by the consumer's
 * module-scope `tenantId`. Without this routing, authz tables that key on
 * `(tenantId, ...)` (custom roles, user attributes, permission overrides,
 * relationships, audit log) collapse onto a single tenantId across every
 * organization the consumer serves — defeating authz's tenant partition.
 *
 * The example app constructs `authz` with `tenantId: "my-app"` (see
 * `example/convex/authz.ts`). If tenants routes correctly, role assignments
 * created via tenants's `addMember` should be visible under each
 * organization's tenantId, and absent under the constant `"my-app"`.
 *
 * Regression for: dbjpanda/convex-tenants#11.
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("Cross-organization authz isolation (#11)", () => {
  test("tenants routes assignRole through withTenant(organizationId)", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asFrank = t.withIdentity({ subject: "frank", issuer: "https://test.com" });

    const orgA = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "ACME",
      slug: "acme",
    });
    const orgB = await asFrank.mutation(api.testHelpers.strictCreateOrganization, {
      name: "BetaCo",
      slug: "betaco",
    });

    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgA,
      memberUserId: "bob",
      role: "member",
    });
    await asFrank.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgB,
      memberUserId: "bob",
      role: "member",
    });

    // Each org's tenantId partition must show its own assignment.
    const bobInOrgA = await asAlice.query(api.testHelpers.inspectAuthzRoles, {
      tenantId: orgA,
      userId: "bob",
    });
    const bobInOrgB = await asFrank.query(api.testHelpers.inspectAuthzRoles, {
      tenantId: orgB,
      userId: "bob",
    });
    expect(bobInOrgA, "bob's role under orgA's tenantId").toHaveLength(1);
    expect(bobInOrgA[0]).toMatchObject({ role: "member" });
    expect(bobInOrgB, "bob's role under orgB's tenantId").toHaveLength(1);
    expect(bobInOrgB[0]).toMatchObject({ role: "member" });

    // The consumer's constant tenantId must NOT collect assignments from
    // either org. If this fails, tenants is writing under the fixed
    // tenantId — every org's authz state collapses onto one partition.
    const bobUnderFixedTenant = await asAlice.query(api.testHelpers.inspectAuthzRoles, {
      tenantId: "my-app",
      userId: "bob",
    });
    expect(
      bobUnderFixedTenant,
      "no role assignments should land under the consumer's fixed tenantId"
    ).toHaveLength(0);
  });

  test("alice's owner role lands under orgA's tenantId, not the fixed one", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgA = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "ACME",
      slug: "acme-owner",
    });

    const aliceInOrgA = await asAlice.query(api.testHelpers.inspectAuthzRoles, {
      tenantId: orgA,
      userId: "alice",
    });
    expect(aliceInOrgA, "alice's owner assignment under orgA's tenantId")
      .toContainEqual(expect.objectContaining({ role: "owner" }));

    const aliceUnderFixed = await asAlice.query(api.testHelpers.inspectAuthzRoles, {
      tenantId: "my-app",
      userId: "alice",
    });
    expect(
      aliceUnderFixed,
      "alice's owner assignment must not land under the fixed tenantId"
    ).toHaveLength(0);
  });
});
