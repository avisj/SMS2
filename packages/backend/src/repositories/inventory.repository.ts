// ========================================================================
// Inventory Repository
// Multi-Tenant PostgREST (Supabase) + In-Memory Fallback Data Access Layer
// Complete Persistence for Inventory Masters, Catalog, Stock, Ledger, POs & SOs
// ========================================================================

import crypto from 'crypto';
import {
  InventoryCategory,
  InventorySubcategory,
  InventoryUOM,
  InventoryBrand,
  InventoryVendor,
  Product,
  SKU,
  InventoryStock,
  InventoryStockLedger,
  PurchaseOrder,
  PurchaseOrderItem,
  SalesOrder,
  SalesOrderItem,
  InventoryStockIn,
  InventoryStockInDetail,
  InventoryStockOut,
  InventoryStockOutDetail,
  InventoryAdjustment,
  InventoryAdjustmentDetail,
  InventoryDashboardStats,
  StockValuationReportItem,
  LowStockAlertItem,
  User,
  Location,
} from '../types/index.js';
import {
  getMemoryDbClient,
  getSupabaseClient,
  isSupabaseDatabaseActive,
} from '../db/client.js';

export class InventoryRepository {
  private mem = getMemoryDbClient();

  // ======================================================================
  // 1. Categories & Subcategories
  // ======================================================================

