import { Building2 } from "lucide-react";
import { CreateOrganizationDialog } from "@djpanda/convex-tenants/react";

export function EmptyState() {
  return (
    <div className="rounded-xl border bg-background p-16 text-center shadow-sm">
      <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
        <Building2 className="size-10 text-muted-foreground" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">No Organization Yet</h2>
      <p className="mb-8 text-muted-foreground">
        Create your first organization to get started
      </p>
      <CreateOrganizationDialog />
    </div>
  );
}
