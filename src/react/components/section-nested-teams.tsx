"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { UsersRound, Loader2 } from "lucide-react";
import { useTenants } from "../providers/tenants-context.js";
import type { Team } from "../providers/tenants-context.js";

type TeamTreeEntry = { team: Team; children: TeamTreeEntry[] };

/**
 * Nested teams: tree view via listTeamsAsTree and create team with optional parent.
 * Renders only when api exposes listTeamsAsTree.
 */
export function NestedTeamsSection() {
  const { currentOrganization, teams, createTeam, api } = useTenants();
  const a = api as Record<string, FunctionReference<"query"> | undefined>;

  const teamTree = useQuery(
    (a.listTeamsAsTree ?? a.listTeams) as FunctionReference<"query">,
    currentOrganization?._id && a.listTeamsAsTree ? { organizationId: currentOrganization._id } : "skip"
  ) as TeamTreeEntry[] | undefined;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentTeamId, setParentTeamId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!currentOrganization || !a.listTeamsAsTree) return null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createTeam({
        name: name.trim(),
        description: description.trim() || undefined,
        parentTeamId: parentTeamId ?? undefined,
      });
      setName("");
      setDescription("");
      setParentTeamId(null);
    } finally {
      setCreating(false);
    }
  };

  function TreeList({ entries, depth = 0 }: { entries: TeamTreeEntry[]; depth?: number }) {
    return (
      <ul className={depth > 0 ? "ml-4 border-l-2 border-muted pl-3" : ""}>
        {entries.map(({ team, children }) => (
          <li key={team._id} className="py-1">
            <span className="font-medium">{team.name}</span>
            {children.length > 0 && <TreeList entries={children} depth={depth + 1} />}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="mt-6 rounded-xl border bg-background p-6 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <UsersRound className="size-5 text-primary" />
        Nested teams (tree)
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Teams can have a parent. Below: <code className="rounded bg-muted px-1">listTeamsAsTree</code>; create with optional parent.
      </p>
      {teamTree && teamTree.length > 0 && (
        <div className="mb-4 rounded-lg border bg-muted/20 p-3">
          <TreeList entries={teamTree} />
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="Team name"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Parent</label>
          <select
            value={parentTeamId ?? ""}
            onChange={(e) => setParentTeamId(e.target.value || null)}
            className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Root</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : null}
          Create team
        </button>
      </div>
    </section>
  );
}
