import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Used by tests to verify onInvitationCreated/onInvitationResent callbacks
  callbackLog: defineTable({
    type: v.string(),
    data: v.any(),
  }),
});
