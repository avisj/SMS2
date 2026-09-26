// ========================================================================
// User Service
// Universal Users Operations, Multi-Role, Multi-Branch & Login Access Management
// ========================================================================

import { userRepository, UserFilters } from '../repositories/user.repository.js';
import { accessControlRepository } from '../repositories/access-control.repository.js';
import { locationRepository } from '../repositories/location.repository.js';
import { credentialsRepository } from '../repositories/credentials.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { hashPassword } from '../utils/password.js';
import { User, UserContext, UserLoginAccess } from '../types/index.js';

export interface CreateUserInput {
  school_id?: string | null;
  user_type_id: string;
  username?: string;
  login_username?: string;
  email: string;
  phone?: string;
  first_name: string;
  middle_name?: string;
  last_name?: string;
  role_ids?: string[];
  location_ids?: string[];
  primary_location_id?: string;
  create_login_access?: boolean;
  login_password?: string;
  login_status?: 'ACTIVE' | 'DISABLED';
}

export class UserService {
  async listUsers(filters: UserFilters, userContext: UserContext): Promise<User[]> {
    const targetSchoolId = userContext.is_super_admin ? filters.schoolId : userContext.school_id;

    let targetLocationId = filters.locationId;
    if (!userContext.is_super_admin) {
      const hasAllLocationsPerm = userContext.permissions.some(
        p => p.module === 'users' && p.scope_code === 'ALL_LOCATIONS'
      );
      if (!hasAllLocationsPerm && !targetLocationId) {
        targetLocationId = userContext.active_location_id || undefined;
      }
    }

    return userRepository.findUsers({
      ...filters,
      schoolId: targetSchoolId,
      locationId: targetLocationId,
    });
  }

  async getUserById(id: string, userContext: UserContext): Promise<User | null> {
    const user = await userRepository.findById(id);
    if (!user) return null;

    if (userContext.school_id && user.school_id !== userContext.school_id) {
      throw new Error('Unauthorized cross-tenant access attempt');
    }

    return user;
  }

  async createUser(input: CreateUserInput, userContext: UserContext): Promise<User> {
    if (
      !userContext.is_super_admin && 
      !userContext.is_school_super_admin && 
      !userContext.permissions.some(p => p.code === 'users.create')
    ) {
      throw new Error('You do not have permission to create users');
    }

    const effectiveSchoolId = userContext.is_super_admin ? (input.school_id || null) : userContext.school_id;

    // Validate user type exists
    const userType = await accessControlRepository.getUserTypeById(input.user_type_id);
    if (!userType) {
      throw new Error('Invalid user type specified');
    }

    const cleanFirst = input.first_name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLast = (input.last_name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const fallbackUsername = cleanLast ? `${cleanFirst}.${cleanLast}` : cleanFirst;
    const effectiveUsername = input.login_username || input.username || fallbackUsername;

    // Check duplicate username within the school context
    const existingUsername = await userRepository.findBySchoolAndUsername(effectiveSchoolId, effectiveUsername);
    if (existingUsername) {
      throw new Error(`Username '${effectiveUsername}' is already taken in this school`);
    }

    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail && existingEmail.school_id === effectiveSchoolId) {
      throw new Error(`Email '${input.email}' is already registered in this school`);
    }

    // Create user profile in universal users table (zero plaintext password)
    const user = await userRepository.create({
      school_id: effectiveSchoolId,
      user_type_id: input.user_type_id,
      username: effectiveUsername,
      email: input.email,
      phone: input.phone,
      first_name: input.first_name,
      middle_name: input.middle_name,
      last_name: input.last_name,
      status: 'ACTIVE',
    });

    // Assign roles if provided
    if (input.role_ids && input.role_ids.length > 0) {
      for (const roleId of input.role_ids) {
        await accessControlRepository.assignRoleToUser(
          user.id,
          roleId,
          effectiveSchoolId,
          userContext.user_id
        );
      }
    }

    // Assign branch locations if provided
    let resolvedPrimaryLocationId = input.primary_location_id;
    if (effectiveSchoolId && input.location_ids && input.location_ids.length > 0) {
      for (const locId of input.location_ids) {
        const isPrimary = input.primary_location_id === locId;
        if (isPrimary) resolvedPrimaryLocationId = locId;
        await accessControlRepository.assignLocationToUser(
          user.id,
          locId,
          effectiveSchoolId,
          isPrimary,
          userContext.user_id
        );
      }
      if (!resolvedPrimaryLocationId) {
        resolvedPrimaryLocationId = input.location_ids[0];
      }
    }

    // If 'Create Login Access for this User' is selected:
    if (input.create_login_access) {
      const targetLocationId = resolvedPrimaryLocationId || userContext.active_location_id;
      if (!targetLocationId) {
        throw new Error('A branch location is required to create login access.');
      }

      const loc = await locationRepository.findById(targetLocationId);
      if (!loc || !loc.school_id_code) {
        throw new Error('Target location is missing a configured School ID.');
      }

      const passHash = hashPassword(input.login_password || 'password123');
      await credentialsRepository.create({
        user_id: user.id,
        school_id: effectiveSchoolId || loc.school_id,
        location_id: loc.id,
        school_id_code: loc.school_id_code,
        username: effectiveUsername,
        password_hash: passHash,
        login_status: input.login_status || 'ACTIVE',
        is_super_admin: false,
      });

      await auditRepository.log({
        school_id: effectiveSchoolId,
        location_id: loc.id,
        user_id: userContext.user_id,
        action: 'CREATE_LOGIN_ACCESS',
        module: 'AUTH',
        entity_name: 'user_credentials',
        record_id: user.id,
        new_values: { username: effectiveUsername, school_id_code: loc.school_id_code },
      });
    }

    // Refresh user with relations
    const fullUser = await userRepository.findById(user.id);

    await auditRepository.log({
      school_id: effectiveSchoolId,
      user_id: userContext.user_id,
      action: 'CREATE',
      module: 'USERS',
      entity_name: 'user',
      record_id: user.id,
      new_values: { username: user.username, email: user.email, roles: input.role_ids, loginAccessCreated: !!input.create_login_access },
    });

    return fullUser || user;
  }

