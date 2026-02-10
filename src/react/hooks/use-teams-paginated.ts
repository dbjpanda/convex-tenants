import { useCallback } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";

export interface Team {
  _id: string;
  _creationTime: number;
  name: string;
  organizationId: string;
  description: string | null;
  slug?: string;
  metadata?: Record<string, unknown>;
}

export interface UseTeamsPaginatedOptions {
  organizationId: string | undefined;
  listTeamsPaginatedQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string; paginationOpts: { numItems: number; cursor: string | null } },
    { page: Team[]; isDone: boolean; continueCursor: string }
  >;
  initialNumItems?: number;
  createTeamMutation: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; name: string; description?: string; slug?: string; metadata?: unknown },
    string
  >;
  updateTeamMutation: FunctionReference<
    "mutation",
    "public",
    { teamId: string; name?: string; description?: string | null; slug?: string; metadata?: unknown },
    null
  >;
  deleteTeamMutation: FunctionReference<
    "mutation",
    "public",
    { teamId: string },
    null
  >;
  addTeamMemberMutation: FunctionReference<
    "mutation",
    "public",
    { teamId: string; memberUserId: string },
    null
  >;
  removeTeamMemberMutation: FunctionReference<
    "mutation",
    "public",
    { teamId: string; memberUserId: string },
    null
  >;
}

export function useTeamsPaginated(options: UseTeamsPaginatedOptions) {
  const {
    organizationId,
    listTeamsPaginatedQuery,
    initialNumItems = 20,
    createTeamMutation,
    updateTeamMutation,
    deleteTeamMutation,
    addTeamMemberMutation,
    removeTeamMemberMutation,
  } = options;

  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    listTeamsPaginatedQuery,
    organizationId ? { organizationId } : "skip",
    { initialNumItems }
  );

  const createTeamMut = useMutation(createTeamMutation);
  const updateTeamMut = useMutation(updateTeamMutation);
  const deleteTeamMut = useMutation(deleteTeamMutation);
  const addTeamMemberMut = useMutation(addTeamMemberMutation);
  const removeTeamMemberMut = useMutation(removeTeamMemberMutation);

  const createTeam = useCallback(
    async (name: string, description?: string, slug?: string, metadata?: unknown) => {
      if (!organizationId) throw new Error("No organization selected");
      return await createTeamMut({ organizationId, name, description, slug, metadata });
    },
    [organizationId, createTeamMut]
  );

  const updateTeam = useCallback(
    async (
      teamId: string,
      data: { name?: string; description?: string | null; slug?: string; metadata?: unknown }
    ) => {
      await updateTeamMut({ teamId, ...data });
    },
    [updateTeamMut]
  );

  const deleteTeam = useCallback(async (teamId: string) => {
    await deleteTeamMut({ teamId });
  }, [deleteTeamMut]);

  const addTeamMember = useCallback(
    async (teamId: string, memberUserId: string) => {
      await addTeamMemberMut({ teamId, memberUserId });
    },
    [addTeamMemberMut]
  );

  const removeTeamMember = useCallback(
    async (teamId: string, memberUserId: string) => {
      await removeTeamMemberMut({ teamId, memberUserId });
    },
    [removeTeamMemberMut]
  );

  return {
    teams: results ?? [],
    status,
    loadMore,
    isLoading,
    createTeam,
    updateTeam,
    deleteTeam,
    addTeamMember,
    removeTeamMember,
  };
}
