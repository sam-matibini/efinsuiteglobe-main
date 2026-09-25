import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface CostCenter {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  parent_id: string | null;
  is_active: boolean;
  is_shared?: boolean;
  allow_postings?: boolean;
  division_type?: 'operating' | 'shared' | 'eliminating' | 'administration';
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  customer_id: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  status: string;
  is_billable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Fund {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  fund_type: string;
  restriction_level: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  province_state: string | null;
  country: string | null;
  postal_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Segment {
  id: string;
  organization_id: string;
  segment_type: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Cost Centers
export function useCostCenters() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cost-centers', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('cost_centers')
        .select('*')
        .eq('organization_id', organization.id)
        .order('code');
      if (error) throw error;
      return data as CostCenter[];
    },
    enabled: !!organization?.id
  });

  const createCostCenter = useMutation({
    mutationFn: async (input: Omit<CostCenter, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('cost_centers')
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success('Cost center created');
    }
  });

  const updateCostCenter = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CostCenter> & { id: string }) => {
      const { data, error } = await supabase
        .from('cost_centers')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success('Cost center updated');
    }
  });

  const deleteCostCenter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cost_centers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success('Cost center deleted');
    }
  });

  return { ...query, createCostCenter, updateCostCenter, deleteCostCenter };
}

// Departments
export function useDepartments() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['departments', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', organization.id)
        .order('code');
      if (error) throw error;
      return data as Department[];
    },
    enabled: !!organization?.id
  });

  const createDepartment = useMutation({
    mutationFn: async (input: Omit<Department, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('departments')
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department created');
    }
  });

  const updateDepartment = useMutation({
    mutationFn: async ({ id, ...input }: Partial<Department> & { id: string }) => {
      const { data, error } = await supabase
        .from('departments')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department updated');
    }
  });

  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department deleted');
    }
  });

  return { ...query, createDepartment, updateDepartment, deleteDepartment };
}

// Projects
export function useProjects() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['projects', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', organization.id)
        .order('code');
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!organization?.id
  });

  const createProject = useMutation({
    mutationFn: async (input: Omit<Project, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('projects')
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
    }
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...input }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
    }
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    }
  });

  return { ...query, createProject, updateProject, deleteProject };
}

// Funds
export function useFunds() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['funds', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('funds')
        .select('*')
        .eq('organization_id', organization.id)
        .order('code');
      if (error) throw error;
      return data as Fund[];
    },
    enabled: !!organization?.id
  });

  const createFund = useMutation({
    mutationFn: async (input: Omit<Fund, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('funds')
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funds'] });
      toast.success('Fund created');
    }
  });

  const updateFund = useMutation({
    mutationFn: async ({ id, ...input }: Partial<Fund> & { id: string }) => {
      const { data, error } = await supabase
        .from('funds')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funds'] });
      toast.success('Fund updated');
    }
  });

  const deleteFund = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('funds').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funds'] });
      toast.success('Fund deleted');
    }
  });

  return { ...query, createFund, updateFund, deleteFund };
}

// Locations
export function useLocations() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['locations', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('organization_id', organization.id)
        .order('code');
      if (error) throw error;
      return data as Location[];
    },
    enabled: !!organization?.id
  });

  const createLocation = useMutation({
    mutationFn: async (input: Omit<Location, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('locations')
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Location created');
    }
  });

  const updateLocation = useMutation({
    mutationFn: async ({ id, ...input }: Partial<Location> & { id: string }) => {
      const { data, error } = await supabase
        .from('locations')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Location updated');
    }
  });

  const deleteLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Location deleted');
    }
  });

  return { ...query, createLocation, updateLocation, deleteLocation };
}

// Segments
export function useSegments() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['segments', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('segments')
        .select('*')
        .eq('organization_id', organization.id)
        .order('segment_type', { ascending: true })
        .order('code', { ascending: true });
      if (error) throw error;
      return data as Segment[];
    },
    enabled: !!organization?.id
  });

  const createSegment = useMutation({
    mutationFn: async (input: Omit<Segment, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('segments')
        .insert({ ...input, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      toast.success('Segment created');
    }
  });

  const updateSegment = useMutation({
    mutationFn: async ({ id, ...input }: Partial<Segment> & { id: string }) => {
      const { data, error } = await supabase
        .from('segments')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      toast.success('Segment updated');
    }
  });

  const deleteSegment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('segments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      toast.success('Segment deleted');
    }
  });

  return { ...query, createSegment, updateSegment, deleteSegment };
}
