// ========================================================================
// Access Control Service
// Configurable Role-Permission Matrices, User Types, and Data Scopes
// ========================================================================

import { accessControlRepository } from '../repositories/access-control.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { Role, UserType, DataScope, Permission, UserContext, UserLocationAccess } from '../types/index.js';

export class AccessControlService {
  // ----------------------------------------------------------------------
  // User Types
  // ----------------------------------------------------------------------
  async listUserTypes(userContext: UserContext): Promise<UserType[]> {
    return accessControlRepository.getUserTypes(userContext.school_id);
  }

  async createUserType(
    data: { code: string; name: string; description?: string },
    userContext: UserContext
  ): Promise<UserType> {
    const existing = await accessControlRepository.getUserTypeByCode(data.code, userContext.school_id);
    if (existing) {
      throw new Error(`User type with code '${data.code}' already exists`);
    }

    const created = await accessControlRepository.createUserType({
      school_id: userContext.is_super_admin ? null : userContext.school_id,
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
      is_system: false,
      is_active: true,
    });

    await auditRepository.log({
      school_id: userContext.school_id,
      user_id: userContext.user_id,
      action: 'CREATE',
      module: 'RBAC',
      entity_name: 'user_type',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  // ----------------------------------------------------------------------
  // Data Scopes & Permissions
  // ----------------------------------------------------------------------
  async listDataScopes(): Promise<DataScope[]> {
    return accessControlRepository.getDataScopes();
  }

  async listPermissions(): Promise<Permission[]> {
    return accessControlRepository.getPermissions();
  }

  // ----------------------------------------------------------------------
  // Roles & Permissions Mapping
  // ----------------------------------------------------------------------
  async listRoles(userContext: UserContext): Promise<Role[]> {
    const roles = await accessControlRepository.getRoles(userContext.school_id);
    // Enrich with permissions
    const enriched: Role[] = [];
    for (const r of roles) {
      const perms = await accessControlRepository.getRolePermissions(r.id);
      enriched.push({
        ...r,
        permissions: perms.map(p => ({
          ...p.permission,
          scope: p.scope,
        })),
      });
    }
    return enriched;
  }

  async getRoleById(id: string, userContext: UserContext): Promise<Role | null> {
    const role = await accessControlRepository.getRoleById(id, userContext.school_id);
    if (!role) return null;

    const perms = await accessControlRepository.getRolePermissions(role.id);
    return {
      ...role,
      permissions: perms.map(p => ({
        ...p.permission,
        scope: p.scope,
      })),
    };
  }

  async createRole(
    data: { code: string; name: string; description?: string; permissions?: Array<{ permissionId: string; dataScopeId: string }> },
    userContext: UserContext
  ): Promise<Role> {
    if (
      !userContext.is_super_admin && 
      !userContext.is_school_super_admin && 
      !userContext.permissions.some(p => p.code === 'roles.manage')
    ) {
      throw new Error('You do not have permission to manage roles');
    }

    const targetSchoolId = userContext.is_super_admin ? null : userContext.school_id;

    const existing = await accessControlRepository.getRoleByCode(data.code, targetSchoolId);
    if (existing) {
      throw new Error(`Role with code '${data.code}' already exists`);
    }

    const role = await accessControlRepository.createRole({
      school_id: targetSchoolId,
      code: data.code.toUpperCase(),
      name: data.name,
      description: data.description,
      is_system: false,
      is_active: true,
    });

    // Assign initial permissions if provided
    if (data.permissions && data.permissions.length > 0) {
      for (const p of data.permissions) {
        await accessControlRepository.assignPermissionToRole(
          role.id,
          p.permissionId,
          p.dataScopeId,
          targetSchoolId
        );
      }
    }

    await auditRepository.log({
      school_id: targetSchoolId,
      user_id: userContext.user_id,
      action: 'CREATE',
      module: 'RBAC',
      entity_name: 'role',
      record_id: role.id,
      new_values: { code: role.code, name: role.name, permissionsCount: data.permissions?.length || 0 },
    });

    return (await this.getRoleById(role.id, userContext)) || role;
  }

  async updateRole(
    id: string,
    updates: { name?: string; description?: string; is_active?: boolean },
    userContext: UserContext
  ): Promise<Role | null> {
    const existing = await accessControlRepository.getRoleById(id, userContext.school_id);
    if (!existing) throw new Error('Role not found');

    if (existing.is_system && !userContext.is_super_admin) {
      throw new Error('System template roles cannot be modified by school administrators');
    }

    const updated = await accessControlRepository.updateRole(id, updates);

    await auditRepository.log({
      school_id: existing.school_id,
      user_id: userContext.user_id,
      action: 'UPDATE',
      module: 'RBAC',
      entity_name: 'role',
      record_id: id,
      old_values: existing,
      new_values: updated,
    });

    return this.getRoleById(id, userContext);
  }

  async setRolePermission(
    roleId: string,
    permissionId: string,
    dataScopeId: string,
    userContext: UserContext
  ) {
    const role = await accessControlRepository.getRoleById(roleId, userContext.school_id);
    if (!role) throw new Error('Role not found');

    if (role.is_system && !userContext.is_super_admin) {
      throw new Error('System template role permissions cannot be altered by school administrators');
    }

    const mapping = await accessControlRepository.assignPermissionToRole(
      roleId,
      permissionId,
      dataScopeId,
      role.school_id
    );

    await auditRepository.log({
      school_id: role.school_id,
      user_id: userContext.user_id,
      action: 'UPDATE_PERMISSIONS',
      module: 'RBAC',
      entity_name: 'role_permission',
      record_id: `${roleId}:${permissionId}`,
      new_values: { dataScopeId },
    });

    return mapping;
  }

  async removeRolePermission(roleId: string, permissionId: string, userContext: UserContext) {
    const role = await accessControlRepository.getRoleById(roleId, userContext.school_id);
    if (!role) throw new Error('Role not found');

    if (role.is_system && !userContext.is_super_admin) {
      throw new Error('System template role permissions cannot be altered');
    }

    const ok = await accessControlRepository.revokePermissionFromRole(roleId, permissionId);

    await auditRepository.log({
      school_id: role.school_id,
      user_id: userContext.user_id,
      action: 'REVOKE_PERMISSION',
      module: 'RBAC',
      entity_name: 'role_permission',
      record_id: `${roleId}:${permissionId}`,
    });

    return ok;
  }

  async deleteRole(id: string, userContext: UserContext): Promise<boolean> {
    const existing = await accessControlRepository.getRoleById(id, userContext.school_id);
    if (!existing) throw new Error('Role not found');
    if (existing.is_system && !userContext.is_super_admin) {
      throw new Error('System template roles cannot be deleted');
    }

    // SERVER-SIDE SELF-LOCKOUT GUARD: Cannot delete role assigned to self
    const userRoles = await accessControlRepository.getUserRoles(userContext.user_id);
    if (userRoles.some(r => r.id === id)) {
      throw new Error('Security Violation: You cannot delete a role that is currently assigned to your own account (self-lockout prevention).');
    }

    const res = await accessControlRepository.deleteRole(id);
    await auditRepository.log({
      school_id: existing.school_id,
      user_id: userContext.user_id,
      action: 'DELETE',
      module: 'RBAC',
      entity_name: 'role',
      record_id: id,
      old_values: existing,
    });
    return res;
  }

  async setRolePermissionsBulk(
    roleId: string,
    permissions: Array<{ permissionId: string; dataScopeId?: string }>,
    userContext: UserContext
  ): Promise<Role> {
    const role = await accessControlRepository.getRoleById(roleId, userContext.school_id);
    if (!role) throw new Error('Role not found');
    if (role.is_system && !userContext.is_super_admin) {
      throw new Error('System template role permissions cannot be altered by school administrators');
    }

    // Check if role is assigned to the calling user
    const callingUserRoles = await accessControlRepository.getUserRoles(userContext.user_id);
    const isAssignedToSelf = callingUserRoles.some(r => r.id === roleId);

    if (isAssignedToSelf && !userContext.is_super_admin) {
      // 1. SELF-PRIVILEGE ESCALATION GUARD: Cannot add rights not already held by the user
      const allPerms = await accessControlRepository.getPermissions();
      for (const p of permissions) {
        const permObj = allPerms.find(x => x.id === p.permissionId);
        if (permObj) {
          const userHolds = userContext.permissions.some(up => up.code === permObj.code);
          if (!userHolds) {
            throw new Error(`Security Violation: You cannot grant rights [${permObj.code}] to your own role that you do not already possess (self-privilege escalation prevention).`);
          }
        }
      }

      // 2. SELF-LOCKOUT GUARD: Cannot strip the role's management permission
      const willRetainAdmin = permissions.some(p => {
        const permObj = allPerms.find(x => x.id === p.permissionId);
        return permObj && (permObj.code === 'roles.manage' || permObj.code === 'rights.manage' || permObj.code === 'user_roles.manage');
      });
      if (!willRetainAdmin) {
        throw new Error('Security Violation: You cannot remove critical administrative rights from your own role (self-lockout prevention).');
      }
    }

    const scopes = await accessControlRepository.getDataScopes();
    const defaultScope = scopes.find(s => s.code === 'ALL_ORGS' || s.code === 'TENANT') || scopes[0];

    // Clear existing
    await accessControlRepository.clearRolePermissions(roleId);

    // Assign new
    for (const p of permissions) {
      await accessControlRepository.assignPermissionToRole(
        roleId,
        p.permissionId,
        p.dataScopeId || defaultScope.id,
        role.school_id
      );
    }

    await auditRepository.log({
      school_id: role.school_id,
      user_id: userContext.user_id,
      action: 'UPDATE_ROLE_PERMISSIONS',
      module: 'RBAC',
      entity_name: 'role_rights',
      record_id: roleId,
      new_values: { count: permissions.length, permissionIds: permissions.map(p => p.permissionId) },
    });

    return (await this.getRoleById(roleId, userContext))!;
  }

  async getUserRoleAssignments(schoolId: string): Promise<Array<{ user: any; roles: Role[]; location_ids: string[] }>> {
    const { getMemoryDbClient } = await import('../db/client.js');
    const mem = getMemoryDbClient();
    const users = mem.findAll('users', (u: any) => u.school_id === schoolId && !u.deleted_at);
    const result = [];
    for (const u of users) {
      const roles = await accessControlRepository.getUserRoles(u.id);
      const locAccess = await accessControlRepository.getUserLocationAccess(u.id);
      result.push({
        user: {
          id: u.id,
          username: u.username,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          user_type_code: u.user_type_code,
          status: u.status,
        },
        roles,
        location_ids: locAccess.map((l: any) => l.location_id),
      });
    }
    return result;
  }

  async updateUserRoles(
    userId: string,
    roleIds: string[],
    schoolId: string,
    userContext: UserContext
  ): Promise<Role[]> {
    if (
      !userContext.is_super_admin && 
      !userContext.is_school_super_admin && 
      !userContext.permissions.some(p => p.code === 'user_roles.manage' || p.code === 'users.assign_roles')
    ) {
      throw new Error('You do not have permission to manage user roles');
    }

    // SERVER-SIDE GUARDS FOR SELF-MODIFICATION
    if (userId === userContext.user_id && !userContext.is_super_admin) {
      // 1. SELF-LOCKOUT GUARD: Cannot remove all roles or strip administrative roles
      if (roleIds.length === 0) {
        throw new Error('Security Violation: You cannot remove all roles from your own account (self-lockout prevention).');
      }

      const currentRoles = await accessControlRepository.getUserRoles(userId);
      const isDirectorOrAdmin = currentRoles.some(r => 
        r.code === 'SCHOOL_DIRECTOR' || r.code === 'SCHOOL_ADMIN' || r.code === 'BRANCH_ADMIN' || r.code === 'DIRECTOR'
      );
      if (isDirectorOrAdmin) {
        // Must maintain at least one administrative role
        const allRoles = await accessControlRepository.getRoles(schoolId);
        const willHaveAdminRole = roleIds.some(rid => {
          const r = allRoles.find(x => x.id === rid);
          return r && (r.code === 'SCHOOL_DIRECTOR' || r.code === 'SCHOOL_ADMIN' || r.code === 'BRANCH_ADMIN' || r.code === 'DIRECTOR');
        });
        if (!willHaveAdminRole) {
          throw new Error('Security Violation: You cannot remove your own administrative role (self-lockout prevention).');
        }
      }

      // 2. SELF-PRIVILEGE ESCALATION GUARD: Cannot assign oneself roles granting unheld permissions
      for (const rid of roleIds) {
        const isNewRole = !currentRoles.some(cr => cr.id === rid);
        if (isNewRole) {
          const rolePerms = await accessControlRepository.getRolePermissions(rid);
          for (const rp of rolePerms) {
            const alreadyHas = userContext.permissions.some(p => p.code === rp.permission.code);
            if (!alreadyHas) {
              throw new Error(`Security Violation: You cannot assign yourself a role granting higher permissions [${rp.permission.code}] (self-privilege escalation prevention).`);
            }
          }
        }
      }
    }

    await accessControlRepository.clearUserRoles(userId);

    for (const rid of roleIds) {
      await accessControlRepository.assignRoleToUser(userId, rid, schoolId, userContext.user_id);
    }

    await auditRepository.log({
      school_id: schoolId,
      user_id: userContext.user_id,
      action: 'ASSIGN_USER_ROLES',
      module: 'RBAC',
      entity_name: 'user_roles',
      record_id: userId,
      new_values: { roleIds },
    });

    return accessControlRepository.getUserRoles(userId);
  }

  async getUserLocationAccess(userId: string): Promise<UserLocationAccess[]> {
    return accessControlRepository.getUserLocationAccess(userId);
  }

  async updateUserLocationAccess(
    userId: string,
    locationIds: string[],
    schoolId: string,
    userContext: UserContext
  ): Promise<UserLocationAccess[]> {
    if (
      !userContext.is_super_admin &&
      !userContext.is_school_super_admin &&
      !userContext.permissions.some(p => p.code === 'access_scope.manage' || p.code === 'users.assign_locations' || p.code === 'roles.manage')
    ) {
      throw new Error('You do not have permission to manage access scopes');
    }

    // SERVER-SIDE GUARDS FOR SELF-MODIFICATION
    if (userId === userContext.user_id && !userContext.is_super_admin) {
      // 1. SELF-LOCKOUT GUARD: Cannot remove all locations
      if (locationIds.length === 0) {
        throw new Error('Security Violation: You cannot remove all branch locations from your own account (self-lockout prevention).');
      }

      // 2. SELF-SCOPE ESCALATION GUARD: Cannot grant oneself locations outside permitted locations
      for (const lid of locationIds) {
        if (!userContext.permitted_location_ids.includes(lid)) {
          throw new Error(`Security Violation: You cannot grant yourself access to branch [${lid}] which is outside your permitted scope (unauthorized data scope prevention).`);
        }
      }
    }

    await accessControlRepository.clearUserLocationAccess(userId);

    for (const [idx, lid] of locationIds.entries()) {
      await accessControlRepository.assignLocationToUser(userId, lid, schoolId, idx === 0, userContext.user_id);
    }

    await auditRepository.log({
      school_id: schoolId,
      user_id: userContext.user_id,
      action: 'UPDATE_LOCATION_ACCESS',
      module: 'RBAC',
      entity_name: 'user_location_access',
      record_id: userId,
      new_values: { locationIds },
    });

    return accessControlRepository.getUserLocationAccess(userId);
  }
}

export const accessControlService = new AccessControlService();
