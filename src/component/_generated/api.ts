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
import type * as mutations_invitations from "../mutations/invitations.js";
import type * as mutations_members from "../mutations/members.js";
import type * as mutations_organizations from "../mutations/organizations.js";
import type * as mutations_teams from "../mutations/teams.js";
import type * as queries from "../queries.js";
import type * as queries_invitations from "../queries/invitations.js";
import type * as queries_members from "../queries/members.js";
import type * as queries_organizations from "../queries/organizations.js";
import type * as queries_teams from "../queries/teams.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  helpers: typeof helpers;
  mutations: typeof mutations;
  "mutations/invitations": typeof mutations_invitations;
  "mutations/members": typeof mutations_members;
  "mutations/organizations": typeof mutations_organizations;
  "mutations/teams": typeof mutations_teams;
  queries: typeof queries;
  "queries/invitations": typeof queries_invitations;
  "queries/members": typeof queries_members;
  "queries/organizations": typeof queries_organizations;
  "queries/teams": typeof queries_teams;
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

export const components = componentsGeneric() as unknown as {};
