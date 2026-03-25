/**
 * Integration tests for validateInvitationCreate and validateInvitationAccept callbacks.
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("validateInvitationCreate", () => {
  test("allows invitation when identifier contains @", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.validateCreateOrg, {
      name: "Validate Create Org",
    });

    const result = await asAlice.mutation(api.testHelpers.validateCreateInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "bob@example.com",
      identifierType: "email",
      role: "member",
    });
    expect(result.invitationId).toBeDefined();
  });

  test("rejects invitation when identifier has no @ (non-email)", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.validateCreateOrg, {
      name: "Validate Create Reject Org",
    });

    await expect(
      asAlice.mutation(api.testHelpers.validateCreateInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "bob_username",
        identifierType: "username",
        role: "member",
      })
    ).rejects.toThrow("Only email identifiers are allowed");
  });

  test("bulk invitations return partial success with validation errors", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.validateCreateOrg, {
      name: "Validate Bulk Org",
    });

    const result = await asAlice.mutation(api.testHelpers.validateCreateBulkInviteMembers, {
      organizationId: orgId,
      invitations: [
        { inviteeIdentifier: "good@example.com", role: "member" },
        { inviteeIdentifier: "bad_username", role: "member" },
      ],
    });
    expect(result.success).toHaveLength(1);
    expect(result.success[0].inviteeIdentifier).toBe("good@example.com");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].inviteeIdentifier).toBe("bad_username");
    expect(result.errors[0].message).toContain("Only email identifiers are allowed");
  });
});

describe("validateInvitationAccept", () => {
  test("allows acceptance when email domains match", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    // bob's getUser returns bob@test.com
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.validateAcceptCreateOrg, {
      name: "Validate Accept Org",
    });

    const result = await asAlice.mutation(api.testHelpers.validateAcceptInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "invited@test.com",
      identifierType: "email",
      role: "member",
    });

    // bob@test.com accepting invited@test.com — same domain, should succeed
    await asBob.mutation(api.testHelpers.validateAcceptAcceptInvitation, {
      invitationId: result.invitationId,
    });
  });

  test("rejects acceptance when email domains differ", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    // bob's getUser returns bob@test.com
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.validateAcceptCreateOrg, {
      name: "Validate Accept Reject Org",
    });

    const result = await asAlice.mutation(api.testHelpers.validateAcceptInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "someone@otherdomain.com",
      identifierType: "email",
      role: "member",
    });

    // bob@test.com accepting someone@otherdomain.com — different domain, should fail
    await expect(
      asBob.mutation(api.testHelpers.validateAcceptAcceptInvitation, {
        invitationId: result.invitationId,
      })
    ).rejects.toThrow("Email domain does not match invitation");
  });
});
