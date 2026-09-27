// ========================================================================
// User Repository
// Universal Users Model Data Access with Taxonomy & Specialized Profile Views
// ========================================================================

import { getMemoryDbClient, getSupabaseClient, isSupabaseDatabaseActive, markSupabaseUnreachable } from '../db/client.js';
import { User, Location, UserType, Role, StudentProfile, StaffProfile } from '../types/index.js';
import { accessControlRepository } from './access-control.repository.js';
import { locationRepository } from './location.repository.js';
import { taxonomyRepository } from './taxonomy.repository.js';
import { profileRepository } from './profile.repository.js';
import { credentialsRepository } from './credentials.repository.js';
import { academicRepository } from './academic.repository.js';
import { extendedRecordsRepository } from './extended-records.repository.js';

export interface UserFilters {
  schoolId?: string | null;
  userTypeId?: string;
  userTypeCode?: string;
  locationId?: string;
  search?: string;
  status?: string;
  categoryId?: string;
  subcategoryId?: string;
  tagId?: string;
  labelId?: string;
  roleId?: string;
  includeDeleted?: boolean;
  sortBy?: 'name' | 'username' | 'created_at' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface StudentFilters extends UserFilters {
  academicSession?: string;
  className?: string;
  sectionName?: string;
  house?: string;
  stream?: string;
  medium?: string;
  admissionNumber?: string;
}

export interface StaffFilters extends UserFilters {
  designationId?: string;
  department?: string;
  employeeCode?: string;
}

export class UserRepository {
  private mem = getMemoryDbClient();

  /**
   * Helper to hydrate all relational dimensions for a user
   */
  async hydrateUser(u: User): Promise<User> {
    const userType = await accessControlRepository.getUserTypeById(u.user_type_id);
    const roles = await accessControlRepository.getUserRoles(u.id);

    // Locations
    const locationAccess = await accessControlRepository.getUserLocationAccess(u.id);
    const locations: Location[] = [];
    for (const locAccess of locationAccess) {
      const loc = await locationRepository.findById(locAccess.location_id);
      if (loc) locations.push(loc);
    }

    // Taxonomy (Categories, Subcategories, Tags, Labels)
    const [categories, subcategories, tags, labels] = await Promise.all([
      taxonomyRepository.getUserCategories(u.id),
      taxonomyRepository.getUserSubcategories(u.id),
      taxonomyRepository.getUserTags(u.id),
      taxonomyRepository.getUserLabels(u.id),
    ]);

    // Domain extensions
    const studentProfile = await profileRepository.getStudentProfile(u.id);
    let staffProfile = await profileRepository.getStaffProfile(u.id);

    let designation = undefined;
    if (staffProfile?.designation) {
      designation = staffProfile.designation;
    }

    let finalStudentProfile = studentProfile || undefined;
    let parents = undefined;
    let children = undefined;
    if (finalStudentProfile || userType?.code === 'STUDENT') {
      parents = await profileRepository.getParentsForStudent(u.id);
      if (u.school_id) {
        const activeEnrollment = await academicRepository.findActiveEnrollmentForStudent(u.school_id, u.id);
        if (activeEnrollment) {
          let sectionName = activeEnrollment.section?.name || finalStudentProfile?.section_name || '';
          if (finalStudentProfile?.section_name?.toLowerCase().startsWith('section ') && activeEnrollment.section?.name && !activeEnrollment.section.name.toLowerCase().startsWith('section ')) {
            sectionName = `Section ${activeEnrollment.section.name}`;
          }

          let className = activeEnrollment.class?.display_name || activeEnrollment.class?.name || finalStudentProfile?.class_name || '';
          if (finalStudentProfile?.class_name?.toLowerCase().startsWith('class ') && className && !className.toLowerCase().startsWith('class ')) {
            className = `Class ${className}`;
          }

          finalStudentProfile = {
            ...(finalStudentProfile || {
              id: '',
              user_id: u.id,
              school_id: u.school_id,
              admission_number: '',
              created_at: activeEnrollment.created_at,
              updated_at: activeEnrollment.updated_at,
            }),
            academic_session: activeEnrollment.session?.name || finalStudentProfile?.academic_session || '',
            class_name: className,
            section_name: sectionName,
            roll_number: activeEnrollment.roll_number || finalStudentProfile?.roll_number,
          };
        }
      }

      if (!finalStudentProfile && userType?.code === 'STUDENT') {
        finalStudentProfile = {
          id: u.id,
          user_id: u.id,
          school_id: u.school_id || '',
          admission_number: 'ADM-' + (u.id.slice(0, 6).toUpperCase()),
          academic_session: '2026-27',
          class_name: 'Unassigned',
          section_name: '',
          created_at: u.created_at,
          updated_at: u.updated_at,
        };
      }
    }

    if (finalStudentProfile) {
      const [prevRecords, achievements, docs] = await Promise.all([
        extendedRecordsRepository.getPreviousRecordsForStudent(u.id),
        extendedRecordsRepository.getAchievementsForStudent(u.id),
        extendedRecordsRepository.getDocumentsForUser(u.id),
      ]);
      finalStudentProfile = {
        ...finalStudentProfile,
        previous_academic_records: prevRecords,
        achievements,
        documents: docs,
      };
    }

    if (staffProfile) {
      const [quals, exps, certs, docs] = await Promise.all([
        extendedRecordsRepository.getQualificationsForStaff(u.id),
        extendedRecordsRepository.getExperiencesForStaff(u.id),
        extendedRecordsRepository.getCertificationsForStaff(u.id),
        extendedRecordsRepository.getDocumentsForUser(u.id),
      ]);
      staffProfile = {
        ...staffProfile,
        qualifications: quals,
        experiences: exps,
        certifications: certs,
        documents: docs,
      };
    }

    if (userType?.code === 'PARENT') {
      children = await profileRepository.getChildrenForParent(u.id);
    }

    const sanitized = { ...u };
    delete (sanitized as any).password_hash;

    // Login access
    const credentials = await credentialsRepository.findByUserId(u.id);
    const primaryCred = credentials[0];
    let login_access = undefined;
    if (primaryCred) {
      const loc = await locationRepository.findById(primaryCred.location_id);
      login_access = {
        user_id: u.id,
        school_id_code: primaryCred.school_id_code,
        location_name: loc?.location_name,
        username: primaryCred.username,
        has_login: true,
        status: (primaryCred.login_status === 'ACTIVE' ? 'ENABLED' : 'DISABLED') as any,
        is_super_admin: primaryCred.is_super_admin,
        last_login_at: primaryCred.last_login_at,
      };
    } else {
      login_access = {
        user_id: u.id,
        status: 'NOT_CREATED' as any,
        has_login: false,
      };
    }

    return {
      ...sanitized,
      user_type: userType || undefined,
      roles,
      locations,
      categories,
      subcategories,
      tags,
      labels,
      student_profile: finalStudentProfile,
      staff_profile: staffProfile || undefined,
      designation,
      login_access,
      parents,
      children,
    };
  }

