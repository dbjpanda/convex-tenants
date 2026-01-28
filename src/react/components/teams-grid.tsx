"use client";

import type { ReactNode } from "react";
import { cn } from "../utils.js";
import type { Team } from "../hooks/use-teams.js";

export interface TeamsGridProps {
  /**
   * List of teams in the organization
   */
  teams: Team[];
  
  /**
   * Whether the data is loading
   */
  isLoading?: boolean;
  
  /**
   * Whether the current user is owner or admin
   */
  isOwnerOrAdmin?: boolean;
  
  /**
   * Callback when clicking a team
   */
  onTeamClick?: (team: Team) => void;
  
  /**
   * Callback to delete a team
   */
  onDeleteTeam?: (teamId: string) => Promise<void>;
  
  /**
   * Empty state action element (e.g., Create Team button)
   */
  emptyAction?: ReactNode;
  
  /**
   * Toast notification callback
   */
  onToast?: (message: string, type: "success" | "error") => void;
  
  /**
   * Custom class name
   */
  className?: string;
  
  /**
   * Custom icon for users/team
   */
  usersIcon?: ReactNode;
  
  /**
   * Custom icon for trash/delete
   */
  trashIcon?: ReactNode;
}

/**
 * A grid component for displaying teams in an organization.
 * 
 * @example
 * ```tsx
 * import { TeamsGrid, CreateTeamDialog } from "@djpanda/convex-tenants/react";
 * import { Users, Trash2 } from "lucide-react";
 * 
 * function MyApp() {
 *   const { teams, isLoading, deleteTeam, createTeam } = useTeams(...);
 *   
 *   return (
 *     <TeamsGrid
 *       teams={teams}
 *       isLoading={isLoading}
 *       isOwnerOrAdmin={true}
 *       onDeleteTeam={deleteTeam}
 *       usersIcon={<Users className="h-4 w-4" />}
 *       trashIcon={<Trash2 className="h-4 w-4" />}
 *       emptyAction={
 *         <CreateTeamDialog
 *           organizationName="Acme Inc"
 *           onCreateTeam={createTeam}
 *         />
 *       }
 *     />
 *   );
 * }
 * ```
 */
export function TeamsGrid({
  teams,
  isLoading = false,
  isOwnerOrAdmin = false,
  onTeamClick,
  onDeleteTeam,
  emptyAction,
  onToast,
  className,
  usersIcon,
  trashIcon,
}: TeamsGridProps) {
  const handleDeleteTeam = async (teamId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onDeleteTeam?.(teamId);
      onToast?.("Team deleted successfully", "success");
    } catch (error: any) {
      onToast?.(error.message || "Failed to delete team", "error");
    }
  };

  if (isLoading) {
    return (
      <div className={cn("p-8 text-center text-gray-500", className)}>
        Loading teams...
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className={cn("p-8 text-center", className)}>
        <div className="flex justify-center mb-4">
          <span className="text-gray-400">{usersIcon}</span>
        </div>
        <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
        <p className="text-gray-500 mb-4">
          Create teams to organize your members
        </p>
        {isOwnerOrAdmin && emptyAction}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {teams.map((team) => (
        <div
          key={team._id}
          onClick={() => onTeamClick?.(team)}
          className={cn(
            "p-4 border rounded-lg bg-white",
            onTeamClick && "cursor-pointer hover:shadow-md transition-shadow"
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{team.name}</h3>
              {team.description && (
                <p className="text-sm text-gray-500 mt-1">{team.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  {usersIcon}
                  <span className="ml-1">Team</span>
                </span>
              </div>
            </div>
            {isOwnerOrAdmin && onDeleteTeam && (
              <button
                onClick={(e) => handleDeleteTeam(team._id, e)}
                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
                title="Delete team"
              >
                {trashIcon}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
