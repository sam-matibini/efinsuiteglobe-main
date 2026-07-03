/**
 * Template Resolution Engine
 * Resolves the appropriate template based on hierarchy: Base → Country → Organization
 */

import { supabase } from '@/integrations/supabase/client';
import type { PrintTemplate, PrintDocumentType, Orientation, PrintMargins, NumberFormatConfig } from './types';
import type { Json } from '@/integrations/supabase/types';

interface TemplateResolutionResult {
  template: PrintTemplate | null;
  hierarchy: ('base' | 'country' | 'organization')[];
  resolvedFrom: 'base' | 'country' | 'organization' | null;
}

// Helper to safely cast JSONB to typed objects
function asRecord(val: Json | null | undefined): Record<string, unknown> {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function asStringArray(val: Json | null | undefined): string[] {
  if (Array.isArray(val)) {
    return val.filter((v): v is string => typeof v === 'string');
  }
  return [];
}

function asMargins(val: Json | null | undefined): PrintMargins {
  const defaults: PrintMargins = { top: 20, right: 20, bottom: 30, left: 20 };
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    return {
      top: typeof obj.top === 'number' ? obj.top : defaults.top,
      right: typeof obj.right === 'number' ? obj.right : defaults.right,
      bottom: typeof obj.bottom === 'number' ? obj.bottom : defaults.bottom,
      left: typeof obj.left === 'number' ? obj.left : defaults.left,
    };
  }
  return defaults;
}

function asNumberFormat(val: Json | null | undefined): NumberFormatConfig {
  const defaults: NumberFormatConfig = { decimal: '.', thousand: ',', precision: 2 };
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    return {
      decimal: typeof obj.decimal === 'string' ? obj.decimal : defaults.decimal,
      thousand: typeof obj.thousand === 'string' ? obj.thousand : defaults.thousand,
      precision: typeof obj.precision === 'number' ? obj.precision : defaults.precision,
    };
  }
  return defaults;
}

function asRegistrationFields(val: Json | null | undefined): { label: string; value: string }[] {
  if (Array.isArray(val)) {
    return val
      .filter((v): v is { label: string; value: string } => 
        typeof v === 'object' && v !== null && 'label' in v && 'value' in v)
      .map(v => ({ label: String(v.label), value: String(v.value) }));
  }
  return [];
}

/**
 * Resolve the most specific template for a document type
 * Resolution order: Organization → Country → Base
 */
export async function resolveTemplate(
  documentType: PrintDocumentType,
  organizationId?: string,
  countryId?: string,
  templateCode?: string
): Promise<TemplateResolutionResult> {
  const hierarchy: ('base' | 'country' | 'organization')[] = [];
  let resolvedFrom: 'base' | 'country' | 'organization' | null = null;
  
  // Try organization-specific template first
  if (organizationId) {
    const orgTemplate = await fetchTemplate(documentType, organizationId, undefined, templateCode);
    if (orgTemplate) {
      hierarchy.push('organization');
      resolvedFrom = 'organization';
      return { template: orgTemplate, hierarchy, resolvedFrom };
    }
  }
  
  // Try country-specific template
  if (countryId) {
    const countryTemplate = await fetchTemplate(documentType, undefined, countryId, templateCode);
    if (countryTemplate) {
      hierarchy.push('country');
      resolvedFrom = 'country';
      return { template: countryTemplate, hierarchy, resolvedFrom };
    }
  }
  
  // Fallback to base template
  const baseTemplate = await fetchTemplate(documentType, undefined, undefined, templateCode);
  if (baseTemplate) {
    hierarchy.push('base');
    resolvedFrom = 'base';
    return { template: baseTemplate, hierarchy, resolvedFrom };
  }
  
  return { template: null, hierarchy, resolvedFrom: null };
}

/**
 * Fetch a specific template from database
 */
