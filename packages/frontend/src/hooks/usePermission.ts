// ========================================================================
// usePermission Hook
// ZERO hardcoded role checks - evaluates dynamic permissions & scopes
// ========================================================================

import { useAuth } from '../context/AuthContext.js';

export function usePermission() {
  const { userContext } = useAuth();

  const hasPermission = (code: string): boolean => {
    if (!userContext) return false;
    if (userContext.is_super_admin) return true;
    return userContext.permissions.some(p => p.code === code);
  };

  const hasAnyPermission = (codes: string[]): boolean => {
    if (!userContext) return false;
    if (userContext.is_super_admin) return true;
    return codes.some(code => hasPermission(code));
  };

  const hasAllPermissions = (codes: string[]): boolean => {
    if (!userContext) return false;
    if (userContext.is_super_admin) return true;
    return codes.every(code => hasPermission(code));
  };

  const getPermissionScope = (code: string): string | null => {
    if (!userContext) return null;
    const perm = userContext.permissions.find(p => p.code === code);
    return perm?.scope_code || null;
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissionScope,
    permissions: userContext?.permissions || [],
    isSuperAdmin: !!userContext?.is_super_admin,
  };
}
