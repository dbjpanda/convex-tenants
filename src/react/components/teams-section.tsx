"use client";

import { type ReactNode } from "react";
import { Users, Plus } from "lucide-react";
import { cn } from "../utils.js";
import { useTenants } from "../providers/tenants-context.js";
import { TeamsGrid } from "./teams-grid.js";
import { CreateTeamDialog } from "./create-team-dialog.js";
import { Button } from "../ui/button.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "../ui/card.js";
import { Skeleton } from "../ui/skeleton.js";
import type { Team } from "../hooks/use-teams.js";

export interface TeamsSectionProps {
  /**
   * Custom class name for the section
   */
  className?: string;

  /**
   * Section title (default: "Teams")
   */
  title?: string;

  /**
   * Whether to show the create button (default: true for owner/admin)
   */
  showCreateButton?: boolean;

  /**
   * Callback when clicking a team
   */
  onTeamClick?: (team: Team) => void;

  // Icons (optional overrides)
  usersIcon?: ReactNode;
  plusIcon?: ReactNode;
  trashIcon?: ReactNode;
}

/**
 * A complete section component for managing organization teams.
 *
 * Includes:
 * - Header with team count
 * - "Create Team" button (for owners/admins)
 * - TeamsGrid with delete actions
 * - Create Team Dialog
 *
 * Must be used within a TenantsProvider.
 *
 * @example
 * ```tsx
 * <TenantsProvider api={api.example}>
 *   <TeamsSection />
 * </TenantsProvider>
 * ```
 */
export function TeamsSection({
  className,
  title = "Teams",
  showCreateButton,
  onTeamClick,
  usersIcon,
  plusIcon,
  trashIcon,
}: TeamsSectionProps) {
  const {
    currentOrganization,
    teams,
    isOrganizationsLoading,
    isOwnerOrAdmin,
    isTeamsLoading,
    createTeam,
    deleteTeam,
    onToast,
  } = useTenants();

  // Show full card skeleton while organizations load, or "select org" when done loading with none selected
  if (isOrganizationsLoading || !currentOrganization) {
    return (
      <TeamsSectionSkeleton className={className} title={title} noOrg={!isOrganizationsLoading} />
    );
  }

  const shouldShowCreateButton = showCreateButton ?? isOwnerOrAdmin;

  const UsersIcon = usersIcon ?? (
    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
      <Users className="size-5 text-primary" />
    </div>
  );
  const PlusIcon = plusIcon ?? <Plus className="size-4" />;

  // Transform teams for the grid
  const transformedTeams: Team[] = teams.map((t) => ({
    _id: t._id,
    _creationTime: t._creationTime,
    name: t.name,
    organizationId: t.organizationId,
    description: t.description ?? null,
    slug: t.slug,
    metadata: undefined,
  }));

  return (
    <Card className={className}>
      {/* Header */}
      <CardHeader>
        <div className="flex items-center gap-3">
          {UsersIcon}
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {isTeamsLoading ? (
              <Skeleton className="mt-1 h-4 w-24" />
            ) : (
              <CardDescription>
                {teams.length} team{teams.length !== 1 ? "s" : ""}
              </CardDescription>
            )}
          </div>
        </div>

        {shouldShowCreateButton && (
          <CardAction>
            <CreateTeamDialog
              organizationName={currentOrganization.name}
              onCreateTeam={async (name, description) => {
                const result = await createTeam({ name, description });
                return result ?? "";
              }}
              onToast={onToast}
              trigger={
                <Button>
                  {PlusIcon}
                  <span>Create Team</span>
                </Button>
              }
            />
          </CardAction>
        )}
      </CardHeader>

      {/* Teams Grid */}
      <CardContent>
        <TeamsGrid
          teams={transformedTeams}
          isLoading={isTeamsLoading}
          isOwnerOrAdmin={isOwnerOrAdmin}
          onTeamClick={onTeamClick}
          onDeleteTeam={deleteTeam}
          onToast={onToast}
          usersIcon={usersIcon}
          trashIcon={trashIcon}
          emptyAction={
            <CreateTeamDialog
              organizationName={currentOrganization.name}
              onCreateTeam={async (name, description) => {
                const result = await createTeam({ name, description });
                return result ?? "";
              }}
              onToast={onToast}
              trigger={
                <Button>
                  {PlusIcon}
                  <span>Create your first team</span>
                </Button>
              }
            />
          }
        />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function TeamsSectionSkeleton({
  className,
  title,
  noOrg,
}: {
  className?: string;
  title: string;
  noOrg?: boolean;
}) {
  if (noOrg) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">
            Select an organization to view teams
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {/* Header skeleton */}
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <CardAction>
          <Skeleton className="h-9 w-32 rounded-md" />
        </CardAction>
      </CardHeader>

      {/* Grid skeleton */}
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
      </CardContent>
    </Card>
  );
}
