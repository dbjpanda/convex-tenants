import { useTenants, OrgSettingsPanel } from "@djpanda/convex-tenants/react";
import { Settings, Loader2 } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { OrgInfoBar } from "../components/OrgInfoBar";

export function SettingsPage() {
  const { currentOrganization, organizations, isOrganizationsLoading, currentRole } =
    useTenants();

  const showEmptyState =
    !isOrganizationsLoading && !currentOrganization && organizations.length === 0;

  if (showEmptyState) {
    return <EmptyState />;
  }

  if (isOrganizationsLoading || !currentOrganization) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isOwnerOrAdmin = currentRole === "owner" || currentRole === "admin";

  if (!isOwnerOrAdmin) {
    return (
      <>
        {currentOrganization && (
          <OrgInfoBar org={currentOrganization} role={currentRole} />
        )}
        <div className="rounded-xl border bg-background p-16 text-center shadow-sm">
          <Settings className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">Access Restricted</h2>
          <p className="text-muted-foreground">
            You need to be an owner or admin to view settings.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {currentOrganization && (
        <OrgInfoBar org={currentOrganization} role={currentRole} />
      )}
      <OrgSettingsPanel />
    </>
  );
}
