// ========================================================================
// School Repository
// Tenant-Level Data Access
// ========================================================================

import { getMemoryDbClient, getDatabaseClient, getSupabaseClient, isPostgresDatabaseActive, isSupabaseDatabaseActive, markSupabaseUnreachable, PostgresDatabaseClient } from '../db/client.js';
import { School } from '../types/index.js';

export class SchoolRepository {
  private mem = getMemoryDbClient();

  private get pg(): PostgresDatabaseClient | null {
    if (isPostgresDatabaseActive()) {
      const client = getDatabaseClient();
      if (client instanceof PostgresDatabaseClient) return client;
    }
    return null;
  }

  async findAll(options?: { includeDeleted?: boolean }): Promise<School[]> {
    if (this.pg) {
      const where = options?.includeDeleted ? undefined : 'deleted_at IS NULL ORDER BY school_name ASC';
      return this.pg.findAll<School>('schools', where);
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!.from('schools').select('*');
        if (!options?.includeDeleted) {
          query = query.is('deleted_at', null);
        }
        const { data, error } = await query.order('school_name', { ascending: true });
        if (error) {
          markSupabaseUnreachable(error.message);
          console.warn('[SchoolRepository] Supabase query warning:', error.message);
        } else if (data) {
          return data as School[];
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[SchoolRepository] Supabase connection failed, falling back to in-memory:', err.message);
      }
    }

    return this.mem.findAll('schools', (row: School) => {
      if (!options?.includeDeleted && row.deleted_at) return false;
      return true;
    });
  }

  async findById(id: string, options?: { includeDeleted?: boolean }): Promise<School | null> {
    if (this.pg) {
      const school = await this.pg.findById<School>('schools', id);
      if (!school) return null;
      if (!options?.includeDeleted && school.deleted_at) return null;
      return school;
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!.from('schools').select('*').eq('id', id);
        if (!options?.includeDeleted) {
          query = query.is('deleted_at', null);
        }
        const { data, error } = await query.maybeSingle();
        if (error) {
          markSupabaseUnreachable(error.message);
          console.warn('[SchoolRepository] Supabase query warning:', error.message);
        } else if (data) {
          return data as School;
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[SchoolRepository] Supabase connection failed, falling back to in-memory:', err.message);
      }
    }

    const school = this.mem.findById('schools', id) as School | null;
    if (!school) return null;
    if (!options?.includeDeleted && school.deleted_at) return null;
    return school;
  }

  async findByCode(code: string): Promise<School | null> {
    if (this.pg) {
      return this.pg.queryOne<School>(
        'SELECT * FROM schools WHERE LOWER(school_code) = LOWER($1) AND deleted_at IS NULL',
        [code]
      );
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('schools')
          .select('*')
          .ilike('school_code', code)
          .is('deleted_at', null)
          .maybeSingle();
        if (error) {
          markSupabaseUnreachable(error.message);
          console.warn('[SchoolRepository] Supabase query warning:', error.message);
        } else if (data) {
          return data as School;
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[SchoolRepository] Supabase connection failed, falling back to in-memory:', err.message);
      }
    }

    const list = this.mem.findAll('schools', (row: School) => 
      row.school_code.toLowerCase() === code.toLowerCase() && !row.deleted_at
    );
    return list[0] || null;
  }

  async create(data: Omit<School, 'id' | 'created_at' | 'updated_at'>): Promise<School> {
    if (this.pg) {
      return this.pg.insert<School>('schools', data);
    }
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: inserted, error } = await getSupabaseClient()!
          .from('schools')
          .insert(data)
          .select()
          .single();
        if (!error && inserted) return inserted as School;
        if (error) console.warn('[SchoolRepository] Supabase insert warning:', error.message);
      } catch (err: any) {
        console.warn('[SchoolRepository] Supabase insert failed, falling back to in-memory:', err.message);
      }
    }
    return this.mem.insert('schools', data) as School;
  }

  async update(id: string, updates: Partial<School>): Promise<School | null> {
    if (this.pg) {
      return this.pg.update<School>('schools', id, updates);
    }
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: updated, error } = await getSupabaseClient()!
          .from('schools')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .maybeSingle();
        if (!error && updated) return updated as School | null;
        if (error) console.warn('[SchoolRepository] Supabase update warning:', error.message);
      } catch (err: any) {
        console.warn('[SchoolRepository] Supabase update failed, falling back to in-memory:', err.message);
      }
    }
    return this.mem.update('schools', id, updates) as School | null;
  }

  async softDelete(id: string): Promise<boolean> {
    if (this.pg) {
      return this.pg.softDelete('schools', id);
    }
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('schools')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
        if (!error) return true;
        console.warn('[SchoolRepository] Supabase softDelete warning:', error.message);
      } catch (err: any) {
        console.warn('[SchoolRepository] Supabase softDelete failed, falling back to in-memory:', err.message);
      }
    }
    return this.mem.softDelete('schools', id);
  }
}

export const schoolRepository = new SchoolRepository();
