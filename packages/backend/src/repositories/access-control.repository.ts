// ========================================================================
// Access Control Repository
// Roles, Permissions, User Types, Scopes, Multi-Role, Multi-Branch Access
// ========================================================================

import { getMemoryDbClient } from '../db/client.js';
import {
  UserType,
  UserTypeMaster,
  User,
  DataScope,
  Permission,
  Role,
  RolePermission,
  UserRole,
  UserLocationAccess,
  EffectivePermission,
} from '../types/index.js';

export class AccessControlRepository {
  private mem = getMemoryDbClient();

  // ----------------------------------------------------------------------
  // User Types (Dynamic Categorization, not authorization)
  // ----------------------------------------------------------------------
  async getUserTypes(schoolId?: string | null): Promise<UserType[]> {
    return this.mem.findAll('user_types', (row: UserType) => {
      if (!row.is_active) return false;
      // System user types (school_id is null) are visible to all
      if (row.school_id === null) return true;
      // School-specific user types
      return row.school_id === schoolId;
    });
  }

  async getUserTypeById(id: string): Promise<UserType | null> {
    return (this.mem.findById('user_types', id) as UserType) || null;
  }

  async getUserTypeByCode(code: string, schoolId?: string | null): Promise<UserType | null> {
    const list = this.mem.findAll('user_types', (row: UserType) => {
      if (row.code.toUpperCase() !== code.toUpperCase()) return false;
      return row.school_id === null || row.school_id === schoolId;
    });
    return list[0] || null;
  }

  async createUserType(data: Omit<UserType, 'id' | 'created_at' | 'updated_at'>): Promise<UserType> {
    return this.mem.insert('user_types', data) as UserType;
  }

  // ----------------------------------------------------------------------
  // Numeric User Type Master (Stable Classification for Module Population)
  // ----------------------------------------------------------------------
  async getUserTypeMasterList(): Promise<UserTypeMaster[]> {
    return this.mem.findAll('user_type_master', (row: UserTypeMaster) => row.is_active);
  }

  async getUserTypeMasterById(id: number): Promise<UserTypeMaster | null> {
    const found = this.mem.findAll('user_type_master', (row: UserTypeMaster) => row.id === id);
    return found[0] || null;
  }

  async getUserTypeMasterByCode(code: string): Promise<UserTypeMaster | null> {
    const found = this.mem.findAll(
      'user_type_master',
      (row: UserTypeMaster) => row.type_code.toUpperCase() === code.toUpperCase()
    );
    return found[0] || null;
  }

  async getUsersByUserType(schoolId: string, numericTypeId: number): Promise<User[]> {
    // 1: STUDENT, 2: STAFF, 3: PARENT, 4: OTHER
    const allUserTypes = await this.getUserTypes(schoolId);
    let targetTypeCodes: string[] = [];

    if (numericTypeId === 1) {
      targetTypeCodes = ['STUDENT'];
    } else if (numericTypeId === 2) {
      targetTypeCodes = ['STAFF', 'TEACHER', 'ADMIN', 'DIRECTOR', 'SUPER_ADMIN'];
    } else if (numericTypeId === 3) {
      targetTypeCodes = ['PARENT'];
    } else {
      targetTypeCodes = ['OTHER'];
    }

    const matchedTypeIds = new Set(
      allUserTypes
        .filter(ut => targetTypeCodes.includes(ut.code.toUpperCase()) || ut.numeric_id === numericTypeId)
        .map(ut => ut.id)
    );

    return this.mem.findAll('users', (u: User) => {
      if (u.school_id !== schoolId) return false;
      if (u.status !== 'ACTIVE') return false;
      if (u.deleted_at) return false;
      return matchedTypeIds.has(u.user_type_id);
    });
  }

  // ----------------------------------------------------------------------
  // Data Scopes
  // ----------------------------------------------------------------------
  async getDataScopes(): Promise<DataScope[]> {
    return this.mem.findAll('data_scopes').sort((a: DataScope, b: DataScope) => b.hierarchy_level - a.hierarchy_level);
  }

