import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';

export type ContactSource = 'manual' | 'customer' | 'vendor' | 'employee' | 'other';

export interface Contact {
  id: string;
  organization_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  cell_phone: string | null;
  cell_phone_normalized: string | null;
  landline: string | null;
  landline_normalized: string | null;
  company: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  source: ContactSource;
  source_id: string | null;
  is_favorite: boolean;
  is_active: boolean;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateContactInput {
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  cell_phone?: string;
  landline?: string;
  company?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  notes?: string;
  is_favorite?: boolean;
  tags?: string[];
}

export interface UpdateContactInput extends Partial<CreateContactInput> {
  is_active?: boolean;
}

export function useContacts() {
  const { currentOrganization } = useOrganizationContext();
  const organizationId = currentOrganization?.id;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ContactSource | 'all'>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('communication_contacts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []).map(c => ({
        ...c,
        source: c.source as ContactSource,
      }));

      setContacts(typedData);
    } catch (err: any) {
      console.error('Error fetching contacts:', err);
      toast.error('Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  // Create contact
  const createContact = useCallback(async (input: CreateContactInput) => {
    if (!organizationId) {
      toast.error('No organization selected');
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('communication_contacts')
        .insert({
          organization_id: organizationId,
          name: input.name.trim(),
          first_name: input.first_name?.trim() || null,
          last_name: input.last_name?.trim() || null,
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          cell_phone: input.cell_phone?.trim() || null,
          landline: input.landline?.trim() || null,
          company: input.company?.trim() || null,
          address_line1: input.address_line1?.trim() || null,
          address_line2: input.address_line2?.trim() || null,
          city: input.city?.trim() || null,
          province: input.province?.trim() || null,
          postal_code: input.postal_code?.trim() || null,
          country: input.country?.trim() || null,
          notes: input.notes?.trim() || null,
          is_favorite: input.is_favorite || false,
          tags: input.tags || null,
          source: 'manual',
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Contact created successfully');
      await fetchContacts();
      return data as Contact;
    } catch (err: any) {
      console.error('Error creating contact:', err);
      toast.error('Failed to create contact');
      return null;
    }
  }, [organizationId, fetchContacts]);

  // Update contact
  const updateContact = useCallback(async (id: string, input: UpdateContactInput) => {
    try {
      const updateData: Record<string, any> = {};
      
      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.first_name !== undefined) updateData.first_name = input.first_name?.trim() || null;
      if (input.last_name !== undefined) updateData.last_name = input.last_name?.trim() || null;
      if (input.email !== undefined) updateData.email = input.email?.trim() || null;
      if (input.phone !== undefined) updateData.phone = input.phone?.trim() || null;
      if (input.cell_phone !== undefined) updateData.cell_phone = input.cell_phone?.trim() || null;
      if (input.landline !== undefined) updateData.landline = input.landline?.trim() || null;
      if (input.company !== undefined) updateData.company = input.company?.trim() || null;
      if (input.address_line1 !== undefined) updateData.address_line1 = input.address_line1?.trim() || null;
      if (input.address_line2 !== undefined) updateData.address_line2 = input.address_line2?.trim() || null;
      if (input.city !== undefined) updateData.city = input.city?.trim() || null;
      if (input.province !== undefined) updateData.province = input.province?.trim() || null;
      if (input.postal_code !== undefined) updateData.postal_code = input.postal_code?.trim() || null;
      if (input.country !== undefined) updateData.country = input.country?.trim() || null;
      if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;
      if (input.is_favorite !== undefined) updateData.is_favorite = input.is_favorite;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;
      if (input.tags !== undefined) updateData.tags = input.tags;

      const { error } = await supabase
        .from('communication_contacts')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Contact updated successfully');
      await fetchContacts();
      return true;
    } catch (err: any) {
      console.error('Error updating contact:', err);
      toast.error('Failed to update contact');
      return false;
    }
  }, [fetchContacts]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (id: string, isFavorite: boolean) => {
    try {
      const { error } = await supabase
        .from('communication_contacts')
        .update({ is_favorite: !isFavorite })
        .eq('id', id);

      if (error) throw error;

      setContacts(prev =>
        prev.map(c => c.id === id ? { ...c, is_favorite: !isFavorite } : c)
      );
    } catch (err: any) {
      console.error('Error toggling favorite:', err);
      toast.error('Failed to update favorite status');
    }
  }, []);

  // Delete contact (soft delete by setting is_active to false)
  const deleteContact = useCallback(async (id: string) => {
    try {
      // Check if it's a manual contact
      const contact = contacts.find(c => c.id === id);
      if (contact?.source !== 'manual') {
        toast.error('Cannot delete synced contacts. Remove the customer or vendor instead.');
        return false;
      }

      const { error } = await supabase
        .from('communication_contacts')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast.success('Contact deleted');
      await fetchContacts();
      return true;
    } catch (err: any) {
      console.error('Error deleting contact:', err);
      toast.error('Failed to delete contact');
      return false;
    }
  }, [contacts, fetchContacts]);

  // Find contact by identifier (phone or email)
  const findContactByIdentifier = useCallback((identifier: string): Contact | undefined => {
    const normalized = identifier.replace(/[^\d+]/g, '');
    return contacts.find(c => 
      c.phone_normalized === normalized || 
      c.email?.toLowerCase() === identifier.toLowerCase()
    );
  }, [contacts]);

  // Filtered contacts
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery) ||
      c.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSource = sourceFilter === 'all' || c.source === sourceFilter;
    const matchesFavorite = !showFavoritesOnly || c.is_favorite;

    return matchesSearch && matchesSource && matchesFavorite;
  });

  // Initial fetch
  useEffect(() => {
    if (organizationId) {
      fetchContacts();
    }
  }, [organizationId, fetchContacts]);

  return {
    contacts,
    filteredContacts,
    isLoading,
    searchQuery,
    setSearchQuery,
    sourceFilter,
    setSourceFilter,
    showFavoritesOnly,
    setShowFavoritesOnly,
    fetchContacts,
    createContact,
    updateContact,
    toggleFavorite,
    deleteContact,
    findContactByIdentifier,
  };
}
