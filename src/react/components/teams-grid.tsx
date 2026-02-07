"use client";

import type { ReactNode } from "react";
import { Users, Trash2 } from "lucide-react";
import { cn } from "../utils.js";
import { Button } from "../ui/button.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Skeleton } from "../ui/skeleton.js";
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
  const UsersIcon = usersIcon ?? <Users className="size-4" />;
  const TrashIcon = trashIcon ?? <Trash2 className="size-4" />;

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
      <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="size-6 rounded-md" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Skeleton className="h-5 w-16 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className={cn("p-8 text-center", className)}>
        <div className="mb-4 flex justify-center">
          <span className="text-muted-foreground">{UsersIcon}</span>
        </div>
        <h3 className="mb-2 text-lg font-semibold">No teams yet</h3>
        <p className="mb-4 text-muted-foreground">
          Create teams to organize your members
        </p>
        {isOwnerOrAdmin && emptyAction}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {teams.map((team) => (
        <Card
          key={team._id}
          className={cn(
            onTeamClick && "cursor-pointer transition-shadow hover:shadow-md"
          )}
          onClick={() => onTeamClick?.(team)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-1">
                <CardTitle className="text-lg">{team.name}</CardTitle>
                {team.description && (
                  <CardDescription>{team.description}</CardDescription>
                )}
              </div>
              {isOwnerOrAdmin && onDeleteTeam && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => handleDeleteTeam(team._id, e)}
                  aria-label="Delete team"
                  className="text-muted-foreground hover:text-destructive"
                >
                  {TrashIcon}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Badge variant="secondary">
              {UsersIcon}
              <span>Team</span>
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