async function fetchTemplate(
  documentType: PrintDocumentType,
  organizationId?: string,
  countryId?: string,
  templateCode?: string
): Promise<PrintTemplate | null> {
  let query = supabase
    .from('print_templates')
    .select('*')
    .eq('document_type', documentType)
    .eq('status', 'active')
    .order('version', { ascending: false })
    .limit(1);
  
  if (templateCode) {
    query = query.eq('code', templateCode);
  }
  
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  } else if (countryId) {
    query = query.eq('country_id', countryId).is('organization_id', null);
  } else {
    query = query.is('country_id', null).is('organization_id', null);
  }
  
  const { data, error } = await query;
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  const row = data[0];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    documentType: row.document_type as PrintDocumentType,
    parentTemplateId: row.parent_template_id ?? undefined,
    countryId: row.country_id ?? undefined,
    organizationId: row.organization_id ?? undefined,
    headerTemplate: asRecord(row.header_template),
    bodyTemplate: asRecord(row.body_template),
    footerTemplate: asRecord(row.footer_template),
    styles: asRecord(row.styles),
    paperSize: row.paper_size || 'letter',
    orientation: (row.orientation as Orientation) || 'portrait',
    margins: asMargins(row.margins),
    defaultLanguage: row.default_language || 'en',
    dateFormat: row.date_format || 'YYYY-MM-DD',
    numberFormat: asNumberFormat(row.number_format),
    legalDisclosures: asStringArray(row.legal_disclosures),
    requiredFootnotes: asStringArray(row.required_footnotes),
    registrationFields: asRegistrationFields(row.registration_fields),
    version: row.version,
    effectiveDate: row.effective_date,
    status: row.status as 'draft' | 'active' | 'archived',
  };
}

/**
 * Merge parent template with child overrides
 */
export function mergeTemplates(
  parent: PrintTemplate,
  child: Partial<PrintTemplate>
): PrintTemplate {
  return {
    ...parent,
    ...child,
    headerTemplate: { ...parent.headerTemplate, ...child.headerTemplate },
    bodyTemplate: { ...parent.bodyTemplate, ...child.bodyTemplate },
    footerTemplate: { ...parent.footerTemplate, ...child.footerTemplate },
    styles: { ...parent.styles, ...child.styles },
    margins: { ...parent.margins, ...child.margins },
    numberFormat: { ...parent.numberFormat, ...child.numberFormat },
    legalDisclosures: [...(child.legalDisclosures || parent.legalDisclosures)],
    requiredFootnotes: [...(child.requiredFootnotes || parent.requiredFootnotes)],
    registrationFields: [...(child.registrationFields || parent.registrationFields)],
  };
}

/**
 * Get all available templates for a document type
 */
export async function getAvailableTemplates(
  documentType: PrintDocumentType,
  _organizationId?: string
): Promise<{ code: string; name: string; scope: string }[]> {
  const { data, error } = await supabase
    .from('print_templates')
    .select('code, name, organization_id, country_id')
    .eq('document_type', documentType)
    .eq('status', 'active');
  
  if (error || !data) {
    return [];
  }
  
  return data.map(t => ({
    code: t.code,
    name: t.name,
    scope: t.organization_id ? 'Organization' : t.country_id ? 'Country' : 'Base',
  }));
}

/**
 * Create or update a template
 */
export async function saveTemplate(
  template: Partial<PrintTemplate> & { code: string; documentType: PrintDocumentType }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const payload = {
    code: template.code,
    name: template.name || template.code,
    document_type: template.documentType,
    parent_template_id: template.parentTemplateId || null,
    country_id: template.countryId || null,
    organization_id: template.organizationId || null,
    header_template: (template.headerTemplate || {}) as Json,
    body_template: (template.bodyTemplate || {}) as Json,
    footer_template: (template.footerTemplate || {}) as Json,
    styles: (template.styles || {}) as Json,
    paper_size: template.paperSize || 'letter',
    orientation: template.orientation || 'portrait',
    margins: (template.margins || { top: 20, right: 20, bottom: 30, left: 20 }) as unknown as Json,
    default_language: template.defaultLanguage || 'en',
    date_format: template.dateFormat || 'YYYY-MM-DD',
    number_format: (template.numberFormat || { decimal: '.', thousand: ',', precision: 2 }) as unknown as Json,
    legal_disclosures: (template.legalDisclosures || []) as Json,
    required_footnotes: (template.requiredFootnotes || []) as Json,
    registration_fields: (template.registrationFields || []) as Json,
    version: template.version || 1,
    effective_date: template.effectiveDate || new Date().toISOString().split('T')[0],
    status: template.status || 'active',
  };
  
  if (template.id) {
    const { error } = await supabase
      .from('print_templates')
      .update(payload)
      .eq('id', template.id);
    
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, id: template.id };
  } else {
    const { data, error } = await supabase
      .from('print_templates')
      .insert(payload)
      .select('id')
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  }
}
