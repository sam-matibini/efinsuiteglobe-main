/**
 * Loads Nigerian tax definitions and their currently-effective rate versions.
 *
 * All calculators MUST resolve rates through this module. Never hard-code a
 * Nigerian tax rate at the call site — if the Finance Act changes a rate, we
 * only update `ng_tax_rate_versions` and every consumer picks it up.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  NgTaxDefinition,
  NgTaxRateVersion,
  NgServiceClassification,
  NgTaxRelief,
} from './types';

export interface ResolvedTax {
  definition: NgTaxDefinition;
  version: NgTaxRateVersion;
}

/**
 * Resolve a tax by code, returning the version whose effective window covers `asOf`.
 * Falls back to the global (organization_id IS NULL) definition when the org
 * has no override.
 */
export async function resolveTaxByCode(
  code: string,
  asOf: string,
  organizationId: string | null,
): Promise<ResolvedTax | null> {
  const query = supabase
    .from('ng_tax_definitions')
    .select('*')
    .eq('code', code)
    .eq('is_active', true);

  const { data: defs, error: defErr } = organizationId
    ? await query.or(`organization_id.eq.${organizationId},organization_id.is.null`)
    : await query.is('organization_id', null);
  if (defErr || !defs?.length) return null;
  // Prefer org-specific override
  const definition = (defs.find((d) => d.organization_id === organizationId) ?? defs[0]) as NgTaxDefinition;

  const { data: versions } = await supabase
    .from('ng_tax_rate_versions')
    .select('*')
    .eq('definition_id', definition.id)
    .eq('is_active', true)
    .lte('effective_from', asOf)
    .order('effective_from', { ascending: false });
  const version = (versions ?? []).find(
    (v: any) => v.effective_to == null || v.effective_to >= asOf,
  ) as unknown as NgTaxRateVersion | undefined;
  if (!version) return null;
  return { definition, version };
}

export async function resolveServiceClassification(
  code: string,
  asOf: string,
  organizationId: string | null,
): Promise<NgServiceClassification | null> {
  const q = supabase
    .from('ng_tax_service_classifications')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .lte('effective_from', asOf);
  const { data } = organizationId
    ? await q.or(`organization_id.eq.${organizationId},organization_id.is.null`)
    : await q.is('organization_id', null);
  const row = (data ?? []).find((r: any) => !r.effective_to || r.effective_to >= asOf);
  return (row ?? null) as NgServiceClassification | null;
}

export async function loadReliefs(
  asOf: string,
  organizationId: string | null,
): Promise<NgTaxRelief[]> {
  const q = supabase
    .from('ng_tax_reliefs')
    .select('*')
    .eq('is_active', true)
    .lte('effective_from', asOf);
  const { data } = organizationId
    ? await q.or(`organization_id.eq.${organizationId},organization_id.is.null`)
    : await q.is('organization_id', null);
  return ((data ?? []).filter((r: any) => !r.effective_to || r.effective_to >= asOf)) as NgTaxRelief[];
}
