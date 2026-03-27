# Error Handling

This guide catalogs every error thrown by `@djpanda/convex-tenants`, explains when each occurs, and shows how to handle them in your React app.

## Error types

The library throws two kinds of errors:

- **`Error`** -- plain JavaScript errors thrown by the API layer (`makeTenantsAPI`), used for authentication failures, membership checks, limit violations, and hook-related errors.
- **`ConvexError`** -- structured errors thrown by the component layer (`src/component/`), carrying a `{ code, message }` payload. These are thrown by the low-level mutations that run inside the Convex component.

Both error types propagate to the client. Convex surfaces them via its standard error handling -- mutations reject their returned promise, and queries/subscriptions receive an error state.

---

## Error catalog

### Authentication

| Error Message | Source | When |
|---------------|--------|------|
| `"Not authenticated"` | `makeTenantsAPI` | Any query or mutation called without a valid session. The `auth` callback returned `null`. |

### Membership

| Error Message | Source | When |
|---------------|--------|------|
| `"Not a member of this organization"` | `makeTenantsAPI` | Caller is authenticated but not a member of the target organization. Thrown by queries and mutations that require membership. |
| `"Your membership is suspended. You cannot perform this action."` | `makeTenantsAPI` | Caller is a member but their membership status is `"suspended"`. Thrown by mutations that require active membership. |

### Organization status

| Error Message | Source | When |
|---------------|--------|------|
| `"Organization is suspended"` | `makeTenantsAPI` | A mutation targets an organization with `status: "suspended"`. Only `updateOrganization` with `status: "active"` bypasses this check. |
| `"Organization is archived"` | `makeTenantsAPI` | A mutation targets an organization with `status: "archived"`. |

### Organization operations

| Code | Error Message | Source | When |
|------|---------------|--------|------|
| `NOT_FOUND` | `"Organization not found"` | component `organizations.ts` | `updateOrganization`, `deleteOrganization`, or `transferOwnership` called with a nonexistent organization ID. |
| `FORBIDDEN` | `"Not a member of this organization"` | component `organizations.ts` | `updateOrganization` called by a non-member (component-level check). |
| -- | `"Maximum number of organizations (N) reached."` | `makeTenantsAPI` | `createOrganization` when user already owns/belongs to `maxOrganizations` orgs. |
| -- | `"Organization name must contain at least one alphanumeric character to generate a valid slug"` | `Tenants` class | `createOrganization` when the name produces an empty slug (e.g., all special characters). |

### Ownership transfer

| Code | Error Message | Source | When |
|------|---------------|--------|------|
| `BAD_REQUEST` | `"Cannot transfer ownership to yourself"` | component `organizations.ts` | `transferOwnership` where `newOwnerUserId === userId`. |
| `FORBIDDEN` | `"Only the current owner can transfer ownership"` | component `organizations.ts` | `transferOwnership` called by a non-owner. Also thrown by the `Tenants` class with a plain `Error`. |
| `NOT_FOUND` | `"New owner must already be a member of the organization"` | component `organizations.ts` | `transferOwnership` where the target user is not a member. |

### Member operations

| Code | Error Message | Source | When |
|------|---------------|--------|------|
| `ALREADY_EXISTS` | `"User is already a member of this organization"` | component `members.ts` | `addMember` for a user who is already a member. Also returned per-item in `bulkAddMembers` errors array. |
| `NOT_FOUND` | `"Member not found"` | component `members.ts` | `removeMember`, `updateMemberRole`, `suspendMember`, or `unsuspendMember` targeting a nonexistent member. Also returned per-item in `bulkRemoveMembers` errors array. |
| `FORBIDDEN` | `"Cannot remove the organization owner. Transfer ownership first."` | component `members.ts` | `removeMember` or `bulkRemoveMembers` targeting the structural owner. |
| `FORBIDDEN` | `"Cannot suspend the organization owner. Transfer ownership first."` | component `members.ts` | `suspendMember` targeting the structural owner. |
| `FORBIDDEN` | `"Cannot leave organization as the owner. Transfer ownership or delete the organization first."` | component `members.ts` | `leaveOrganization` called by the structural owner. |
| `NOT_FOUND` | `"You are not a member of this organization"` | component `members.ts` | `leaveOrganization` called by a non-member. |
| -- | `"Not a member of this organization"` | `Tenants` class | `leaveOrganization` when the `Tenants` class pre-checks membership. |
| -- | `"Cannot leave: you are the last owner. Transfer ownership first."` | `Tenants` class | `leaveOrganization` when the caller holds `creatorRole` and is the only one with that role. |
| -- | `"Maximum number of members (N) for this organization reached."` | `makeTenantsAPI` | `addMember` when the org has reached `maxMembers`. |
| -- | `"Adding these members would exceed the maximum (N). Current: M."` | `makeTenantsAPI` | `bulkAddMembers` when the batch would exceed `maxMembers`. |