  async getDataScopeByCode(code: string): Promise<DataScope | null> {
    const list = this.mem.findAll('data_scopes', (row: DataScope) => row.code === code);
    return list[0] || null;
  }

  async getDataScopeById(id: string): Promise<DataScope | null> {
    return (this.mem.findById('data_scopes', id) as DataScope) || null;
  }

  // ----------------------------------------------------------------------
  // Permissions
  // ----------------------------------------------------------------------
  async getPermissions(): Promise<Permission[]> {
    return this.mem.findAll('permissions');
  }

  async getPermissionByCode(code: string): Promise<Permission | null> {
    const list = this.mem.findAll('permissions', (row: Permission) => row.code === code);
    return list[0] || null;
  }

  // ----------------------------------------------------------------------
  // Roles
  // ----------------------------------------------------------------------
  async getRoles(schoolId?: string | null): Promise<Role[]> {
    return this.mem.findAll('roles', (row: Role) => {
      if (row.deleted_at) return false;
      if (row.school_id === null) return true; // System template roles
      return row.school_id === schoolId;
    });
  }

  async getRoleById(id: string, schoolId?: string | null): Promise<Role | null> {
    const role = this.mem.findById('roles', id) as Role | null;
    if (!role || role.deleted_at) return null;
    if (role.school_id !== null && schoolId && role.school_id !== schoolId) return null;
    return role;
  }

  async getRoleByCode(code: string, schoolId?: string | null): Promise<Role | null> {
    const list = this.mem.findAll('roles', (row: Role) => {
      if (row.deleted_at) return false;
      if (row.code.toUpperCase() !== code.toUpperCase()) return false;
      return row.school_id === null || row.school_id === schoolId;
    });
    return list[0] || null;
  }

  async createRole(data: Omit<Role, 'id' | 'created_at' | 'updated_at'>): Promise<Role> {
    return this.mem.insert('roles', data) as Role;
  }

  async updateRole(id: string, updates: Partial<Role>): Promise<Role | null> {
    return this.mem.update('roles', id, updates) as Role | null;
  }

  async deleteRole(id: string): Promise<boolean> {
    return this.mem.softDelete('roles', id);
  }

