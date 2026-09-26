// ========================================================================
// Asset Repository
// Multi-Tenant PostgREST (Supabase) + In-Memory Fallback Data Access Layer
// Complete Persistence for Asset Master, Categories, Assignments, Movements,
// Maintenance, Disposals, and Dashboard Aggregations
// ========================================================================

import crypto from 'crypto';
import {
  Asset,
  AssetCategory,
  AssetSubcategory,
  AssetAssignment,
  AssetMovement,
  AssetMaintenance,
  AssetDisposal,
  AssetDocument,
  AssetDashboardMetrics,
  AssetStatus,
  AssetCondition,
  Location,
  User,
  InventoryVendor,
} from '../types/index.js';
import {
  getMemoryDbClient,
  getSupabaseClient,
  isSupabaseDatabaseActive,
} from '../db/client.js';

export class AssetRepository {
  private mem = getMemoryDbClient();

  // ======================================================================
  // 1. Categories & Subcategories
  // ======================================================================

  async getCategories(schoolId: string): Promise<AssetCategory[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_categories')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .order('name');
        if (!error && data && data.length > 0) return data as AssetCategory[];
      } catch (err) {
        console.warn('[AssetRepository.getCategories] Supabase fallback:', err);
      }
    }
    return this.mem.findAll('asset_categories', (c: AssetCategory) =>
      c.school_id === schoolId && !c.deleted_at
    ).sort((a: AssetCategory, b: AssetCategory) => a.name.localeCompare(b.name));
  }

  async getCategoryById(id: string, schoolId: string): Promise<AssetCategory | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_categories')
          .select('*')
          .eq('id', id)
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .single();
        if (!error && data) return data as AssetCategory;
      } catch (err) {
        console.warn('[AssetRepository.getCategoryById] Supabase fallback:', err);
      }
    }
    return this.mem.findOne('asset_categories', (c: AssetCategory) =>
      c.id === id && c.school_id === schoolId && !c.deleted_at
    ) || null;
  }

  async createCategory(cat: Omit<AssetCategory, 'id' | 'created_at' | 'updated_at'>): Promise<AssetCategory> {
    const record: AssetCategory = {
      ...cat,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_categories')
          .insert(record)
          .select()
          .single();
        if (!error && data) {
          this.mem.insert('asset_categories', data);
          return data as AssetCategory;
        }
      } catch (err) {
        console.warn('[AssetRepository.createCategory] Supabase fallback:', err);
      }
    }
    this.mem.insert('asset_categories', record);
    return record;
  }

  async updateCategory(id: string, schoolId: string, updates: Partial<AssetCategory>): Promise<AssetCategory | null> {
    const updatedRecord = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_categories')
          .update(updatedRecord)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) {
          this.mem.update('asset_categories', id, data);
          return data as AssetCategory;
        }
      } catch (err) {
        console.warn('[AssetRepository.updateCategory] Supabase fallback:', err);
      }
    }
    const current = this.mem.findOne('asset_categories', (c: AssetCategory) => c.id === id && c.school_id === schoolId);
    if (!current) return null;
    return this.mem.update('asset_categories', id, updatedRecord);
  }

  async deleteCategory(id: string, schoolId: string): Promise<boolean> {
    const now = new Date().toISOString();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('asset_categories')
          .update({ deleted_at: now, is_active: false })
          .eq('id', id)
          .eq('school_id', schoolId);
        if (!error) {
          this.mem.update('asset_categories', id, { deleted_at: now, is_active: false });
          return true;
        }
      } catch (err) {
        console.warn('[AssetRepository.deleteCategory] Supabase fallback:', err);
      }
    }
    const res = this.mem.update('asset_categories', id, { deleted_at: now, is_active: false });
    return !!res;
  }

  async getSubcategories(schoolId: string, categoryId?: string): Promise<AssetSubcategory[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('asset_subcategories')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null);
        if (categoryId) query = query.eq('category_id', categoryId);
        const { data, error } = await query.order('name');
        if (!error && data && data.length > 0) return data as AssetSubcategory[];
      } catch (err) {
        console.warn('[AssetRepository.getSubcategories] Supabase fallback:', err);
      }
    }
    return this.mem.findAll('asset_subcategories', (s: AssetSubcategory) => {
      if (s.school_id !== schoolId || s.deleted_at) return false;
      if (categoryId && s.category_id !== categoryId) return false;
      return true;
    }).sort((a: AssetSubcategory, b: AssetSubcategory) => a.name.localeCompare(b.name));
  }

  async createSubcategory(subcat: Omit<AssetSubcategory, 'id' | 'created_at' | 'updated_at'>): Promise<AssetSubcategory> {
    const record: AssetSubcategory = {
      ...subcat,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_subcategories')
          .insert(record)
          .select()
          .single();
        if (!error && data) {
          this.mem.insert('asset_subcategories', data);
          return data as AssetSubcategory;
        }
      } catch (err) {
        console.warn('[AssetRepository.createSubcategory] Supabase fallback:', err);
      }
    }
    this.mem.insert('asset_subcategories', record);
    return record;
  }

  async updateSubcategory(id: string, schoolId: string, updates: Partial<AssetSubcategory>): Promise<AssetSubcategory | null> {
    const updatedRecord = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_subcategories')
          .update(updatedRecord)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) {
          this.mem.update('asset_subcategories', id, data);
          return data as AssetSubcategory;
        }
      } catch (err) {
        console.warn('[AssetRepository.updateSubcategory] Supabase fallback:', err);
      }
    }
    const current = this.mem.findOne('asset_subcategories', (s: AssetSubcategory) => s.id === id && s.school_id === schoolId);
    if (!current) return null;
    return this.mem.update('asset_subcategories', id, updatedRecord);
  }

  async deleteSubcategory(id: string, schoolId: string): Promise<boolean> {
    const now = new Date().toISOString();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('asset_subcategories')
          .update({ deleted_at: now, is_active: false })
          .eq('id', id)
          .eq('school_id', schoolId);
        if (!error) {
          this.mem.update('asset_subcategories', id, { deleted_at: now, is_active: false });
          return true;
        }
      } catch (err) {
        console.warn('[AssetRepository.deleteSubcategory] Supabase fallback:', err);
      }
    }
    const res = this.mem.update('asset_subcategories', id, { deleted_at: now, is_active: false });
    return !!res;
  }

  // ======================================================================
  // 2. Assets Master
  // ======================================================================

  async getAssets(
    schoolId: string,
    filters?: {
      location_id?: string;
      category_id?: string;
      subcategory_id?: string;
      status?: AssetStatus;
      condition?: AssetCondition;
      custodian_id?: string;
      search?: string;
    }
  ): Promise<Asset[]> {
    let rawAssets: Asset[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('assets')
          .select(`
            *,
            category:asset_categories(*),
            subcategory:asset_subcategories(*),
            location:locations(*),
            custodian:users!assets_current_custodian_user_id_fkey(*),
            vendor:inventory_vendors(*)
          `)
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.location_id) query = query.eq('current_location_id', filters.location_id);
        if (filters?.category_id) query = query.eq('category_id', filters.category_id);
        if (filters?.subcategory_id) query = query.eq('subcategory_id', filters.subcategory_id);
        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.condition) query = query.eq('condition', filters.condition);
        if (filters?.custodian_id) query = query.eq('current_custodian_user_id', filters.custodian_id);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          rawAssets = data as Asset[];
        }
      } catch (err) {
        console.warn('[AssetRepository.getAssets] Supabase fallback:', err);
      }
    }

    if (rawAssets.length === 0) {
      const items = this.mem.findAll('assets', (a: any) => {
        if (a.school_id !== schoolId || a.deleted_at) return false;
        const locId = a.current_location_id || a.location_id;
        if (filters?.location_id && locId !== filters.location_id) return false;
        if (filters?.category_id && a.category_id !== filters.category_id) return false;
        if (filters?.subcategory_id && a.subcategory_id !== filters.subcategory_id) return false;
        if (filters?.status && a.status !== filters.status) return false;
        if (filters?.condition && a.condition !== filters.condition) return false;
        const custId = a.current_custodian_user_id || a.custodian_id;
        if (filters?.custodian_id && custId !== filters.custodian_id) return false;
        return true;
      });

      rawAssets = items.map((a: any) => this.hydrateAsset(a));
    }

    // Apply client-side / memory text search if provided
    if (filters?.search) {
      const term = filters.search.toLowerCase().trim();
      rawAssets = rawAssets.filter(a => {
        const name = (a.asset_name || (a as any).name || '').toLowerCase();
        const code = (a.asset_code || '').toLowerCase();
        const serial = (a.serial_number || '').toLowerCase();
        const barcode = (a.barcode || '').toLowerCase();
        const model = (a.model || (a as any).model_number || '').toLowerCase();
        const brand = (a.brand || '').toLowerCase();
        return name.includes(term) || code.includes(term) || serial.includes(term) || barcode.includes(term) || model.includes(term) || brand.includes(term);
      });
    }

    return rawAssets;
  }

  async getAssetById(id: string, schoolId: string): Promise<Asset | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('assets')
          .select(`
            *,
            category:asset_categories(*),
            subcategory:asset_subcategories(*),
            location:locations(*),
            custodian:users!assets_current_custodian_user_id_fkey(*),
            vendor:inventory_vendors(*)
          `)
          .eq('id', id)
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .single();

        if (!error && data) {
          const asset = data as Asset;
          // Hydrate assignments, movements, maintenance, disposal
          const [assignments, movements, maintenance, disposal] = await Promise.all([
            this.getAssignments(schoolId, asset.id),
            this.getMovements(schoolId, asset.id),
            this.getMaintenanceRecords(schoolId, asset.id),
            this.getDisposalForAsset(asset.id, schoolId),
          ]);
          asset.assignments = assignments;
          asset.active_assignment = assignments.find(a => a.is_active || !a.actual_return_date);
          asset.movements = movements;
          asset.maintenance_records = maintenance;
          asset.disposal = disposal || undefined;
          return asset;
        }
      } catch (err) {
        console.warn('[AssetRepository.getAssetById] Supabase fallback:', err);
      }
    }

    const raw = this.mem.findOne('assets', (a: any) => a.id === id && a.school_id === schoolId && !a.deleted_at);
    if (!raw) return null;
    const asset = this.hydrateAsset(raw);

    const [assignments, movements, maintenance, disposal] = await Promise.all([
      this.getAssignments(schoolId, asset.id),
      this.getMovements(schoolId, asset.id),
      this.getMaintenanceRecords(schoolId, asset.id),
      this.getDisposalForAsset(asset.id, schoolId),
    ]);
    asset.assignments = assignments;
    asset.active_assignment = assignments.find(a => a.is_active || !a.actual_return_date);
    asset.movements = movements;
    asset.maintenance_records = maintenance;
    asset.disposal = disposal || undefined;
    return asset;
  }

  async getAssetByCode(assetCode: string, schoolId: string): Promise<Asset | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('assets')
          .select('*')
          .eq('asset_code', assetCode)
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .single();
        if (!error && data) return this.hydrateAsset(data);
      } catch (err) {
        console.warn('[AssetRepository.getAssetByCode] Supabase fallback:', err);
      }
    }
    const raw = this.mem.findOne('assets', (a: any) => a.asset_code === assetCode && a.school_id === schoolId && !a.deleted_at);
    return raw ? this.hydrateAsset(raw) : null;
  }

  async countAssets(schoolId: string): Promise<number> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { count, error } = await getSupabaseClient()!
          .from('assets')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', schoolId);
        if (!error && count !== null) return count;
      } catch (err) {
        console.warn('[AssetRepository.countAssets] Supabase fallback:', err);
      }
    }
    return this.mem.findAll('assets', (a: any) => a.school_id === schoolId).length;
  }

  async createAsset(asset: Omit<Asset, 'id' | 'created_at' | 'updated_at'>): Promise<Asset> {
    const record: Asset = {
      ...asset,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        // Strip joined/hydrated sub-objects before DB insert
        const { category, subcategory, location, custodian, vendor, active_assignment, assignments, movements, maintenance_records, disposal, documents, ...dbRecord } = record as any;
        const { data, error } = await getSupabaseClient()!
          .from('assets')
          .insert(dbRecord)
          .select()
          .single();
        if (!error && data) {
          this.mem.insert('assets', data);
          return this.hydrateAsset(data);
        }
      } catch (err) {
        console.warn('[AssetRepository.createAsset] Supabase fallback:', err);
      }
    }

    this.mem.insert('assets', record);
    return this.hydrateAsset(record);
  }

  async updateAsset(id: string, schoolId: string, updates: Partial<Asset>): Promise<Asset | null> {
    const updatedRecord = { ...updates, updated_at: new Date().toISOString() };
    const { category, subcategory, location, custodian, vendor, active_assignment, assignments, movements, maintenance_records, disposal, documents, ...dbUpdates } = updatedRecord as any;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('assets')
          .update(dbUpdates)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) {
          this.mem.update('assets', id, data);
          return this.hydrateAsset(data);
        }
      } catch (err) {
        console.warn('[AssetRepository.updateAsset] Supabase fallback:', err);
      }
    }

    const current = this.mem.findOne('assets', (a: any) => a.id === id && a.school_id === schoolId);
    if (!current) return null;
    const res = this.mem.update('assets', id, dbUpdates);
    return this.hydrateAsset(res);
  }

  async deleteAsset(id: string, schoolId: string): Promise<boolean> {
    const now = new Date().toISOString();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('assets')
          .update({ deleted_at: now, status: 'RETIRED' })
          .eq('id', id)
          .eq('school_id', schoolId);
        if (!error) {
          this.mem.update('assets', id, { deleted_at: now, status: 'RETIRED' });
          return true;
        }
      } catch (err) {
        console.warn('[AssetRepository.deleteAsset] Supabase fallback:', err);
      }
    }
    const res = this.mem.update('assets', id, { deleted_at: now, status: 'RETIRED' });
    return !!res;
  }

  // ======================================================================
  // 3. Asset Assignments
  // ======================================================================

  async getAssignments(schoolId: string, assetId?: string, userId?: string): Promise<AssetAssignment[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('asset_assignments')
          .select(`
            *,
            asset:assets(*),
            assigned_to_user:users!asset_assignments_assigned_to_user_id_fkey(*),
            assigned_by_user:users!asset_assignments_assigned_by_fkey(*),
            returned_by_user:users!asset_assignments_returned_by_fkey(*),
            location:locations(*)
          `)
          .eq('school_id', schoolId);
        if (assetId) query = query.eq('asset_id', assetId);
        if (userId) query = query.eq('assigned_to_user_id', userId);
        const { data, error } = await query.order('assignment_date', { ascending: false });
        if (!error && data && data.length > 0) return data as AssetAssignment[];
      } catch (err) {
        console.warn('[AssetRepository.getAssignments] Supabase fallback:', err);
      }
    }

    return this.mem.findAll('asset_assignments', (a: any) => {
      if (a.school_id !== schoolId) return false;
      if (assetId && a.asset_id !== assetId) return false;
      const uid = a.assigned_to_user_id || a.user_id;
      if (userId && uid !== userId) return false;
      return true;
    }).map((a: any) => this.hydrateAssignment(a)).sort((a: AssetAssignment, b: AssetAssignment) =>
      new Date(b.assignment_date).getTime() - new Date(a.assignment_date).getTime()
    );
  }

  async getAssignmentById(id: string, schoolId: string): Promise<AssetAssignment | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_assignments')
          .select('*')
          .eq('id', id)
          .eq('school_id', schoolId)
          .single();
        if (!error && data) return this.hydrateAssignment(data);
      } catch (err) {
        console.warn('[AssetRepository.getAssignmentById] Supabase fallback:', err);
      }
    }
    const raw = this.mem.findOne('asset_assignments', (a: any) => a.id === id && a.school_id === schoolId);
    return raw ? this.hydrateAssignment(raw) : null;
  }

  async createAssignment(assignment: Omit<AssetAssignment, 'id' | 'created_at' | 'updated_at'>): Promise<AssetAssignment> {
    const record: AssetAssignment = {
      ...assignment,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { asset, assigned_to_user, assigned_by_user, returned_by_user, location, ...dbRecord } = record as any;
        const { data, error } = await getSupabaseClient()!
          .from('asset_assignments')
          .insert(dbRecord)
          .select()
          .single();
        if (!error && data) {
          this.mem.insert('asset_assignments', data);
          return this.hydrateAssignment(data);
        }
      } catch (err) {
        console.warn('[AssetRepository.createAssignment] Supabase fallback:', err);
      }
    }

    this.mem.insert('asset_assignments', record);
    return this.hydrateAssignment(record);
  }

  async returnAssignment(
    id: string,
    schoolId: string,
    returnData: {
      actual_return_date: string;
      condition_at_return: AssetCondition;
      returned_by?: string;
      remarks?: string;
    }
  ): Promise<AssetAssignment | null> {
    const updates = {
      ...returnData,
      is_active: false,
      status: 'RETURNED',
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_assignments')
          .update(updates)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) {
          this.mem.update('asset_assignments', id, data);
          return this.hydrateAssignment(data);
        }
      } catch (err) {
        console.warn('[AssetRepository.returnAssignment] Supabase fallback:', err);
      }
    }

    const current = this.mem.findOne('asset_assignments', (a: any) => a.id === id && a.school_id === schoolId);
    if (!current) return null;
    const res = this.mem.update('asset_assignments', id, updates);
    return this.hydrateAssignment(res);
  }

  // ======================================================================
  // 4. Asset Movements
  // ======================================================================

  async getMovements(schoolId: string, assetId?: string): Promise<AssetMovement[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('asset_movements')
          .select(`
            *,
            asset:assets(*),
            from_location:locations!asset_movements_from_location_id_fkey(*),
            to_location:locations!asset_movements_to_location_id_fkey(*),
            from_user:users!asset_movements_from_user_id_fkey(*),
            to_user:users!asset_movements_to_user_id_fkey(*),
            moved_by_user:users!asset_movements_moved_by_fkey(*)
          `)
          .eq('school_id', schoolId);
        if (assetId) query = query.eq('asset_id', assetId);
        const { data, error } = await query.order('movement_date', { ascending: false });
        if (!error && data && data.length > 0) return data as AssetMovement[];
      } catch (err) {
        console.warn('[AssetRepository.getMovements] Supabase fallback:', err);
      }
    }

    return this.mem.findAll('asset_movements', (m: any) => {
      if (m.school_id !== schoolId) return false;
      if (assetId && m.asset_id !== assetId) return false;
      return true;
    }).map((m: any) => this.hydrateMovement(m)).sort((a: AssetMovement, b: AssetMovement) =>
      new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime()
    );
  }

  async createMovement(movement: Omit<AssetMovement, 'id' | 'created_at'>): Promise<AssetMovement> {
    const record: AssetMovement = {
      ...movement,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { asset, from_location, to_location, from_user, to_user, moved_by_user, ...dbRecord } = record as any;
        const { data, error } = await getSupabaseClient()!
          .from('asset_movements')
          .insert(dbRecord)
          .select()
          .single();
        if (!error && data) {
          this.mem.insert('asset_movements', data);
          return this.hydrateMovement(data);
        }
      } catch (err) {
        console.warn('[AssetRepository.createMovement] Supabase fallback:', err);
      }
    }

    this.mem.insert('asset_movements', record);
    return this.hydrateMovement(record);
  }

  // ======================================================================
  // 5. Asset Maintenance
  // ======================================================================

  async getMaintenanceRecords(schoolId: string, assetId?: string, status?: string): Promise<AssetMaintenance[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('asset_maintenance')
          .select(`
            *,
            asset:assets(*),
            vendor:inventory_vendors(*),
            created_by_user:users!asset_maintenance_created_by_fkey(*)
          `)
          .eq('school_id', schoolId);
        if (assetId) query = query.eq('asset_id', assetId);
        if (status) query = query.eq('status', status);
        const { data, error } = await query.order('service_date', { ascending: false });
        if (!error && data && data.length > 0) return data as AssetMaintenance[];
      } catch (err) {
        console.warn('[AssetRepository.getMaintenanceRecords] Supabase fallback:', err);
      }
    }

    return this.mem.findAll('asset_maintenance', (m: any) => {
      if (m.school_id !== schoolId) return false;
      if (assetId && m.asset_id !== assetId) return false;
      if (status && m.status !== status) return false;
      return true;
    }).map((m: any) => this.hydrateMaintenance(m)).sort((a: AssetMaintenance, b: AssetMaintenance) =>
      new Date(b.service_date).getTime() - new Date(a.service_date).getTime()
    );
  }

  async getMaintenanceById(id: string, schoolId: string): Promise<AssetMaintenance | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_maintenance')
          .select('*')
          .eq('id', id)
          .eq('school_id', schoolId)
          .single();
        if (!error && data) return this.hydrateMaintenance(data);
      } catch (err) {
        console.warn('[AssetRepository.getMaintenanceById] Supabase fallback:', err);
      }
    }
    const raw = this.mem.findOne('asset_maintenance', (m: any) => m.id === id && m.school_id === schoolId);
    return raw ? this.hydrateMaintenance(raw) : null;
  }

  async createMaintenanceRecord(maint: Omit<AssetMaintenance, 'id' | 'created_at' | 'updated_at'>): Promise<AssetMaintenance> {
    const record: AssetMaintenance = {
      ...maint,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { asset, vendor, created_by_user, ...dbRecord } = record as any;
        const { data, error } = await getSupabaseClient()!
          .from('asset_maintenance')
          .insert(dbRecord)
          .select()
          .single();
        if (!error && data) {
          this.mem.insert('asset_maintenance', data);
          return this.hydrateMaintenance(data);
        }
      } catch (err) {
        console.warn('[AssetRepository.createMaintenanceRecord] Supabase fallback:', err);
      }
    }

    this.mem.insert('asset_maintenance', record);
    return this.hydrateMaintenance(record);
  }

  async updateMaintenanceRecord(id: string, schoolId: string, updates: Partial<AssetMaintenance>): Promise<AssetMaintenance | null> {
    const updatedRecord = { ...updates, updated_at: new Date().toISOString() };
    const { asset, vendor, created_by_user, ...dbUpdates } = updatedRecord as any;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_maintenance')
          .update(dbUpdates)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) {
          this.mem.update('asset_maintenance', id, data);
          return this.hydrateMaintenance(data);
        }
      } catch (err) {
        console.warn('[AssetRepository.updateMaintenanceRecord] Supabase fallback:', err);
      }
    }

    const current = this.mem.findOne('asset_maintenance', (m: any) => m.id === id && m.school_id === schoolId);
    if (!current) return null;
    const res = this.mem.update('asset_maintenance', id, dbUpdates);
    return this.hydrateMaintenance(res);
  }

  // ======================================================================
  // 6. Asset Disposals
  // ======================================================================

  async getDisposals(schoolId: string): Promise<AssetDisposal[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_disposals')
          .select(`
            *,
            asset:assets(*),
            approved_by_user:users!asset_disposals_approved_by_fkey(*),
            created_by_user:users!asset_disposals_created_by_fkey(*)
          `)
          .eq('school_id', schoolId)
          .order('disposal_date', { ascending: false });
        if (!error && data && data.length > 0) return data as AssetDisposal[];
      } catch (err) {
        console.warn('[AssetRepository.getDisposals] Supabase fallback:', err);
      }
    }

    return this.mem.findAll('asset_disposals', (d: any) => d.school_id === schoolId)
      .map((d: any) => this.hydrateDisposal(d))
      .sort((a: AssetDisposal, b: AssetDisposal) =>
        new Date(b.disposal_date).getTime() - new Date(a.disposal_date).getTime()
      );
  }

  async getDisposalForAsset(assetId: string, schoolId: string): Promise<AssetDisposal | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('asset_disposals')
          .select('*')
          .eq('asset_id', assetId)
          .eq('school_id', schoolId)
          .single();
        if (!error && data) return this.hydrateDisposal(data);
      } catch (err) {
        console.warn('[AssetRepository.getDisposalForAsset] Supabase fallback:', err);
      }
    }
    const raw = this.mem.findOne('asset_disposals', (d: any) => d.asset_id === assetId && d.school_id === schoolId);
    return raw ? this.hydrateDisposal(raw) : null;
  }

  async createDisposal(disposal: Omit<AssetDisposal, 'id' | 'created_at'>): Promise<AssetDisposal> {
    const record: AssetDisposal = {
      ...disposal,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { asset, approved_by_user, created_by_user, ...dbRecord } = record as any;
        const { data, error } = await getSupabaseClient()!
          .from('asset_disposals')
          .insert(dbRecord)
          .select()
          .single();
        if (!error && data) {
          this.mem.insert('asset_disposals', data);
          return this.hydrateDisposal(data);
        }
      } catch (err) {
        console.warn('[AssetRepository.createDisposal] Supabase fallback:', err);
      }
    }

    this.mem.insert('asset_disposals', record);
    return this.hydrateDisposal(record);
  }

  // ======================================================================
  // 7. Dashboard Metrics
  // ======================================================================

  async getDashboardMetrics(schoolId: string, locationId?: string): Promise<AssetDashboardMetrics> {
    const allAssets = await this.getAssets(schoolId, { location_id: locationId });
    const allCategories = await this.getCategories(schoolId);
    const maintenanceRecords = await this.getMaintenanceRecords(schoolId);

    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let active_assets = 0;
    let assigned_assets = 0;
    let available_assets = 0;
    let under_maintenance = 0;
    let damaged_assets = 0;
    let lost_assets = 0;
    let disposed_assets = 0;
    let warranty_expiring_soon = 0;
    let total_acquisition_value = 0;

    const catMap = new Map<string, { category_name: string; count: number; value: number }>();
    const locMap = new Map<string, { location_name: string; count: number; value: number }>();
    const statusMap = new Map<AssetStatus, number>();
    const conditionMap = new Map<AssetCondition, number>();

    allCategories.forEach(c => catMap.set(c.id, { category_name: c.name, count: 0, value: 0 }));

    for (const a of allAssets) {
      const price = Number(a.purchase_price) || 0;
      total_acquisition_value += price;

      // Status aggregation
      statusMap.set(a.status, (statusMap.get(a.status) || 0) + 1);
      conditionMap.set(a.condition, (conditionMap.get(a.condition) || 0) + 1);

      if (a.status === 'AVAILABLE') available_assets++;
      if (a.status === 'ASSIGNED') assigned_assets++;
      if (a.status === 'UNDER_MAINTENANCE') under_maintenance++;
      if (a.status === 'DAMAGED') damaged_assets++;
      if (a.status === 'LOST') lost_assets++;
      if (a.status === 'DISPOSED') disposed_assets++;
      if (a.status !== 'DISPOSED' && a.status !== 'RETIRED' && a.status !== 'LOST') active_assets++;

      // Warranty check
      const expiry = a.warranty_end_date || (a as any).warranty_expiry;
      if (expiry) {
        const expDate = new Date(expiry);
        if (expDate >= now && expDate <= thirtyDaysAhead) {
          warranty_expiring_soon++;
        }
      }

      // Category breakdown
      if (a.category_id) {
        const entry = catMap.get(a.category_id);
        if (entry) {
          entry.count += 1;
          entry.value += price;
        } else {
          catMap.set(a.category_id, {
            category_name: a.category?.name || 'Uncategorized',
            count: 1,
            value: price,
          });
        }
      }

      // Location breakdown
      const locId = a.current_location_id || (a as any).location_id;
      if (locId) {
        const entry = locMap.get(locId);
        if (entry) {
          entry.count += 1;
          entry.value += price;
        } else {
          locMap.set(locId, {
            location_name: a.location?.location_name || 'Branch',
            count: 1,
            value: price,
          });
        }
      }
    }

    const maintenance_due = maintenanceRecords.filter(m => m.status === 'OPEN' || m.status === 'IN_PROGRESS').length;

    return {
      total_assets: allAssets.length,
      active_assets,
      assigned_assets,
      available_assets,
      under_maintenance,
      damaged_assets,
      lost_assets,
      disposed_assets,
      warranty_expiring_soon,
      maintenance_due,
      total_acquisition_value,
      by_category: Array.from(catMap.entries()).map(([k, v]) => ({
        category_id: k,
        category_name: v.category_name,
        count: v.count,
        value: v.value,
      })),
      by_location: Array.from(locMap.entries()).map(([k, v]) => ({
        location_id: k,
        location_name: v.location_name,
        count: v.count,
        value: v.value,
      })),
      by_status: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
      by_condition: Array.from(conditionMap.entries()).map(([condition, count]) => ({ condition, count })),
    };
  }

  // ======================================================================
  // Private In-Memory Hydration Helpers
  // ======================================================================

  private hydrateAsset(a: any): Asset {
    const locId = a.current_location_id !== undefined ? a.current_location_id : (a.location_id || null);
    const custId = a.current_custodian_user_id !== undefined ? a.current_custodian_user_id : (a.custodian_id || null);

    const category = a.category || this.mem.findOne('asset_categories', (c: any) => c.id === a.category_id);
    const subcategory = a.subcategory || (a.subcategory_id ? this.mem.findOne('asset_subcategories', (s: any) => s.id === a.subcategory_id) : undefined);
    const location = a.location || (locId ? this.mem.findOne('locations', (l: any) => l.id === locId) : undefined);
    const custodian = a.custodian || (custId ? this.mem.findOne('users', (u: any) => u.id === custId) : undefined);
    const vendor = a.vendor || (a.vendor_id ? this.mem.findOne('inventory_vendors', (v: any) => v.id === a.vendor_id) : undefined);

    return {
      ...a,
      asset_name: a.asset_name || a.name || 'Untitled Asset',
      current_location_id: locId,
      current_custodian_user_id: custId,
      purchase_price: Number(a.purchase_price) || 0,
      salvage_value: Number(a.salvage_value) || 0,
      category,
      subcategory,
      location,
      custodian,
      vendor,
    };
  }

  private hydrateAssignment(a: any): AssetAssignment {
    const uid = a.assigned_to_user_id || a.user_id;
    const assigned_to_user = a.assigned_to_user || (uid ? this.mem.findOne('users', (u: any) => u.id === uid) : undefined);
    const assigned_by_user = a.assigned_by_user || (a.assigned_by ? this.mem.findOne('users', (u: any) => u.id === a.assigned_by) : undefined);
    const returned_by_user = a.returned_by_user || (a.returned_by ? this.mem.findOne('users', (u: any) => u.id === a.returned_by) : undefined);
    const location = a.location || (a.location_id ? this.mem.findOne('locations', (l: any) => l.id === a.location_id) : undefined);
    const asset = a.asset || (a.asset_id ? this.mem.findOne('assets', (x: any) => x.id === a.asset_id) : undefined);

    return {
      ...a,
      assigned_to_user_id: uid,
      is_active: a.is_active !== undefined ? a.is_active : !a.actual_return_date,
      asset: asset ? this.hydrateAsset(asset) : undefined,
      assigned_to_user,
      assigned_by_user,
      returned_by_user,
      location,
    };
  }

  private hydrateMovement(m: any): AssetMovement {
    const from_location = m.from_location || (m.from_location_id ? this.mem.findOne('locations', (l: any) => l.id === m.from_location_id) : undefined);
    const to_location = m.to_location || (m.to_location_id ? this.mem.findOne('locations', (l: any) => l.id === m.to_location_id) : undefined);
    const from_user = m.from_user || (m.from_user_id ? this.mem.findOne('users', (u: any) => u.id === m.from_user_id) : undefined);
    const to_user = m.to_user || (m.to_user_id ? this.mem.findOne('users', (u: any) => u.id === m.to_user_id) : undefined);
    const moved_by_user = m.moved_by_user || (m.moved_by ? this.mem.findOne('users', (u: any) => u.id === m.moved_by) : undefined);
    const asset = m.asset || (m.asset_id ? this.mem.findOne('assets', (x: any) => x.id === m.asset_id) : undefined);

    return {
      ...m,
      asset: asset ? this.hydrateAsset(asset) : undefined,
      from_location,
      to_location,
      from_user,
      to_user,
      moved_by_user,
    };
  }

  private hydrateMaintenance(m: any): AssetMaintenance {
    const vendor = m.vendor || (m.vendor_id ? this.mem.findOne('inventory_vendors', (v: any) => v.id === m.vendor_id) : undefined);
    const created_by_user = m.created_by_user || (m.created_by ? this.mem.findOne('users', (u: any) => u.id === m.created_by) : undefined);
    const asset = m.asset || (m.asset_id ? this.mem.findOne('assets', (x: any) => x.id === m.asset_id) : undefined);

    return {
      ...m,
      service_date: m.service_date || m.scheduled_date || new Date().toISOString().split('T')[0],
      issue_description: m.issue_description || m.description || m.title || '',
      cost: Number(m.cost) || 0,
      warranty_claim: !!m.warranty_claim,
      asset: asset ? this.hydrateAsset(asset) : undefined,
      vendor,
      created_by_user,
    };
  }

  private hydrateDisposal(d: any): AssetDisposal {
    const approved_by_user = d.approved_by_user || (d.approved_by ? this.mem.findOne('users', (u: any) => u.id === d.approved_by) : undefined);
    const created_by_user = d.created_by_user || (d.created_by ? this.mem.findOne('users', (u: any) => u.id === d.created_by) : undefined);
    const asset = d.asset || (d.asset_id ? this.mem.findOne('assets', (x: any) => x.id === d.asset_id) : undefined);

    return {
      ...d,
      disposal_value: Number(d.disposal_value) || 0,
      asset: asset ? this.hydrateAsset(asset) : undefined,
      approved_by_user,
      created_by_user,
    };
  }
}

export const assetRepository = new AssetRepository();
