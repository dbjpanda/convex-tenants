import { describe, expect, it } from "vitest";
import { generateSlug, toAuthzRole } from "./helpers.js";

describe("helpers", () => {
  describe("generateSlug", () => {
    it("should convert name to lowercase slug", () => {
      expect(generateSlug("Hello World")).toBe("hello-world");
    });

    it("should remove special characters", () => {
      expect(generateSlug("Hello! World@")).toBe("hello-world");
    });

    it("should replace multiple spaces with single hyphen", () => {
      expect(generateSlug("Hello    World")).toBe("hello-world");
    });

    it("should trim leading and trailing spaces", () => {
      expect(generateSlug("  Hello World  ")).toBe("hello-world");
    });

    it("should handle underscores", () => {
      expect(generateSlug("hello_world")).toBe("hello-world");
    });

    it("should handle multiple hyphens", () => {
      expect(generateSlug("hello---world")).toBe("hello-world");
    });

    it("should handle mixed case", () => {
      expect(generateSlug("HeLLo WoRLD")).toBe("hello-world");
    });

    it("should handle numbers", () => {
      expect(generateSlug("Team 123")).toBe("team-123");
    });

    it("should handle unicode characters by removing them", () => {
      expect(generateSlug("Hello 世界")).toBe("hello");
    });

    it("should handle empty string", () => {
      expect(generateSlug("")).toBe("");
    });

    it("should handle string with only special chars", () => {
      expect(generateSlug("@#$%")).toBe("");
    });
  });

  describe("toAuthzRole", () => {
    it("should prefix tenant roles with org:", () => {
      expect(toAuthzRole("owner")).toBe("org:owner");
      expect(toAuthzRole("admin")).toBe("org:admin");
      expect(toAuthzRole("member")).toBe("org:member");
    });
  });
});
