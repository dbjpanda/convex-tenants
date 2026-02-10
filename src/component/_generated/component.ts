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
        {
          acceptingEmail?: string;
          acceptingUserId: string;
          invitationId: string;
        },
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
          metadata?: any;
          name: string;
          organizationId: string;
          slug?: string;
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
      invitations: {
        acceptInvitation: FunctionReference<
          "mutation",
          "internal",
          {
            acceptingEmail?: string;
            acceptingUserId: string;
            invitationId: string;
          },
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
        inviteMember: FunctionReference<
          "mutation",
          "internal",
          {
            email: string;
            expiresAt?: number;
            message?: string;
            organizationId: string;
            role: string;
            teamId?: string;
            userId: string;
          },
          { email: string; expiresAt: number; invitationId: string },
          Name
        >;
        resendInvitation: FunctionReference<
          "mutation",
          "internal",
          { invitationId: string; userId: string },
          { email: string; invitationId: string },
          Name
        >;
      };
      inviteMember: FunctionReference<
        "mutation",
        "internal",
        {
          email: string;
          expiresAt?: number;
          message?: string;
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
      members: {
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
        suspendMember: FunctionReference<
          "mutation",
          "internal",
          { memberUserId: string; organizationId: string; userId: string },
          null,
          Name
        >;
        unsuspendMember: FunctionReference<
          "mutation",
          "internal",
          { memberUserId: string; organizationId: string; userId: string },
          null,
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
      };
      organizations: {
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
        deleteOrganization: FunctionReference<
          "mutation",
          "internal",
          { organizationId: string; userId: string },
          null,
          Name
        >;
        transferOwnership: FunctionReference<
          "mutation",
          "internal",
          {
            newOwnerUserId: string;
            organizationId: string;
            previousOwnerRole?: string;
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
            status?: "active" | "suspended" | "archived";
            userId: string;
          },
          null,
          Name
        >;
      };
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
      suspendMember: FunctionReference<
        "mutation",
        "internal",
        { memberUserId: string; organizationId: string; userId: string },
        null,
        Name
      >;
      teams: {
        addTeamMember: FunctionReference<
          "mutation",
          "internal",
          { memberUserId: string; teamId: string; userId: string },
          null,
          Name
        >;
        createTeam: FunctionReference<
          "mutation",
          "internal",
          {
            description?: string;
            metadata?: any;
            name: string;
            organizationId: string;
            slug?: string;
            userId: string;
          },
          string,
          Name
        >;
        deleteTeam: FunctionReference<
          "mutation",
          "internal",
          { teamId: string; userId: string },
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
        updateTeam: FunctionReference<
          "mutation",
          "internal",
          {
            description?: null | string;
            metadata?: any;
            name?: string;
            slug?: string;
            teamId: string;
            userId: string;
          },
          null,
          Name
        >;
      };
      transferOwnership: FunctionReference<
        "mutation",
        "internal",
        {
          newOwnerUserId: string;
          organizationId: string;
          previousOwnerRole?: string;
          userId: string;
        },
        null,
        Name
      >;
      unsuspendMember: FunctionReference<
        "mutation",
        "internal",
        { memberUserId: string; organizationId: string; userId: string },
        null,
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
          status?: "active" | "suspended" | "archived";
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
          metadata?: any;
          name?: string;
          slug?: string;
          teamId: string;
          userId: string;
        },
        null,
        Name
      >;
    };
    queries: {
      countInvitations: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        number,
        Name
      >;
      countOrganizationMembers: FunctionReference<
        "query",
        "internal",
        { organizationId: string; status?: "active" | "suspended" | "all" },
        number,
        Name
      >;
      countTeams: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        number,
        Name
      >;
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
          message?: string;
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
          status?: "active" | "suspended";
          suspendedAt?: number;
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
          status?: "active" | "suspended" | "archived";
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
          status?: "active" | "suspended" | "archived";
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
          metadata?: any;
          name: string;
          organizationId: string;
          slug?: string;
        },
        Name
      >;
      invitations: {
        countInvitations: FunctionReference<
          "query",
          "internal",
          { organizationId: string },
          number,
          Name
        >;
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
            message?: string;
            organizationId: string;
            role: string;
            status: "pending" | "accepted" | "cancelled" | "expired";
            teamId: null | string;
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
            message?: string;
            organizationId: string;
            role: string;
            status: "pending" | "accepted" | "cancelled" | "expired";
            teamId: null | string;
          }>,
          Name
        >;
        listInvitationsPaginated: FunctionReference<
          "query",
          "internal",
          {
            organizationId: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any,
          Name
        >;
      };
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
          message?: string;
          organizationId: string;
          role: string;
          status: "pending" | "accepted" | "cancelled" | "expired";
          teamId: null | string;
        }>,
        Name
      >;
      listInvitationsPaginated: FunctionReference<
        "query",
        "internal",
        {
          organizationId: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any,
        Name
      >;
      listOrganizationMembers: FunctionReference<
        "query",
        "internal",
        { organizationId: string; status?: "active" | "suspended" | "all" },
        Array<{
          _creationTime: number;
          _id: string;
          organizationId: string;
          role: string;
          status?: "active" | "suspended";
          suspendedAt?: number;
          userId: string;
        }>,
        Name
      >;
      listOrganizationMembersPaginated: FunctionReference<
        "query",
        "internal",
        {
          organizationId: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          status?: "active" | "suspended" | "all";
        },
        any,
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
      listTeamMembersPaginated: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          teamId: string;
        },
        any,
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
          metadata?: any;
          name: string;
          organizationId: string;
          slug?: string;
        }>,
        Name
      >;
      listTeamsPaginated: FunctionReference<
        "query",
        "internal",
        {
          organizationId: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any,
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
          status?: "active" | "suspended" | "archived";
        }>,
        Name
      >;
      members: {
        countOrganizationMembers: FunctionReference<
          "query",
          "internal",
          { organizationId: string; status?: "active" | "suspended" | "all" },
          number,
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
            status?: "active" | "suspended";
            suspendedAt?: number;
            userId: string;
          },
          Name
        >;
        listOrganizationMembers: FunctionReference<
          "query",
          "internal",
          { organizationId: string; status?: "active" | "suspended" | "all" },
          Array<{
            _creationTime: number;
            _id: string;
            organizationId: string;
            role: string;
            status?: "active" | "suspended";
            suspendedAt?: number;
            userId: string;
          }>,
          Name
        >;
        listOrganizationMembersPaginated: FunctionReference<
          "query",
          "internal",
          {
            organizationId: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            status?: "active" | "suspended" | "all";
          },
          any,
          Name
        >;
      };
      organizations: {
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
            status?: "active" | "suspended" | "archived";
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
            status?: "active" | "suspended" | "archived";
          },
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
            status?: "active" | "suspended" | "archived";
          }>,
          Name
        >;
      };
      teams: {
        countTeams: FunctionReference<
          "query",
          "internal",
          { organizationId: string },
          number,
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
            metadata?: any;
            name: string;
            organizationId: string;
            slug?: string;
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
        listTeamMembersPaginated: FunctionReference<
          "query",
          "internal",
          {
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            teamId: string;
          },
          any,
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
            metadata?: any;
            name: string;
            organizationId: string;
            slug?: string;
          }>,
          Name
        >;
        listTeamsPaginated: FunctionReference<
          "query",
          "internal",
          {
            organizationId: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any,
          Name
        >;
      };
    };
  };
