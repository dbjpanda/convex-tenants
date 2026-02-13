import { useTenants } from "@djpanda/convex-tenants/react";
import {
  TeamsSection,
  NestedTeamsSection,
} from "@djpanda/convex-tenants/react";
import { EmptyState } from "../components/EmptyState";
import { OrgInfoBar } from "../components/OrgInfoBar";

export function TeamsPage() {
  const { currentOrganization, organizations, isOrganizationsLoading, currentRole } =
    useTenants();

  const showEmptyState =
    !isOrganizationsLoading && !currentOrganization && organizations.length === 0;

  if (showEmptyState) {
    return <EmptyState />;
  }

  return (
    <>
      {currentOrganization && (
        <OrgInfoBar org={currentOrganization} role={currentRole} />
      )}

      <TeamsSection />
      <NestedTeamsSection />
    </>
  );
}
