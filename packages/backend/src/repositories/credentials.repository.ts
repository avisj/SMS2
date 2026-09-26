// ========================================================================
// User Credentials Repository
// Storage and querying for dedicated authentication credentials
// ========================================================================

import { getMemoryDbClient, getDatabaseClient, getSupabaseClient, isPostgresDatabaseActive, isSupabaseDatabaseActive, markSupabaseUnreachable, PostgresDatabaseClient } from '../db/client.js';
import { UserCredential } from '../types/index.js';
import crypto from 'crypto';

export class CredentialsRepository {
  private get pg(): PostgresDatabaseClient | null {
    if (isPostgresDatabaseActive()) {
      const client = getDatabaseClient();
      if (client instanceof PostgresDatabaseClient) return client;
    }
    return null;
  }

  async findBySchoolIdAndUsername(schoolIdCode: string, username: string): Promise<UserCredential | null> {
    const cleanSchoolCode = schoolIdCode.trim().toUpperCase();
    const cleanUsername = username.trim().toLowerCase();

    if (this.pg) {
      return this.pg.queryOne<UserCredential>(
        'SELECT * FROM user_credentials WHERE UPPER(school_id_code) = UPPER($1) AND LOWER(username) = LOWER($2)',
        [cleanSchoolCode, cleanUsername]
      );
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('user_credentials')
          .select('*')
          .ilike('school_id_code', cleanSchoolCode)
          .ilike('username', cleanUsername)
          .maybeSingle();
        if (error) {
          markSupabaseUnreachable(error.message);
          console.warn('[CredentialsRepository] Supabase query warning:', error.message);
        } else if (data) {
          return data as UserCredential;
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[CredentialsRepository] Supabase connection failed, falling back to in-memory:', err.message);
      }
    }

    const mem = getMemoryDbClient();
    const list = mem.findAll('user_credentials', (c: any) => 
      c.school_id_code?.toUpperCase() === cleanSchoolCode && 
      c.username?.toLowerCase() === cleanUsername
    );
    return list[0] || null;
  }

  async findByUserId(userId: string): Promise<UserCredential[]> {
    if (this.pg) {
      return this.pg.findAll<UserCredential>('user_credentials', 'user_id = $1', [userId]);
    }
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('user_credentials')
          .select('*')
          .eq('user_id', userId);
        if (error) {
          markSupabaseUnreachable(error.message);
          console.warn('[CredentialsRepository] Supabase query warning:', error.message);
        } else if (data) {
          return data as UserCredential[];
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[CredentialsRepository] Supabase connection failed, falling back to in-memory:', err.message);
      }
    }
    const mem = getMemoryDbClient();
    return mem.findAll('user_credentials', (c: any) => c.user_id === userId);
  }

  async findById(id: string): Promise<UserCredential | null> {
    if (this.pg) {
      return this.pg.findById<UserCredential>('user_credentials', id);
    }
    const mem = getMemoryDbClient();
    return mem.findById('user_credentials', id) || null;
  }

  async create(data: {
    user_id: string;
    school_id: string;
    location_id: string;
    school_id_code: string;
    username: string;
    password_hash: string;
    login_status?: 'ACTIVE' | 'DISABLED';
    is_super_admin?: boolean;
  }): Promise<UserCredential> {
    const mem = getMemoryDbClient();
    const cleanSchoolCode = data.school_id_code.trim().toUpperCase();
    const cleanUsername = data.username.trim().toLowerCase();

    // Enforce uniqueness of (school_id_code, username)
    const existing = await this.findBySchoolIdAndUsername(cleanSchoolCode, cleanUsername);
    if (existing) {
      throw new Error(`User ID '${data.username}' is already registered for School ID '${data.school_id_code}'`);
    }

    const newCred: UserCredential = {
      id: crypto.randomUUID(),
      user_id: data.user_id,
      school_id: data.school_id,
      location_id: data.location_id,
      school_id_code: cleanSchoolCode,
      username: cleanUsername,
      password_hash: data.password_hash,
      login_status: data.login_status || 'ACTIVE',
      is_super_admin: data.is_super_admin || false,
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: null,
      password_changed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.pg) {
      return this.pg.insert<UserCredential>('user_credentials', newCred);
    }

    mem.insert('user_credentials', newCred);
    return newCred;
  }

  async update(id: string, updates: Partial<UserCredential>): Promise<UserCredential | null> {
    if (this.pg) {
      return this.pg.update<UserCredential>('user_credentials', id, updates);
    }
    const mem = getMemoryDbClient();
    const updated = mem.update('user_credentials', id, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
    return updated || null;
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    if (this.pg) {
      const res = await this.pg.execute('DELETE FROM user_credentials WHERE user_id = $1', [userId]);
      return res > 0;
    }
    const mem = getMemoryDbClient();
    const creds = await this.findByUserId(userId);
    for (const c of creds) {
      mem.delete('user_credentials', c.id);
    }
    return true;
  }
}

export const credentialsRepository = new CredentialsRepository();
