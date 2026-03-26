/**
 * User journey tests — callbacks audit trail, invitation callbacks,
 * slug management, and organization metadata lifecycle.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

// ---------------------------------------------------------------------------
// Shared helper: filter callback logs by type
// ---------------------------------------------------------------------------
async function getLogsOfType(
  runner: ReturnType<typeof initConvexTest>,
  type: string,
) {
  const logs = await runner.query(api.testHelpers.getCallbackLogs, {});
  return logs.filter((l: any) => l.type === type);
}

// ===========================================================================
// Journey 1: Callback audit trail — complete org lifecycle generates
//            correct callbacks
// ===========================================================================

describe("Journey 1: Callback audit trail — complete org lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("every lifecycle action produces the expected callback log entry", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org "CallbackCorp"
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "CallbackCorp",
    });
    expect(orgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Verify "onBeforeCreateOrganization" + "organizationCreated"
    // -----------------------------------------------------------------------
    const beforeCreateLogs = await getLogsOfType(t, "onBeforeCreateOrganization");
    expect(beforeCreateLogs).toHaveLength(1);
    expect(beforeCreateLogs[0].data.name).toBe("CallbackCorp");

    const createdLogs = await getLogsOfType(t, "organizationCreated");
    expect(createdLogs).toHaveLength(1);
    expect(createdLogs[0].data.organizationId).toBe(orgId);
    expect(createdLogs[0].data.name).toBe("CallbackCorp");
    expect(createdLogs[0].data.ownerId).toBe("alice");
    expect(createdLogs[0].data.slug).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 3: Alice adds bob as admin
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // -----------------------------------------------------------------------
    // Step 4: Verify "memberAdded" with correct data
    // -----------------------------------------------------------------------
    const memberAddedLogs = await getLogsOfType(t, "memberAdded");
    expect(memberAddedLogs).toHaveLength(1);
    expect(memberAddedLogs[0].data.userId).toBe("bob");
    expect(memberAddedLogs[0].data.role).toBe("admin");
    expect(memberAddedLogs[0].data.addedBy).toBe("alice");
    expect(memberAddedLogs[0].data.organizationId).toBe(orgId);

    // -----------------------------------------------------------------------
    // Step 5: Alice creates "Engineering" team
    // -----------------------------------------------------------------------
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Engineering",
    });
    expect(teamId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 6: Verify "teamCreated" callback
    // -----------------------------------------------------------------------
    const teamCreatedLogs = await getLogsOfType(t, "teamCreated");
    expect(teamCreatedLogs).toHaveLength(1);
    expect(teamCreatedLogs[0].data.teamId).toBe(teamId);
    expect(teamCreatedLogs[0].data.name).toBe("Engineering");
    expect(teamCreatedLogs[0].data.organizationId).toBe(orgId);
    expect(teamCreatedLogs[0].data.createdBy).toBe("alice");

    // -----------------------------------------------------------------------
    // Step 7: Alice adds bob to Engineering
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId,
      memberUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 8: Verify "teamMemberAdded" callback
    // -----------------------------------------------------------------------
    const teamMemberAddedLogs = await getLogsOfType(t, "teamMemberAdded");
    expect(teamMemberAddedLogs).toHaveLength(1);
    expect(teamMemberAddedLogs[0].data.teamId).toBe(teamId);
    expect(teamMemberAddedLogs[0].data.userId).toBe("bob");
    expect(teamMemberAddedLogs[0].data.addedBy).toBe("alice");

    // -----------------------------------------------------------------------
    // Step 9: Alice updates bob's role to member
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateMemberRole, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // -----------------------------------------------------------------------
    // Step 10: Verify "memberRoleChanged" with oldRole/newRole
    // -----------------------------------------------------------------------
    const roleChangedLogs = await getLogsOfType(t, "memberRoleChanged");
    expect(roleChangedLogs).toHaveLength(1);
    expect(roleChangedLogs[0].data.organizationId).toBe(orgId);
    expect(roleChangedLogs[0].data.userId).toBe("bob");
    expect(roleChangedLogs[0].data.oldRole).toBe("admin");
    expect(roleChangedLogs[0].data.newRole).toBe("member");
    expect(roleChangedLogs[0].data.changedBy).toBe("alice");

    // -----------------------------------------------------------------------
    // Step 11: Alice removes bob from org
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });

    // -----------------------------------------------------------------------
    // Step 12: Verify "memberRemoved" callback
    // -----------------------------------------------------------------------
    const memberRemovedLogs = await getLogsOfType(t, "memberRemoved");
    expect(memberRemovedLogs).toHaveLength(1);
    expect(memberRemovedLogs[0].data.organizationId).toBe(orgId);
    expect(memberRemovedLogs[0].data.userId).toBe("bob");
    expect(memberRemovedLogs[0].data.removedBy).toBe("alice");

    // -----------------------------------------------------------------------
    // Step 13: Verify cascading team removal does NOT fire "teamMemberRemoved"
    //          (only explicit removeTeamMember calls trigger that callback)
    // -----------------------------------------------------------------------
    const teamMemberRemovedLogs = await getLogsOfType(t, "teamMemberRemoved");
    expect(teamMemberRemovedLogs).toHaveLength(0);

    // -----------------------------------------------------------------------
    // Step 14: Count total callbacks — should match expected number
    // -----------------------------------------------------------------------
    const allLogs = await t.query(api.testHelpers.getCallbackLogs, {});
    // Expected: onBeforeCreateOrganization (1) + organizationCreated (1) +
    //           memberAdded (1) + teamCreated (1) + teamMemberAdded (1) +
    //           memberRoleChanged (1) + memberRemoved (1)
    expect(allLogs).toHaveLength(7);
  });
});

// ===========================================================================
// Journey 2: Invitation callbacks
// ===========================================================================

describe("Journey 2: Invitation callbacks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("invitation create and accept generate the expected callback sequence", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "InviteCorp",
    });

    // -----------------------------------------------------------------------
    // Step 2: Alice invites bob@test.com as member
    // -----------------------------------------------------------------------
    const { invitationId } = await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "bob@test.com",
      identifierType: "email",
      role: "member",
    });
    expect(invitationId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 3: Verify "invitationCreated" callback with inviteeIdentifier, role
    // -----------------------------------------------------------------------
    const invCreatedLogs = await getLogsOfType(t, "invitationCreated");
    expect(invCreatedLogs).toHaveLength(1);
    expect(invCreatedLogs[0].data.invitationId).toBe(invitationId);
    expect(invCreatedLogs[0].data.inviteeIdentifier).toBe("bob@test.com");
    expect(invCreatedLogs[0].data.role).toBe("member");
    expect(invCreatedLogs[0].data.organizationId).toBe(orgId);
    expect(invCreatedLogs[0].data.organizationName).toBe("InviteCorp");

    // -----------------------------------------------------------------------
    // Step 4: Bob accepts the invitation
    // -----------------------------------------------------------------------
    await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
      invitationId,
    });

    // -----------------------------------------------------------------------
    // Step 5: Verify "invitationAccepted" callback with userId, role
    // -----------------------------------------------------------------------
    const invAcceptedLogs = await getLogsOfType(t, "invitationAccepted");
    expect(invAcceptedLogs).toHaveLength(1);
    expect(invAcceptedLogs[0].data.invitationId).toBe(invitationId);
    expect(invAcceptedLogs[0].data.organizationId).toBe(orgId);
    expect(invAcceptedLogs[0].data.userId).toBe("bob");
    expect(invAcceptedLogs[0].data.role).toBe("member");
    expect(invAcceptedLogs[0].data.inviteeIdentifier).toBe("bob@test.com");

    // -----------------------------------------------------------------------
    // Step 6: Verify "memberAdded" does NOT fire from invitation acceptance
    //         (invitation acceptance uses an internal path that bypasses the
    //          addMember callback; only explicit addMember calls trigger it)
    // -----------------------------------------------------------------------
    const memberAddedLogs = await getLogsOfType(t, "memberAdded");
    expect(memberAddedLogs).toHaveLength(0);

    // Verify bob is indeed a member despite no "memberAdded" callback
    const bobMember = await asAlice.query(api.testHelpers.strictGetMember, {
      organizationId: orgId,
      userId: "bob",
    });
    expect(bobMember).not.toBeNull();
    expect(bobMember?.role).toBe("member");
  });
});

// ===========================================================================
// Journey 3: Slug management lifecycle
// ===========================================================================

describe("Journey 3: Slug management lifecycle", () => {
  test("auto-generated slugs are unique and can be updated", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org with name "My Cool Startup" (no explicit slug)
    // -----------------------------------------------------------------------
    const aliceOrgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "My Cool Startup",
    });
    expect(aliceOrgId).toBeDefined();

    // -----------------------------------------------------------------------
    // Step 2: Verify org has an auto-generated slug
    // -----------------------------------------------------------------------
    const aliceOrg = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: aliceOrgId,
    });
    expect(aliceOrg).not.toBeNull();
    expect(aliceOrg?.slug).toBe("my-cool-startup");

    // -----------------------------------------------------------------------
    // Step 3: Find org by slug → found
    // -----------------------------------------------------------------------
    const foundBySlug = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
      slug: "my-cool-startup",
    });
    expect(foundBySlug).not.toBeNull();
    expect(foundBySlug?._id).toBe(aliceOrgId);

    // -----------------------------------------------------------------------
    // Step 4: Bob creates another org with the same name "My Cool Startup"
    // -----------------------------------------------------------------------
    const bobOrgId = await asBob.mutation(api.testHelpers.strictCreateOrganization, {
      name: "My Cool Startup",
    });
    expect(bobOrgId).toBeDefined();
    expect(bobOrgId).not.toBe(aliceOrgId);

    // -----------------------------------------------------------------------
    // Step 5: Verify bob's org gets a different slug (uniqueness enforced)
    // -----------------------------------------------------------------------
    const bobOrg = await asBob.query(api.testHelpers.strictGetOrganization, {
      organizationId: bobOrgId,
    });
    expect(bobOrg).not.toBeNull();
    expect(bobOrg?.slug).not.toBe("my-cool-startup");
    // The slug should be something like "my-cool-startup-1"
    expect(bobOrg?.slug).toMatch(/^my-cool-startup-\d+$/);

    // -----------------------------------------------------------------------
    // Step 6: Find bob's org by its unique slug → found
    // -----------------------------------------------------------------------
    const foundBobOrg = await asBob.query(api.testHelpers.strictGetOrganizationBySlug, {
      slug: bobOrg!.slug,
    });
    expect(foundBobOrg).not.toBeNull();
    expect(foundBobOrg?._id).toBe(bobOrgId);

    // -----------------------------------------------------------------------
    // Step 7: Alice updates her org slug to "cool-startup"
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: aliceOrgId,
      slug: "cool-startup",
    });

    // -----------------------------------------------------------------------
    // Step 8: Verify old slug no longer resolves, new slug works
    // -----------------------------------------------------------------------
    // Old slug should no longer find alice's org (alice is not a member of whatever
    // might be at the old slug, or it returns null)
    const oldSlugResult = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
      slug: "my-cool-startup",
    });
    // Old slug should now return null (no org uses it anymore)
    expect(oldSlugResult).toBeNull();

    // New slug resolves to alice's org
    const newSlugResult = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
      slug: "cool-startup",
    });
    expect(newSlugResult).not.toBeNull();
    expect(newSlugResult?._id).toBe(aliceOrgId);
    expect(newSlugResult?.name).toBe("My Cool Startup");
  });
});

// ===========================================================================
// Journey 4: Organization metadata lifecycle
// ===========================================================================

describe("Journey 4: Organization metadata lifecycle", () => {
  test("metadata and settings are stored, replaced, and independent of each other", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // -----------------------------------------------------------------------
    // Step 1: Alice creates org
    // -----------------------------------------------------------------------
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "MetadataCorp",
    });

    // -----------------------------------------------------------------------
    // Step 2: Update with metadata: { plan: "free", maxSeats: 5 }
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      metadata: { plan: "free", maxSeats: 5 },
    });

    // -----------------------------------------------------------------------
    // Step 3: Verify getOrganization returns the metadata
    // -----------------------------------------------------------------------
    const orgAfterFirst = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(orgAfterFirst?.metadata).toEqual({ plan: "free", maxSeats: 5 });

    // -----------------------------------------------------------------------
    // Step 4: Update metadata to { plan: "pro", maxSeats: 50, features: ["sso"] }
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      metadata: { plan: "pro", maxSeats: 50, features: ["sso"] },
    });

    // -----------------------------------------------------------------------
    // Step 5: Verify metadata fully replaced (not merged)
    // -----------------------------------------------------------------------
    const orgAfterSecond = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(orgAfterSecond?.metadata).toEqual({ plan: "pro", maxSeats: 50, features: ["sso"] });
    // "free" plan should be gone — it was replaced, not merged
    expect(orgAfterSecond?.metadata.plan).toBe("pro");

    // -----------------------------------------------------------------------
    // Step 6: Update org settings: { allowPublicSignup: true }
    // -----------------------------------------------------------------------
    await asAlice.mutation(api.testHelpers.strictUpdateOrganization, {
      organizationId: orgId,
      settings: { allowPublicSignup: true },
    });

    // -----------------------------------------------------------------------
    // Step 7: Verify settings updated, metadata untouched
    // -----------------------------------------------------------------------
    const orgAfterSettings = await asAlice.query(api.testHelpers.strictGetOrganization, {
      organizationId: orgId,
    });
    expect(orgAfterSettings?.settings).toEqual({ allowPublicSignup: true });
    // Metadata should remain unchanged
    expect(orgAfterSettings?.metadata).toEqual({ plan: "pro", maxSeats: 50, features: ["sso"] });
  });
});
