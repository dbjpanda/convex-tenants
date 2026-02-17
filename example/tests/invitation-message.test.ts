import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - invitation message", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  test("inviteMember with message stores and returns message", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Message Invite Org",
    });

    const { invitationId } = await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "newuser@example.com",
      identifierType: "email",
      role: "member",
      message: "Welcome to the team! Please join us.",
    });

    const invitation = await t.query(api.testHelpers.strictGetInvitation, {
      invitationId,
    });

    expect(invitation?.message).toBe("Welcome to the team! Please join us.");
  });

  test("inviteMember without message has undefined message", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "No Message Invite Org",
    });

    const { invitationId } = await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "nomsg@example.com",
      identifierType: "email",
      role: "admin",
    });

    const invitation = await t.query(api.testHelpers.strictGetInvitation, {
      invitationId,
    });

    expect(invitation?.message).toBeUndefined();
  });

  test("listInvitations returns message for each invitation", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "List Message Org",
    });

    await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "with-msg@example.com",
      identifierType: "email",
      role: "member",
      message: "Custom message one",
    });
    await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "no-msg@example.com",
      identifierType: "email",
      role: "member",
    });

    const invitations = await asAlice.query(api.testHelpers.strictListInvitations, {
      organizationId: orgId,
    });

    expect(invitations).toHaveLength(2);
    const withMsg = invitations.find((i: any) => i.inviteeIdentifier === "with-msg@example.com");
    const noMsg = invitations.find((i: any) => i.inviteeIdentifier === "no-msg@example.com");
    expect(withMsg?.message).toBe("Custom message one");
    expect(noMsg?.message).toBeUndefined();
  });
});
