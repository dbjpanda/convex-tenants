/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as helpers from "../helpers.js";
import type * as mutations from "../mutations.js";
import type * as queries from "../queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  helpers: typeof helpers;
  mutations: typeof mutations;
  queries: typeof queries;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {
  authz: {
    indexed: {
      addRelationWithCompute: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          inheritedRelations?: Array<{
            fromObjectType: string;
            fromRelation: string;
            relation: string;
          }>;
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        string
      >;
      assignRoleWithCompute: FunctionReference<
        "mutation",
        "internal",
        {
          assignedBy?: string;
          expiresAt?: number;
          role: string;
          rolePermissions: Array<string>;
          scope?: { id: string; type: string };
          userId: string;
        },
        string
      >;
      checkPermissionFast: FunctionReference<
        "query",
        "internal",
        {
          objectId?: string;
          objectType?: string;
          permission: string;
          userId: string;
        },
        boolean
      >;
      cleanupExpired: FunctionReference<
        "mutation",
        "internal",
        {},
        { expiredPermissions: number; expiredRoles: number }
      >;
      denyPermissionDirect: FunctionReference<
        "mutation",
        "internal",
        {
          deniedBy?: string;
          expiresAt?: number;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        string
      >;
      getUserPermissionsFast: FunctionReference<
        "query",
        "internal",
        { scopeKey?: string; userId: string },
        Array<{
          effect: string;
          permission: string;
          scopeKey: string;
          sources: Array<string>;
        }>
      >;
      getUserRolesFast: FunctionReference<
        "query",
        "internal",
        { scopeKey?: string; userId: string },
        Array<{
          role: string;
          scope?: { id: string; type: string };
          scopeKey: string;
        }>
      >;
      grantPermissionDirect: FunctionReference<
        "mutation",
        "internal",
        {
          expiresAt?: number;
          grantedBy?: string;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        string
      >;
      hasRelationFast: FunctionReference<
        "query",
        "internal",
        {
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        boolean
      >;
      hasRoleFast: FunctionReference<
        "query",
        "internal",
        {
          objectId?: string;
          objectType?: string;
          role: string;
          userId: string;
        },
        boolean
      >;
      removeRelationWithCompute: FunctionReference<
        "mutation",
        "internal",
        {
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        boolean
      >;
      revokeRoleWithCompute: FunctionReference<
        "mutation",
        "internal",
        {
          role: string;
          rolePermissions: Array<string>;
          scope?: { id: string; type: string };
          userId: string;
        },
        boolean
      >;
    };
    mutations: {
      assignRole: FunctionReference<
        "mutation",
        "internal",
        {
          assignedBy?: string;
          enableAudit?: boolean;
          expiresAt?: number;
          metadata?: any;
          role: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        string
      >;
      cleanupExpired: FunctionReference<
        "mutation",
        "internal",
        {},
        { expiredOverrides: number; expiredRoles: number }
      >;
      denyPermission: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          enableAudit?: boolean;
          expiresAt?: number;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        string
      >;
      grantPermission: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          enableAudit?: boolean;
          expiresAt?: number;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        string
      >;
      logPermissionCheck: FunctionReference<
        "mutation",
        "internal",
        {
          permission: string;
          reason?: string;
          result: boolean;
          scope?: { id: string; type: string };
          userId: string;
        },
        null
      >;
      removeAllAttributes: FunctionReference<
        "mutation",
        "internal",
        { enableAudit?: boolean; removedBy?: string; userId: string },
        number
      >;
      removeAttribute: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          key: string;
          removedBy?: string;
          userId: string;
        },
        boolean
      >;
      removePermissionOverride: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          permission: string;
          removedBy?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        boolean
      >;
      revokeAllRoles: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          revokedBy?: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        number
      >;
      revokeRole: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          revokedBy?: string;
          role: string;
          scope?: { id: string; type: string };
          userId: string;
        },
        boolean
      >;
      setAttribute: FunctionReference<
        "mutation",
        "internal",
        {
          enableAudit?: boolean;
          key: string;
          setBy?: string;
          userId: string;
          value: any;
        },
        string
      >;
    };
    queries: {
      checkPermission: FunctionReference<
        "query",
        "internal",
        {
          permission: string;
          rolePermissions: Record<string, Array<string>>;
          scope?: { id: string; type: string };
          userId: string;
        },
        {
          allowed: boolean;
          matchedOverride?: string;
          matchedRole?: string;
          reason: string;
        }
      >;
      getAuditLog: FunctionReference<
        "query",
        "internal",
        {
          action?:
            | "permission_check"
            | "role_assigned"
            | "role_revoked"
            | "permission_granted"
            | "permission_denied"
            | "attribute_set"
            | "attribute_removed";
          limit?: number;
          userId?: string;
        },
        Array<{
          _id: string;
          action: string;
          actorId?: string;
          details: any;
          timestamp: number;
          userId: string;
        }>
      >;
      getEffectivePermissions: FunctionReference<
        "query",
        "internal",
        {
          rolePermissions: Record<string, Array<string>>;
          scope?: { id: string; type: string };
          userId: string;
        },
        {
          deniedPermissions: Array<string>;
          permissions: Array<string>;
          roles: Array<string>;
        }
      >;
      getPermissionOverrides: FunctionReference<
        "query",
        "internal",
        { permission?: string; userId: string },
        Array<{
          _id: string;
          effect: "allow" | "deny";
          expiresAt?: number;
          permission: string;
          reason?: string;
          scope?: { id: string; type: string };
        }>
      >;
      getUserAttribute: FunctionReference<
        "query",
        "internal",
        { key: string; userId: string },
        null | any
      >;
      getUserAttributes: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{ _id: string; key: string; value: any }>
      >;
      getUserRoles: FunctionReference<
        "query",
        "internal",
        { scope?: { id: string; type: string }; userId: string },
        Array<{
          _id: string;
          expiresAt?: number;
          metadata?: any;
          role: string;
          scope?: { id: string; type: string };
        }>
      >;
      getUsersWithRole: FunctionReference<
        "query",
        "internal",
        { role: string; scope?: { id: string; type: string } },
        Array<{ assignedAt: number; expiresAt?: number; userId: string }>
      >;
      hasRole: FunctionReference<
        "query",
        "internal",
        { role: string; scope?: { id: string; type: string }; userId: string },
        boolean
      >;
    };
    rebac: {
      addRelation: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        string
      >;
      checkRelationWithTraversal: FunctionReference<
        "query",
        "internal",
        {
          maxDepth?: number;
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
          traversalRules?: any;
        },
        { allowed: boolean; path: Array<string>; reason: string }
      >;
      getObjectRelations: FunctionReference<
        "query",
        "internal",
        { objectId: string; objectType: string; relation?: string },
        Array<{
          _id: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        }>
      >;
      getSubjectRelations: FunctionReference<
        "query",
        "internal",
        { objectType?: string; subjectId: string; subjectType: string },
        Array<{
          _id: string;
          objectId: string;
          objectType: string;
          relation: string;
        }>
      >;
      hasDirectRelation: FunctionReference<
        "query",
        "internal",
        {
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        boolean
      >;
      listAccessibleObjects: FunctionReference<
        "query",
        "internal",
        {
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
          traversalRules?: any;
        },
        Array<{ objectId: string; via: string }>
      >;
      listUsersWithAccess: FunctionReference<
        "query",
        "internal",
        { objectId: string; objectType: string; relation: string },
        Array<{ userId: string; via: string }>
      >;
      removeRelation: FunctionReference<
        "mutation",
        "internal",
        {
          objectId: string;
          objectType: string;
          relation: string;
          subjectId: string;
          subjectType: string;
        },
        boolean
      >;
    };
  };
};
