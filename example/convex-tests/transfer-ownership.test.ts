import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - transferOwnership", () => {
  test("owner can transfer ownership to another member", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Transfer Org",
    });

    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    await asAlice.mutation(api.testHelpers.strictTransferOwnership, {
      organizationId: orgId,
      newOwnerUserId: "bob",
    });

    const aliceMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "alice",
    });
    const bobMember = await asBob.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });

    expect(aliceMember?.role).toBe("admin");
    expect(bobMember?.role).toBe("owner");
  });

  test("non-owner cannot transfer ownership", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Deny Transfer Org",
    });

    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    await expect(
      asBob.mutation(api.testHelpers.strictTransferOwnership, {
        organizationId: orgId,
        newOwnerUserId: "alice",
      })
    ).rejects.toThrow("Only the current owner can transfer ownership");
  });

  test("new owner must already be a member", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Member Required Org",
    });

    await expect(
      asAlice.mutation(api.testHelpers.strictTransferOwnership, {
        organizationId: orgId,
        newOwnerUserId: "charlie",
      })
    ).rejects.toThrow("New owner must already be a member of the organization");
  });

  test("cannot transfer ownership to self", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Self Transfer Org",
    });

    await expect(
      asAlice.mutation(api.testHelpers.strictTransferOwnership, {
        organizationId: orgId,
        newOwnerUserId: "alice",
      })
    ).rejects.toThrow("New owner must be a different user");
  });
});