  // ----------------------------------------------------------------------
  // Role Permissions
  // ----------------------------------------------------------------------
  async getRolePermissions(roleId: string): Promise<Array<RolePermission & { permission: Permission; scope: DataScope }>> {
    const mappings = this.mem.findAll('role_permissions', (row: RolePermission) => row.role_id === roleId);
    const result: Array<RolePermission & { permission: Permission; scope: DataScope }> = [];
    for (const m of mappings) {
      const p = this.mem.findById('permissions', m.permission_id) as Permission | null;
      const s = this.mem.findById('data_scopes', m.data_scope_id) as DataScope | null;
      if (p && s) {
        result.push({
          ...m,
          permission: p,
          scope: s,
        });
      }
    }
    return result;
  }

  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
    dataScopeId: string,
    schoolId?: string | null
  ): Promise<RolePermission> {
    // Check if already mapped
    const existing = this.mem.findAll(
      'role_permissions',
      (row: RolePermission) => row.role_id === roleId && row.permission_id === permissionId
    );
    if (existing.length > 0) {
      return this.mem.update('role_permissions', existing[0].id, {
        data_scope_id: dataScopeId,
        school_id: schoolId,
      }) as RolePermission;
    }
    return this.mem.insert('role_permissions', {
      role_id: roleId,
      permission_id: permissionId,
      data_scope_id: dataScopeId,
      school_id: schoolId,
    }) as RolePermission;
  }

  async revokePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    const existing = this.mem.findAll(
      'role_permissions',
      (row: RolePermission) => row.role_id === roleId && row.permission_id === permissionId
    );
    if (existing.length > 0) {
      return this.mem.delete('role_permissions', existing[0].id);
    }
    return false;
  }

  // ----------------------------------------------------------------------
  // User Roles (Multi-Role Support)
  // ----------------------------------------------------------------------
  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoleRows = this.mem.findAll('user_roles', (row: UserRole) => row.user_id === userId);
    const roles: Role[] = [];
    for (const ur of userRoleRows) {
      const r = await this.getRoleById(ur.role_id);
      if (r && r.is_active && !r.deleted_at) {
        roles.push(r);
      }
    }
    return roles;
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    schoolId?: string | null,
    assignedBy?: string
  ): Promise<UserRole> {
    const existing = this.mem.findAll(
      'user_roles',
      (row: UserRole) => row.user_id === userId && row.role_id === roleId
    );
    if (existing.length > 0) return existing[0] as UserRole;
    return this.mem.insert('user_roles', {
      user_id: userId,
      role_id: roleId,
      school_id: schoolId,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString(),
    }) as UserRole;
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<boolean> {
    const existing = this.mem.findAll(
      'user_roles',
      (row: UserRole) => row.user_id === userId && row.role_id === roleId
    );
    if (existing.length > 0) {
      return this.mem.delete('user_roles', existing[0].id);
    }
    return false;
  }

  // ----------------------------------------------------------------------
  // User Location Access (Multi-Branch Support)
  // ----------------------------------------------------------------------
  async getUserLocationAccess(userId: string): Promise<UserLocationAccess[]> {
    return this.mem.findAll('user_location_access', (row: UserLocationAccess) => row.user_id === userId);
  }

  async assignLocationToUser(
    userId: string,
    locationId: string,
    schoolId: string,
    isPrimary = false,
    assignedBy?: string
  ): Promise<UserLocationAccess> {
    const existing = this.mem.findAll(
      'user_location_access',
      (row: UserLocationAccess) => row.user_id === userId && row.location_id === locationId
    );
    if (existing.length > 0) {
      return this.mem.update('user_location_access', existing[0].id, {
        is_primary: isPrimary,
      }) as UserLocationAccess;
    }
    return this.mem.insert('user_location_access', {
      user_id: userId,
      location_id: locationId,
      school_id: schoolId,
      is_primary: isPrimary,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString(),
    }) as UserLocationAccess;
  }

  async clearRolePermissions(roleId: string): Promise<void> {
    const existing = this.mem.findAll(
      'role_permissions',
      (row: RolePermission) => row.role_id === roleId
    );
    for (const item of existing) {
      this.mem.delete('role_permissions', item.id);
    }
  }

  async clearUserRoles(userId: string): Promise<void> {
    const existing = this.mem.findAll('user_roles', (row: UserRole) => row.user_id === userId);
    for (const item of existing) {
      this.mem.delete('user_roles', item.id);
    }
  }

  async clearUserLocationAccess(userId: string): Promise<void> {
    const existing = this.mem.findAll('user_location_access', (row: UserLocationAccess) => row.user_id === userId);
    for (const item of existing) {
      this.mem.delete('user_location_access', item.id);
    }
  }

  async removeLocationFromUser(userId: string, locationId: string): Promise<boolean> {
    const existing = this.mem.findAll(
      'user_location_access',
      (row: UserLocationAccess) => row.user_id === userId && row.location_id === locationId
    );
    if (existing.length > 0) {
      return this.mem.delete('user_location_access', existing[0].id);
    }
    return false;
  }

  // ----------------------------------------------------------------------
  // Dynamic Effective Permissions & Scopes Engine
  // Calculates aggregated permissions across all user roles
  // ----------------------------------------------------------------------
  async getUserEffectivePermissions(userId: string): Promise<EffectivePermission[]> {
    const roles = await this.getUserRoles(userId);
    const permMap = new Map<string, EffectivePermission>();

    for (const role of roles) {
      const rolePerms = await this.getRolePermissions(role.id);
      for (const rp of rolePerms) {
        const existing = permMap.get(rp.permission.code);
        // If multiple roles grant the same permission, elevate to the broadest scope (highest hierarchy level)
        if (!existing || rp.scope.hierarchy_level > existing.hierarchy_level) {
          permMap.set(rp.permission.code, {
            code: rp.permission.code,
            module: rp.permission.module,
            action: rp.permission.action,
            scope_code: rp.scope.code,
            hierarchy_level: rp.scope.hierarchy_level,
          });
        }
      }
    }

    return Array.from(permMap.values());
  }
}

export const accessControlRepository = new AccessControlRepository();
