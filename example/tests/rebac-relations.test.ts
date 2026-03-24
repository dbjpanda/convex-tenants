/**
 * Integration tests verifying that ReBAC relations in the authz component
 * are correctly created and removed by tenants operations.
 *
 * These tests go beyond checking the tenants DB rows — they query
 * authz.hasRelation to confirm the actual ReBAC tuples.
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

function hasRelation(
  t: ReturnType<typeof initConvexTest>,
  identity: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
  userId: string,
  teamId: string,
) {
  return identity.query(api.testHelpers.hasAuthzRelation, {
    subjectType: "user",
    subjectId: userId,
    relation: "member",
    objectType: "team",
    objectId: teamId,
  });
}

describe("ReBAC relation integration", () => {
  test("addTeamMember creates a ReBAC relation in authz", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "ReBAC Add Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Engineering",
    });

    // Before adding — no relation
    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(false);

    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId, memberUserId: "bob",
    });

    // After adding — relation exists
    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(true);
  });

  test("removeTeamMember removes the ReBAC relation from authz", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "ReBAC Remove Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Engineering",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId, memberUserId: "bob",
    });
    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(true);

    await asAlice.mutation(api.testHelpers.strictRemoveTeamMember, {
      teamId, memberUserId: "bob",
    });

    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(false);
  });

  test("deleteTeam removes all member ReBAC relations from authz", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "ReBAC DeleteTeam Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Engineering",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId, memberUserId: "bob",
    });
    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(true);

    await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId });

    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(false);
  });

  test("removeMember cleans up team ReBAC relations in authz", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "ReBAC RemoveMember Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Engineering",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId, memberUserId: "bob",
    });
    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(true);

    // Remove bob from the org — should also clean team relations
    await asAlice.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId, memberUserId: "bob",
    });

    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(false);
  });

  test("leaveOrganization removes team ReBAC relations from authz", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "ReBAC Leave Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Engineering",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId, memberUserId: "bob",
    });
    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(true);

    // Bob leaves the org
    await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
      organizationId: orgId,
    });

    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(false);
  });

  test("acceptInvitation with teamId creates ReBAC relation in authz", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "ReBAC Invite Org",
    });
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId, name: "Engineering",
    });

    const result = await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "bob@test.com",
      identifierType: "email",
      role: "member",
      teamId,
    });

    await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId: result.invitationId,
    });

    expect(await hasRelation(t, asAlice, "bob", teamId)).toBe(true);
  });
});
