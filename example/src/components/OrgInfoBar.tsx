import { Building2 } from "lucide-react";

interface OrgInfoBarProps {
  org: {
    _id: string;
    name: string;
    slug: string;
    ownerId: string;
    _creationTime: number;
  };
  role: string | null;
}

export function OrgInfoBar({ org, role }: OrgInfoBarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
        <Building2 className="size-5 text-primary" />
      </div>
      <div className="flex-1">
        <h2 className="font-semibold">{org.name}</h2>
        <p className="text-sm text-muted-foreground">
          /{org.slug} &middot; Your role:{" "}
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
            {role}
          </span>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Created {new Date(org._creationTime).toLocaleDateString()}
      </p>
    </div>
  );
}
