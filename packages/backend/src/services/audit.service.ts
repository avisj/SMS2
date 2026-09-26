// ========================================================================
// Audit Service
// Query and Record Immutable Audit Trail
// ========================================================================

import { auditRepository, AuditFilters } from '../repositories/audit.repository.js';
import { UserContext, AuditLog } from '../types/index.js';

export class AuditService {
  async listAuditLogs(
    filters: Omit<AuditFilters, 'schoolId'>,
    userContext: UserContext
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const targetSchoolId = userContext.is_super_admin ? undefined : userContext.school_id;

    return auditRepository.findLogs({
      ...filters,
      schoolId: targetSchoolId,
    });
  }

  async recordLog(entry: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    return auditRepository.log(entry);
  }
}

export const auditService = new AuditService();