### Team operations

| Code | Error Message | Source | When |
|------|---------------|--------|------|
| `NOT_FOUND` | `"Team not found"` | component `teams.ts` | `updateTeam`, `deleteTeam`, `addTeamMember`, `updateTeamMemberRole`, or `removeTeamMember` targeting a nonexistent team. Also thrown as plain `Error` from `makeTenantsAPI` and `Tenants` class. |
| `FORBIDDEN` | `"Not a member of this organization"` | component `teams.ts` | Team mutation called by a user who is not an org member (component-level check). |
| `FORBIDDEN` | `"User is not an active member of this organization"` | component `teams.ts` | `addTeamMember` when the target user is not an active org member (missing or suspended). |
| `FORBIDDEN` | `"Parent team must belong to the same organization"` | component `teams.ts` | `createTeam` or `updateTeam` with a `parentTeamId` from a different organization. |
| `NOT_FOUND` | `"Parent team not found"` | component `teams.ts` | `createTeam` or `updateTeam` with a nonexistent `parentTeamId`. |
| `ALREADY_EXISTS` | `"User is already a member of this team"` | component `teams.ts` | `addTeamMember` for a user already on the team. |
| `NOT_FOUND` | `"User is not a member of this team"` | component `teams.ts` | `removeTeamMember` or `updateTeamMemberRole` for a non-member. |
| `INVALID_ARGUMENT` | `"Team cannot be its own parent"` | component `teams.ts` | `updateTeam` setting `parentTeamId` to the team's own ID. |
| `INVALID_ARGUMENT` | `"Setting this parent would create a cycle in the team hierarchy"` | component `teams.ts` | `updateTeam` where the new parent is a descendant of the team (cycle detection). |
| -- | `"Maximum number of teams (N) for this organization reached."` | `makeTenantsAPI` | `createTeam` when the org has reached `maxTeams`. |

### Invitation operations

| Code | Error Message | Source | When |
|------|---------------|--------|------|
| `NOT_FOUND` | `"Invitation not found"` | component `invitations.ts` | `acceptInvitation`, `resendInvitation`, or `cancelInvitation` with an invalid ID. Also thrown as plain `Error` from `makeTenantsAPI` and `Tenants` class. |
| `NOT_FOUND` | `"Team not found"` | component `invitations.ts` | `inviteMember` or `bulkInviteMembers` referencing a nonexistent team. |
| `FORBIDDEN` | `"Team must belong to the invitation organization"` | component `invitations.ts` | `inviteMember` with a team from a different organization. |
| `ALREADY_EXISTS` | `"A pending invitation already exists for this identifier"` | component `invitations.ts` | `inviteMember` or `bulkInviteMembers` for an identifier that already has a pending invitation. |
| `ALREADY_EXISTS` | `"You are already a member of this organization"` | component `invitations.ts` | `acceptInvitation` when the accepting user is already an org member. |
| `INVALID_STATE` | `"Invitation has already been {status}"` | component `invitations.ts` | `acceptInvitation` or `cancelInvitation` for a non-pending invitation. |
| `INVALID_STATE` | `"Cannot resend {status} invitation"` | component `invitations.ts` | `resendInvitation` for a non-pending invitation. |
| `INVALID_STATE` | `"Invitation team is invalid for this organization"` | component `invitations.ts` | `acceptInvitation` when the invitation's team no longer exists or belongs to a different org. |
| `EXPIRED` | `"Invitation has expired"` | component `invitations.ts` | `acceptInvitation` for an expired invitation. |
| `EXPIRED` | `"Invitation has expired. Please create a new one."` | component `invitations.ts` | `resendInvitation` for an expired invitation. |

### Invitation validation

| Error Message | Source | When |
|---------------|--------|------|
| `"Invitation not allowed"` (or custom reason) | `makeTenantsAPI` | `inviteMember` when `validateInvitationCreate` returns `{ allowed: false }`. |
| `"You cannot accept this invitation"` (or custom reason) | `makeTenantsAPI` | `acceptInvitation` when `validateInvitationAccept` returns `{ allowed: false }`. |

### Invitation acceptance requirements

| Error Message | Source | When |
|---------------|--------|------|
| `"getUser callback is required for invitation acceptance"` | `makeTenantsAPI` | `acceptInvitation` called without a `getUser` option configured. |
| `"Authenticated user identifier is required for invitation acceptance"` | `makeTenantsAPI` | `acceptInvitation` when `getUser` returns a user with no `email` field. |
| `"getUser callback is required for getPendingInvitations"` | `makeTenantsAPI` | `getPendingInvitations` called without a `getUser` option configured. |
| `"Authenticated user identifier is required for getPendingInvitations"` | `makeTenantsAPI` | `getPendingInvitations` when `getUser` returns a user with no `email` field. |
| `"Cannot query invitations for another identifier"` | `makeTenantsAPI` | `getPendingInvitations` when the `identifier` arg does not match the authenticated user's email. |

