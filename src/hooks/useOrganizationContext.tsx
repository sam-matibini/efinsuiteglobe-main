import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUserOrganizations, Organization } from './useOrganization';
import { useQueryClient } from '@tanstack/react-query';

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  switchOrganization: (org: Organization) => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const STORAGE_KEY = 'current_organization_id';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { data: organizations = [], isLoading } = useUserOrganizations();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const queryClient = useQueryClient();

  // Restore organization from localStorage or select first one
  useEffect(() => {
    if (organizations.length > 0 && !currentOrganization) {
      const savedOrgId = localStorage.getItem(STORAGE_KEY);
      const savedOrg = savedOrgId 
        ? organizations.find(org => org.id === savedOrgId) 
        : null;
      setCurrentOrganization(savedOrg || organizations[0]);
    }
  }, [organizations, currentOrganization]);

  const switchOrganization = useCallback((org: Organization) => {
    // Clear all cached queries to prevent stale data leaking across orgs
    queryClient.clear();
    setCurrentOrganization(org);
    localStorage.setItem(STORAGE_KEY, org.id);
    // Navigate to the dashboard and refresh all data for new org context
    window.location.assign('/');
  }, [queryClient]);

  return (
    <OrganizationContext.Provider value={{
      currentOrganization,
      organizations,
      isLoading,
      switchOrganization,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    // Return a safe fallback during HMR or when rendered outside the provider transiently
    return {
      currentOrganization: null,
      organizations: [],
      isLoading: true,
      switchOrganization: () => {},
    } as OrganizationContextType;
  }
  return context;
}
