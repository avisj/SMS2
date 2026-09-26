// ========================================================================
// Authentication Service
// School ID Architecture, 4-Step Validation Flow & Recovery Authority
// ========================================================================

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { schoolRepository } from '../repositories/school.repository.js';
import { locationRepository } from '../repositories/location.repository.js';
import { accessControlRepository } from '../repositories/access-control.repository.js';
import { credentialsRepository } from '../repositories/credentials.repository.js';
import { configRepository } from '../repositories/config.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { verifyPassword } from '../utils/password.js';
import { UserContext, User, UserCredential } from '../types/index.js';

export class AuthService {
  /**
   * Generates a signed JWT session token containing user identity and context
   */
  generateToken(payload: {
    userId: string;
    schoolId: string | null;
    locationId?: string;
    schoolIdCode?: string;
    isSuperAdmin?: boolean;
  }): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
  }

  /**
   * Builds the comprehensive UserContext (roles, permissions, data scopes, permitted locations)
   */
  async buildUserContext(
    user: User,
    activeLocationId?: string | null,
    credential?: UserCredential | null
  ): Promise<UserContext> {
    if (!credential) {
      const userCreds = await credentialsRepository.findByUserId(user.id);
      credential = userCreds.find(c => c.is_super_admin) || userCreds[0] || null;
    }

    const isSchoolSuperAdmin = credential?.is_super_admin || false;
    const userType = await accessControlRepository.getUserTypeById(user.user_type_id);
    const isSuperAdmin = (userType?.code === 'SUPER_ADMIN' && !user.school_id);

    let school = null;
    if (user.school_id) {
      school = await schoolRepository.findById(user.school_id);
    }

    const roles = await accessControlRepository.getUserRoles(user.id);
    let permissions = await accessControlRepository.getUserEffectivePermissions(user.id);
    const locationAccess = await accessControlRepository.getUserLocationAccess(user.id);
    let permittedLocationIds = locationAccess.map(l => l.location_id);

    // If School Super Admin: grant full administrative permissions within this school
    // independent of normal role-rights table!
    if (isSchoolSuperAdmin) {
      const allPermissions = await accessControlRepository.getPermissions();
      const allScopes = await accessControlRepository.getDataScopes();
      const allLocationsScope = allScopes.find(s => s.code === 'ALL_LOCATIONS') || allScopes[0];

      permissions = allPermissions.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        module: p.module,
        action: p.action,
        scope_id: allLocationsScope.id,
        scope_code: allLocationsScope.code,
        scope_name: allLocationsScope.name,
        hierarchy_level: allLocationsScope.hierarchy_level,
      }));

      if (user.school_id) {
        const schoolLocs = await locationRepository.findBySchoolId(user.school_id);
        permittedLocationIds = schoolLocs.map(l => l.id);
      }
    }

    // Determine initial active branch
    let resolvedActiveLocationId = activeLocationId || null;
    if (!resolvedActiveLocationId && permittedLocationIds.length > 0) {
      const primary = locationAccess.find(l => l.is_primary);
      resolvedActiveLocationId = primary ? primary.location_id : permittedLocationIds[0];
    }

    let activeSchoolIdCode: string | undefined = credential?.school_id_code;
    if (!activeSchoolIdCode && resolvedActiveLocationId) {
      const loc = await locationRepository.findById(resolvedActiveLocationId);
      if (loc) activeSchoolIdCode = loc.school_id_code;
    }

    let brandColor = '#0d9488';
    if (user.school_id) {
      const brandSetting = await configRepository.getSchoolSetting(user.school_id, 'brand_color');
      if (brandSetting?.setting_value) {
        brandColor = brandSetting.setting_value;
      }
    }

    return {
      user_id: user.id,
      school_id: user.school_id || null,
      school_id_code: activeSchoolIdCode,
      school_name: school?.school_name,
      school_code: school?.school_code,
      username: credential?.username || user.username,
      email: user.email,
      user_type_code: userType?.code || (isSchoolSuperAdmin ? 'SUPER_ADMIN' : 'OTHER'),
      is_super_admin: isSuperAdmin,
      is_school_super_admin: isSchoolSuperAdmin,
      roles: roles.map(r => ({ id: r.id, code: r.code, name: r.name })),
      permissions,
      permitted_location_ids: permittedLocationIds,
      active_location_id: resolvedActiveLocationId,
      currency: school?.currency || 'INR',
      currency_symbol: school?.currency_symbol || (school?.currency === 'USD' ? '$' : '₹'),
      currency_position: school?.currency_position || 'BEFORE',
      decimal_places: school?.decimal_places ?? 2,
      timezone: school?.timezone || 'Asia/Kolkata',
      date_format: school?.date_format || 'DD/MM/YYYY',
      time_format: school?.time_format || '12h',
      locale: school?.locale || (school?.currency === 'USD' ? 'en-US' : 'en-IN'),
      brand_color: brandColor,
    };
  }

  /**
   * Authenticate with School ID, User ID, and Password
   * Strict 4-step validation sequence
   */
  async login(
    schoolIdCode: string,
    username: string,
    passwordPlain: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Input sanitization and existence check
    if (!schoolIdCode || typeof schoolIdCode !== 'string' || !schoolIdCode.trim()) {
      throw new Error('School ID is incorrect.');
    }
    if (!username || typeof username !== 'string' || !username.trim()) {
      throw new Error('User ID not found for this School ID.');
    }
    if (!passwordPlain || typeof passwordPlain !== 'string') {
      throw new Error('Password is incorrect.');
    }

    const cleanSchoolCode = schoolIdCode.trim().toUpperCase();
    const cleanUsername = username.trim().toLowerCase();

    // STEP 1: Validate School ID
    const location = await locationRepository.findBySchoolIdCode(cleanSchoolCode);
    if (!location) {
      throw new Error('School ID is incorrect.');
    }

    // STEP 2: Validate User ID within that School ID context
    const credential = await credentialsRepository.findBySchoolIdAndUsername(cleanSchoolCode, cleanUsername);
    if (!credential) {
      throw new Error('User ID not found for this School ID.');
    }

    // Check account lockout
    if (credential.locked_until && new Date(credential.locked_until) > new Date()) {
      throw new Error('Too many unsuccessful login attempts. Please try again later.');
    }

    // Check login status
    if (credential.login_status === 'DISABLED') {
      throw new Error('Login access for this user is disabled.');
    }

    // STEP 3: Validate Password
    const isPasswordValid = verifyPassword(passwordPlain, credential.password_hash);
    if (!isPasswordValid) {
      const attempts = (credential.failed_login_attempts || 0) + 1;
      const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await credentialsRepository.update(credential.id, {
        failed_login_attempts: attempts,
        locked_until: lockedUntil,
      });

      await auditRepository.log({
        school_id: credential.school_id,
        location_id: credential.location_id,
        user_id: credential.user_id,
        action: 'FAILED_LOGIN',
        module: 'AUTH',
        entity_name: 'session',
        record_id: credential.user_id,
        new_values: { username: cleanUsername, school_id_code: cleanSchoolCode, attempts },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      if (lockedUntil) {
        throw new Error('Too many unsuccessful login attempts. Please try again later.');
      }

      throw new Error('Password is incorrect.');
    }

    // STEP 4: Authenticate Successfully
    await credentialsRepository.update(credential.id, {
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    });

    const user = await userRepository.findById(credential.user_id);
    if (!user) {
      throw new Error('User ID not found for this School ID.');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error(`Account is ${user.status.toLowerCase()}. Please contact administrator.`);
    }

    // Establish context
    const context = await this.buildUserContext(user, credential.location_id, credential);
    const token = this.generateToken({
      userId: user.id,
      schoolId: credential.school_id,
      locationId: credential.location_id,
      schoolIdCode: credential.school_id_code,
      isSuperAdmin: credential.is_super_admin,
    });

    await auditRepository.log({
      school_id: credential.school_id,
      location_id: credential.location_id,
      user_id: user.id,
      action: 'LOGIN',
      module: 'AUTH',
      entity_name: 'session',
      record_id: user.id,
      new_values: { username: credential.username, school_id_code: credential.school_id_code, ip: ipAddress },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        user_type: user.user_type,
        school_id: credential.school_id,
      },
      context,
    };
  }

  /**
   * Switch the active branch location for the current user session
   */
  async switchBranch(userContext: UserContext, targetLocationId: string): Promise<UserContext> {
    if (!userContext.is_super_admin) {
      if (!userContext.permitted_location_ids.includes(targetLocationId)) {
        throw new Error('Unauthorized: You do not have access to this branch location');
      }
    }

    const loc = await locationRepository.findById(targetLocationId);
    if (!loc) {
      throw new Error('Branch location not found');
    }

    return {
      ...userContext,
      active_location_id: targetLocationId,
      school_id_code: loc.school_id_code,
    };
  }
}

export const authService = new AuthService();
