/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    mutations: {
      acceptInvitation: FunctionReference<
        "mutation",
        "internal",
        { acceptingUserId: string; invitationId: string },
        null,
        Name
      >;
      addMember: FunctionReference<
        "mutation",
        "internal",
        {
          memberUserId: string;
          organizationId: string;
          role: string;
          userId: string;
        },
        null,
        Name
      >;
      addTeamMember: FunctionReference<
        "mutation",
        "internal",
        { memberUserId: string; teamId: string; userId: string },
        null,
        Name
      >;
      cancelInvitation: FunctionReference<
        "mutation",
        "internal",
        { invitationId: string; userId: string },
        null,
        Name
      >;
      createOrganization: FunctionReference<
        "mutation",
        "internal",
        {
          creatorRole?: string;
          logo?: string;
          metadata?: any;
          name: string;
          slug: string;
          userId: string;
        },
        string,
        Name
      >;
      createTeam: FunctionReference<
        "mutation",
        "internal",
        {
          description?: string;
          name: string;
          organizationId: string;
          userId: string;
        },
        string,
        Name
      >;
      deleteOrganization: FunctionReference<
        "mutation",
        "internal",
        { organizationId: string; userId: string },
        null,
        Name
      >;
      deleteTeam: FunctionReference<
        "mutation",
        "internal",
        { teamId: string; userId: string },
        null,
        Name
      >;
      inviteMember: FunctionReference<
        "mutation",
        "internal",
        {
          email: string;
          expiresAt?: number;
          organizationId: string;
          role: string;
          teamId?: string;
          userId: string;
        },
        { email: string; expiresAt: number; invitationId: string },
        Name
      >;
      leaveOrganization: FunctionReference<
        "mutation",
        "internal",
        { organizationId: string; userId: string },
        null,
        Name
      >;
      removeMember: FunctionReference<
        "mutation",
        "internal",
        { memberUserId: string; organizationId: string; userId: string },
        null,
        Name
      >;
      removeTeamMember: FunctionReference<
        "mutation",
        "internal",
        { memberUserId: string; teamId: string; userId: string },
        null,
        Name
      >;
      resendInvitation: FunctionReference<
        "mutation",
        "internal",
        { invitationId: string; userId: string },
        { email: string; invitationId: string },
        Name
      >;
      updateMemberRole: FunctionReference<
        "mutation",
        "internal",
        {
          memberUserId: string;
          organizationId: string;
          role: string;
          userId: string;
        },
        null,
        Name
      >;
      updateOrganization: FunctionReference<
        "mutation",
        "internal",
        {
          logo?: null | string;
          metadata?: any;
          name?: string;
          organizationId: string;
          slug?: string;
          userId: string;
        },
        null,
        Name
      >;
      updateTeam: FunctionReference<
        "mutation",
        "internal",
        {
          description?: null | string;
          name?: string;
          teamId: string;
          userId: string;
        },
        null,
        Name
      >;
    };
    queries: {
      getInvitation: FunctionReference<
        "query",
        "internal",
        { invitationId: string },
        null | {
          _creationTime: number;
          _id: string;
          email: string;
          expiresAt: number;
          inviterId: string;
          isExpired: boolean;
          organizationId: string;
          role: string;
          status: "pending" | "accepted" | "cancelled" | "expired";
          teamId: null | string;
        },
        Name
      >;
      getMember: FunctionReference<
        "query",
        "internal",
        { organizationId: string; userId: string },
        null | {
          _creationTime: number;
          _id: string;
          organizationId: string;
          role: string;
          userId: string;
        },
        Name
      >;
      getOrganization: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        null | {
          _creationTime: number;
          _id: string;
          logo: null | string;
          metadata?: any;
          name: string;
          ownerId: string;
          slug: string;
        },
        Name
      >;
      getOrganizationBySlug: FunctionReference<
        "query",
        "internal",
        { slug: string },
        null | {
          _creationTime: number;
          _id: string;
          logo: null | string;
          metadata?: any;
          name: string;
          ownerId: string;
          slug: string;
        },
        Name
      >;
      getPendingInvitationsForEmail: FunctionReference<
        "query",
        "internal",
        { email: string },
        Array<{
          _creationTime: number;
          _id: string;
          email: string;
          expiresAt: number;
          inviterId: string;
          isExpired: boolean;
          organizationId: string;
          role: string;
          teamId: null | string;
        }>,
        Name
      >;
      getTeam: FunctionReference<
        "query",
        "internal",
        { teamId: string },
        null | {
          _creationTime: number;
          _id: string;
          description: null | string;
          name: string;
          organizationId: string;
        },
        Name
      >;
      isTeamMember: FunctionReference<
        "query",
        "internal",
        { teamId: string; userId: string },
        boolean,
        Name
      >;
      listInvitations: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        Array<{
          _creationTime: number;
          _id: string;
          email: string;
          expiresAt: number;
          inviterId: string;
          isExpired: boolean;
          organizationId: string;
          role: string;
          status: "pending" | "accepted" | "cancelled" | "expired";
          teamId: null | string;
        }>,
        Name
      >;
      listOrganizationMembers: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        Array<{
          _creationTime: number;
          _id: string;
          organizationId: string;
          role: string;
          userId: string;
        }>,
        Name
      >;
      listTeamMembers: FunctionReference<
        "query",
        "internal",
        { teamId: string },
        Array<{
          _creationTime: number;
          _id: string;
          teamId: string;
          userId: string;
        }>,
        Name
      >;
      listTeams: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        Array<{
          _creationTime: number;
          _id: string;
          description: null | string;
          name: string;
          organizationId: string;
        }>,
        Name
      >;
      listUserOrganizations: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          _creationTime: number;
          _id: string;
          logo: null | string;
          metadata?: any;
          name: string;
          ownerId: string;
          role: string;
          slug: string;
        }>,
        Name
      >;
    };
  };