### Permission scope

| Error Message | Source | When |
|---------------|--------|------|
| `"Permission scope organization mismatch"` | `Tenants` class | `grantPermission` or `denyPermission` with a scope whose `type` is `"organization"` but `id` does not match the `organizationId` arg. |
| `"Permission scope team must belong to organization"` | `Tenants` class | `grantPermission` or `denyPermission` with a team scope that does not belong to the target organization. |
| `"Unsupported permission scope type"` | `Tenants` class | `grantPermission` or `denyPermission` with a scope type other than `"organization"` or `"team"`. |

### Authorization (from `@djpanda/convex-authz`)

Permission checks are delegated to `authz.require()`. When a user lacks the required permission, the authz library throws its own error (typically `"Unauthorized"` or a `ConvexError` with details). See the [Permission Map](permission-map.md) for which permission guards each mutation.

---

## Catching errors on the client

### Mutations

Mutations return a promise. Catch errors with `try/catch` or `.catch()`:

```typescript
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function CreateOrgButton() {
  const createOrg = useMutation(api.tenants.createOrganization);

  async function handleCreate() {
    try {
      const orgId = await createOrg({ name: "Acme Corp" });
      // Success -- navigate to org
    } catch (error) {
      if (error instanceof Error) {
        // Plain Error from API layer
        console.error(error.message);
        // e.g. "Not authenticated", "Maximum number of organizations (3) reached."
      }
    }
  }

  return <button onClick={handleCreate}>Create Organization</button>;
}
```

### Extracting ConvexError data

Errors from the component layer are `ConvexError` instances with structured data:

```typescript
import { ConvexError } from "convex/values";

async function handleInvite() {
  try {
    await inviteMember({
      organizationId: orgId,
      inviteeIdentifier: "alice@example.com",
      role: "member",
    });
  } catch (error) {
    if (error instanceof ConvexError) {
      const data = error.data as { code: string; message: string };

      switch (data.code) {
        case "ALREADY_EXISTS":
          toast.warning("This person already has a pending invitation.");
          break;
        case "FORBIDDEN":
          toast.error("You do not have permission to send invitations.");
          break;
        case "NOT_FOUND":
          toast.error(data.message);
          break;
        default:
          toast.error(`Error: ${data.message}`);
      }
    } else if (error instanceof Error) {
      // Plain Error from the API layer
      toast.error(error.message);
    }
  }
}
```

### Queries

Queries do not throw in the traditional sense -- they are reactive subscriptions. Use the Convex `useQuery` error boundary or check the error state:

```typescript
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function MembersList({ organizationId }: { organizationId: string }) {
  const members = useQuery(api.tenants.listMembers, { organizationId });

  // `members` is undefined while loading, or the resolved value.
  // If the query throws (e.g. "Not a member"), it propagates to the
  // nearest ErrorBoundary in your React tree.

  if (members === undefined) return <Spinner />;
  return <ul>{members.map((m) => <li key={m._id}>{m.userId}</li>)}</ul>;
}
```

For queries that may fail due to permissions, wrap them in an error boundary:

```tsx
import { ErrorBoundary } from "react-error-boundary";

function SafeMembersList({ organizationId }: { organizationId: string }) {
  return (
    <ErrorBoundary fallback={<p>You do not have access to this resource.</p>}>
      <MembersList organizationId={organizationId} />
    </ErrorBoundary>
  );
}
```

> **Note:** `listMembers` and `listTeams` have special behavior -- when the user lacks the required permission (`members:list` or `teams:list`), they return an empty array instead of throwing. This prevents subscription crashes in the UI. Other queries (e.g., `getOrganization`) will throw if membership is missing.

---

## Error code reference

Summary of all structured error codes from the component layer:

| Code | Used By | Meaning |
|------|---------|---------|
| `NOT_FOUND` | organizations, members, teams, invitations | The requested resource does not exist. |
| `FORBIDDEN` | organizations, members, teams, invitations | The caller lacks permission or is trying a disallowed operation (e.g., removing the owner). |
| `ALREADY_EXISTS` | members, teams, invitations | A duplicate record would be created. |
| `BAD_REQUEST` | organizations | The request is semantically invalid (e.g., transferring ownership to yourself). |
| `INVALID_STATE` | invitations | The resource is in a state that does not allow the requested operation. |
| `INVALID_ARGUMENT` | teams | An argument value is logically invalid (e.g., circular parent reference). |
| `EXPIRED` | invitations | The invitation has passed its expiration time. |
| `VALIDATION` | `makeTenantsAPI` (bulk invitations) | A `validateInvitationCreate` callback rejected the invitation. Appears in the `errors` array of `bulkInviteMembers`. |
| `ERROR` | members (bulk operations) | An unexpected error occurred during a bulk operation item. |