  async findUsers(filters: UserFilters): Promise<User[]> {
    let rawUsers: User[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!.from('users').select('*');
        if (filters.schoolId !== undefined) {
          if (filters.schoolId === null) {
            query = query.is('school_id', null);
          } else {
            query = query.eq('school_id', filters.schoolId);
          }
        }
        if (!filters.includeDeleted) {
          query = query.is('deleted_at', null);
        }
        if (filters.userTypeId) {
          query = query.eq('user_type_id', filters.userTypeId);
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        const { data, error } = await query;
        if (error) {
          markSupabaseUnreachable(error.message);
        } else if (data && data.length > 0) {
          rawUsers = data as User[];
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[UserRepository] Supabase findUsers failed, falling back to in-memory:', err.message);
      }
    }

    if (rawUsers.length === 0) {
      rawUsers = this.mem.findAll('users', (row: User) => {
        if (filters.schoolId !== undefined) {
          if (filters.schoolId === null) {
            if (row.school_id !== null) return false;
          } else {
            if (row.school_id !== filters.schoolId) return false;
          }
        }
        if (!filters.includeDeleted && row.deleted_at) return false;
        if (filters.userTypeId && row.user_type_id !== filters.userTypeId) return false;
        if (filters.status && row.status !== filters.status) return false;
        return true;
      });
    }

    // Apply search filter in memory
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rawUsers = rawUsers.filter(row => {
        const matchesName = `${row.first_name} ${row.last_name || ''}`.toLowerCase().includes(q);
        const matchesEmail = (row.email || '').toLowerCase().includes(q);
        const matchesUsername = (row.username || '').toLowerCase().includes(q);
        const matchesPhone = (row.phone || '').includes(q);
        return matchesName || matchesEmail || matchesUsername || matchesPhone;
      });
    }

    const enrichedUsers: User[] = [];
    for (const u of rawUsers) {
      // User Type code filter if specified
      if (filters.userTypeCode) {
        const ut = await accessControlRepository.getUserTypeById(u.user_type_id);
        if (ut?.code.toUpperCase() !== filters.userTypeCode.toUpperCase()) continue;
      }

      // Filter by location if specified
      if (filters.locationId) {
        const locationAccess = await accessControlRepository.getUserLocationAccess(u.id);
        const userLocationIds = locationAccess.map(l => l.location_id);
        if (!userLocationIds.includes(filters.locationId)) continue;
      }

      // Filter by Role if specified
      if (filters.roleId) {
        const roles = await accessControlRepository.getUserRoles(u.id);
        if (!roles.some(r => r.id === filters.roleId)) continue;
      }

      // Taxonomy filters
      if (filters.categoryId) {
        const cats = await taxonomyRepository.getUserCategories(u.id);
        if (!cats.some(c => c.id === filters.categoryId)) continue;
      }

      if (filters.subcategoryId) {
        const subs = await taxonomyRepository.getUserSubcategories(u.id);
        if (!subs.some(s => s.id === filters.subcategoryId)) continue;
      }

      if (filters.tagId) {
        const tags = await taxonomyRepository.getUserTags(u.id);
        if (!tags.some(t => t.id === filters.tagId)) continue;
      }

      if (filters.labelId) {
        const labels = await taxonomyRepository.getUserLabels(u.id);
        if (!labels.some(l => l.id === filters.labelId)) continue;
      }

      const hydrated = await this.hydrateUser(u);
      enrichedUsers.push(hydrated);
    }

    // Sort results - Default newest records first (created_at DESC)
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'desc';
    enrichedUsers.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      if (sortBy === 'name') {
        valA = `${a.first_name} ${a.last_name || ''}`.toLowerCase();
        valB = `${b.first_name} ${b.last_name || ''}`.toLowerCase();
      } else if (sortBy === 'username') {
        valA = a.username.toLowerCase();
        valB = b.username.toLowerCase();
      } else if (sortBy === 'created_at') {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      } else {
        valA = a.status;
        valB = b.status;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return enrichedUsers;
  }

  /**
   * Specialized Student Master Query
   * Queries universal users table filtered by student classification & academic dimensions
   */
  async findStudents(filters: StudentFilters): Promise<User[]> {
    // Find STUDENT user_type
    const studentUserType = await accessControlRepository.getUserTypeByCode('STUDENT', filters.schoolId);
    if (!studentUserType) return [];

    const baseStudents = await this.findUsers({
      ...filters,
      userTypeId: studentUserType.id,
    });

    // Apply academic dimensions filtering
    return baseStudents.filter(u => {
      let sp = u.student_profile;
      if (!sp) {
        sp = {
          id: u.id,
          user_id: u.id,
          school_id: u.school_id || '',
          admission_number: 'ADM-' + (u.id.slice(0, 6).toUpperCase()),
          academic_session: '2026-27',
          class_name: 'Unassigned',
          section_name: '',
          created_at: u.created_at,
          updated_at: u.updated_at,
        };
        u.student_profile = sp;
      }

      if (filters.academicSession && sp.academic_session && sp.academic_session !== filters.academicSession) return false;
      if (filters.className) {
        const filterCls = filters.className.toLowerCase().replace(/^class\s*/i, '').trim();
        const studentCls = (sp.class_name || '').toLowerCase().replace(/^class\s*/i, '').trim();
        if (sp.class_name !== filters.className && studentCls !== filterCls) return false;
      }
      if (filters.sectionName) {
        const filterSec = filters.sectionName.toLowerCase().replace(/^section\s*/i, '').trim();
        const studentSec = (sp.section_name || '').toLowerCase().replace(/^section\s*/i, '').trim();
        if (sp.section_name !== filters.sectionName && studentSec !== filterSec) return false;
      }
      if (filters.house && sp.house?.toLowerCase() !== filters.house.toLowerCase()) return false;
      if (filters.stream && sp.stream?.toLowerCase() !== filters.stream.toLowerCase()) return false;
      if (filters.medium && sp.medium?.toLowerCase() !== filters.medium.toLowerCase()) return false;
      if (filters.admissionNumber && !sp.admission_number.toLowerCase().includes(filters.admissionNumber.toLowerCase())) return false;

      return true;
    });
  }

  /**
   * Specialized Staff Master Query
   * Queries universal users table filtered by staff/teacher classification & employment dimensions
   */
  async findStaff(filters: StaffFilters): Promise<User[]> {
    // Staff includes TEACHER, STAFF, ADMIN, DIRECTOR user types
    const staffTypeCodes = ['TEACHER', 'STAFF', 'ADMIN', 'DIRECTOR'];
    const allUsers = await this.findUsers(filters);

    const baseStaff = allUsers.filter(u => {
      if (!u.user_type) return false;
      return staffTypeCodes.includes(u.user_type.code.toUpperCase());
    });

    // Apply employment dimensions filtering
    return baseStaff.filter(u => {
      const sp = u.staff_profile;
      if (filters.designationId) {
        if (!sp || sp.designation_id !== filters.designationId) return false;
      }
      if (filters.department) {
        if (!sp || sp.department?.toLowerCase() !== filters.department.toLowerCase()) return false;
      }
      if (filters.employeeCode) {
        if (!sp || !sp.employee_code.toLowerCase().includes(filters.employeeCode.toLowerCase())) return false;
      }
      return true;
    });
  }

  /**
   * Specialized Parent Master Query
   * Queries universal users table filtered by PARENT classification
   */
  async findParents(filters: { schoolId: string; search?: string; locationId?: string; status?: string }): Promise<User[]> {
    const parentUserType = await accessControlRepository.getUserTypeByCode('PARENT', filters.schoolId);
    if (!parentUserType) return [];

    return this.findUsers({
      ...filters,
      userTypeId: parentUserType.id,
    });
  }

  async findById(id: string, schoolId?: string | null): Promise<User | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!.from('users').select('*').eq('id', id).is('deleted_at', null);
        if (schoolId !== undefined && schoolId !== null) {
          query = query.eq('school_id', schoolId);
        }
        const { data, error } = await query.maybeSingle();
        if (error) {
          markSupabaseUnreachable(error.message);
        } else if (data) {
          return this.hydrateUser(data as User);
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[UserRepository] Supabase findById failed, falling back to in-memory:', err.message);
      }
    }

