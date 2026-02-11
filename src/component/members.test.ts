import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema.js";
import { api } from "./_generated/api.js";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts")).filter(
    ([path]) => !path.endsWith(".test.ts")
  )
);

function createTestInstance() {
  return convexTest(schema, modules);
}

describe("members", () => {
  it("should add a member to organization", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "member",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member).not.toBeNull();
    expect(member?.role).toBe("member");
  });

  it("should list organization members", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "admin",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_789",
      role: "member",
    });

    const members = await t.query(api.members.listOrganizationMembers, {
      organizationId: orgId,
    });

    expect(members).toHaveLength(3); // owner + 2 members
  });

  it("should prevent duplicate member additions", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "member",
    });

    await expect(
      t.mutation(api.members.addMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_456",
        role: "admin",
      })
    ).rejects.toThrow();
  });

  it("should update member role", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "member",
    });

    await t.mutation(api.members.updateMemberRole, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "admin",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member?.role).toBe("admin");
  });

  it("should remove member from organization", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "member",
    });

    await t.mutation(api.members.removeMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member).toBeNull();
  });

  it("should prevent removing an owner", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.removeMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "user_123",
      })
    ).rejects.toThrow();
  });

  it("should return member role for role checking", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "member",
    });

    const owner = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_123",
    });
    expect(owner).not.toBeNull();
    expect(owner!.role).toBe("owner");

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });
    expect(member).not.toBeNull();
    expect(member!.role).toBe("member");

    const stranger = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "unknown_user",
    });
    expect(stranger).toBeNull();
  });

  it("should allow member to leave organization", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "member",
    });

    await t.mutation(api.members.leaveOrganization, {
      userId: "user_456",
      organizationId: orgId,
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "user_456",
    });

    expect(member).toBeNull();
  });

  it("should prevent sole owner from leaving", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.leaveOrganization, {
        userId: "user_123",
        organizationId: orgId,
      })
    ).rejects.toThrow();
  });

  it("non-members return null from getMember", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const member = await t.query(api.members.getMember, {
      organizationId: orgId,
      userId: "stranger_user",
    });

    expect(member).toBeNull();
  });

  it("removeMember throws for nonexistent member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.removeMember, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "nonexistent_user",
      })
    ).rejects.toThrow("Member not found");
  });

  it("updateMemberRole throws for nonexistent member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.updateMemberRole, {
        userId: "user_123",
        organizationId: orgId,
        memberUserId: "nonexistent_user",
        role: "admin",
      })
    ).rejects.toThrow("Member not found");
  });

  it("leaveOrganization throws for non-member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await expect(
      t.mutation(api.members.leaveOrganization, {
        userId: "non_member",
        organizationId: orgId,
      })
    ).rejects.toThrow("You are not a member of this organization");
  });

  it("leaveOrganization cleans up team memberships", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Engineering",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    await t.mutation(api.teams.addTeamMember, {
      userId: "user_123",
      teamId,
      memberUserId: "bob",
    });

    const isMemberBefore = await t.query(api.teams.isTeamMember, {
      teamId,
      userId: "bob",
    });
    expect(isMemberBefore).toBe(true);

    await t.mutation(api.members.leaveOrganization, {
      userId: "bob",
      organizationId: orgId,
    });

    const isMemberAfter = await t.query(api.teams.isTeamMember, {
      teamId,
      userId: "bob",
    });
    expect(isMemberAfter).toBe(false);
  });
});
