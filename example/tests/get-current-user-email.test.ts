/**
 * Integration tests for getCurrentUserEmail query.
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("getCurrentUserEmail", () => {
  test("returns email for authenticated user with getUser configured", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // testHelpers getUser returns `${userId}@test.com`
    const email = await asAlice.query(api.testHelpers.strictGetCurrentUserEmail, {});
    expect(email).toBe("alice@test.com");
  });

  test("returns null when unauthenticated", async () => {
    const t = initConvexTest();

    const email = await t.query(api.testHelpers.strictGetCurrentUserEmail, {});
    expect(email).toBeNull();
  });
});