  async getCategories(schoolId: string): Promise<InventoryCategory[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_categories')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .order('name');
        if (!error && data && data.length > 0) return data as InventoryCategory[];
      } catch (err) {
        console.warn('[InventoryRepository.getCategories] Supabase fallback:', err);
      }
    }
    return this.mem.findAll('inventory_categories', (c: InventoryCategory) =>
      c.school_id === schoolId && !c.deleted_at
    ).sort((a: InventoryCategory, b: InventoryCategory) => a.name.localeCompare(b.name));
  }

  async createCategory(cat: Omit<InventoryCategory, 'id' | 'created_at' | 'updated_at'>): Promise<InventoryCategory> {
    const record: InventoryCategory = {
      ...cat,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_categories')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as InventoryCategory;
      } catch (err) {
        console.warn('[InventoryRepository.createCategory] Supabase fallback:', err);
      }
    }
    this.mem.insert('inventory_categories', record);
    return record;
  }

  async updateCategory(id: string, schoolId: string, updates: Partial<InventoryCategory>): Promise<InventoryCategory> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_categories')
          .update(payload)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as InventoryCategory;
      } catch (err) {
        console.warn('[InventoryRepository.updateCategory] Supabase fallback:', err);
      }
    }
    return this.mem.update('inventory_categories', id, payload) as InventoryCategory;
  }

  async deleteCategory(id: string, schoolId: string): Promise<boolean> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('inventory_categories')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('school_id', schoolId);
      } catch (err) {
        console.warn('[InventoryRepository.deleteCategory] Supabase fallback:', err);
      }
    }
    this.mem.update('inventory_categories', id, { deleted_at: new Date().toISOString() });
    return true;
  }

  async getSubcategories(schoolId: string, categoryId?: string): Promise<InventorySubcategory[]> {
    let list: InventorySubcategory[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('inventory_subcategories')
          .select('*, category:inventory_categories(*)')
          .eq('school_id', schoolId)
          .is('deleted_at', null);
        if (categoryId) q = q.eq('category_id', categoryId);
        const { data, error } = await q.order('name');
        if (!error && data) list = data as InventorySubcategory[];
      } catch (err) {
        console.warn('[InventoryRepository.getSubcategories] Supabase fallback:', err);
      }
    }
    if (list.length === 0) {
      list = this.mem.findAll('inventory_subcategories', (s: InventorySubcategory) => {
        if (s.school_id !== schoolId || s.deleted_at) return false;
        if (categoryId && s.category_id !== categoryId) return false;
        return true;
      });
      // Hydrate category
      for (const item of list) {
        item.category = this.mem.findById('inventory_categories', item.category_id) as InventoryCategory;
      }
    }
    return list;
  }

  async createSubcategory(subcat: Omit<InventorySubcategory, 'id' | 'created_at' | 'updated_at'>): Promise<InventorySubcategory> {
    const record: InventorySubcategory = {
      ...subcat,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_subcategories')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as InventorySubcategory;
      } catch (err) {
        console.warn('[InventoryRepository.createSubcategory] Supabase fallback:', err);
      }
    }
    this.mem.insert('inventory_subcategories', record);
    return record;
  }

  async updateSubcategory(id: string, schoolId: string, updates: Partial<InventorySubcategory>): Promise<InventorySubcategory> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_subcategories')
          .update(payload)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as InventorySubcategory;
      } catch (err) {
        console.warn('[InventoryRepository.updateSubcategory] Supabase fallback:', err);
      }
    }
    return this.mem.update('inventory_subcategories', id, payload) as InventorySubcategory;
  }

  async deleteSubcategory(id: string, schoolId: string): Promise<boolean> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('inventory_subcategories')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('school_id', schoolId);
      } catch (err) {
        console.warn('[InventoryRepository.deleteSubcategory] Supabase fallback:', err);
      }
    }
    this.mem.update('inventory_subcategories', id, { deleted_at: new Date().toISOString() });
    return true;
  }

  // ======================================================================
  // 2. Units of Measure (UOM)
  // ======================================================================

  async getUOMs(schoolId: string): Promise<InventoryUOM[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_uoms')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .order('name');
        if (!error && data && data.length > 0) return data as InventoryUOM[];
      } catch (err) {
        console.warn('[InventoryRepository.getUOMs] Supabase fallback:', err);
      }
    }
    return this.mem.findAll('inventory_uoms', (u: InventoryUOM) =>
      u.school_id === schoolId && !u.deleted_at
    );
  }

  async createUOM(uom: Omit<InventoryUOM, 'id' | 'created_at' | 'updated_at'>): Promise<InventoryUOM> {
    const record: InventoryUOM = {
      ...uom,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_uoms')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as InventoryUOM;
      } catch (err) {
        console.warn('[InventoryRepository.createUOM] Supabase fallback:', err);
      }
    }
    this.mem.insert('inventory_uoms', record);
    return record;
  }

  async updateUOM(id: string, schoolId: string, updates: Partial<InventoryUOM>): Promise<InventoryUOM> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_uoms')
          .update(payload)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as InventoryUOM;
      } catch (err) {
        console.warn('[InventoryRepository.updateUOM] Supabase fallback:', err);
      }
    }
    return this.mem.update('inventory_uoms', id, payload) as InventoryUOM;
  }

  async deleteUOM(id: string, schoolId: string): Promise<boolean> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('inventory_uoms')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('school_id', schoolId);
      } catch (err) {
        console.warn('[InventoryRepository.deleteUOM] Supabase fallback:', err);
      }
    }
    this.mem.update('inventory_uoms', id, { deleted_at: new Date().toISOString() });
    return true;
  }

  // ======================================================================
  // 3. Brands Master
  // ======================================================================

  async getBrands(schoolId: string): Promise<InventoryBrand[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_brands')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .order('name');
        if (!error && data && data.length > 0) return data as InventoryBrand[];
      } catch (err) {
        console.warn('[InventoryRepository.getBrands] Supabase fallback:', err);
      }
    }
    return this.mem.findAll('inventory_brands', (b: InventoryBrand) =>
      b.school_id === schoolId && !b.deleted_at
    );
  }

  async createBrand(brand: Omit<InventoryBrand, 'id' | 'created_at' | 'updated_at'>): Promise<InventoryBrand> {
    const record: InventoryBrand = {
      ...brand,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_brands')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as InventoryBrand;
      } catch (err) {
        console.warn('[InventoryRepository.createBrand] Supabase fallback:', err);
      }
    }
    this.mem.insert('inventory_brands', record);
    return record;
  }

  async updateBrand(id: string, schoolId: string, updates: Partial<InventoryBrand>): Promise<InventoryBrand> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_brands')
          .update(payload)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as InventoryBrand;
      } catch (err) {
        console.warn('[InventoryRepository.updateBrand] Supabase fallback:', err);
      }
    }
    return this.mem.update('inventory_brands', id, payload) as InventoryBrand;
  }

  async deleteBrand(id: string, schoolId: string): Promise<boolean> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('inventory_brands')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('school_id', schoolId);
      } catch (err) {
        console.warn('[InventoryRepository.deleteBrand] Supabase fallback:', err);
      }
    }
    this.mem.update('inventory_brands', id, { deleted_at: new Date().toISOString() });
    return true;
  }

  // ======================================================================
  // 4. Vendors / Suppliers
  // ======================================================================

  async getVendors(schoolId: string, status?: string): Promise<InventoryVendor[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('inventory_vendors')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null);
        if (status) q = q.eq('status', status);
        const { data, error } = await q.order('name');
        if (!error && data && data.length > 0) return data as InventoryVendor[];
      } catch (err) {
        console.warn('[InventoryRepository.getVendors] Supabase fallback:', err);
      }
    }
    return this.mem.findAll('inventory_vendors', (v: InventoryVendor) => {
      if (v.school_id !== schoolId || v.deleted_at) return false;
      if (status && v.status !== status) return false;
      return true;
    });
  }

  async createVendor(vendor: Omit<InventoryVendor, 'id' | 'created_at' | 'updated_at'>): Promise<InventoryVendor> {
    const record: InventoryVendor = {
      ...vendor,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_vendors')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as InventoryVendor;
      } catch (err) {
        console.warn('[InventoryRepository.createVendor] Supabase fallback:', err);
      }
    }
    this.mem.insert('inventory_vendors', record);
    return record;
  }

  async updateVendor(id: string, schoolId: string, updates: Partial<InventoryVendor>): Promise<InventoryVendor> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_vendors')
          .update(payload)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as InventoryVendor;
      } catch (err) {
        console.warn('[InventoryRepository.updateVendor] Supabase fallback:', err);
      }
    }
    return this.mem.update('inventory_vendors', id, payload) as InventoryVendor;
  }

  async deleteVendor(id: string, schoolId: string): Promise<boolean> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('inventory_vendors')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('school_id', schoolId);
      } catch (err) {
        console.warn('[InventoryRepository.deleteVendor] Supabase fallback:', err);
      }
    }
    this.mem.update('inventory_vendors', id, { deleted_at: new Date().toISOString() });
    return true;
  }

  // ======================================================================
  // 5. Products Master
  // ======================================================================

  async getProducts(
    schoolId: string,
    filters?: { categoryId?: string; search?: string; status?: string }
  ): Promise<Product[]> {
    let list: Product[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('products')
          .select(`
            *,
            category:inventory_categories(*),
            subcategory:inventory_subcategories(*),
            uom:inventory_uoms(*),
            brand:inventory_brands(*)
          `)
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.categoryId) q = q.eq('category_id', filters.categoryId);
        if (filters?.status) q = q.eq('status', filters.status);
        if (filters?.search) {
          q = q.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
        }
        const { data, error } = await q.order('name');
        if (!error && data) list = data as Product[];
      } catch (err) {
        console.warn('[InventoryRepository.getProducts] Supabase fallback:', err);
      }
    }

    if (list.length === 0) {
      list = this.mem.findAll('products', (p: Product) => {
        if (p.school_id !== schoolId || p.deleted_at) return false;
        if (filters?.categoryId && p.category_id !== filters.categoryId) return false;
        if (filters?.status && p.status !== filters.status) return false;
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          if (!p.name.toLowerCase().includes(s) && !p.code.toLowerCase().includes(s)) return false;
        }
        return true;
      });

      // Hydrate relationships
      for (const p of list) {
        if (p.category_id) p.category = this.mem.findById('inventory_categories', p.category_id) as InventoryCategory;
        if (p.subcategory_id) p.subcategory = this.mem.findById('inventory_subcategories', p.subcategory_id) as InventorySubcategory;
        if (p.uom_id) p.uom = this.mem.findById('inventory_uoms', p.uom_id) as InventoryUOM;
        if (p.brand_id) p.brand = this.mem.findById('inventory_brands', p.brand_id) as InventoryBrand;
      }
    }

    // Attach SKU count
    for (const p of list) {
      const skus = this.mem.findAll('skus', (s: SKU) => s.product_id === p.id && !s.deleted_at);
      p.skus_count = skus.length;
    }

    return list;
  }

  async getProductById(id: string, schoolId: string): Promise<Product | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('products')
          .select(`
            *,
            category:inventory_categories(*),
            subcategory:inventory_subcategories(*),
            uom:inventory_uoms(*),
            brand:inventory_brands(*)
          `)
          .eq('id', id)
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .single();
        if (!error && data) return data as Product;
      } catch (err) {
        console.warn('[InventoryRepository.getProductById] Supabase fallback:', err);
      }
    }
    const p = this.mem.findById('products', id) as Product | null;
    if (!p || p.school_id !== schoolId || p.deleted_at) return null;
    if (p.category_id) p.category = this.mem.findById('inventory_categories', p.category_id) as InventoryCategory;
    if (p.subcategory_id) p.subcategory = this.mem.findById('inventory_subcategories', p.subcategory_id) as InventorySubcategory;
    if (p.uom_id) p.uom = this.mem.findById('inventory_uoms', p.uom_id) as InventoryUOM;
    if (p.brand_id) p.brand = this.mem.findById('inventory_brands', p.brand_id) as InventoryBrand;
    return p;
  }

  async createProduct(prod: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const record: Product = {
      ...prod,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('products')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as Product;
      } catch (err) {
        console.warn('[InventoryRepository.createProduct] Supabase fallback:', err);
      }
    }
    this.mem.insert('products', record);
    return record;
  }

  async updateProduct(id: string, schoolId: string, updates: Partial<Product>): Promise<Product> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('products')
          .update(payload)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as Product;
      } catch (err) {
        console.warn('[InventoryRepository.updateProduct] Supabase fallback:', err);
      }
    }
    return this.mem.update('products', id, payload) as Product;
  }

  async deleteProduct(id: string, schoolId: string): Promise<boolean> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('products')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('school_id', schoolId);
      } catch (err) {
        console.warn('[InventoryRepository.deleteProduct] Supabase fallback:', err);
      }
    }
    this.mem.update('products', id, { deleted_at: new Date().toISOString() });
    return true;
  }

  // ======================================================================
  // 6. SKUs Master
  // ======================================================================

  async getSKUs(
    schoolId: string,
    filters?: { categoryId?: string; productId?: string; search?: string; status?: string }
  ): Promise<SKU[]> {
    let list: SKU[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('skus')
          .select(`
            *,
            category:inventory_categories(*),
            subcategory:inventory_subcategories(*),
            uom:inventory_uoms(*),
            brand:inventory_brands(*),
            product:products(*)
          `)
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.categoryId) q = q.eq('category_id', filters.categoryId);
        if (filters?.productId) q = q.eq('product_id', filters.productId);
        if (filters?.status) q = q.eq('status', filters.status);
        if (filters?.search) {
          q = q.or(`sku_code.ilike.%${filters.search}%,sku_name.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%,alternate_barcode.ilike.%${filters.search}%`);
        }
        const { data, error } = await q.order('sku_code');
        if (!error && data) list = data as SKU[];
      } catch (err) {
        console.warn('[InventoryRepository.getSKUs] Supabase fallback:', err);
      }
    }

    if (list.length === 0) {
      list = this.mem.findAll('skus', (s: SKU) => {
        if (s.school_id !== schoolId || s.deleted_at) return false;
        if (filters?.categoryId && s.category_id !== filters.categoryId) return false;
        if (filters?.productId && s.product_id !== filters.productId) return false;
        if (filters?.status && s.status !== filters.status) return false;
        if (filters?.search) {
          const t = filters.search.toLowerCase();
          const code = (s.sku_code || '').toLowerCase();
          const name = (s.sku_name || '').toLowerCase();
          const bc = (s.barcode || '').toLowerCase();
          const alt = (s.alternate_barcode || '').toLowerCase();
          if (!code.includes(t) && !name.includes(t) && !bc.includes(t) && !alt.includes(t)) return false;
        }
        return true;
      });

      for (const s of list) {
        if (s.category_id) s.category = this.mem.findById('inventory_categories', s.category_id) as InventoryCategory;
        if (s.subcategory_id) s.subcategory = this.mem.findById('inventory_subcategories', s.subcategory_id) as InventorySubcategory;
        if (s.uom_id) s.uom = this.mem.findById('inventory_uoms', s.uom_id) as InventoryUOM;
        if (s.brand_id) s.brand = this.mem.findById('inventory_brands', s.brand_id) as InventoryBrand;
        if (s.product_id) s.product = this.mem.findById('products', s.product_id) as Product;
      }
    }

    // Hydrate authoritative total stock quantity across all locations for this school
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: stockData } = await getSupabaseClient()!
          .from('inventory_stock')
          .select('sku_id, quantity')
          .eq('school_id', schoolId);
        if (stockData && stockData.length > 0) {
          const stockMap = new Map<string, number>();
          for (const item of stockData) {
            stockMap.set(item.sku_id, (stockMap.get(item.sku_id) || 0) + Number(item.quantity || 0));
          }
          for (const s of list) {
            s.total_stock = stockMap.get(s.id) || 0;
          }
          return list;
        }
      } catch (err) {
        console.warn('[InventoryRepository.getSKUs] Supabase stock hydration fallback:', err);
      }
    }

    // In-memory stock balance aggregation fallback
    for (const s of list) {
      const stocks = this.mem.findAll('inventory_stock', (st: InventoryStock) =>
        st.sku_id === s.id && st.school_id === schoolId
      );
      s.total_stock = stocks.reduce((acc: number, cur: InventoryStock) => acc + Number(cur.quantity || 0), 0);
    }

    return list;
  }

  async getSKUById(id: string, schoolId: string): Promise<SKU | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('skus')
          .select(`
            *,
            category:inventory_categories(*),
            subcategory:inventory_subcategories(*),
            uom:inventory_uoms(*),
            brand:inventory_brands(*),
            product:products(*)
          `)
          .eq('id', id)
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .single();
        if (!error && data) {
          const sku = data as SKU;
          const { data: stockData } = await getSupabaseClient()!
            .from('inventory_stock')
            .select('quantity')
            .eq('school_id', schoolId)
            .eq('sku_id', id);
          sku.total_stock = (stockData || []).reduce((acc: number, cur: any) => acc + Number(cur.quantity || 0), 0);
          return sku;
        }
      } catch (err) {
        console.warn('[InventoryRepository.getSKUById] Supabase fallback:', err);
      }
    }
    const s = this.mem.findById('skus', id) as SKU | null;
    if (!s || s.school_id !== schoolId || s.deleted_at) return null;
    if (s.category_id) s.category = this.mem.findById('inventory_categories', s.category_id) as InventoryCategory;
    if (s.subcategory_id) s.subcategory = this.mem.findById('inventory_subcategories', s.subcategory_id) as InventorySubcategory;
    if (s.uom_id) s.uom = this.mem.findById('inventory_uoms', s.uom_id) as InventoryUOM;
    if (s.brand_id) s.brand = this.mem.findById('inventory_brands', s.brand_id) as InventoryBrand;
    if (s.product_id) s.product = this.mem.findById('products', s.product_id) as Product;

    const stocks = this.mem.findAll('inventory_stock', (st: InventoryStock) =>
      st.sku_id === s.id && st.school_id === schoolId
    );
    s.total_stock = stocks.reduce((acc: number, cur: InventoryStock) => acc + Number(cur.quantity || 0), 0);
    return s;
  }

  async createSKU(sku: Omit<SKU, 'id' | 'created_at' | 'updated_at'>): Promise<SKU> {
    const record: SKU = {
      ...sku,
      id: crypto.randomUUID(),
      attributes: sku.attributes || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('skus')
          .insert(record)
          .select(`
            *,
            category:inventory_categories(*),
            subcategory:inventory_subcategories(*),
            uom:inventory_uoms(*),
            brand:inventory_brands(*),
            product:products(*)
          `)
          .single();
        if (!error && data) return data as SKU;
      } catch (err) {
        console.warn('[InventoryRepository.createSKU] Supabase fallback:', err);
      }
    }
    this.mem.insert('skus', record);
    return record;
  }

  async updateSKU(id: string, schoolId: string, updates: Partial<SKU>): Promise<SKU> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('skus')
          .update(payload)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select(`
            *,
            category:inventory_categories(*),
            subcategory:inventory_subcategories(*),
            uom:inventory_uoms(*),
            brand:inventory_brands(*),
            product:products(*)
          `)
          .single();
        if (!error && data) return data as SKU;
      } catch (err) {
        console.warn('[InventoryRepository.updateSKU] Supabase fallback:', err);
      }
    }
    return this.mem.update('skus', id, payload) as SKU;
  }

  async deleteSKU(id: string, schoolId: string): Promise<boolean> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('skus')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('school_id', schoolId);
      } catch (err) {
        console.warn('[InventoryRepository.deleteSKU] Supabase fallback:', err);
      }
    }
    this.mem.update('skus', id, { deleted_at: new Date().toISOString() });
    return true;
  }

  // ======================================================================
  // 7. Inventory Stock (Materialized Stock by SKU + Location)
  // ======================================================================

  async getStock(
    schoolId: string,
    filters?: { locationId?: string; skuId?: string; search?: string }
  ): Promise<InventoryStock[]> {
    let list: InventoryStock[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('inventory_stock')
          .select(`
            *,
            sku:skus(*, product:products(*)),
            location:locations(*)
          `)
          .eq('school_id', schoolId);

        if (filters?.locationId) q = q.eq('location_id', filters.locationId);
        if (filters?.skuId) q = q.eq('sku_id', filters.skuId);
        const { data, error } = await q;
        if (!error && data) list = data as InventoryStock[];
      } catch (err) {
        console.warn('[InventoryRepository.getStock] Supabase fallback:', err);
      }
    }

    if (list.length === 0) {
      list = this.mem.findAll('inventory_stock', (st: InventoryStock) => {
        if (st.school_id !== schoolId) return false;
        if (filters?.locationId && st.location_id !== filters.locationId) return false;
        if (filters?.skuId && st.sku_id !== filters.skuId) return false;
        return true;
      });

      for (const st of list) {
        st.sku = this.mem.findById('skus', st.sku_id) as SKU;
        if (st.sku && st.sku.product_id) {
          st.sku.product = this.mem.findById('products', st.sku.product_id) as Product;
        }
        st.location = this.mem.findById('locations', st.location_id) as Location;
      }
    }

    if (filters?.search) {
      const s = filters.search.toLowerCase();
      list = list.filter((item) =>
        (item.sku?.sku_code || '').toLowerCase().includes(s) ||
        (item.sku?.product?.name || '').toLowerCase().includes(s) ||
        (item.location?.location_name || '').toLowerCase().includes(s)
      );
    }

    return list;
  }

  async getStockBySkuAndLocation(
    schoolId: string,
    locationId: string,
    skuId: string
  ): Promise<InventoryStock | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_stock')
          .select('*, sku:skus(*, product:products(*)), location:locations(*)')
          .eq('school_id', schoolId)
          .eq('location_id', locationId)
          .eq('sku_id', skuId)
          .single();
        if (!error && data) return data as InventoryStock;
      } catch (err) {
        console.warn('[InventoryRepository.getStockBySkuAndLocation] Supabase fallback:', err);
      }
    }

    const st = this.mem.findAll('inventory_stock', (s: InventoryStock) =>
      s.school_id === schoolId && s.location_id === locationId && s.sku_id === skuId
    )[0] as InventoryStock | undefined;

    if (!st) return null;
    st.sku = this.mem.findById('skus', st.sku_id) as SKU;
    if (st.sku && st.sku.product_id) {
      st.sku.product = this.mem.findById('products', st.sku.product_id) as Product;
    }
    st.location = this.mem.findById('locations', st.location_id) as Location;
    return st;
  }

  /**
   * Upsert stock record atomically:
   * If isAbsolute is true, sets quantity to delta.
   * If isAbsolute is false, adds delta to current quantity.
   */
  async upsertStock(
    schoolId: string,
    locationId: string,
    skuId: string,
    quantityDelta: number,
    options?: { isAbsolute?: boolean; minQuantity?: number; reorderPoint?: number }
  ): Promise<{ previousBalance: number; newBalance: number; stock: InventoryStock }> {
    const existing = await this.getStockBySkuAndLocation(schoolId, locationId, skuId);
    const prevBalance = existing ? Number(existing.quantity || 0) : 0;
    const newBalance = options?.isAbsolute ? quantityDelta : prevBalance + quantityDelta;

    if (newBalance < 0) {
      throw new Error(`Insufficient stock for SKU ${skuId} at location ${locationId}. Current: ${prevBalance}, Requested change: ${quantityDelta}`);
    }

    let updatedStock: InventoryStock;
    const now = new Date().toISOString();

    if (existing) {
      const updates: Partial<InventoryStock> = {
        quantity: newBalance,
        updated_at: now,
      };
      if (options?.minQuantity !== undefined) updates.min_quantity = options.minQuantity;
      if (options?.reorderPoint !== undefined) updates.reorder_point = options.reorderPoint;

      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          await getSupabaseClient()!
            .from('inventory_stock')
            .update(updates)
            .eq('id', existing.id);
        } catch (err) {
          console.warn('[InventoryRepository.upsertStock] Supabase update fallback:', err);
        }
      }
      updatedStock = this.mem.update('inventory_stock', existing.id, updates) as InventoryStock;
    } else {
      const newRecord: InventoryStock = {
        id: crypto.randomUUID(),
        school_id: schoolId,
        location_id: locationId,
        sku_id: skuId,
        quantity: newBalance,
        reserved_quantity: 0,
        min_quantity: options?.minQuantity ?? 5,
        reorder_point: options?.reorderPoint ?? 10,
        created_at: now,
        updated_at: now,
      };
      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          await getSupabaseClient()!.from('inventory_stock').insert(newRecord);
        } catch (err) {
          console.warn('[InventoryRepository.upsertStock] Supabase insert fallback:', err);
        }
      }
      this.mem.insert('inventory_stock', newRecord);
      updatedStock = newRecord;
    }

    return { previousBalance: prevBalance, newBalance, stock: updatedStock };
  }

  // ======================================================================
  // 8. Stock Ledger (Append-Only Immutable Audit Trail)
  // ======================================================================

  async recordLedger(entry: Omit<InventoryStockLedger, 'id' | 'created_at'>): Promise<InventoryStockLedger> {
    const record: InventoryStockLedger = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('inventory_stock_ledger')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as InventoryStockLedger;
      } catch (err) {
        console.warn('[InventoryRepository.recordLedger] Supabase fallback:', err);
      }
    }
    this.mem.insert('inventory_stock_ledger', record);
    return record;
  }

  async getLedger(
    schoolId: string,
    filters?: {
      locationId?: string;
      skuId?: string;
      movementType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: InventoryStockLedger[]; total: number }> {
    let list: InventoryStockLedger[] = [];
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('inventory_stock_ledger')
          .select(`
            *,
            sku:skus(*, product:products(*)),
            location:locations(*),
            created_by_user:users(id, first_name, last_name, email)
          `, { count: 'exact' })
          .eq('school_id', schoolId);

        if (filters?.locationId) q = q.eq('location_id', filters.locationId);
        if (filters?.skuId) q = q.eq('sku_id', filters.skuId);
        if (filters?.movementType) q = q.eq('movement_type', filters.movementType);
        if (filters?.startDate) q = q.gte('created_at', filters.startDate);
        if (filters?.endDate) q = q.lte('created_at', filters.endDate);

        q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
        const { data, error, count } = await q;
        if (!error && data) {
          list = data as InventoryStockLedger[];
          return { data: list, total: count || list.length };
        }
      } catch (err) {
        console.warn('[InventoryRepository.getLedger] Supabase fallback:', err);
      }
    }

    const all = this.mem.findAll('inventory_stock_ledger', (l: InventoryStockLedger) => {
      if (l.school_id !== schoolId) return false;
      if (filters?.locationId && l.location_id !== filters.locationId) return false;
      if (filters?.skuId && l.sku_id !== filters.skuId) return false;
      if (filters?.movementType && l.movement_type !== filters.movementType) return false;
      if (filters?.startDate && l.created_at < filters.startDate) return false;
      if (filters?.endDate && l.created_at > filters.endDate) return false;
      return true;
    }).sort((a: InventoryStockLedger, b: InventoryStockLedger) => b.created_at.localeCompare(a.created_at));

    const paged = all.slice(offset, offset + limit);
    for (const l of paged) {
      l.sku = this.mem.findById('skus', l.sku_id) as SKU;
      if (l.sku && l.sku.product_id) {
        l.sku.product = this.mem.findById('products', l.sku.product_id) as Product;
      }
      l.location = this.mem.findById('locations', l.location_id) as Location;
      if (l.created_by) {
        l.created_by_user = this.mem.findById('users', l.created_by) as User;
      }
    }

    return { data: paged, total: all.length };
  }

  // ======================================================================
  // 9. Purchase Orders (Intent to Purchase)
  // ======================================================================

  async getPurchaseOrders(
    schoolId: string,
    filters?: { locationId?: string; vendorId?: string; status?: string; search?: string }
  ): Promise<PurchaseOrder[]> {
    let list: PurchaseOrder[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('purchase_orders')
          .select(`
            *,
            vendor:inventory_vendors(*),
            location:locations(*),
            created_by_user:users(id, first_name, last_name, email),
            items:purchase_order_items(*, sku:skus(*))
          `)
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.locationId) q = q.eq('location_id', filters.locationId);
        if (filters?.vendorId) q = q.eq('vendor_id', filters.vendorId);
        if (filters?.status) q = q.eq('status', filters.status);
        if (filters?.search) q = q.ilike('po_number', `%${filters.search}%`);

        const { data, error } = await q.order('created_at', { ascending: false });
        if (!error && data) list = data as PurchaseOrder[];
      } catch (err) {
        console.warn('[InventoryRepository.getPurchaseOrders] Supabase fallback:', err);
      }
    }

    if (list.length === 0) {
      list = this.mem.findAll('purchase_orders', (po: PurchaseOrder) => {
        if (po.school_id !== schoolId || po.deleted_at) return false;
        if (filters?.locationId && po.location_id !== filters.locationId) return false;
        if (filters?.vendorId && po.vendor_id !== filters.vendorId) return false;
        if (filters?.status && po.status !== filters.status) return false;
        if (filters?.search && !po.po_number.toLowerCase().includes(filters.search.toLowerCase())) return false;
        return true;
      }).sort((a: PurchaseOrder, b: PurchaseOrder) => b.created_at.localeCompare(a.created_at));

      for (const po of list) {
        po.vendor = this.mem.findById('inventory_vendors', po.vendor_id) as InventoryVendor;
        po.location = this.mem.findById('locations', po.location_id) as Location;
        if (po.created_by) po.created_by_user = this.mem.findById('users', po.created_by) as User;
        const items = this.mem.findAll('purchase_order_items', (i: PurchaseOrderItem) => i.po_id === po.id);
        for (const it of items) {
          it.sku = this.mem.findById('skus', it.sku_id) as SKU;
        }
        po.items = items;
      }
    }

    return list;
  }

  async getPurchaseOrderById(id: string, schoolId: string): Promise<PurchaseOrder | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('purchase_orders')
          .select(`
            *,
            vendor:inventory_vendors(*),
            location:locations(*),
            created_by_user:users(id, first_name, last_name, email),
            items:purchase_order_items(*, sku:skus(*))
          `)
          .eq('id', id)
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .single();
        if (!error && data) return data as PurchaseOrder;
      } catch (err) {
        console.warn('[InventoryRepository.getPurchaseOrderById] Supabase fallback:', err);
      }
    }

    const po = this.mem.findById('purchase_orders', id) as PurchaseOrder | null;
    if (!po || po.school_id !== schoolId || po.deleted_at) return null;
    po.vendor = this.mem.findById('inventory_vendors', po.vendor_id) as InventoryVendor;
    po.location = this.mem.findById('locations', po.location_id) as Location;
    if (po.created_by) po.created_by_user = this.mem.findById('users', po.created_by) as User;
    const items = this.mem.findAll('purchase_order_items', (i: PurchaseOrderItem) => i.po_id === po.id);
    for (const it of items) {
      it.sku = this.mem.findById('skus', it.sku_id) as SKU;
    }
    po.items = items;
    return po;
  }

  async createPurchaseOrder(
    poData: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at' | 'items'>,
    itemsData: Omit<PurchaseOrderItem, 'id' | 'po_id' | 'quantity_received' | 'created_at'>[]
  ): Promise<PurchaseOrder> {
    const poId = crypto.randomUUID();
    const now = new Date().toISOString();

    const poRecord: PurchaseOrder = {
      ...poData,
      id: poId,
      created_at: now,
      updated_at: now,
    };

    const itemRecords: PurchaseOrderItem[] = itemsData.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      po_id: poId,
      quantity_received: 0,
      created_at: now,
    }));

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!.from('purchase_orders').insert(poRecord);
        await getSupabaseClient()!.from('purchase_order_items').insert(itemRecords);
      } catch (err) {
        console.warn('[InventoryRepository.createPurchaseOrder] Supabase fallback:', err);
      }
    }

    this.mem.insert('purchase_orders', poRecord);
    for (const item of itemRecords) {
      this.mem.insert('purchase_order_items', item);
    }

    poRecord.items = itemRecords;
    return poRecord;
  }

  async updatePurchaseOrder(id: string, schoolId: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('purchase_orders')
          .update(payload)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as PurchaseOrder;
      } catch (err) {
        console.warn('[InventoryRepository.updatePurchaseOrder] Supabase fallback:', err);
      }
    }
    return this.mem.update('purchase_orders', id, payload) as PurchaseOrder;
  }

  /**
   * Receive items against a PO:
   * Updates line items quantity_received.
   * Updates PO status ('PARTIALLY_RECEIVED' or 'RECEIVED').
   * Increases inventory_stock per SKU.
   * Records immutable ledger entry per SKU received.
   */
  async receivePurchaseOrder(
    poId: string,
    schoolId: string,
    locationId: string,
    receivedItems: { sku_id: string; quantity_received: number; unit_cost?: number }[],
    receivedBy: string
  ): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrderById(poId, schoolId);
    if (!po) throw new Error('Purchase Order not found');
    if (po.status === 'CANCELLED' || po.status === 'RECEIVED') {
      throw new Error(`Cannot receive items for PO in status: ${po.status}`);
    }

    const items = po.items || [];
    let allCompleted = true;

    for (const rec of receivedItems) {
      if (rec.quantity_received <= 0) continue;
      const targetItem = items.find((i) => i.sku_id === rec.sku_id);
      if (!targetItem) {
        throw new Error(`SKU ${rec.sku_id} is not part of this purchase order`);
      }

      const previouslyReceived = Number(targetItem.quantity_received || 0);
      const newTotalReceived = previouslyReceived + rec.quantity_received;

      if (newTotalReceived > Number(targetItem.quantity_ordered)) {
        throw new Error(`Cannot receive more than ordered for SKU ${rec.sku_id}. Ordered: ${targetItem.quantity_ordered}, Already Received: ${previouslyReceived}, Attempted: ${rec.quantity_received}`);
      }

      // Update PO item
      targetItem.quantity_received = newTotalReceived;
      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          await getSupabaseClient()!
            .from('purchase_order_items')
            .update({ quantity_received: newTotalReceived })
            .eq('id', targetItem.id);
        } catch (err) {
          console.warn('[InventoryRepository.receivePO] Supabase item update fallback:', err);
        }
      }
      this.mem.update('purchase_order_items', targetItem.id, { quantity_received: newTotalReceived });

      // Update physical inventory stock
      const { previousBalance, newBalance } = await this.upsertStock(
        schoolId,
        locationId,
        rec.sku_id,
        rec.quantity_received
      );

      // Record immutable stock ledger entry
      await this.recordLedger({
        school_id: schoolId,
        location_id: locationId,
        sku_id: rec.sku_id,
        movement_type: 'PURCHASE_RECEIPT',
        reference_type: 'PURCHASE_ORDER',
        reference_id: poId,
        quantity: rec.quantity_received,
        previous_balance: previousBalance,
        new_balance: newBalance,
        unit_cost: rec.unit_cost ?? Number(targetItem.unit_price || 0),
        notes: `PO Receipt ${po.po_number}`,
        created_by: receivedBy,
      });
    }

    // Check if all items in PO are fully received
    const reloadedPo = await this.getPurchaseOrderById(poId, schoolId);
    for (const item of reloadedPo?.items || []) {
      if (Number(item.quantity_received || 0) < Number(item.quantity_ordered)) {
        allCompleted = false;
        break;
      }
    }

    const newStatus = allCompleted ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    return await this.updatePurchaseOrder(poId, schoolId, { status: newStatus });
  }

  // ======================================================================
  // 10. Sales Orders (Intent to Sell / Issue)
  // ======================================================================

  async getSalesOrders(
    schoolId: string,
    filters?: { locationId?: string; customerType?: string; status?: string; search?: string }
  ): Promise<SalesOrder[]> {
    let list: SalesOrder[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('sales_orders')
          .select(`
            *,
            location:locations(*),
            customer_user:users!customer_id(id, first_name, last_name, email),
            created_by_user:users!created_by(id, first_name, last_name, email),
            items:sales_order_items(*, sku:skus(*))
          `)
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.locationId) q = q.eq('location_id', filters.locationId);
        if (filters?.customerType) q = q.eq('customer_type', filters.customerType);
        if (filters?.status) q = q.eq('status', filters.status);
        if (filters?.search) {
          q = q.or(`so_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`);
        }

        const { data, error } = await q.order('created_at', { ascending: false });
        if (!error && data) list = data as SalesOrder[];
      } catch (err) {
        console.warn('[InventoryRepository.getSalesOrders] Supabase fallback:', err);
      }
    }

    if (list.length === 0) {
      list = this.mem.findAll('sales_orders', (so: SalesOrder) => {
        if (so.school_id !== schoolId || so.deleted_at) return false;
        if (filters?.locationId && so.location_id !== filters.locationId) return false;
        if (filters?.customerType && so.customer_type !== filters.customerType) return false;
        if (filters?.status && so.status !== filters.status) return false;
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          if (!so.so_number.toLowerCase().includes(s) && !so.customer_name.toLowerCase().includes(s)) return false;
        }
        return true;
      }).sort((a: SalesOrder, b: SalesOrder) => b.created_at.localeCompare(a.created_at));

      for (const so of list) {
        so.location = this.mem.findById('locations', so.location_id) as Location;
        if (so.customer_id) so.customer_user = this.mem.findById('users', so.customer_id) as User;
        if (so.created_by) so.created_by_user = this.mem.findById('users', so.created_by) as User;
        const items = this.mem.findAll('sales_order_items', (i: SalesOrderItem) => i.so_id === so.id);
        for (const it of items) {
          it.sku = this.mem.findById('skus', it.sku_id) as SKU;
        }
        so.items = items;
      }
    }

    return list;
  }

  async getSalesOrderById(id: string, schoolId: string): Promise<SalesOrder | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('sales_orders')
          .select(`
            *,
            location:locations(*),
            customer_user:users!customer_id(id, first_name, last_name, email),
            created_by_user:users!created_by(id, first_name, last_name, email),
            items:sales_order_items(*, sku:skus(*))
          `)
          .eq('id', id)
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .single();
        if (!error && data) return data as SalesOrder;
      } catch (err) {
        console.warn('[InventoryRepository.getSalesOrderById] Supabase fallback:', err);
      }
    }

    const so = this.mem.findById('sales_orders', id) as SalesOrder | null;
    if (!so || so.school_id !== schoolId || so.deleted_at) return null;
    so.location = this.mem.findById('locations', so.location_id) as Location;
    if (so.customer_id) so.customer_user = this.mem.findById('users', so.customer_id) as User;
    if (so.created_by) so.created_by_user = this.mem.findById('users', so.created_by) as User;
    const items = this.mem.findAll('sales_order_items', (i: SalesOrderItem) => i.so_id === so.id);
    for (const it of items) {
      it.sku = this.mem.findById('skus', it.sku_id) as SKU;
    }
    so.items = items;
    return so;
  }

  async createSalesOrder(
    soData: Omit<SalesOrder, 'id' | 'created_at' | 'updated_at' | 'items'>,
    itemsData: Omit<SalesOrderItem, 'id' | 'so_id' | 'quantity_fulfilled' | 'created_at'>[]
  ): Promise<SalesOrder> {
    const soId = crypto.randomUUID();
    const now = new Date().toISOString();

    const soRecord: SalesOrder = {
      ...soData,
      id: soId,
      created_at: now,
      updated_at: now,
    };

    const itemRecords: SalesOrderItem[] = itemsData.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      so_id: soId,
      quantity_fulfilled: 0,
      created_at: now,
    }));

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!.from('sales_orders').insert(soRecord);
        await getSupabaseClient()!.from('sales_order_items').insert(itemRecords);
      } catch (err) {
        console.warn('[InventoryRepository.createSalesOrder] Supabase fallback:', err);
      }
    }

    this.mem.insert('sales_orders', soRecord);
    for (const item of itemRecords) {
      this.mem.insert('sales_order_items', item);
    }

    soRecord.items = itemRecords;
    return soRecord;
  }

  async updateSalesOrder(id: string, schoolId: string, updates: Partial<SalesOrder>): Promise<SalesOrder> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('sales_orders')
          .update(payload)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as SalesOrder;
      } catch (err) {
        console.warn('[InventoryRepository.updateSalesOrder] Supabase fallback:', err);
      }
    }
    return this.mem.update('sales_orders', id, payload) as SalesOrder;
  }

  /**
   * Fulfill items against an SO:
   * Validates available stock for each SKU at locationId (cannot go negative).
   * Decrements inventory_stock per SKU.
   * Updates line items quantity_fulfilled.
   * Updates SO status ('PARTIALLY_FULFILLED' or 'FULFILLED').
   * Records immutable ledger entry per SKU fulfilled.
   */
  async fulfillSalesOrder(
    soId: string,
    schoolId: string,
    locationId: string,
    fulfilledItems: { sku_id: string; quantity_fulfilled: number }[],
    fulfilledBy: string
  ): Promise<SalesOrder> {
    const so = await this.getSalesOrderById(soId, schoolId);
    if (!so) throw new Error('Sales Order not found');
    if (so.status === 'CANCELLED' || so.status === 'FULFILLED') {
      throw new Error(`Cannot fulfill items for SO in status: ${so.status}`);
    }

    const items = so.items || [];
    let allCompleted = true;

    // Pre-flight check: Verify all items have enough stock first before mutating
    for (const f of fulfilledItems) {
      if (f.quantity_fulfilled <= 0) continue;
      const targetItem = items.find((i) => i.sku_id === f.sku_id);
      if (!targetItem) {
        throw new Error(`SKU ${f.sku_id} is not part of this sales order`);
      }

      const previouslyFulfilled = Number(targetItem.quantity_fulfilled || 0);
      const newTotalFulfilled = previouslyFulfilled + f.quantity_fulfilled;

      if (newTotalFulfilled > Number(targetItem.quantity_ordered)) {
        throw new Error(`Cannot fulfill more than ordered for SKU ${f.sku_id}. Ordered: ${targetItem.quantity_ordered}, Already Fulfilled: ${previouslyFulfilled}, Attempted: ${f.quantity_fulfilled}`);
      }

      const currentStock = await this.getStockBySkuAndLocation(schoolId, locationId, f.sku_id);
      const available = currentStock ? Number(currentStock.quantity || 0) : 0;
      if (available < f.quantity_fulfilled) {
        throw new Error(`Insufficient stock for SKU ${f.sku_id} at location ${locationId}. Available: ${available}, Required: ${f.quantity_fulfilled}`);
      }
    }

    // Execute fulfillment mutations
    for (const f of fulfilledItems) {
      if (f.quantity_fulfilled <= 0) continue;
      const targetItem = items.find((i) => i.sku_id === f.sku_id)!;
      const newTotalFulfilled = Number(targetItem.quantity_fulfilled || 0) + f.quantity_fulfilled;

      // Update SO item
      targetItem.quantity_fulfilled = newTotalFulfilled;
      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          await getSupabaseClient()!
            .from('sales_order_items')
            .update({ quantity_fulfilled: newTotalFulfilled })
            .eq('id', targetItem.id);
        } catch (err) {
          console.warn('[InventoryRepository.fulfillSO] Supabase item update fallback:', err);
        }
      }
      this.mem.update('sales_order_items', targetItem.id, { quantity_fulfilled: newTotalFulfilled });

      // Deduct stock (-f.quantity_fulfilled)
      const { previousBalance, newBalance } = await this.upsertStock(
        schoolId,
        locationId,
        f.sku_id,
        -f.quantity_fulfilled
      );

      // Record immutable stock ledger entry
      await this.recordLedger({
        school_id: schoolId,
        location_id: locationId,
        sku_id: f.sku_id,
        movement_type: 'SALES_FULFILLMENT',
        reference_type: 'SALES_ORDER',
        reference_id: soId,
        quantity: -f.quantity_fulfilled,
        previous_balance: previousBalance,
        new_balance: newBalance,
        unit_cost: Number(targetItem.unit_price || 0),
        notes: `SO Fulfillment ${so.so_number} for ${so.customer_name}`,
        created_by: fulfilledBy,
      });
    }

    // Check completion status
    const reloadedSo = await this.getSalesOrderById(soId, schoolId);
    for (const item of reloadedSo?.items || []) {
      if (Number(item.quantity_fulfilled || 0) < Number(item.quantity_ordered)) {
        allCompleted = false;
        break;
      }
    }

    const newStatus = allCompleted ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
    return await this.updateSalesOrder(soId, schoolId, { status: newStatus });
  }

  // ======================================================================
  // 11. Direct Stock In, Stock Out, Adjustments
  // ======================================================================

  async createStockIn(
    header: Omit<InventoryStockIn, 'id' | 'created_at' | 'items'>,
    items: Omit<InventoryStockInDetail, 'id' | 'stock_in_id'>[]
  ): Promise<InventoryStockIn> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: InventoryStockIn = { ...header, id, created_at: now };
    const detailRecords: InventoryStockInDetail[] = items.map((it) => ({
      ...it,
      id: crypto.randomUUID(),
      stock_in_id: id,
    }));

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!.from('inventory_stock_in').insert(record);
        await getSupabaseClient()!.from('inventory_stock_in_details').insert(detailRecords);
      } catch (err) {
        console.warn('[InventoryRepository.createStockIn] Supabase fallback:', err);
      }
    }
    this.mem.insert('inventory_stock_in', record);
    for (const d of detailRecords) this.mem.insert('inventory_stock_in_details', d);

    // Apply stock and ledger movements
    for (const d of detailRecords) {
      const { previousBalance, newBalance } = await this.upsertStock(
        header.school_id,
        header.location_id,
        d.sku_id,
        d.quantity
      );
      await this.recordLedger({
        school_id: header.school_id,
        location_id: header.location_id,
        sku_id: d.sku_id,
        movement_type: 'STOCK_IN',
        reference_type: 'STOCK_IN',
        reference_id: id,
        quantity: d.quantity,
        previous_balance: previousBalance,
        new_balance: newBalance,
        unit_cost: d.unit_cost,
        notes: `Stock In ${header.receipt_number}`,
        created_by: header.created_by,
      });
    }

    record.items = detailRecords;
    return record;
  }

  async getStockIns(schoolId: string, locationId?: string): Promise<InventoryStockIn[]> {
    let list: InventoryStockIn[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('inventory_stock_in')
          .select('*, vendor:inventory_vendors(*), location:locations(*), items:inventory_stock_in_details(*, sku:skus(*, product:products(*)))')
          .eq('school_id', schoolId);
        if (locationId) q = q.eq('location_id', locationId);
        const { data, error } = await q.order('created_at', { ascending: false });
        if (!error && data) list = data as InventoryStockIn[];
      } catch (err) {
        console.warn('[InventoryRepository.getStockIns] Supabase fallback:', err);
      }
    }
    if (list.length === 0) {
      list = this.mem.findAll('inventory_stock_in', (s: InventoryStockIn) => {
        if (s.school_id !== schoolId) return false;
        if (locationId && s.location_id !== locationId) return false;
        return true;
      }).sort((a: InventoryStockIn, b: InventoryStockIn) => b.created_at.localeCompare(a.created_at));

      for (const s of list) {
        if (s.vendor_id) s.vendor = this.mem.findById('inventory_vendors', s.vendor_id) as InventoryVendor;
        s.location = this.mem.findById('locations', s.location_id) as Location;
        const details = this.mem.findAll('inventory_stock_in_details', (d: InventoryStockInDetail) => d.stock_in_id === s.id);
        for (const it of details) {
          it.sku = this.mem.findById('skus', it.sku_id) as SKU;
          if (it.sku && it.sku.product_id) it.sku.product = this.mem.findById('products', it.sku.product_id) as Product;
        }
        s.items = details;
      }
    }
    return list;
  }

  async createStockOut(
    header: Omit<InventoryStockOut, 'id' | 'created_at' | 'items'>,
    items: Omit<InventoryStockOutDetail, 'id' | 'stock_out_id'>[]
  ): Promise<InventoryStockOut> {
    // Pre-flight check stock
    for (const it of items) {
      const current = await this.getStockBySkuAndLocation(header.school_id, header.location_id, it.sku_id);
      const avail = current ? Number(current.quantity || 0) : 0;
      if (avail < it.quantity) {
        throw new Error(`Insufficient stock for SKU ${it.sku_id}. Available: ${avail}, Requested: ${it.quantity}`);
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: InventoryStockOut = { ...header, id, created_at: now };
    const detailRecords: InventoryStockOutDetail[] = items.map((it) => ({
      ...it,
      id: crypto.randomUUID(),
      stock_out_id: id,
    }));

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!.from('inventory_stock_out').insert(record);
        await getSupabaseClient()!.from('inventory_stock_out_details').insert(detailRecords);
      } catch (err) {
        console.warn('[InventoryRepository.createStockOut] Supabase fallback:', err);
      }
    }
    this.mem.insert('inventory_stock_out', record);
    for (const d of detailRecords) this.mem.insert('inventory_stock_out_details', d);

    // Apply stock and ledger movements
    for (const d of detailRecords) {
      const { previousBalance, newBalance } = await this.upsertStock(
        header.school_id,
        header.location_id,
        d.sku_id,
        -d.quantity
      );
      await this.recordLedger({
        school_id: header.school_id,
        location_id: header.location_id,
        sku_id: d.sku_id,
        movement_type: 'STOCK_OUT',
        reference_type: 'STOCK_OUT',
        reference_id: id,
        quantity: -d.quantity,
        previous_balance: previousBalance,
        new_balance: newBalance,
        unit_cost: d.unit_price,
        notes: `Stock Out ${header.issue_number}`,
        created_by: header.created_by,
      });
    }

    record.items = detailRecords;
    return record;
  }

  async getStockOuts(schoolId: string, locationId?: string): Promise<InventoryStockOut[]> {
    let list: InventoryStockOut[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('inventory_stock_out')
          .select('*, location:locations(*), items:inventory_stock_out_details(*, sku:skus(*, product:products(*)))')
          .eq('school_id', schoolId);
        if (locationId) q = q.eq('location_id', locationId);
        const { data, error } = await q.order('created_at', { ascending: false });
        if (!error && data) list = data as InventoryStockOut[];
      } catch (err) {
        console.warn('[InventoryRepository.getStockOuts] Supabase fallback:', err);
      }
    }
    if (list.length === 0) {
      list = this.mem.findAll('inventory_stock_out', (s: InventoryStockOut) => {
        if (s.school_id !== schoolId) return false;
        if (locationId && s.location_id !== locationId) return false;
        return true;
      }).sort((a: InventoryStockOut, b: InventoryStockOut) => b.created_at.localeCompare(a.created_at));

      for (const s of list) {
        s.location = this.mem.findById('locations', s.location_id) as Location;
        const details = this.mem.findAll('inventory_stock_out_details', (d: InventoryStockOutDetail) => d.stock_out_id === s.id);
        for (const it of details) {
          it.sku = this.mem.findById('skus', it.sku_id) as SKU;
          if (it.sku && it.sku.product_id) it.sku.product = this.mem.findById('products', it.sku.product_id) as Product;
        }
        s.items = details;
      }
    }
    return list;
  }

  async createAdjustment(
    header: Omit<InventoryAdjustment, 'id' | 'created_at' | 'items'>,
    items: Omit<InventoryAdjustmentDetail, 'id' | 'adjustment_id'>[]
  ): Promise<InventoryAdjustment> {
    // Check decrease adjustments first
    for (const it of items) {
      if (it.adjustment_type === 'DECREASE') {
        const cur = await this.getStockBySkuAndLocation(header.school_id, header.location_id, it.sku_id);
        const avail = cur ? Number(cur.quantity || 0) : 0;
        if (avail < it.quantity) {
          throw new Error(`Cannot decrease stock below 0 for SKU ${it.sku_id}. Current: ${avail}, Adjustment: -${it.quantity}`);
        }
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: InventoryAdjustment = { ...header, id, created_at: now };
    const detailRecords: InventoryAdjustmentDetail[] = items.map((it) => ({
      ...it,
      id: crypto.randomUUID(),
      adjustment_id: id,
    }));

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!.from('inventory_adjustments').insert(record);
        await getSupabaseClient()!.from('inventory_adjustment_details').insert(detailRecords);
      } catch (err) {
        console.warn('[InventoryRepository.createAdjustment] Supabase fallback:', err);
      }
    }
    this.mem.insert('inventory_adjustments', record);
    for (const d of detailRecords) this.mem.insert('inventory_adjustment_details', d);

    // Apply adjustments
    for (const d of detailRecords) {
      const delta = d.adjustment_type === 'INCREASE' ? d.quantity : -d.quantity;
      const moveType = d.adjustment_type === 'INCREASE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

      const { previousBalance, newBalance } = await this.upsertStock(
        header.school_id,
        header.location_id,
        d.sku_id,
        delta
      );

      await this.recordLedger({
        school_id: header.school_id,
        location_id: header.location_id,
        sku_id: d.sku_id,
        movement_type: moveType,
        reference_type: 'ADJUSTMENT',
        reference_id: id,
        quantity: delta,
        previous_balance: previousBalance,
        new_balance: newBalance,
        unit_cost: d.unit_cost,
        notes: `Adjustment ${header.adjustment_number} (${header.reason}): ${d.remarks || ''}`,
        created_by: header.created_by,
      });
    }

    record.items = detailRecords;
    return record;
  }

  async getAdjustments(schoolId: string, locationId?: string): Promise<InventoryAdjustment[]> {
    let list: InventoryAdjustment[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('inventory_adjustments')
          .select('*, location:locations(*), items:inventory_adjustment_details(*, sku:skus(*, product:products(*)))')
          .eq('school_id', schoolId);
        if (locationId) q = q.eq('location_id', locationId);
        const { data, error } = await q.order('created_at', { ascending: false });
        if (!error && data) list = data as InventoryAdjustment[];
      } catch (err) {
        console.warn('[InventoryRepository.getAdjustments] Supabase fallback:', err);
      }
    }
    if (list.length === 0) {
      list = this.mem.findAll('inventory_adjustments', (a: InventoryAdjustment) => {
        if (a.school_id !== schoolId) return false;
        if (locationId && a.location_id !== locationId) return false;
        return true;
      }).sort((a: InventoryAdjustment, b: InventoryAdjustment) => b.created_at.localeCompare(a.created_at));

      for (const a of list) {
        a.location = this.mem.findById('locations', a.location_id) as Location;
        const details = this.mem.findAll('inventory_adjustment_details', (d: InventoryAdjustmentDetail) => d.adjustment_id === a.id);
        for (const it of details) {
          it.sku = this.mem.findById('skus', it.sku_id) as SKU;
          if (it.sku && it.sku.product_id) it.sku.product = this.mem.findById('products', it.sku.product_id) as Product;
        }
        a.items = details;
      }
    }
    return list;
  }

  // ======================================================================
  // 12. Dashboard & Reporting Analytics
  // ======================================================================

  async getDashboardStats(schoolId: string, locationId?: string): Promise<InventoryDashboardStats> {
    const products = await this.getProducts(schoolId);
    const skus = await this.getSKUs(schoolId);
    const stockList = await this.getStock(schoolId, { locationId });

    let totalUnits = 0;
    let totalValuation = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const st of stockList) {
      const qty = Number(st.quantity || 0);
      const cost = Number(st.sku?.cost_price || 0);
      totalUnits += qty;
      totalValuation += qty * cost;

      const reorderPt = Number(st.reorder_point || st.sku?.reorder_level || 10);
      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= reorderPt) {
        lowStockCount++;
      }
    }

    const pos = await this.getPurchaseOrders(schoolId, { locationId });
    const pendingPOs = pos.filter((p) => p.status === 'ORDERED' || p.status === 'PARTIALLY_RECEIVED').length;

    const sos = await this.getSalesOrders(schoolId, { locationId });
    const pendingSOs = sos.filter((s) => s.status === 'CONFIRMED' || s.status === 'PARTIALLY_FULFILLED').length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const ledger = await this.getLedger(schoolId, { locationId, startDate: todayStr, limit: 10 });

    // Category distribution
    const catMap = new Map<string, number>();
    for (const p of products) {
      const cName = p.category?.name || 'Unassigned';
      catMap.set(cName, (catMap.get(cName) || 0) + 1);
    }
    const topCategories = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total_products: products.length,
      total_skus: skus.length,
      total_stock_units: totalUnits,
      total_stock_valuation: Math.round(totalValuation * 100) / 100,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount,
      pending_pos_count: pendingPOs,
      pending_sos_count: pendingSOs,
      today_movements_count: ledger.total,
      top_categories: topCategories,
      recent_activities: ledger.data.slice(0, 8),
    };
  }

  async getStockValuationReport(schoolId: string, locationId?: string): Promise<StockValuationReportItem[]> {
    const stockList = await this.getStock(schoolId, { locationId });
    return stockList.map((st) => {
      const qty = Number(st.quantity || 0);
      const cost = Number(st.sku?.cost_price || 0);
      const sell = Number(st.sku?.selling_price || 0);
      const reorderLevel = Number(st.reorder_point || st.sku?.reorder_level || 10);

      let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (qty <= 0) status = 'OUT_OF_STOCK';
      else if (qty <= reorderLevel) status = 'LOW_STOCK';

      return {
        sku_id: st.sku_id,
        sku_code: st.sku?.sku_code || '',
        barcode: st.sku?.barcode || undefined,
        product_name: st.sku?.product?.name || '',
        category_name: st.sku?.product?.category?.name || '',
        location_id: st.location_id,
        location_name: st.location?.location_name || '',
        quantity: qty,
        cost_price: cost,
        selling_price: sell,
        total_cost_valuation: Math.round(qty * cost * 100) / 100,
        total_selling_valuation: Math.round(qty * sell * 100) / 100,
        reorder_level: reorderLevel,
        stock_status: status,
      };
    });
  }

  async getLowStockAlerts(schoolId: string, locationId?: string): Promise<LowStockAlertItem[]> {
    const stockList = await this.getStock(schoolId, { locationId });
    const alerts: LowStockAlertItem[] = [];

    for (const st of stockList) {
      const qty = Number(st.quantity || 0);
      const reorderLevel = Number(st.sku?.reorder_level || 10);
      const reorderPt = Number(st.reorder_point || reorderLevel);
      const minQty = Number(st.sku?.min_order_qty || 1);

      if (qty <= reorderPt) {
        const deficit = Math.max(reorderPt - qty, 0);
        const suggested = Math.max(deficit, minQty);
        alerts.push({
          sku_id: st.sku_id,
          sku_code: st.sku?.sku_code || '',
          product_name: st.sku?.product?.name || '',
          location_id: st.location_id,
          location_name: st.location?.location_name || '',
          current_quantity: qty,
          reorder_level: reorderLevel,
          reorder_point: reorderPt,
          min_order_qty: minQty,
          cost_price: Number(st.sku?.cost_price || 0),
          suggested_order_qty: suggested,
        });
      }
    }

    return alerts.sort((a, b) => a.current_quantity - b.current_quantity);
  }
}

export const inventoryRepository = new InventoryRepository();
