import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - invitations", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  describe("onInvitationCreated callback", () => {
    test("callback receives correct invitation data", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Callback Test Org" }
      );

      const result = await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "invited@example.com",
        identifierType: "email",
        role: "admin",
      });

      // Verify the callback wrote to the callbackLog table
      const allLogs = await t.query(api.testHelpers.getCallbackLogs, {});
      const logs = allLogs.filter((l: any) => l.type === "invitationCreated");

      expect(logs).toHaveLength(1);
      expect(logs[0].data.inviteeIdentifier).toBe("invited@example.com");
      expect(logs[0].data.organizationName).toBe("Callback Test Org");
      expect(logs[0].data.role).toBe("admin");
      expect(logs[0].data.inviterName).toBe("User alice");
      expect(logs[0].data.invitationId).toBe(result.invitationId);
      expect(logs[0].data.organizationId).toBe(orgId);
      expect(logs[0].data.expiresAt).toBeGreaterThan(0);
    });

    test("callback receives inviterName from getUser", async () => {
      const t = initConvexTest();
      const asBob = t.withIdentity({
        subject: "bob-the-admin",
        issuer: "https://test.com",
      });

      const orgId = await asBob.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Inviter Name Org" }
      );

      await asBob.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "someone@example.com",
        identifierType: "email",
        role: "member",
      });

      const allLogs = await t.query(api.testHelpers.getCallbackLogs, {});
      const logs = allLogs.filter((l: any) => l.type === "invitationCreated");

      expect(logs).toHaveLength(1);
      // inviterName comes from getUser which returns `User ${userId}`
      expect(logs[0].data.inviterName).toBe("User bob-the-admin");
    });
  });

  describe("onInvitationResent callback", () => {
    test("callback receives correct data on resend", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Resend Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          inviteeIdentifier: "resend@example.com",
          identifierType: "email",
          role: "member",
        }
      );

      // Resend the invitation
      await asAlice.mutation(api.testHelpers.strictResendInvitation, {
        invitationId,
      });

      // Should have logs for invitationCreated + invitationResent
      const allLogs = await t.query(api.testHelpers.getCallbackLogs, {});

      const createdLog = allLogs.find((l: any) => l.type === "invitationCreated");
      const resentLog = allLogs.find((l: any) => l.type === "invitationResent");

      expect(createdLog).toBeDefined();
      expect(resentLog).toBeDefined();

      expect(resentLog!.data.inviteeIdentifier).toBe("resend@example.com");
      expect(resentLog!.data.organizationName).toBe("Resend Org");
      expect(resentLog!.data.role).toBe("member");
      expect(resentLog!.data.inviterName).toBe("User alice");
      expect(resentLog!.data.organizationId).toBe(orgId);
    });
  });

  describe("invitation functions", () => {
    test("listInvitations returns all invitations for an org", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "List Invitations Org" }
      );

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "user1@example.com",
        identifierType: "email",
        role: "member",
      });

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "user2@example.com",
        identifierType: "email",
        role: "admin",
      });

      const invitations = await asAlice.query(api.testHelpers.strictListInvitations, {
        organizationId: orgId,
      });

      expect(invitations).toHaveLength(2);
      expect(invitations.map((i: any) => i.inviteeIdentifier)).toContain(
        "user1@example.com"
      );
      expect(invitations.map((i: any) => i.inviteeIdentifier)).toContain(
        "user2@example.com"
      );
    });

    test("countInvitations returns invitation count", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Count Invitations Org" }
      );
      expect(await asAlice.query(api.testHelpers.strictCountInvitations, { organizationId: orgId })).toBe(0);

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "a@example.com",
        identifierType: "email",
        role: "member",
      });
      expect(await asAlice.query(api.testHelpers.strictCountInvitations, { organizationId: orgId })).toBe(1);

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "b@example.com",
        identifierType: "email",
        role: "admin",
      });
      expect(await asAlice.query(api.testHelpers.strictCountInvitations, { organizationId: orgId })).toBe(2);
    });

    test("getInvitation returns invitation by ID", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Get Invitation Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          inviteeIdentifier: "invited@example.com",
          identifierType: "email",
          role: "member",
        }
      );

      const invitation = await t.query(api.testHelpers.strictGetInvitation, {
        invitationId,
      });

      expect(invitation).not.toBeNull();
      expect(invitation?.inviteeIdentifier).toBe("invited@example.com");
      expect(invitation?.role).toBe("member");
      expect(invitation?.status).toBe("pending");
      expect(invitation?.organizationId).toBe(orgId);
    });

    test("getInvitation returns null for nonexistent ID", async () => {
      const t = initConvexTest();

      const invitation = await t.query(api.testHelpers.strictGetInvitation, {
        invitationId: "nonexistent",
      });

      expect(invitation).toBeNull();
    });

    test("listInvitationsPaginated returns paginated invitations", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Paginated Invitations Org" }
      );

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "a@test.com",
        identifierType: "email",
        role: "member",
      });
      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "b@test.com",
        identifierType: "email",
        role: "member",
      });
      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "c@test.com",
        identifierType: "email",
        role: "member",
      });

      const result = await asAlice.query(api.testHelpers.strictListInvitationsPaginated, {
        organizationId: orgId,
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.isDone).toBe(false);
      expect(result.continueCursor).toBeDefined();

      const nextPage = await asAlice.query(api.testHelpers.strictListInvitationsPaginated, {
        organizationId: orgId,
        paginationOpts: { numItems: 2, cursor: result.continueCursor },
      });
      expect(nextPage.page.length).toBeGreaterThanOrEqual(1);
    });

    test("getPendingInvitations returns invitations for email across orgs", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });
      const asBob = t.withIdentity({
        subject: "bob",
        issuer: "https://test.com",
      });
      const asTarget = t.withIdentity({
        subject: "target",
        issuer: "https://test.com",
      });

      const org1Id = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Pending Org 1" }
      );

      const org2Id = await asBob.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Pending Org 2" }
      );

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: org1Id,
        inviteeIdentifier: "target@test.com",
        identifierType: "email",
        role: "member",
      });

      await asBob.mutation(api.testHelpers.strictInviteMember, {
        organizationId: org2Id,
        inviteeIdentifier: "target@test.com",
        identifierType: "email",
        role: "admin",
      });

      // Must be authenticated to query pending invitations
      const pending = await asTarget.query(
        api.testHelpers.strictGetPendingInvitations,
        { identifier: "target@test.com" }
      );

      expect(pending).toHaveLength(2);

      // Unauthenticated callers are rejected
      await expect(
        t.query(api.testHelpers.strictGetPendingInvitations, {
          identifier: "target@test.com",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("getPendingInvitations blocks querying another user's email", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });
      const asTarget = t.withIdentity({
        subject: "target",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Pending Strict Org" }
      );

      await asAlice.mutation(api.testHelpers.strictInviteMember, {
        organizationId: orgId,
        inviteeIdentifier: "alice@test.com",
        identifierType: "email",
        role: "member",
      });

      await expect(
        asTarget.query(api.testHelpers.strictGetPendingInvitations, {
          identifier: "alice@test.com",
        })
      ).rejects.toThrow("Cannot query invitations for another identifier");
    });

    test("acceptInvitation adds user as member with invited role", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });
      const asBob = t.withIdentity({
        subject: "bob",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Accept Invitation Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          inviteeIdentifier: "bob@test.com",
          identifierType: "email",
          role: "admin",
        }
      );

      await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
        invitationId,
      });

      // Verify bob is now a member with admin role
      const member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "bob",
      });
      expect(member).not.toBeNull();
      expect(member?.role).toBe("admin");

      // Verify invitation status changed
      const invitation = await asAlice.query(api.testHelpers.strictGetInvitation, {
        invitationId,
      });
      expect(invitation?.status).toBe("accepted");
    });

    test("acceptInvitation throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictAcceptInvitation, {
          invitationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("acceptInvitation rejects when authenticated identifier does not match invitation inviteeIdentifier", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });
      const asBob = t.withIdentity({
        subject: "bob",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Accept Strict Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          inviteeIdentifier: "alice@test.com",
          identifierType: "email",
          role: "member",
        }
      );

      await expect(
        asBob.mutation(api.testHelpers.strictAcceptInvitation, {
          invitationId,
        })
      ).rejects.toThrow("Invitation identifier does not match authenticated user");
    });

    test("cancelInvitation sets status to cancelled", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Cancel Invitation Org" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          inviteeIdentifier: "cancel@example.com",
          identifierType: "email",
          role: "member",
        }
      );

      await asAlice.mutation(api.testHelpers.strictCancelInvitation, {
        invitationId,
      });

      const invitation = await t.query(api.testHelpers.strictGetInvitation, {
        invitationId,
      });
      expect(invitation?.status).toBe("cancelled");
    });

    test("cancelInvitation throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictCancelInvitation, {
          invitationId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("getInvitation returns organizationName for new users", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });
      const asNewUser = t.withIdentity({
        subject: "newuser",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Test Organization with Name" }
      );

      const { invitationId } = await asAlice.mutation(
        api.testHelpers.strictInviteMember,
        {
          organizationId: orgId,
          inviteeIdentifier: "newuser@test.com",
          identifierType: "email",
          role: "member",
        }
      );

      // New user (not yet a member) should be able to get invitation with org name
      const invitation = await asNewUser.query(api.testHelpers.strictGetInvitation, {
        invitationId,
      });

      expect(invitation).not.toBeNull();
      expect(invitation?.organizationName).toBe("Test Organization with Name");
      expect(invitation?.inviteeIdentifier).toBe("newuser@test.com");

      // New user should be able to accept invitation
      await asNewUser.mutation(api.testHelpers.strictAcceptInvitation, {
        invitationId,
      });

      // Verify user is now a member
      const member = await asAlice.query(api.testHelpers.strictGetMember, {
        organizationId: orgId,
        userId: "newuser",
      });
      expect(member).not.toBeNull();
      expect(member?.role).toBe("member");
    });
  });
});
