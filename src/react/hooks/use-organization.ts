import { useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useOrganizationStore } from "../stores/organization-store.js";

// Type for organization from the component
export interface Organization {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  logo: string | null;
  metadata?: any;
  ownerId: string;
  role: string;
}

export interface UseOrganizationOptions {
  /**
   * Query function reference to get user's organizations
   * Example: api.tenants.myOrganizations
   */
  listOrganizationsQuery: FunctionReference<"query", "public", Record<string, never>, Organization[]>;
  
  /**
   * Mutation function reference to create a new organization
   * Example: api.tenants.createOrganization
   */
  createOrganizationMutation: FunctionReference<
    "mutation",
    "public",
    { name: string; slug: string; logo?: string; metadata?: any },
    string
  >;
}

export function useOrganization(options: UseOrganizationOptions) {
  const { listOrganizationsQuery, createOrganizationMutation } = options;
  const { activeOrganizationId, setActiveOrganizationId } = useOrganizationStore();
  
  // Get user's organizations
  const organizationsRaw = useQuery(listOrganizationsQuery);
  const organizations = useMemo(() => organizationsRaw ?? [], [organizationsRaw]);
  
  // Create organization mutation
  const createOrgMutation = useMutation(createOrganizationMutation);
  
  // Get the current active organization
  const currentOrganization = useMemo(() => {
    if (activeOrganizationId) {
      const org = organizations.find((org) => org._id === activeOrganizationId);
      if (org) return org;
    }
    return organizations[0] || null;
  }, [organizations, activeOrganizationId]);

  // Sync local storage when organizations load
  useEffect(() => {
    if (organizations.length > 0 && !activeOrganizationId) {
      // Only one org, set it as active
      if (organizations.length === 1) {
        setActiveOrganizationId(organizations[0]._id);
      }
    }
  }, [organizations, activeOrganizationId, setActiveOrganizationId]);

  // Switch to a different organization
  const switchOrganization = useCallback(
    (organizationId: string) => {
      setActiveOrganizationId(organizationId);
    },
    [setActiveOrganizationId]
  );

  // Create a new organization
  const createOrganization = useCallback(
    async (data: { name: string; slug: string; logo?: string; metadata?: any }) => {
      try {
        const organizationId = await createOrgMutation(data);
        // Immediately set the new organization as active
        if (organizationId) {
          setActiveOrganizationId(organizationId);
        }
        return { organizationId };
      } catch (error) {
        console.error("Failed to create organization:", error);
        throw error;
      }
    },
    [createOrgMutation, setActiveOrganizationId]
  );

  // Current user's role in the active organization
  const currentRole = useMemo(() => {
    return currentOrganization?.role ?? null;
  }, [currentOrganization]);

  return {
    // Organizations data
    organizations,
    currentOrganization,
    
    // Loading state
    isLoading: organizations === undefined,
    
    // Organization actions
    switchOrganization,
    createOrganization,
    
    // Role (developer compares against their own role names)
    currentRole,
    
    // Helper flags
    hasOrganizations: organizations.length > 0,
    organizationCount: organizations.length,
  };
}
