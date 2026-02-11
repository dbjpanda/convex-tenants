import { describe, expect, it } from "vitest";
import { isInvitationExpired } from "./helpers.js";

describe("helpers", () => {
  describe("isInvitationExpired", () => {
    it("returns true when invitation has expired", () => {
      const invitation = {
        _id: "inv_1" as any,
        _creationTime: Date.now(),
        expiresAt: Date.now() - 1000,
        email: "test@example.com",
        organizationId: "org_1" as any,
        teamId: null as any,
        role: "member",
        inviterId: "user_1",
        status: "pending" as const,
      };
      expect(isInvitationExpired(invitation)).toBe(true);
    });

    it("returns false when invitation has not expired", () => {
      const invitation = {
        _id: "inv_1" as any,
        _creationTime: Date.now(),
        expiresAt: Date.now() + 60000,
        email: "test@example.com",
        organizationId: "org_1" as any,
        teamId: null as any,
        role: "member",
        inviterId: "user_1",
        status: "pending" as const,
      };
      expect(isInvitationExpired(invitation)).toBe(false);
    });
  });
});
