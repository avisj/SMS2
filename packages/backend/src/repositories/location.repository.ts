// ========================================================================
// Location Repository
// Branch / Location Data Access with Tenant & Permitted Branch Scoping
// ========================================================================

import { getMemoryDbClient, getDatabaseClient, getSupabaseClient, isPostgresDatabaseActive, isSupabaseDatabaseActive, markSupabaseUnreachable, PostgresDatabaseClient } from '../db/client.js';
import { Location } from '../types/index.js';

export class LocationRepository {
  private mem = getMemoryDbClient();

  private get pg(): PostgresDatabaseClient | null {
    if (isPostgresDatabaseActive()) {
      const client = getDatabaseClient();
      if (client instanceof PostgresDatabaseClient) return client;
    }
    return null;
  }

  async findBySchoolId(
    schoolId: string,
    options?: {
      locationIds?: string[];
      includeDeleted?: boolean;
    }
  ): Promise<Location[]> {
    if (this.pg) {
      let sql = 'SELECT * FROM locations WHERE school_id = $1';
      const params: any[] = [schoolId];
      if (!options?.includeDeleted) {
        sql += ' AND deleted_at IS NULL';
      }
      if (options?.locationIds && options.locationIds.length > 0) {
        params.push(options.locationIds);
        sql += ` AND id = ANY($${params.length})`;
      }
      sql += ' ORDER BY location_name ASC';
      const res = await this.pg.query<Location>(sql, params);
      return res.rows;
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('locations')
          .select('*')
          .eq('school_id', schoolId);
        if (!options?.includeDeleted) {
          query = query.is('deleted_at', null);
        }
        if (options?.locationIds && options.locationIds.length > 0) {
          query = query.in('id', options.locationIds);
        }
        const { data, error } = await query.order('location_name', { ascending: true });
        if (error) {
          markSupabaseUnreachable(error.message);
          console.warn('[LocationRepository] Supabase query warning:', error.message);
        } else if (data) {
          return data as Location[];
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[LocationRepository] Supabase connection failed, falling back to in-memory:', err.message);
      }
    }

    return this.mem.findAll('locations', (row: Location) => {
      if (row.school_id !== schoolId) return false;
      if (!options?.includeDeleted && row.deleted_at) return false;
      if (options?.locationIds && options.locationIds.length > 0) {
        if (!options.locationIds.includes(row.id)) return false;
      }
      return true;
    });
  }

  async findById(id: string, schoolId?: string): Promise<Location | null> {
    if (this.pg) {
      let sql = 'SELECT * FROM locations WHERE id = $1 AND deleted_at IS NULL';
      const params: any[] = [id];
      if (schoolId) {
        params.push(schoolId);
        sql += ' AND school_id = $2';
      }
      return this.pg.queryOne<Location>(sql, params);
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('locations')
          .select('*')
          .eq('id', id)
          .is('deleted_at', null);
        if (schoolId) {
          query = query.eq('school_id', schoolId);
        }
        const { data, error } = await query.maybeSingle();
        if (error) {
          markSupabaseUnreachable(error.message);
          console.warn('[LocationRepository] Supabase query warning:', error.message);
        } else if (data) {
          return data as Location;
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[LocationRepository] Supabase connection failed, falling back to in-memory:', err.message);
      }
    }

    const loc = this.mem.findById('locations', id) as Location | null;
    if (!loc || loc.deleted_at) return null;
    if (schoolId && loc.school_id !== schoolId) return null;
    return loc;
  }

  async findByCode(schoolId: string, code: string): Promise<Location | null> {
    if (this.pg) {
      return this.pg.queryOne<Location>(
        'SELECT * FROM locations WHERE school_id = $1 AND LOWER(location_code) = LOWER($2) AND deleted_at IS NULL',
        [schoolId, code]
      );
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('locations')
          .select('*')
          .eq('school_id', schoolId)
          .ilike('location_code', code)
          .is('deleted_at', null)
          .maybeSingle();
        if (error) {
          markSupabaseUnreachable(error.message);
          console.warn('[LocationRepository] Supabase query warning:', error.message);
        } else if (data) {
          return data as Location;
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[LocationRepository] Supabase connection failed, falling back to in-memory:', err.message);
      }
    }

    const list = this.mem.findAll('locations', (row: Location) => 
      row.school_id === schoolId &&
      row.location_code.toLowerCase() === code.toLowerCase() &&
      !row.deleted_at
    );
    return list[0] || null;
  }

  async findBySchoolIdCode(code: string): Promise<Location | null> {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    if (this.pg) {
      return this.pg.queryOne<Location>(
        'SELECT * FROM locations WHERE UPPER(school_id_code) = UPPER($1) AND deleted_at IS NULL',
        [clean]
      );
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('locations')
          .select('*')
          .ilike('school_id_code', clean)
          .is('deleted_at', null)
          .maybeSingle();
        if (error) {
          markSupabaseUnreachable(error.message);
          console.warn('[LocationRepository] Supabase query warning:', error.message);
        } else if (data) {
          return data as Location;
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[LocationRepository] Supabase connection failed, falling back to in-memory:', err.message);
      }
    }

    const list = this.mem.findAll('locations', (row: Location) => 
      Boolean(row.school_id_code && row.school_id_code.toUpperCase() === clean && !row.deleted_at)
    );
    return list[0] || null;
  }

  generateSchoolIdCode(schoolCode: string, locationCode: string): string {
    const s = schoolCode.trim().toUpperCase();
    const l = locationCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    const existing = this.mem.findAll('locations', (row: Location) => 
      Boolean(row.school_id_code?.startsWith(`${s}-${l}`))
    );
    const seq = String(existing.length + 1).padStart(3, '0');
    return `${s}-${l}-${seq}`;
  }

  async create(data: Omit<Location, 'id' | 'created_at' | 'updated_at'>): Promise<Location> {
    if (this.pg) {
      return this.pg.insert<Location>('locations', data);
    }
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: inserted, error } = await getSupabaseClient()!
          .from('locations')
          .insert(data)
          .select()
          .single();
        if (!error && inserted) return inserted as Location;
        if (error) console.warn('[LocationRepository] Supabase insert warning:', error.message);
      } catch (err: any) {
        console.warn('[LocationRepository] Supabase insert failed, falling back to in-memory:', err.message);
      }
    }
    return this.mem.insert('locations', data) as Location;
  }

  async update(id: string, updates: Partial<Location>): Promise<Location | null> {
    if (this.pg) {
      return this.pg.update<Location>('locations', id, updates);
    }
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: updated, error } = await getSupabaseClient()!
          .from('locations')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .maybeSingle();
        if (!error && updated) return updated as Location | null;
        if (error) console.warn('[LocationRepository] Supabase update warning:', error.message);
      } catch (err: any) {
        console.warn('[LocationRepository] Supabase update failed, falling back to in-memory:', err.message);
      }
    }
    return this.mem.update('locations', id, updates) as Location | null;
  }

  async softDelete(id: string): Promise<boolean> {
    if (this.pg) {
      return this.pg.softDelete('locations', id);
    }
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('locations')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
        if (!error) return true;
        console.warn('[LocationRepository] Supabase softDelete warning:', error.message);
      } catch (err: any) {
        console.warn('[LocationRepository] Supabase softDelete failed, falling back to in-memory:', err.message);
      }
    }
    return this.mem.softDelete('locations', id);
  }
}

export const locationRepository = new LocationRepository();
