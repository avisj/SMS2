// ========================================================================
// Authorization Middleware
// Dynamic RBAC and Data Scope Evaluation
// ZERO hardcoded role checks - evaluates dynamic permissions & scopes
// ========================================================================

import { Request, Response, NextFunction } from 'express';
import { UserContext, EffectivePermission } from '../types/index.js';
import { auditRepository } from '../repositories/audit.repository.js';

export type ScopeValidator = (req: Request, userContext: UserContext, perm: EffectivePermission) => boolean;

export function requirePermission(permissionCode: string | string[], scopeValidator?: ScopeValidator) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userContext = req.userContext;
    if (!userContext) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    // Platform Super Admin bypasses individual permission restrictions
    if (userContext.is_super_admin) {
      next();
      return;
    }

    // 1. Check if user has the requested permission
    const codes = Array.isArray(permissionCode) ? permissionCode : [permissionCode];
    const matchedPerm = userContext.permissions.find(p => codes.includes(p.code));
    if (!matchedPerm) {
      // Record access denial in audit logs
      auditRepository.log({
        school_id: userContext.school_id,
        location_id: userContext.active_location_id,
        user_id: userContext.user_id,
        action: 'ACCESS_DENIED',
        module: 'RBAC',
        entity_name: 'permission',
        record_id: codes.join(','),
        new_values: { path: req.originalUrl, requiredPermission: codes },
        ip_address: req.ip || req.socket?.remoteAddress || '127.0.0.1',
        user_agent: req.headers['user-agent'],
      }).catch(() => {});

      res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: `Forbidden: You lack the required permission [${codes.join(' or ')}]`,
        },
      });
      return;
    }

    // 2. Data Scope Evaluation
    const scopeCode = matchedPerm.scope_code;

    // Check location scopes
    const targetLocationId = req.params.locationId || req.query.locationId as string || req.body?.location_id;

    if (targetLocationId) {
      // If scope is restricted to SELECTED_LOCATIONS or ONE_LOCATION
      if (scopeCode === 'SELECTED_LOCATIONS' || scopeCode === 'ONE_LOCATION') {
        if (!userContext.permitted_location_ids.includes(targetLocationId)) {
          res.status(403).json({
            success: false,
            error: {
              code: 'DATA_SCOPE_VIOLATION',
              message: `Forbidden: Your access scope is limited and does not include branch location [${targetLocationId}]`,
            },
          });
          return;
        }
      }
    }

    // Check user record scopes (e.g. OWN_RECORD)
    const targetUserId = req.params.userId || req.params.id;
    if (scopeCode === 'OWN_RECORD' && targetUserId && targetUserId !== userContext.user_id) {
      res.status(403).json({
        success: false,
        error: {
          code: 'DATA_SCOPE_VIOLATION',
          message: 'Forbidden: Your scope is restricted strictly to your own record',
        },
      });
      return;
    }

    // 3. Custom Scope Validator if provided
    if (scopeValidator) {
      const allowed = scopeValidator(req, userContext, matchedPerm);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: 'DATA_SCOPE_VIOLATION',
            message: 'Forbidden: Operation outside permitted scope constraints',
          },
        });
        return;
      }
    }

    next();
  };
}
