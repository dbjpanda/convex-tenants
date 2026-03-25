import { useCallback } from "react";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import type { PaginatedQueryReference } from "convex/react";

// Type for team from the component
export interface Team {
  _id: string;
  _creationTime: number;
  name: string;
  organizationId: string;
  description: string | null;
  slug?: string;
  metadata?: Record<string, unknown>;
}

export interface TeamMember {
  _id: string;
  _creationTime: number;
  teamId: string;
  userId: string;
}

export interface UseTeamsOptions {
  /**
   * The organization ID to list teams for
   */
  organizationId: string | undefined;

  /**
   * Query function reference to list organization teams.
   * Example: api.tenants.listTeams
   * Pass `pagination: { initialNumItems }` to use cursor-based pagination.
   */
  listTeamsQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string; paginationOpts?: { numItems: number; cursor: string | null } },
    | Team[]
    | { page: Team[]; isDone: boolean; continueCursor: string }
  >;

  /**
   * When set, uses usePaginatedQuery and returns status, loadMore.
   * Omit for a single useQuery that returns all teams.
   */
  pagination?: { initialNumItems?: number };

  /**
   * Mutation function reference to create a team
   * Example: api.tenants.createTeam
   */
  createTeamMutation: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; name: string; description?: string; slug?: string; metadata?: unknown },
    string
  >;

  /**
   * Mutation function reference to update a team
   * Example: api.tenants.updateTeam
   */
  updateTeamMutation: FunctionReference<
    "mutation",
    "public",
    { teamId: string; name?: string; description?: string | null; slug?: string; metadata?: unknown },
    null
  >;

  /**
   * Mutation function reference to delete a team
   * Example: api.tenants.deleteTeam
   */
  deleteTeamMutation: FunctionReference<
    "mutation",
    "public",
    { teamId: string },
    null
  >;

  /**
   * Mutation function reference to add a team member
   * Example: api.tenants.addTeamMember
   */
  addTeamMemberMutation: FunctionReference<
    "mutation",
    "public",
    { teamId: string; memberUserId: string },
    null
  >;

  /**
   * Mutation function reference to remove a team member
   * Example: api.tenants.removeTeamMember
   */
  removeTeamMemberMutation: FunctionReference<
    "mutation",
    "public",
    { teamId: string; memberUserId: string },
    null
  >;
}

export function useTeams(options: UseTeamsOptions) {
  const {
    organizationId,
    listTeamsQuery,
    pagination,
    createTeamMutation,
    updateTeamMutation,
    deleteTeamMutation,
    addTeamMemberMutation,
    removeTeamMemberMutation,
  } = options;

  const createTeamMut = useMutation(createTeamMutation);
  const updateTeamMut = useMutation(updateTeamMutation);
  const deleteTeamMut = useMutation(deleteTeamMutation);
  const addTeamMemberMut = useMutation(addTeamMemberMutation);
  const removeTeamMemberMut = useMutation(removeTeamMemberMutation);

  const createTeam = useCallback(
    async (name: string, description?: string, slug?: string, metadata?: unknown) => {
      if (!organizationId) {
        throw new Error("No organization selected");
      }
      try {
        const teamId = await createTeamMut({
          organizationId,
          name,
          description,
          slug,
          metadata,
        });
        return teamId;
      } catch (error) {
        console.error("Failed to create team:", error);
        throw error;
      }
    },
    [organizationId, createTeamMut]
  );

  const updateTeam = useCallback(
    async (
      teamId: string,
      data: { name?: string; description?: string | null; slug?: string; metadata?: unknown }
    ) => {
      try {
        await updateTeamMut({ teamId, ...data });
      } catch (error) {
        console.error("Failed to update team:", error);
        throw error;
      }
    },
    [updateTeamMut]
  );

  const deleteTeam = useCallback(
    async (teamId: string) => {
      try {
        await deleteTeamMut({ teamId });
      } catch (error) {
        console.error("Failed to delete team:", error);
        throw error;
      }
    },
    [deleteTeamMut]
  );

  const addTeamMember = useCallback(
    async (teamId: string, memberUserId: string) => {
      try {
        await addTeamMemberMut({ teamId, memberUserId });
      } catch (error) {
        console.error("Failed to add member to team:", error);
        throw error;
      }
    },
    [addTeamMemberMut]
  );

  const removeTeamMember = useCallback(
    async (teamId: string, memberUserId: string) => {
      try {
        await removeTeamMemberMut({ teamId, memberUserId });
      } catch (error) {
        console.error("Failed to remove member from team:", error);
        throw error;
      }
    },
    [removeTeamMemberMut]
  );

  // Both hooks are called unconditionally (Rules of Hooks). The "skip" arg
  // prevents Convex from creating an actual backend subscription for the unused path.
  const {
    results,
    status,
    loadMore,
    isLoading: isPaginatedLoading,
  } = usePaginatedQuery(
    listTeamsQuery as PaginatedQueryReference,
    pagination !== undefined && organizationId ? { organizationId } : "skip",
    { initialNumItems: pagination?.initialNumItems ?? 20 }
  );

  const teams = useQuery(
    listTeamsQuery,
    pagination === undefined && organizationId ? { organizationId } : "skip"
  );

  if (pagination !== undefined) {
    return {
      teams: results ?? [],
      status,
      loadMore,
      isLoading: isPaginatedLoading,
      createTeam,
      updateTeam,
      deleteTeam,
      addTeamMember,
      removeTeamMember,
    };
  }

  return {
    teams: (Array.isArray(teams) ? teams : []) as Team[],
    isLoading: teams === undefined,
    createTeam,
    updateTeam,
    deleteTeam,
    addTeamMember,
    removeTeamMember,
  };
}
