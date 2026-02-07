import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Used by tests to verify onInvitationCreated/onInvitationResent callbacks
  callbackLog: defineTable({
    type: v.string(),
    data: v.any(),
  }),
});
