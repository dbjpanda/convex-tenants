import { Component } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTenants } from "@djpanda/convex-tenants/react";
import { ScrollText, Shield, Loader2 } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { OrgInfoBar } from "../components/OrgInfoBar";

// ============================================================================
// Error Boundary
// ============================================================================

type Props = { children: React.ReactNode; fallback?: React.ReactNode };

class QueryErrorBoundary extends Component<
  Props,
  { hasError: boolean; error?: Error }
> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <section className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-destructive">
              <Shield className="size-5" />
              Something went wrong
            </h3>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message ??
                "An error occurred. You may not have permission to view this."}
            </p>
          </section>
        )
      );
    }
    return this.props.children;
  }
}

export function AuditPage() {
  const { currentOrganization, organizations, isOrganizationsLoading, currentRole } =
    useTenants();

  const showEmptyState =
    !isOrganizationsLoading && !currentOrganization && organizations.length === 0;

  if (showEmptyState) {
    return <EmptyState />;
  }

  const isOwnerOrAdmin = currentRole === "owner" || currentRole === "admin";

  if (!isOwnerOrAdmin) {
    return (
      <>
        {currentOrganization && (
          <OrgInfoBar org={currentOrganization} role={currentRole} />
        )}
        <div className="rounded-xl border bg-background p-16 text-center shadow-sm">
          <ScrollText className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">Access Restricted</h2>
          <p className="text-muted-foreground">
            You need to be an owner or admin to view the audit log.
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
      <QueryErrorBoundary>
        <AuditLogPanel orgId={currentOrganization?._id} />
      </QueryErrorBoundary>
    </>
  );
}

function AuditLogPanel({ orgId }: { orgId?: string }) {
  const auditLog = useQuery(
    api.tenants.getAuditLog,
    orgId ? { organizationId: orgId, limit: 50 } : "skip"
  );

  return (
    <section className="rounded-xl border bg-background p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <ScrollText className="size-5 text-primary" />
        Audit Log
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        All authorization changes — role assignments, permission grants/denials — are
        logged automatically by authz.
      </p>

      {!auditLog ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : Array.isArray(auditLog) && auditLog.length > 0 ? (
        <div className="max-h-96 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-2 font-medium text-muted-foreground">User</th>
                <th className="px-4 py-2 font-medium text-muted-foreground">
                  Details
                </th>
                <th className="px-4 py-2 font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {auditLog.map((entry: any, i: number) => (
                <tr key={entry._id ?? i} className="hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {entry.userId || entry.actorId || "system"}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {entry.details ? (
                      <code className="rounded bg-muted px-1 py-0.5">
                        {JSON.stringify(entry.details).slice(0, 80)}
                        {JSON.stringify(entry.details).length > 80 && "..."}
                      </code>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {entry.timestamp
                      ? new Date(entry.timestamp).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No audit entries yet. Create organizations, add members, or change roles to
          generate entries.
        </div>
      )}
    </section>
  );
}