  async updateUser(
    id: string,
    updates: Partial<User>,
    userContext: UserContext
  ): Promise<User | null> {
    const existing = await userRepository.findById(id, userContext.is_super_admin ? null : userContext.school_id);
    if (!existing) throw new Error('User not found');

    if (userContext.school_id && existing.school_id !== userContext.school_id) {
      throw new Error('Unauthorized cross-tenant user update');
    }

    // SERVER-SIDE SELF-LOCKOUT GUARD:
    // A user may not deactivate or suspend their own account
    if (id === userContext.user_id && updates.status && updates.status !== 'ACTIVE') {
      throw new Error('Security Violation: You cannot deactivate or suspend your own account (self-lockout prevention).');
    }

    // Protect school_id from being mutated
    delete updates.school_id;

    const updated = await userRepository.update(id, updates);

    await auditRepository.log({
      school_id: existing.school_id,
      user_id: userContext.user_id,
      action: 'UPDATE',
      module: 'USERS',
      entity_name: 'user',
      record_id: id,
      old_values: existing,
      new_values: updated,
    });

    return updated;
  }

  async assignRole(userId: string, roleId: string, userContext: UserContext) {
    const user = await userRepository.findById(userId, userContext.is_super_admin ? null : userContext.school_id);
    if (!user) throw new Error('User not found');

    const role = await accessControlRepository.getRoleById(roleId, user.school_id);
    if (!role) throw new Error('Role not found');

    const result = await accessControlRepository.assignRoleToUser(
      userId,
      roleId,
      user.school_id,
      userContext.user_id
    );

    await auditRepository.log({
      school_id: user.school_id,
      user_id: userContext.user_id,
      action: 'ASSIGN_ROLE',
      module: 'USERS',
      entity_name: 'user_role',
      record_id: `${userId}:${roleId}`,
      new_values: { roleName: role.name },
    });

    return result;
  }

  async revokeRole(userId: string, roleId: string, userContext: UserContext) {
    const user = await userRepository.findById(userId, userContext.is_super_admin ? null : userContext.school_id);
    if (!user) throw new Error('User not found');

    // SERVER-SIDE SELF-LOCKOUT GUARD
    if (userId === userContext.user_id) {
      throw new Error('Security Violation: You cannot remove your own roles (self-lockout prevention).');
    }

    const ok = await accessControlRepository.removeRoleFromUser(userId, roleId);

    await auditRepository.log({
      school_id: user.school_id,
      user_id: userContext.user_id,
      action: 'REVOKE_ROLE',
      module: 'USERS',
      entity_name: 'user_role',
      record_id: `${userId}:${roleId}`,
    });

    return ok;
  }

  async assignLocation(userId: string, locationId: string, isPrimary: boolean, userContext: UserContext) {
    const user = await userRepository.findById(userId, userContext.is_super_admin ? null : userContext.school_id);
    if (!user || !user.school_id) throw new Error('User not found');

    const loc = await locationRepository.findById(locationId, user.school_id);
    if (!loc) throw new Error('Branch location not found');

    const result = await accessControlRepository.assignLocationToUser(
      userId,
      locationId,
      user.school_id,
      isPrimary,
      userContext.user_id
    );

    await auditRepository.log({
      school_id: user.school_id,
      location_id: locationId,
      user_id: userContext.user_id,
      action: 'ASSIGN_BRANCH',
      module: 'USERS',
      entity_name: 'user_location_access',
      record_id: `${userId}:${locationId}`,
      new_values: { locationName: loc.location_name, isPrimary },
    });

    return result;
  }

  async archiveUser(id: string, userContext: UserContext): Promise<boolean> {
    // SERVER-SIDE SELF-LOCKOUT GUARD
    if (id === userContext.user_id) {
      throw new Error('Security Violation: You cannot archive or delete your own account (self-lockout prevention).');
    }

    const user = await userRepository.findById(id, userContext.is_super_admin ? null : userContext.school_id);
    if (!user) throw new Error('User not found');

    const success = await userRepository.softDelete(id);

    await auditRepository.log({
      school_id: user.school_id,
      user_id: userContext.user_id,
      action: 'ARCHIVE',
      module: 'USERS',
      entity_name: 'user',
      record_id: id,
      old_values: { status: user.status },
    });

    return success;
  }

