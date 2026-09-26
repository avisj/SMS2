// ========================================================================
// Tenant Service
// Multi-Tenant School & Location Operations
// ========================================================================

import { schoolRepository } from '../repositories/school.repository.js';
import { locationRepository } from '../repositories/location.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { School, Location, UserContext } from '../types/index.js';

export class TenantService {
  // ----------------------------------------------------------------------
  // School Operations
  // ----------------------------------------------------------------------
  async listSchools(userContext: UserContext): Promise<School[]> {
    if (userContext.is_super_admin) {
      return schoolRepository.findAll();
    }
    if (!userContext.school_id) return [];
    const school = await schoolRepository.findById(userContext.school_id);
    return school ? [school] : [];
  }

  async getSchoolById(id: string, userContext: UserContext): Promise<School | null> {
    if (!userContext.is_super_admin && userContext.school_id !== id) {
      throw new Error('Unauthorized cross-tenant access attempt');
    }
    return schoolRepository.findById(id);
  }

  async createSchool(
    data: Omit<School, 'id' | 'created_at' | 'updated_at'>,
    userContext: UserContext
  ): Promise<School> {
    if (!userContext.is_super_admin) {
      throw new Error('Only SaaS Super Admin can create new school tenants');
    }

    const existing = await schoolRepository.findByCode(data.school_code);
    if (existing) {
      throw new Error(`School with code '${data.school_code}' already exists`);
    }

    const school = await schoolRepository.create(data);

    await auditRepository.log({
      school_id: school.id,
      user_id: userContext.user_id,
      action: 'CREATE',
      module: 'SCHOOLS',
      entity_name: 'school',
      record_id: school.id,
      new_values: school,
    });

    return school;
  }

  async updateSchool(
    id: string,
    updates: Partial<School>,
    userContext: UserContext
  ): Promise<School | null> {
    if (!userContext.is_super_admin && userContext.school_id !== id) {
      throw new Error('Unauthorized cross-tenant update attempt');
    }

    const oldSchool = await schoolRepository.findById(id);
    if (!oldSchool) throw new Error('School not found');

    const updated = await schoolRepository.update(id, updates);

    await auditRepository.log({
      school_id: id,
      user_id: userContext.user_id,
      action: 'UPDATE',
      module: 'SCHOOLS',
      entity_name: 'school',
      record_id: id,
      old_values: oldSchool,
      new_values: updated,
    });

    return updated;
  }

  // ----------------------------------------------------------------------
  // Location Operations
  // ----------------------------------------------------------------------
  async listLocations(schoolId: string, userContext: UserContext): Promise<Location[]> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized cross-tenant location query');
    }

    // If restricted branch admin or teacher, scope by permitted locations
    let locationIds: string[] | undefined = undefined;
    if (!userContext.is_super_admin) {
      const hasAllLocationsPerm = userContext.permissions.some(
        p => p.module === 'locations' && p.scope_code === 'ALL_LOCATIONS'
      );
      if (!hasAllLocationsPerm) {
        locationIds = userContext.permitted_location_ids;
      }
    }

    return locationRepository.findBySchoolId(schoolId, { locationIds });
  }

  async getLocationById(id: string, userContext: UserContext): Promise<Location | null> {
    const loc = await locationRepository.findById(id);
    if (!loc) return null;

    if (!userContext.is_super_admin && userContext.school_id !== loc.school_id) {
      throw new Error('Unauthorized cross-tenant location query');
    }

    return loc;
  }

  async createLocation(
    data: Omit<Location, 'id' | 'created_at' | 'updated_at'>,
    userContext: UserContext
  ): Promise<Location> {
    if (!userContext.is_super_admin && userContext.school_id !== data.school_id) {
      throw new Error('Cannot create branch for a different school tenant');
    }

    const existing = await locationRepository.findByCode(data.school_id, data.location_code);
    if (existing) {
      throw new Error(`Location with code '${data.location_code}' already exists in this school`);
    }

    const location = await locationRepository.create(data);

    await auditRepository.log({
      school_id: data.school_id,
      location_id: location.id,
      user_id: userContext.user_id,
      action: 'CREATE',
      module: 'LOCATIONS',
      entity_name: 'location',
      record_id: location.id,
      new_values: location,
    });

    return location;
  }

  async updateLocation(
    id: string,
    updates: Partial<Location>,
    userContext: UserContext
  ): Promise<Location | null> {
    const oldLoc = await locationRepository.findById(id);
    if (!oldLoc) throw new Error('Branch location not found');

    if (!userContext.is_super_admin && userContext.school_id !== oldLoc.school_id) {
      throw new Error('Unauthorized cross-tenant location update');
    }

    const updated = await locationRepository.update(id, updates);

    await auditRepository.log({
      school_id: oldLoc.school_id,
      location_id: id,
      user_id: userContext.user_id,
      action: 'UPDATE',
      module: 'LOCATIONS',
      entity_name: 'location',
      record_id: id,
      old_values: oldLoc,
      new_values: updated,
    });

    return updated;
  }
}

export const tenantService = new TenantService();
