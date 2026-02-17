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
    invitations: {
      acceptInvitation: FunctionReference<
        "mutation",
        "internal",
        {
          acceptingUserId: string;
          acceptingUserIdentifier?: string;
          invitationId: string;
        },
        null,
        Name
      >;
      bulkInviteMembers: FunctionReference<
        "mutation",
        "internal",
        {
          expiresAt?: number;
          invitations: Array<{
            identifierType?: string;
            inviteeIdentifier: string;
            message?: string;
            role: string;
            teamId?: string;
          }>;
          inviterName?: string;
          organizationId: string;
          userId: string;
        },
        {
          errors: Array<{
            code: string;
            inviteeIdentifier: string;
            message: string;
          }>;
          success: Array<{
            expiresAt: number;
            invitationId: string;
            inviteeIdentifier: string;
          }>;
        },
        Name
      >;
      cancelInvitation: FunctionReference<
        "mutation",
        "internal",
        { invitationId: string; userId: string },
        null,
        Name
      >;
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
          expiresAt: number;
          identifierType?: string;
          inviteeIdentifier: string;
          inviterId: string;
          inviterName?: string;
          isExpired: boolean;
          message?: string;
          organizationId: string;
          organizationName: string;
          role: string;
          status: "pending" | "accepted" | "cancelled" | "expired";
          teamId: null | string;
        },
        Name
      >;
      getPendingInvitationsForIdentifier: FunctionReference<
        "query",
        "internal",
        { identifier: string },
        Array<{
          _creationTime: number;
          _id: string;
          expiresAt: number;
          identifierType?: string;
          inviteeIdentifier: string;
          inviterId: string;
          inviterName?: string;
          isExpired: boolean;
          organizationId: string;
          organizationName: string;
          role: string;
          teamId: null | string;
        }>,
        Name
      >;
      inviteMember: FunctionReference<
        "mutation",
        "internal",
        {
          expiresAt?: number;
          identifierType?: string;
          inviteeIdentifier: string;
          inviterName?: string;
          message?: string;
          organizationId: string;
          role: string;
          teamId?: string;
          userId: string;
        },
        { expiresAt: number; invitationId: string; inviteeIdentifier: string },
        Name
      >;
      listInvitations: FunctionReference<
        "query",
        "internal",
        {
          organizationId: string;
          sortBy?: "inviteeIdentifier" | "expiresAt" | "createdAt";
          sortOrder?: "asc" | "desc";
        },
        Array<{
          _creationTime: number;
          _id: string;
          expiresAt: number;
          identifierType?: string;
          inviteeIdentifier: string;
          inviterId: string;
          inviterName?: string;
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
      resendInvitation: FunctionReference<
        "mutation",
        "internal",
        { invitationId: string; userId: string },
        { invitationId: string; inviteeIdentifier: string },
        Name
      >;
    };
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
      bulkAddMembers: FunctionReference<
        "mutation",
        "internal",
        {
          members: Array<{ memberUserId: string; role: string }>;
          organizationId: string;
          userId: string;
        },
        {
          errors: Array<{ code: string; message: string; userId: string }>;
          success: Array<string>;
        },
        Name
      >;
      bulkRemoveMembers: FunctionReference<
        "mutation",
        "internal",
        {
          memberUserIds: Array<string>;
          organizationId: string;
          userId: string;
        },
        {
          errors: Array<{ code: string; message: string; userId: string }>;
          success: Array<string>;
        },
        Name
      >;
      checkMemberPermission: FunctionReference<
        "query",
        "internal",
        {
          minRole: "member" | "admin" | "owner";
          organizationId: string;
          userId: string;
        },
        {
          currentRole: null | "owner" | "admin" | "member";
          hasPermission: boolean;
        },
        Name
      >;
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
          joinedAt?: number;
          organizationId: string;
          role: string;
          status?: "active" | "suspended";
          suspendedAt?: number;
          userId: string;
        },
        Name
      >;
      leaveOrganization: FunctionReference<
        "mutation",
        "internal",
        { organizationId: string; userId: string },
        null,
        Name
      >;
      listOrganizationMembers: FunctionReference<
        "query",
        "internal",
        {
          organizationId: string;
          sortBy?: "role" | "joinedAt" | "createdAt" | "userId";
          sortOrder?: "asc" | "desc";
          status?: "active" | "suspended" | "all";
        },
        Array<{
          _creationTime: number;
          _id: string;
          joinedAt?: number;
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
          settings?: {
            allowPublicSignup?: boolean;
            requireInvitationToJoin?: boolean;
          };
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
          settings?: {
            allowPublicSignup?: boolean;
            requireInvitationToJoin?: boolean;
          };
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
          settings?: {
            allowPublicSignup?: boolean;
            requireInvitationToJoin?: boolean;
          };
          slug: string;
          status?: "active" | "suspended" | "archived";
        },
        Name
      >;
      listUserOrganizations: FunctionReference<
        "query",
        "internal",
        {
          sortBy?: "name" | "createdAt" | "slug";
          sortOrder?: "asc" | "desc";
          userId: string;
        },
        Array<{
          _creationTime: number;
          _id: string;
          logo: null | string;
          metadata?: any;
          name: string;
          ownerId: string;
          role: string;
          settings?: {
            allowPublicSignup?: boolean;
            requireInvitationToJoin?: boolean;
          };
          slug: string;
          status?: "active" | "suspended" | "archived";
        }>,
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
          settings?: {
            allowPublicSignup?: boolean;
            requireInvitationToJoin?: boolean;
          };
          slug?: string;
          status?: "active" | "suspended" | "archived";
          userId: string;
        },
        null,
        Name
      >;
    };
    teams: {
      addTeamMember: FunctionReference<
        "mutation",
        "internal",
        { memberUserId: string; role?: string; teamId: string; userId: string },
        null,
        Name
      >;
      countTeams: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        number,
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
          parentTeamId?: string;
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
          parentTeamId?: string;
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
        {
          sortBy?: "userId" | "role" | "createdAt";
          sortOrder?: "asc" | "desc";
          teamId: string;
        },
        Array<{
          _creationTime: number;
          _id: string;
          role?: string;
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
        {
          organizationId: string;
          parentTeamId?: null | string;
          sortBy?: "name" | "createdAt" | "slug";
          sortOrder?: "asc" | "desc";
        },
        Array<{
          _creationTime: number;
          _id: string;
          description: null | string;
          metadata?: any;
          name: string;
          organizationId: string;
          parentTeamId?: string;
          slug?: string;
        }>,
        Name
      >;
      listTeamsAsTree: FunctionReference<
        "query",
        "internal",
        { organizationId: string },
        Array<{
          children: any;
          team: {
            _creationTime: number;
            _id: string;
            description: null | string;
            metadata?: any;
            name: string;
            organizationId: string;
            parentTeamId?: string;
            slug?: string;
          };
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
          parentTeamId?: null | string;
          slug?: string;
          teamId: string;
          userId: string;
        },
        null,
        Name
      >;
      updateTeamMemberRole: FunctionReference<
        "mutation",
        "internal",
        { memberUserId: string; role: string; teamId: string; userId: string },
        null,
        Name
      >;
    };
  };