    const u = this.mem.findById('users', id) as User | null;
    if (!u || u.deleted_at) return null;
    
    // Strict tenant isolation check
    if (schoolId !== undefined && schoolId !== null && u.school_id !== schoolId) {
      return null;
    }

    return this.hydrateUser(u);
  }

  async findByUsername(username: string, schoolId?: string | null): Promise<User | null> {
    if (!username) return null;
    const clean = username.trim().toLowerCase();

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!.from('users').select('*').ilike('username', clean).is('deleted_at', null);
        if (schoolId !== undefined) {
          if (schoolId === null) {
            query = query.is('school_id', null);
          } else {
            query = query.eq('school_id', schoolId);
          }
        }
        const { data, error } = await query.maybeSingle();
        if (error) {
          markSupabaseUnreachable(error.message);
        } else if (data) {
          return this.findById((data as User).id);
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[UserRepository] Supabase findByUsername failed, falling back to in-memory:', err.message);
      }
    }

    const list = this.mem.findAll('users', (row: User) => {
      if (row.username?.toLowerCase() !== clean || row.deleted_at) return false;
      if (schoolId !== undefined) {
        if (schoolId === null && row.school_id !== null) return false;
        if (schoolId !== null && row.school_id !== schoolId) return false;
      }
      return true;
    });
    if (list.length === 0) return null;
    return this.findById(list[0].id);
  }

  async findBySchoolAndUsername(schoolId: string | null, username: string): Promise<User | null> {
    return this.findByUsername(username, schoolId);
  }

  async findByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const clean = email.trim().toLowerCase();

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('users')
          .select('*')
          .ilike('email', clean)
          .is('deleted_at', null)
          .maybeSingle();
        if (!error && data) return this.findById((data as User).id);
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        console.warn('[UserRepository] Supabase findByEmail failed, falling back to in-memory:', err.message);
      }
    }

    const list = this.mem.findAll('users', (row: User) => 
      row.email?.toLowerCase() === clean && !row.deleted_at
    );
    if (list.length === 0) return null;
    return this.findById(list[0].id);
  }

  async create(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    let created: User;
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const userRecord: User = { ...data, id, created_at: now, updated_at: now } as User;
        const { data: ins, error } = await getSupabaseClient()!.from('users').insert(userRecord).select().single();
        if (!error && ins) {
          created = ins as User;
        } else {
          created = this.mem.insert('users', data) as User;
        }
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
        created = this.mem.insert('users', data) as User;
      }
    } else {
      created = this.mem.insert('users', data) as User;
    }
    this.mem.getTable('users').set(created.id, created);
    return (await this.findById(created.id)) || created;
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('users')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
      }
    }
    const updated = this.mem.update('users', id, updates) as User | null;
    if (!updated) return null;
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('users')
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch (err: any) {
        markSupabaseUnreachable(err.message);
      }
    }
    return this.mem.softDelete('users', id);
  }
}

export const userRepository = new UserRepository();