  // ----------------------------------------------------------------------
  // User Login Access Management
  // ----------------------------------------------------------------------
  async getUserLoginAccess(userId: string, userContext: UserContext): Promise<UserLoginAccess> {
    const user = await userRepository.findById(userId, userContext.is_super_admin ? null : userContext.school_id);
    if (!user) throw new Error('User not found');

    const creds = await credentialsRepository.findByUserId(userId);
    if (creds.length === 0) {
      return {
        user_id: userId,
        status: 'NOT_CREATED',
        has_login: false,
      };
    }

    const primaryCred = creds[0];
    const loc = await locationRepository.findById(primaryCred.location_id);

    return {
      user_id: userId,
      has_login: true,
      username: primaryCred.username,
      school_id_code: primaryCred.school_id_code,
      location_name: loc?.location_name,
      status: primaryCred.login_status === 'ACTIVE' ? 'ENABLED' : 'DISABLED',
      is_super_admin: primaryCred.is_super_admin,
      last_login_at: primaryCred.last_login_at,
    };
  }

  async createUserLoginAccess(
    userId: string,
    data: { password?: string; locationId?: string; status?: 'ACTIVE' | 'DISABLED' },
    userContext: UserContext
  ): Promise<UserLoginAccess> {
    const user = await userRepository.findById(userId, userContext.is_super_admin ? null : userContext.school_id);
    if (!user) throw new Error('User not found');

    const existing = await credentialsRepository.findByUserId(userId);
    if (existing.length > 0) {
      throw new Error('Login access already exists for this user');
    }

    let targetLocId = data.locationId;
    if (!targetLocId && user.locations && user.locations.length > 0) {
      targetLocId = user.locations[0].id;
    }
    if (!targetLocId) {
      targetLocId = userContext.active_location_id || undefined;
    }
    if (!targetLocId) {
      throw new Error('A branch location is required to create login access.');
    }

    const loc = await locationRepository.findById(targetLocId);
    if (!loc || !loc.school_id_code) {
      throw new Error('Selected location is missing a configured School ID.');
    }

    const passHash = hashPassword(data.password || 'password123');
    await credentialsRepository.create({
      user_id: user.id,
      school_id: user.school_id || loc.school_id,
      location_id: loc.id,
      school_id_code: loc.school_id_code,
      username: user.username,
      password_hash: passHash,
      login_status: data.status || 'ACTIVE',
      is_super_admin: false,
    });

    await auditRepository.log({
      school_id: user.school_id,
      location_id: loc.id,
      user_id: userContext.user_id,
      action: 'CREATE_LOGIN_ACCESS',
      module: 'USERS',
      entity_name: 'user_credentials',
      record_id: user.id,
      new_values: { username: user.username, school_id_code: loc.school_id_code },
    });

    return this.getUserLoginAccess(userId, userContext);
  }

  async toggleUserLoginAccess(
    userId: string,
    status: 'ACTIVE' | 'DISABLED',
    userContext: UserContext
  ): Promise<UserLoginAccess> {
    // SERVER-SIDE SELF-LOCKOUT GUARD:
    if (userId === userContext.user_id && status === 'DISABLED') {
      throw new Error('Security Violation: You cannot disable your own login access (self-lockout prevention).');
    }

    const creds = await credentialsRepository.findByUserId(userId);
    if (creds.length === 0) {
      throw new Error('No login credentials found for this user');
    }

    for (const c of creds) {
      await credentialsRepository.update(c.id, { login_status: status });
    }

    await auditRepository.log({
      school_id: creds[0].school_id,
      location_id: creds[0].location_id,
      user_id: userContext.user_id,
      action: status === 'ACTIVE' ? 'ENABLE_LOGIN' : 'DISABLE_LOGIN',
      module: 'USERS',
      entity_name: 'user_credentials',
      record_id: userId,
      new_values: { status },
    });

    return this.getUserLoginAccess(userId, userContext);
  }

  async resetUserPassword(
    userId: string,
    newPasswordPlain: string,
    userContext: UserContext
  ): Promise<boolean> {
    if (!newPasswordPlain || newPasswordPlain.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const creds = await credentialsRepository.findByUserId(userId);
    if (creds.length === 0) {
      throw new Error('No login credentials found for this user');
    }

    const passHash = hashPassword(newPasswordPlain);
    for (const c of creds) {
      await credentialsRepository.update(c.id, {
        password_hash: passHash,
        password_changed_at: new Date().toISOString(),
        failed_login_attempts: 0,
        locked_until: null,
      });
    }

    await auditRepository.log({
      school_id: creds[0].school_id,
      location_id: creds[0].location_id,
      user_id: userContext.user_id,
      action: 'RESET_PASSWORD',
      module: 'USERS',
      entity_name: 'user_credentials',
      record_id: userId,
    });

    return true;
  }
}

export const userService = new UserService();
