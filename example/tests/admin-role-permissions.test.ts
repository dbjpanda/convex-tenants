/**
 * Integration tests verifying the admin role's permission grants and denials.
 * Confirms admin can do what TENANTS_ROLES grants and cannot do what it doesn't.
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("admin role permissions", () => {
  test("admin can update organization (has organizations:update)", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Admin Test Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "admin",
    });

    // Admin should be able to update org
    await asBob.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId, name: "Updated by Admin",
    });

    const org = await asBob.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect((org as any).name).toBe("Updated by Admin");
  });

  test("admin cannot delete organization (no organizations:delete)", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Admin Delete Test Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "admin",
    });

    await expect(
      asBob.mutation(api.testHelpers.strictDeleteOrganization, {
        organizationId: orgId,
      })
    ).rejects.toThrow(/Permission denied.*organizations:delete/);
  });

  test("admin can add members (has members:add)", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Admin Add Member Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "admin",
    });

    // Admin should be able to add members
    await asBob.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "carol", role: "member",
    });

    const member = await asBob.query(api.testHelpers.strictGetMember, {
      organizationId: orgId, userId: "carol",
    });
    expect(member).not.toBeNull();
  });

  test("admin can create teams (has teams:create)", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Admin Team Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "admin",
    });

    const teamId = await asBob.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Admin Created Team",
    });
    expect(teamId).toBeDefined();
  });

  test("admin can create invitations (has invitations:create)", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Admin Invite Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "admin",
    });

    const result = await asBob.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "carol@test.com",
      identifierType: "email",
      role: "member",
    });
    expect(result.invitationId).toBeDefined();
  });

  test("owner can delete organization (has organizations:delete)", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Owner Delete Org",
    });

    await asAlice.mutation(api.testHelpers.strictDeleteOrganization, {
      organizationId: orgId,
    });

    const org = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
      slug: "owner-delete-org",
    });
    expect(org).toBeNull();
  });
});
