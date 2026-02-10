// Providers
export {
  TenantsProvider,
  useTenants,
  TenantsContext,
  type TenantsProviderProps,
  type TenantsAPI,
  type TenantsContextValue,
  type Organization as ProviderOrganization,
  type Member as ProviderMember,
  type Invitation as ProviderInvitation,
  type Team as ProviderTeam,
} from "./providers/index.js";

// Hooks
export {
  useOrganization,
  useMembers,
  useInvitations,
  useTeams,
  useInvitation,
  type UseOrganizationOptions,
  type UseMembersOptions,
  type UseInvitationsOptions,
  type UseTeamsOptions,
  type UseInvitationOptions,
  type Organization,
  type Member,
  type Invitation,
  type Team,
  type TeamMember,
  type InvitationWithOrg,
} from "./hooks/index.js";

// Stores
export { useOrganizationStore, configureOrganizationStore, type OrganizationStore } from "./stores/organization-store.js";

// Components
export {
  OrganizationSwitcher,
  InviteMemberDialog,
  CreateTeamDialog,
  MembersTable,
  TeamsGrid,
  AcceptInvitation,
  CreateOrganizationDialog,
  MembersSection,
  TeamsSection,
  type OrganizationSwitcherProps,
  type InviteMemberDialogProps,
  type CreateTeamDialogProps,
  type MembersTableProps,
  type FilterValue,
  type TeamsGridProps,
  type AcceptInvitationProps,
  type CreateOrganizationDialogProps,
  type MembersSectionProps,
  type TeamsSectionProps,
} from "./components/index.js";

// Utilities
export { cn, generateSlugFromName, formatDate, formatRelativeTime, getInvitationLink, copyToClipboard } from "./utils.js";
