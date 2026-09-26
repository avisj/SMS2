// ========================================================================
// Audit Repository
// Immutable Audit Ledger for Compliance & Tenant Tracking
// ========================================================================

import { getMemoryDbClient } from '../db/client.js';
import { AuditLog, User } from '../types/index.js';

export interface AuditFilters {
  schoolId?: string | null;
  locationId?: string;
  userId?: string;
  recordId?: string;
  module?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export class AuditRepository {
  private mem = getMemoryDbClient();

  async log(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    return this.mem.insert('audit_logs', {
      ...entry,
      created_at: new Date().toISOString(),
    }) as AuditLog;
  }

  async findLogs(filters: AuditFilters): Promise<{ logs: AuditLog[]; total: number }> {
    const raw = this.mem.findAll('audit_logs', (row: AuditLog) => {
      // If tenant specified (or null for platform)
      if (filters.schoolId !== undefined) {
        if (filters.schoolId === null) {
          if (row.school_id !== null) return false;
        } else {
          if (row.school_id !== filters.schoolId) return false;
        }
      }

      if (filters.locationId && row.location_id !== filters.locationId) return false;
      if (filters.userId && row.user_id !== filters.userId) return false;
      if (filters.recordId && row.record_id !== filters.recordId) return false;
      if (filters.module && row.module.toLowerCase() !== filters.module.toLowerCase()) return false;
      if (filters.action && row.action.toUpperCase() !== filters.action.toUpperCase()) return false;

      return true;
    });

    // Sort descending by created_at
    raw.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = raw.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    const paginated = raw.slice(offset, offset + limit);

    // Enrich with username
    const enriched: AuditLog[] = [];
    for (const item of paginated) {
      let username = 'SYSTEM';
      if (item.user_id) {
        const u = this.mem.findById('users', item.user_id) as User | null;
        if (u) username = `${u.first_name} ${u.last_name || ''}`.trim() || u.username;
      }
      enriched.push({
        ...item,
        username,
      });
    }

    return { logs: enriched, total };
  }
}

export const auditRepository = new AuditRepository();
