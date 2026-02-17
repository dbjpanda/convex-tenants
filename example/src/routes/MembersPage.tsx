import { useTenants } from "@djpanda/convex-tenants/react";
import {
  MembersSection,
  BulkInviteSection,
  MemberModerationSection,
} from "@djpanda/convex-tenants/react";
import { EmptyState } from "../components/EmptyState";
import { OrgInfoBar } from "../components/OrgInfoBar";

export function MembersPage() {
  const { currentOrganization, organizations, isOrganizationsLoading, currentRole } =
    useTenants();

  const showEmptyState =
    !isOrganizationsLoading && !currentOrganization && organizations.length === 0;

  const isOwnerOrAdmin = currentRole === "owner" || currentRole === "admin";

  if (showEmptyState) {
    return <EmptyState />;
  }

  return (
    <>
      {currentOrganization && (
        <OrgInfoBar org={currentOrganization} role={currentRole} />
      )}

      <MembersSection
        showTeamSelection
        showInvitationLink
        invitationPath="/accept-invitation/:id"
        expirationText="48 hours"
      />

      {isOwnerOrAdmin && (
        <>
          <BulkInviteSection />
          <MemberModerationSection />
        </>
      )}
    </>
  );
}
