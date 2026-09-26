// ========================================================================
// Tenant Middleware
// Strict Cross-Tenant Isolation Enforcement
// ========================================================================

import { Request, Response, NextFunction } from 'express';
import { auditRepository } from '../repositories/audit.repository.js';

export function tenantIsolationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const userContext = req.userContext;
  if (!userContext) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User context is missing' },
    });
    return;
  }

  // 1. If SaaS Super Admin, they have platform-wide access
  if (userContext.is_super_admin) {
    next();
    return;
  }

  // 2. Regular tenant user MUST have a valid school_id
  const userSchoolId = userContext.school_id;
  if (!userSchoolId) {
    res.status(403).json({
      success: false,
      error: { code: 'NO_TENANT_ASSIGNED', message: 'User does not belong to any school tenant' },
    });
    return;
  }

  // 3. Inspect requested school_id from URL params, query, or body
  const paramSchoolId = req.params.schoolId || req.params.school_id;
  const querySchoolId = req.query.schoolId as string | undefined || req.query.school_id as string | undefined;
  const bodySchoolId = req.body?.school_id || req.body?.schoolId;

  const attemptedSchoolId = paramSchoolId || querySchoolId || bodySchoolId;

  // If a school_id is provided in the request, it MUST match the user's school_id
  if (attemptedSchoolId && attemptedSchoolId !== userSchoolId) {
    // Record tamper attempt in audit logs
    auditRepository.log({
      school_id: userSchoolId,
      location_id: userContext.active_location_id,
      user_id: userContext.user_id,
      action: 'ACCESS_DENIED',
      module: 'SECURITY',
      entity_name: 'tenant_boundary',
      record_id: attemptedSchoolId,
      old_values: { userSchoolId },
      new_values: { attemptedSchoolId, path: req.originalUrl, method: req.method },
      ip_address: req.ip || req.socket.remoteAddress,
      user_agent: req.headers['user-agent'],
    }).catch(() => {});

    res.status(403).json({
      success: false,
      error: {
        code: 'TENANT_VIOLATION',
        message: 'Security Violation: Access across tenant boundaries is strictly forbidden.',
      },
    });
    return;
  }

  // 4. Force inject the authenticated user's validated school_id into req.body and req.query
  // so downstream handlers can never use forged tenant keys
  if (req.body && typeof req.body === 'object') {
    req.body.school_id = userSchoolId;
  }

  next();
}
