import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";

// Type for team from the component
export interface Team {
  _id: string;
  _creationTime: number;
  name: string;
  organizationId: string;
  description: string | null;
  slug?: string;
  metadata?: any;
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
   * Query function reference to list organization teams
   * Example: api.tenants.listTeams
   */
  listTeamsQuery: FunctionReference<
    "query",
    "public",
    { organizationId: string },
    Team[]
  >;
  
  /**
   * Mutation function reference to create a team
   * Example: api.tenants.createTeam
   */
  createTeamMutation: FunctionReference<
    "mutation",
    "public",
    { organizationId: string; name: string; description?: string },
    string
  >;
  
  /**
   * Mutation function reference to update a team
   * Example: api.tenants.updateTeam
   */
  updateTeamMutation: FunctionReference<
    "mutation",
    "public",
    { teamId: string; name?: string; description?: string | null },
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
    createTeamMutation,
    updateTeamMutation,
    deleteTeamMutation,
    addTeamMemberMutation,
    removeTeamMemberMutation,
  } = options;

  // Get teams for the organization
  const teams = useQuery(
    listTeamsQuery,
    organizationId ? { organizationId } : "skip"
  );
  
  // Mutations
  const createTeamMut = useMutation(createTeamMutation);
  const updateTeamMut = useMutation(updateTeamMutation);
  const deleteTeamMut = useMutation(deleteTeamMutation);
  const addTeamMemberMut = useMutation(addTeamMemberMutation);
  const removeTeamMemberMut = useMutation(removeTeamMemberMutation);

  const createTeam = useCallback(
    async (name: string, description?: string) => {
      if (!organizationId) {
        throw new Error("No organization selected");
      }
      try {
        const teamId = await createTeamMut({
          organizationId,
          name,
          description,
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
    async (teamId: string, data: { name?: string; description?: string | null }) => {
      try {
        await updateTeamMut({
          teamId,
          ...data,
        });
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
        await addTeamMemberMut({
          teamId,
          memberUserId,
        });
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
        await removeTeamMemberMut({
          teamId,
          memberUserId,
        });
      } catch (error) {
        console.error("Failed to remove member from team:", error);
        throw error;
      }
    },
    [removeTeamMemberMut]
  );

  return {
    // Team operations
    teams: teams ?? [],
    isLoading: teams === undefined,
    createTeam,
    updateTeam,
    deleteTeam,
    
    // Team member operations
    addTeamMember,
    removeTeamMember,
  };
}
