import pg from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env, isDatabaseConfigured } from '../config/env.js';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface IDatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  queryOne<T = any>(text: string, params?: any[]): Promise<T | null>;
  execute(text: string, params?: any[]): Promise<number>;
  close(): Promise<void>;
}

export interface ICloudDatabaseClient extends IDatabaseClient {
  testConnection(): Promise<{ ok: boolean; message?: string; error?: string }>;
  findById<T = any>(tableName: string, id: string): Promise<T | null>;
  findAll<T = any>(tableName: string, whereClause?: string, params?: any[]): Promise<T[]>;
  insert<T = any>(tableName: string, record: Record<string, any>): Promise<T>;
  update<T = any>(tableName: string, id: string, updates: Record<string, any>): Promise<T | null>;
  delete(tableName: string, id: string): Promise<boolean>;
  softDelete(tableName: string, id: string): Promise<boolean>;
}

// ------------------------------------------------------------------------
// 1. PostgreSQL / Supabase Client (Production)
// ------------------------------------------------------------------------
export class PostgresDatabaseClient implements ICloudDatabaseClient {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('[Postgres Pool Error]', err.message);
    });
  }

  getPool(): pg.Pool {
    return this.pool;
  }

  async testConnection(): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const res = await this.pool.query('SELECT NOW() as now, version() as version');
      return {
        ok: true,
        message: `Connected successfully to PostgreSQL at ${res.rows[0].now}`,
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err.message || 'Connection failed',
      };
    }
  }

  async withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const res = await this.pool.query(text, params);
    return {
      rows: res.rows as T[],
      rowCount: res.rowCount || 0,
    };
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const res = await this.query<T>(text, params);
    return res.rows[0] || null;
  }

  async execute(text: string, params?: any[]): Promise<number> {
    const res = await this.pool.query(text, params);
    return res.rowCount || 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async findById<T = any>(tableName: string, id: string): Promise<T | null> {
    return this.queryOne<T>(`SELECT * FROM "${tableName}" WHERE id = $1`, [id]);
  }

  async findAll<T = any>(tableName: string, whereClause?: string, params?: any[]): Promise<T[]> {
    const sql = whereClause ? `SELECT * FROM "${tableName}" WHERE ${whereClause}` : `SELECT * FROM "${tableName}"`;
    const res = await this.query<T>(sql, params);
    return res.rows;
  }

  async insert<T = any>(tableName: string, record: Record<string, any>): Promise<T> {
    const id = record.id || crypto.randomUUID();
    const dataWithId: Record<string, any> = { ...record, id };
    const keys = Object.keys(dataWithId);
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map((k) => {
      const v = dataWithId[k];
      if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
        return JSON.stringify(v);
      }
      return v;
    });
    const sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) RETURNING *`;
    const res = await this.query<T>(sql, values);
    return res.rows[0];
  }

  async update<T = any>(tableName: string, id: string, updates: Record<string, any>): Promise<T | null> {
    const keys = Object.keys(updates).filter((k) => k !== 'id' && k !== 'created_at');
    if (keys.length === 0) return this.findById<T>(tableName, id);
    const setClauses = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const values = [
      id,
      ...keys.map((k) => {
        const v = updates[k];
        if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
          return JSON.stringify(v);
        }
        return v;
      }),
    ];
    const sql = `UPDATE "${tableName}" SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const res = await this.query<T>(sql, values);
    return res.rows[0] || null;
  }

  async delete(tableName: string, id: string): Promise<boolean> {
    const count = await this.execute(`DELETE FROM "${tableName}" WHERE id = $1`, [id]);
    return count > 0;
  }

  async softDelete(tableName: string, id: string): Promise<boolean> {
    const count = await this.execute(
      `UPDATE "${tableName}" SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return count > 0;
  }
}

// ------------------------------------------------------------------------
// 2. Portable In-Memory Relational Engine (For Local Testing & Offline Dev)
// Compatible with SQL CRUD, zero external dependencies required
// ------------------------------------------------------------------------
export class MemoryDatabaseClient implements IDatabaseClient {
  private tables: Map<string, Map<string, Record<string, any>>> = new Map();

  constructor() {
    this.initTables();
  }

  private initTables() {
    const tableNames = [
      'platform_settings',
      'platform_features',
      'schools',
      'locations',
      'user_types',
      'users',
      'data_scopes',
      'permissions',
      'roles',
      'role_permissions',
      'user_roles',
      'user_location_access',
      'user_class_access',
      'user_section_access',
      'school_features',
      'school_settings',
      'audit_logs',
      'designations',
      'user_categories',
      'user_subcategories',
      'user_tags',
      'user_labels',
      'user_category_assignments',
      'user_subcategory_assignments',
      'user_tag_assignments',
      'user_label_assignments',
      'student_profiles',
      'staff_profiles',
      'parent_student_relationships',
      'academic_sessions',
      'classes',
      'sections',
      'academic_class_sections',
      'subjects',
      'subject_groups',
      'subject_group_items',
      'academic_class_subjects',
      'student_academic_enrollments',
      'teacher_subject_assignments',
      'role_rights',
      'user_credentials',
      'student_previous_academic_records',
      'student_achievements',
      'staff_qualifications',
      'staff_professional_experience',
      'staff_certifications',
      'user_documents',
      'timetable_master',
      'timetable_details',
      'user_attendance',
      'attendance_status_master',
      'attendance_audit_log',
      'fee_heads',
      'fee_structures',
      'student_fee_demands',
      'fee_demand_adjustments',
      'fee_payments',
      'fee_payment_allocations',
      'fee_receipts',
      'fee_refunds',
      'exam_master',
      'exam_structures',
      'exam_structure_subjects',
      'exam_schedules',
      'grade_rules',
      'exam_marks',
      'exam_results',
      'exam_result_details',
      'user_type_master',
      'vehicles',
      'vehicle_driver_assignments',
      'transport_routes',
      'transport_route_stops',
      'student_transport_assignments',
      'transport_trips',
      'vehicle_location_history',
      'transport_driver_profiles',
      'inventory_categories',
      'inventory_subcategories',
      'inventory_uoms',
      'inventory_brands',
      'inventory_vendors',
      'products',
      'skus',
      'inventory_stock',
      'inventory_stock_ledger',
      'purchase_orders',
      'purchase_order_items',
      'sales_orders',
      'sales_order_items',
      'inventory_stock_in',
      'inventory_stock_in_details',
      'inventory_stock_out',
      'inventory_stock_out_details',
      'inventory_adjustments',
      'inventory_adjustment_details',
      'asset_categories',
      'asset_subcategories',
      'assets',
      'asset_assignments',
      'asset_movements',
      'asset_maintenance',
      'asset_disposals',
      'asset_documents',
      'library_settings',
      'library_categories',
      'library_authors',
      'library_publishers',
      'library_books',
      'library_book_authors',
      'library_book_copies',
      'library_members',
      'library_issues',
      'library_reservations',
      'library_fines',
      'library_lost_damaged',
      'admission_sources',
      'admission_enquiries',
      'admission_followups',
      'admission_applications',
    ];
    for (const table of tableNames) {
      this.tables.set(table, new Map());
    }
  }

  clear(): void {
    for (const table of this.tables.values()) {
      table.clear();
    }
  }

  getTable(name: string): Map<string, Record<string, any>> {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }

  // Direct table collection access for repositories
  findAll(tableName: string, filter?: (row: any) => boolean): any[] {
    const table = this.getTable(tableName);
    const all = Array.from(table.values());
    if (!filter) return all;
    return all.filter(filter);
  }

  find<T = any>(tableName: string, filter?: (row: any) => boolean): T[] {
    return this.findAll(tableName, filter) as T[];
  }

  findById<T = any>(tableName: string, id: string): T | null {
    const table = this.getTable(tableName);
    return (table.get(id) as T) || null;
  }

  findOne(tableName: string, filter: (row: any) => boolean): any | null {
    const table = this.getTable(tableName);
    for (const row of table.values()) {
      if (filter(row)) return row;
    }
    return null;
  }

  insert(tableName: string, record: Record<string, any>): any {
    const table = this.getTable(tableName);
    const id = record.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const row = {
      ...record,
      id,
      created_at: record.created_at || now,
      updated_at: record.updated_at || now,
    };
    table.set(id, row);
    return row;
  }

  update(tableName: string, id: string, updates: Record<string, any>): any | null {
    const table = this.getTable(tableName);
    const existing = table.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    table.set(id, updated);
    return updated;
  }

  delete(tableName: string, id: string): boolean {
    const table = this.getTable(tableName);
    return table.delete(id);
  }

  softDelete(tableName: string, id: string): boolean {
    const table = this.getTable(tableName);
    const existing = table.get(id);
    if (!existing) return false;
    existing.deleted_at = new Date().toISOString();
    existing.updated_at = new Date().toISOString();
    table.set(id, existing);
    return true;
  }

  // Generic fallback query simulation
  async query<T = any>(_text: string, _params?: any[]): Promise<QueryResult<T>> {
    return { rows: [], rowCount: 0 };
  }

  async queryOne<T = any>(_text: string, _params?: any[]): Promise<T | null> {
    return null;
  }

  async execute(_text: string, _params?: any[]): Promise<number> {
    return 0;
  }

  async close(): Promise<void> {}
}

let supabaseClient: SupabaseClient | null = null;
let supabaseHealthy: boolean = false;
let lastSupabaseCheck: number = 0;
let healthCheckInProgress: boolean = false;

if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_URL.includes('your-project')) {
  supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const getSupabaseClient = (): SupabaseClient | null => supabaseClient;

export function markSupabaseUnreachable(reason?: string) {
  if (supabaseHealthy) {
    console.warn(`[Supabase Circuit Breaker] Marked unreachable (${reason || 'network failure'}). Switching immediately to in-memory engine.`);
  }
  supabaseHealthy = false;
  lastSupabaseCheck = Date.now();
  if (activeDbClient instanceof SupabaseDatabaseClient) {
    activeDbClient = null;
  }
}

export function markSupabaseHealthy() {
  if (!supabaseHealthy) {
    console.log('[Supabase Circuit Breaker] Connection verified healthy. Cloud database active.');
  }
  supabaseHealthy = true;
  lastSupabaseCheck = Date.now();
}

export function isSupabaseDatabaseActive(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (!supabaseClient) return false;
  return supabaseHealthy;
}

export async function probeSupabaseHealth(): Promise<boolean> {
  if (!supabaseClient || healthCheckInProgress) return supabaseHealthy;
  healthCheckInProgress = true;
  try {
    const timeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase probe timed out after 2000ms')), 2000)
    );
    const queryPromise = supabaseClient.from('schools').select('id').limit(1);
    const res: any = await Promise.race([queryPromise, timeoutPromise]);
    if (res.error) throw res.error;
    markSupabaseHealthy();
    return true;
  } catch (err: any) {
    markSupabaseUnreachable(err.message);
    return false;
  } finally {
    healthCheckInProgress = false;
  }
}

export class SupabaseDatabaseClient implements ICloudDatabaseClient {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async testConnection(): Promise<{ ok: boolean; message?: string; error?: string }> {
    try {
      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out after 2000ms')), 2000)
      );
      const queryPromise = this.client.from('schools').select('id, school_code').limit(1);
      const res: any = await Promise.race([queryPromise, timeoutPromise]);
      if (res.error) throw res.error;
      markSupabaseHealthy();
      return {
        ok: true,
        message: `Connected successfully to Supabase cloud database (${res.data?.length || 0} tenant schools verified)`,
      };
    } catch (err: any) {
      markSupabaseUnreachable(err.message);
      return { ok: false, error: err.message || 'Supabase connection failed' };
    }
  }

  async findById<T = any>(tableName: string, id: string): Promise<T | null> {
    try {
      const { data, error } = await this.client.from(tableName).select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error(`[Supabase findById ${tableName}] Error:`, error.message);
        return null;
      }
      return data as T | null;
    } catch (err: any) {
      markSupabaseUnreachable(err.message);
      console.warn(`[Supabase findById ${tableName}] Network/Fetch Error:`, err.message);
      return null;
    }
  }

  async findAll<T = any>(tableName: string, whereClause?: string, _params?: any[]): Promise<T[]> {
    try {
      let query = this.client.from(tableName).select('*');
      if (whereClause && whereClause.includes('deleted_at IS NULL')) {
        query = query.is('deleted_at', null);
      }
      const { data, error } = await query;
      if (error) {
        console.error(`[Supabase findAll ${tableName}] Error:`, error.message);
        return [];
      }
      return (data || []) as T[];
    } catch (err: any) {
      markSupabaseUnreachable(err.message);
      console.warn(`[Supabase findAll ${tableName}] Network/Fetch Error:`, err.message);
      return [];
    }
  }

  async insert<T = any>(tableName: string, record: Record<string, any>): Promise<T> {
    const id = record.id || crypto.randomUUID();
    const dataWithId: Record<string, any> = { ...record, id };
    try {
      const { data, error } = await this.client.from(tableName).insert(dataWithId).select().single();
      if (error) {
        console.error(`[Supabase insert ${tableName}] Error:`, error.message);
        throw new Error(`Supabase insert error on ${tableName}: ${error.message}`);
      }
      return data as T;
    } catch (err: any) {
      markSupabaseUnreachable(err.message);
      console.warn(`[Supabase insert ${tableName}] Network/Fetch Error:`, err.message);
      throw err;
    }
  }

  async update<T = any>(tableName: string, id: string, updates: Record<string, any>): Promise<T | null> {
    try {
      const { data, error } = await this.client
        .from(tableName)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) {
        console.error(`[Supabase update ${tableName}] Error:`, error.message);
        throw new Error(`Supabase update error on ${tableName}: ${error.message}`);
      }
      return data as T | null;
    } catch (err: any) {
      markSupabaseUnreachable(err.message);
      console.warn(`[Supabase update ${tableName}] Network/Fetch Error:`, err.message);
      throw err;
    }
  }

  async delete(tableName: string, id: string): Promise<boolean> {
    try {
      const { error } = await this.client.from(tableName).delete().eq('id', id);
      return !error;
    } catch (err: any) {
      markSupabaseUnreachable(err.message);
      console.warn(`[Supabase delete ${tableName}] Network/Fetch Error:`, err.message);
      return false;
    }
  }

  async softDelete(tableName: string, id: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from(tableName)
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      return !error;
    } catch (err: any) {
      markSupabaseUnreachable(err.message);
      console.warn(`[Supabase softDelete ${tableName}] Network/Fetch Error:`, err.message);
      return false;
    }
  }

  async query<T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
    // Special optimization: timetable version generation
    if (text.includes('COALESCE(MAX(version_no)') && text.includes('timetable_master')) {
      const { data } = await this.client
        .from('timetable_master')
        .select('version_no')
        .eq('school_id', params[0])
        .eq('academic_session_id', params[1])
        .eq('location_id', params[2])
        .order('version_no', { ascending: false })
        .limit(1);
      const maxVer = data && data[0]?.version_no ? Number(data[0].version_no) : 0;
      return { rows: [{ next_ver: maxVer + 1 } as any], rowCount: 1 };
    }

    // Extract table name from FROM clause
    const fromMatch = text.match(/\bFROM\s+"?([a-zA-Z0-9_]+)"?/i);
    if (!fromMatch) {
      return { rows: [], rowCount: 0 };
    }
    const tableName = fromMatch[1];
    let q = this.client.from(tableName).select('*');

    // Extract WHERE clause
    const whereMatch = text.match(/\bWHERE\b\s+([\s\S]*?)(?:\s+\bORDER BY\b|\s+\bLIMIT\b|$)/i);
    if (whereMatch) {
      const whereStr = whereMatch[1].trim();
      const conditions = whereStr.split(/\s+\bAND\b\s+/i);
      for (const cond of conditions) {
        const c = cond.trim();
        if (!c) continue;

        if (/^(?:[a-zA-Z0-9_]+\.)?deleted_at\s+IS\s+NULL$/i.test(c)) {
          q = q.is('deleted_at', null);
          continue;
        }

        const isNullMatch = c.match(/^(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s+IS\s+NULL$/i);
        if (isNullMatch) {
          q = q.is(isNullMatch[1], null);
          continue;
        }

        if (/^(?:[a-zA-Z0-9_]+\.)?is_current\s*=\s*TRUE$/i.test(c)) {
          q = q.eq('is_current', true);
          continue;
        }

        if (/^(?:[a-zA-Z0-9_]+\.)?is_current\s*=\s*FALSE$/i.test(c)) {
          q = q.eq('is_current', false);
          continue;
        }

        const literalEq = c.match(/^(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*=\s*'([^']+)'$/i);
        if (literalEq) {
          q = q.eq(literalEq[1], literalEq[2]);
          continue;
        }

        const ilikeMatch = c.match(/^(?:UPPER|LOWER)\((?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\)\s*=\s*(?:UPPER|LOWER)\(\$(\d+)\)$/i);
        if (ilikeMatch) {
          const col = ilikeMatch[1];
          const paramIdx = parseInt(ilikeMatch[2], 10) - 1;
          q = q.ilike(col, params[paramIdx]);
          continue;
        }

        const lowerEqMatch = c.match(/^LOWER\((?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\)\s*=\s*\$(\d+)$/i);
        if (lowerEqMatch) {
          const col = lowerEqMatch[1];
          const paramIdx = parseInt(lowerEqMatch[2], 10) - 1;
          q = q.ilike(col, params[paramIdx]);
          continue;
        }

        const anyMatch = c.match(/^(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*=\s*ANY\(\$(\d+)\)$/i);
        if (anyMatch) {
          const col = anyMatch[1];
          const paramIdx = parseInt(anyMatch[2], 10) - 1;
          const arr = params[paramIdx];
          if (Array.isArray(arr)) {
            q = q.in(col, arr);
          }
          continue;
        }

        const neqMatch = c.match(/^(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*(?:<>|!=)\s*\$(\d+)$/i);
        if (neqMatch) {
          const col = neqMatch[1];
          const paramIdx = parseInt(neqMatch[2], 10) - 1;
          q = q.neq(col, params[paramIdx]);
          continue;
        }

        const eqMatch = c.match(/^(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*=\s*\$(\d+)$/i);
        if (eqMatch) {
          const col = eqMatch[1];
          const paramIdx = parseInt(eqMatch[2], 10) - 1;
          q = q.eq(col, params[paramIdx]);
          continue;
        }
      }
    }

    // Parse ORDER BY
    const orderMatch = text.match(/\bORDER BY\b\s+([\s\S]*?)(?:\s+\bLIMIT\b|$)/i);
    if (orderMatch) {
      const orderItems = orderMatch[1].split(',').map((s) => s.trim());
      for (const item of orderItems) {
        const parts = item.split(/\s+/);
        let col = parts[0];
        if (col.includes('.')) col = col.split('.').pop()!;
        const ascending = parts.length > 1 ? parts[1].toUpperCase() !== 'DESC' : true;
        q = q.order(col, { ascending });
      }
    }

    // Parse LIMIT
    const limitMatch = text.match(/\bLIMIT\b\s+(\d+)/i);
    if (limitMatch) {
      q = q.limit(parseInt(limitMatch[1], 10));
    }

    try {
      const { data, error } = await q;
      if (error) {
        console.error(`[Supabase query on ${tableName}] Error:`, error.message);
        return { rows: [], rowCount: 0 };
      }
      return { rows: (data || []) as T[], rowCount: data?.length || 0 };
    } catch (err: any) {
      markSupabaseUnreachable(err.message);
      console.warn(`[Supabase query on ${tableName}] Network/Fetch Error:`, err.message);
      return { rows: [], rowCount: 0 };
    }
  }

  async queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
    const res = await this.query<T>(text, params);
    return res.rows[0] || null;
  }

  async execute(text: string, params: any[] = []): Promise<number> {
    const updateMatch = text.match(/^UPDATE\s+"?([a-zA-Z0-9_]+)"?\s+SET\s+([\s\S]*?)\s+WHERE\s+([\s\S]*)$/i);
    if (updateMatch) {
      const tableName = updateMatch[1];
      const setPart = updateMatch[2];
      const wherePart = updateMatch[3];

      const updates: Record<string, any> = {};
      const setClauses = setPart.split(',').map((s) => s.trim());
      for (const sc of setClauses) {
        if (/updated_at\s*=\s*NOW\(\)/i.test(sc)) {
          updates.updated_at = new Date().toISOString();
          continue;
        }
        const setBoolTrue = sc.match(/^([a-zA-Z0-9_]+)\s*=\s*TRUE$/i);
        if (setBoolTrue) {
          updates[setBoolTrue[1]] = true;
          continue;
        }
        const setBoolFalse = sc.match(/^([a-zA-Z0-9_]+)\s*=\s*FALSE$/i);
        if (setBoolFalse) {
          updates[setBoolFalse[1]] = false;
          continue;
        }
        const setStr = sc.match(/^([a-zA-Z0-9_]+)\s*=\s*'([^']+)'$/i);
        if (setStr) {
          updates[setStr[1]] = setStr[2];
          continue;
        }
        const setParam = sc.match(/^([a-zA-Z0-9_]+)\s*=\s*\$(\d+)$/i);
        if (setParam) {
          const col = setParam[1];
          const idx = parseInt(setParam[2], 10) - 1;
          updates[col] = params[idx];
          continue;
        }
      }

      let q = this.client.from(tableName).update(updates);
      const conditions = wherePart.split(/\s+\bAND\b\s+/i);
      for (const cond of conditions) {
        const c = cond.trim();
        const eqParam = c.match(/^(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*=\s*\$(\d+)$/i);
        if (eqParam) {
          q = q.eq(eqParam[1], params[parseInt(eqParam[2], 10) - 1]);
          continue;
        }
        const neqParam = c.match(/^(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*(?:<>|!=)\s*\$(\d+)$/i);
        if (neqParam) {
          q = q.neq(neqParam[1], params[parseInt(neqParam[2], 10) - 1]);
          continue;
        }
        const eqLiteral = c.match(/^(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*=\s*'([^']+)'$/i);
        if (eqLiteral) {
          q = q.eq(eqLiteral[1], eqLiteral[2]);
          continue;
        }
      }
      try {
        const { data, error } = await q.select('id');
        if (error) {
          console.error(`[Supabase update on ${tableName}] Error:`, error.message);
          return 0;
        }
        return data?.length || 1;
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn(`[Supabase update on ${tableName}] Network/Fetch Error:`, err.message);
        return 0;
      }
    }

    const deleteMatch = text.match(/^DELETE\s+FROM\s+"?([a-zA-Z0-9_]+)"?\s+WHERE\s+([\s\S]*)$/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1];
      const wherePart = deleteMatch[2];
      let q = this.client.from(tableName).delete();
      const conditions = wherePart.split(/\s+\bAND\b\s+/i);
      for (const cond of conditions) {
        const c = cond.trim();
        const eqParam = c.match(/^(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*=\s*\$(\d+)$/i);
        if (eqParam) {
          q = q.eq(eqParam[1], params[parseInt(eqParam[2], 10) - 1]);
          continue;
        }
      }
      try {
        const { error } = await q;
        if (error) {
          console.error(`[Supabase delete on ${tableName}] Error:`, error.message);
          return 0;
        }
        return 1;
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn(`[Supabase delete on ${tableName}] Network/Fetch Error:`, err.message);
        return 0;
      }
    }

    return 0;
  }

  async close(): Promise<void> {}
}

// ------------------------------------------------------------------------
// Factory Function & Connection State
// ------------------------------------------------------------------------
let activeDbClient: IDatabaseClient | null = null;
let activeMemoryClient: MemoryDatabaseClient | null = null;

export function isPostgresDatabaseActive(): boolean {
  return isDatabaseConfigured();
}

export function isCloudDatabaseActive(): boolean {
  return isPostgresDatabaseActive() || isSupabaseDatabaseActive();
}

export function getCloudDatabaseClient(): ICloudDatabaseClient | null {
  if (isPostgresDatabaseActive()) {
    return (getDatabaseClient() as PostgresDatabaseClient);
  }
  if (isSupabaseDatabaseActive() && supabaseClient) {
    return (getDatabaseClient() as SupabaseDatabaseClient);
  }
  return null;
}

export function getDatabaseClient(): IDatabaseClient {
  if (!activeDbClient) {
    if (isPostgresDatabaseActive()) {
      activeDbClient = new PostgresDatabaseClient(env.DATABASE_URL);
    } else if (isSupabaseDatabaseActive() && supabaseClient) {
      activeDbClient = new SupabaseDatabaseClient(supabaseClient);
    } else {
      activeMemoryClient = getMemoryDbClient();
      activeDbClient = activeMemoryClient;
    }
  }
  return activeDbClient;
}

export function getMemoryDbClient(): MemoryDatabaseClient {
  if (!activeMemoryClient) {
    activeMemoryClient = new MemoryDatabaseClient();
    if (!isDatabaseConfigured() && !isSupabaseDatabaseActive()) {
      activeDbClient = activeMemoryClient;
    }
  }
  return activeMemoryClient;
}

