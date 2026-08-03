import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { useUserOrganizations, Organization } from './useOrganization';
import { useQueryClient } from '@tanstack/react-query';
import { useCountryScope, normalizeCountryCode } from './useCountryFilter';

interface OrganizationContextType {
  currentOrganization: Organization | null;
  /** Organizations for the currently scoped country (or all if no scope yet). */
  organizations: Organization[];
  /** Unfiltered list — every org the user has access to across all countries. */
  allOrganizations: Organization[];
  isLoading: boolean;
  switchOrganization: (org: Organization) => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const STORAGE_KEY = 'current_organization_id';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { data: allOrganizations = [], isLoading } = useUserOrganizations();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const queryClient = useQueryClient();
  const { country: scopedCountry, setCountry: setScopedCountry } = useCountryScope();

  // Organizations restricted to the currently scoped country.
  const organizations = useMemo(() => {
    if (!scopedCountry) return allOrganizations;
    return allOrganizations.filter(
      (o) => normalizeCountryCode(o.country) === scopedCountry
    );
  }, [allOrganizations, scopedCountry]);

  // 1) Restore current organization from localStorage or first available.
  useEffect(() => {
    if (allOrganizations.length === 0) return;
    if (currentOrganization) return;
    const savedOrgId = localStorage.getItem(STORAGE_KEY);
    const savedOrg = savedOrgId
      ? allOrganizations.find((o) => o.id === savedOrgId)
      : null;
    setCurrentOrganization(savedOrg || allOrganizations[0]);
  }, [allOrganizations, currentOrganization]);

  // 2) Auto-derive scope from the current org when unset.
  useEffect(() => {
    if (scopedCountry) return;
    if (!currentOrganization) return;
    const code = normalizeCountryCode(currentOrganization.country);
    if (code) setScopedCountry(code);
  }, [scopedCountry, currentOrganization, setScopedCountry]);

  // 3) When scope changes and current org falls outside it, auto-switch
  //    to the first in-scope org so we never show cross-country data.
  useEffect(() => {
    if (!scopedCountry) return;
    if (organizations.length === 0) return;
    const currentInScope =
      currentOrganization &&
      normalizeCountryCode(currentOrganization.country) === scopedCountry;
    if (currentInScope) return;
    const next = organizations[0];
    setCurrentOrganization(next);
    localStorage.setItem(STORAGE_KEY, next.id);
    void queryClient.invalidateQueries();
  }, [scopedCountry, organizations, currentOrganization, queryClient]);

  const switchOrganization = useCallback((org: Organization) => {
    setCurrentOrganization(org);
    localStorage.setItem(STORAGE_KEY, org.id);
    // Keep the country scope in sync with the org the user picked.
    const code = normalizeCountryCode(org.country);
    if (code && code !== scopedCountry) setScopedCountry(code);
    // Invalidate all queries so org-scoped data refetches without tearing down the app.
    void queryClient.invalidateQueries();
  }, [queryClient, scopedCountry, setScopedCountry]);

  return (
    <OrganizationContext.Provider value={{
      currentOrganization,
      organizations,
      allOrganizations,
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
      allOrganizations: [],
      isLoading: true,
      switchOrganization: () => {},
    } as OrganizationContextType;
  }
  return context;
}
