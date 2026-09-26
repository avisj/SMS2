// ========================================================================
// People Service
// Specialized views for Students, Staff, Designations & Taxonomy Masters
// Operating on the UNIVERSAL users table and dimensional profile tables
// ========================================================================

import { taxonomyRepository } from '../repositories/taxonomy.repository.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { userRepository, StudentFilters, StaffFilters } from '../repositories/user.repository.js';
import { accessControlRepository } from '../repositories/access-control.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { credentialsRepository } from '../repositories/credentials.repository.js';
import { locationRepository } from '../repositories/location.repository.js';
import { extendedRecordsRepository } from '../repositories/extended-records.repository.js';
import { hashPassword } from '../utils/password.js';
import { academicService } from './academic.service.js';
import { academicRepository } from '../repositories/academic.repository.js';
import {
  User,
  Designation,
  UserCategory,
  UserSubcategory,
  UserTag,
  UserLabel,
  StudentProfile,
  StaffProfile,
  ParentStudentRelationship,
  StudentPreviousAcademicRecord,
  StudentAchievement,
  StaffQualification,
  StaffProfessionalExperience,
  StaffCertification,
  UserDocument,
} from '../types/index.js';

export interface CreateStudentInput {
  username: string;
  email: string;
  phone?: string;
  first_name: string;
  middle_name?: string;
  last_name?: string;
  profile_photo_url?: string;
  password?: string;
  location_id: string;
  create_login_access?: boolean;
  login_password?: string;
  login_status?: 'ACTIVE' | 'DISABLED';
  // Student Profile fields
  admission_number: string;
  roll_number?: string;
  academic_session?: string;
  academic_session_id?: string;
  class_name?: string;
  class_id?: string;
  section_name?: string;
  section_id?: string;
  stream?: string;
  medium?: string;
  house?: string;
  gender?: string;
  date_of_birth?: string;
  blood_group?: string;
  nationality?: string;
  religion?: string;
  category_name?: string;
  address?: string;
  admission_date?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  // Extended Child Records
  previous_academic_records?: Array<Omit<StudentPreviousAcademicRecord, 'id' | 'school_id' | 'student_user_id' | 'created_at' | 'updated_at'>>;
  achievements?: Array<Omit<StudentAchievement, 'id' | 'school_id' | 'student_user_id' | 'created_at' | 'updated_at'>>;
  documents?: Array<Omit<UserDocument, 'id' | 'school_id' | 'user_id' | 'created_at' | 'updated_at'>>;
  // Taxonomy
  category_ids?: string[];
  subcategory_ids?: string[];
  tag_ids?: string[];
  label_ids?: string[];
}

export interface UpdateStudentInput {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  phone?: string;
  profile_photo_url?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  // Student Profile updates
  roll_number?: string;
  academic_session?: string;
  class_name?: string;
  section_name?: string;
  stream?: string;
  medium?: string;
  house?: string;
  gender?: string;
  date_of_birth?: string;
  blood_group?: string;
  nationality?: string;
  religion?: string;
  category_name?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  // Taxonomy
  category_ids?: string[];
  subcategory_ids?: string[];
  tag_ids?: string[];
  label_ids?: string[];
}

export interface CreateStaffInput {
  username: string;
  email: string;
  phone?: string;
  first_name: string;
  middle_name?: string;
  last_name?: string;
  profile_photo_url?: string;
  password?: string;
  create_login_access?: boolean;
  login_password?: string;
  login_status?: 'ACTIVE' | 'DISABLED';
  user_type_code?: 'TEACHER' | 'STAFF' | 'ADMIN';
  role_id?: string;
  role_ids?: string[];
  location_ids: string[];
  primary_location_id?: string;
  // Staff Profile fields
  employee_code: string;
  designation_id?: string;
  department?: string;
  employment_type?: 'PERMANENT' | 'PROBATION' | 'CONTRACT' | 'PART_TIME' | 'TEMPORARY';
  joining_date?: string;
  qualification?: string;
  experience_years?: number;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  confirmation_date?: string;
  work_shift?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  // Extended Child Records
  qualifications?: Array<Omit<StaffQualification, 'id' | 'school_id' | 'staff_user_id' | 'created_at' | 'updated_at'>>;
  experiences?: Array<Omit<StaffProfessionalExperience, 'id' | 'school_id' | 'staff_user_id' | 'created_at' | 'updated_at'>>;
  certifications?: Array<Omit<StaffCertification, 'id' | 'school_id' | 'staff_user_id' | 'created_at' | 'updated_at'>>;
  documents?: Array<Omit<UserDocument, 'id' | 'school_id' | 'user_id' | 'created_at' | 'updated_at'>>;
  // Taxonomy
  category_ids?: string[];
  subcategory_ids?: string[];
  tag_ids?: string[];
  label_ids?: string[];
}

export interface CreateParentInput {
  first_name: string;
  middle_name?: string;
  last_name?: string;
  username: string;
  email: string;
  phone?: string;
  location_id?: string;
  student_ids?: string[];
  relationship_type?: string;
  is_emergency_contact?: boolean;
  create_login_access?: boolean;
  login_password?: string;
  login_status?: 'ACTIVE' | 'DISABLED';
  category_ids?: string[];
  subcategory_ids?: string[];
  tag_ids?: string[];
  label_ids?: string[];
}

export interface UpdateStaffInput {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  phone?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  // Staff Profile updates
  designation_id?: string;
  department?: string;
  employment_type?: 'PERMANENT' | 'PROBATION' | 'CONTRACT' | 'PART_TIME' | 'TEMPORARY';
  joining_date?: string;
  qualification?: string;
  experience_years?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  // Taxonomy
  category_ids?: string[];
  subcategory_ids?: string[];
  tag_ids?: string[];
  label_ids?: string[];
}

export class PeopleService {
  // ----------------------------------------------------------------------
  // Designations Master
  // ----------------------------------------------------------------------
  async listDesignations(schoolId: string, includeInactive = false): Promise<Designation[]> {
    return taxonomyRepository.findDesignations(schoolId, { includeInactive });
  }

  async createDesignation(
    schoolId: string,
    data: { code: string; name: string; description?: string },
    actorId: string
  ): Promise<Designation> {
    const existing = await taxonomyRepository.findDesignationByCode(schoolId, data.code);
    if (existing) {
      throw new Error(`Designation code '${data.code}' already exists for this school`);
    }

    const created = await taxonomyRepository.createDesignation({
      school_id: schoolId,
      code: data.code,
      name: data.name,
      description: data.description,
      status: 'ACTIVE',
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'CREATE',
      module: 'TAXONOMY',
      entity_name: 'designation',
      record_id: created.id,
      new_values: { code: created.code, name: created.name },
    });

    return created;
  }

  async updateDesignation(
    schoolId: string,
    id: string,
    updates: Partial<Designation>,
    actorId: string
  ): Promise<Designation | null> {
    const existing = await taxonomyRepository.findDesignationById(id, schoolId);
    if (!existing) throw new Error('Designation not found');

    const updated = await taxonomyRepository.updateDesignation(id, updates);

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'UPDATE',
      module: 'TAXONOMY',
      entity_name: 'designation',
      record_id: id,
      old_values: existing,
      new_values: updates,
    });

    return updated;
  }

  async deleteDesignation(schoolId: string, id: string, actorId: string): Promise<boolean> {
    const existing = await taxonomyRepository.findDesignationById(id, schoolId);
    if (!existing) throw new Error('Designation not found');

    const deleted = await taxonomyRepository.deleteDesignation(id);
    if (deleted) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: actorId,
        action: 'DELETE',
        module: 'TAXONOMY',
        entity_name: 'designation',
        record_id: id,
      });
    }
    return deleted;
  }

  // ----------------------------------------------------------------------
  // Categories & Subcategories Master
  // ----------------------------------------------------------------------
  async listCategories(schoolId: string, userType?: string): Promise<UserCategory[]> {
    return taxonomyRepository.findCategories(schoolId, userType);
  }

  async createCategory(
    schoolId: string,
    data: { code: string; name: string; applicable_user_type: string; description?: string },
    actorId: string
  ): Promise<UserCategory> {
    const existing = await taxonomyRepository.findCategoryByCode(schoolId, data.code);
    if (existing) throw new Error(`Category code '${data.code}' already exists`);

    const created = await taxonomyRepository.createCategory({
      school_id: schoolId,
      code: data.code,
      name: data.name,
      applicable_user_type: data.applicable_user_type,
      description: data.description,
      is_active: true,
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'CREATE',
      module: 'TAXONOMY',
      entity_name: 'user_category',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async updateCategory(schoolId: string, id: string, updates: Partial<UserCategory>, actorId: string): Promise<UserCategory | null> {
    const existing = await taxonomyRepository.findCategoryById(id, schoolId);
    if (!existing) throw new Error('Category not found');

    const updated = await taxonomyRepository.updateCategory(id, updates);
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'UPDATE',
      module: 'TAXONOMY',
      entity_name: 'user_category',
      record_id: id,
      new_values: updates,
    });
    return updated;
  }

  async deleteCategory(schoolId: string, id: string, actorId: string): Promise<boolean> {
    const existing = await taxonomyRepository.findCategoryById(id, schoolId);
    if (!existing) throw new Error('Category not found');

    const deleted = await taxonomyRepository.deleteCategory(id);
    if (deleted) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: actorId,
        action: 'DELETE',
        module: 'TAXONOMY',
        entity_name: 'user_category',
        record_id: id,
      });
    }
    return deleted;
  }

  async listSubcategories(schoolId: string, categoryId?: string): Promise<UserSubcategory[]> {
    return taxonomyRepository.findSubcategories(schoolId, categoryId);
  }

  async createSubcategory(
    schoolId: string,
    data: { category_id: string; code: string; name: string; description?: string },
    actorId: string
  ): Promise<UserSubcategory> {
    const cat = await taxonomyRepository.findCategoryById(data.category_id, schoolId);
    if (!cat) throw new Error('Parent category not found');

    const created = await taxonomyRepository.createSubcategory({
      school_id: schoolId,
      category_id: data.category_id,
      code: data.code,
      name: data.name,
      description: data.description,
      is_active: true,
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'CREATE',
      module: 'TAXONOMY',
      entity_name: 'user_subcategory',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async updateSubcategory(schoolId: string, id: string, updates: Partial<UserSubcategory>, actorId: string): Promise<UserSubcategory | null> {
    const updated = await taxonomyRepository.updateSubcategory(id, updates);
    if (updated) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: actorId,
        action: 'UPDATE',
        module: 'TAXONOMY',
        entity_name: 'user_subcategory',
        record_id: id,
        new_values: updates,
      });
    }
    return updated;
  }

  async deleteSubcategory(schoolId: string, id: string, actorId: string): Promise<boolean> {
    const deleted = await taxonomyRepository.deleteSubcategory(id);
    if (deleted) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: actorId,
        action: 'DELETE',
        module: 'TAXONOMY',
        entity_name: 'user_subcategory',
        record_id: id,
      });
    }
    return deleted;
  }

  // ----------------------------------------------------------------------
  // Tags & Labels Master
  // ----------------------------------------------------------------------
  async listTags(schoolId: string): Promise<UserTag[]> {
    return taxonomyRepository.findTags(schoolId);
  }

  async createTag(
    schoolId: string,
    data: { code: string; name: string; color?: string; description?: string },
    actorId: string
  ): Promise<UserTag> {
    const created = await taxonomyRepository.createTag({
      school_id: schoolId,
      code: data.code,
      name: data.name,
      color: data.color || '#64748b',
      description: data.description,
      is_active: true,
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'CREATE',
      module: 'TAXONOMY',
      entity_name: 'user_tag',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async updateTag(schoolId: string, id: string, updates: Partial<UserTag>, actorId: string): Promise<UserTag | null> {
    const updated = await taxonomyRepository.updateTag(id, updates);
    if (updated) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: actorId,
        action: 'UPDATE',
        module: 'TAXONOMY',
        entity_name: 'user_tag',
        record_id: id,
        new_values: updates,
      });
    }
    return updated;
  }

  async deleteTag(schoolId: string, id: string, actorId: string): Promise<boolean> {
    const deleted = await taxonomyRepository.deleteTag(id);
    if (deleted) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: actorId,
        action: 'DELETE',
        module: 'TAXONOMY',
        entity_name: 'user_tag',
        record_id: id,
      });
    }
    return deleted;
  }

  async listLabels(schoolId: string): Promise<UserLabel[]> {
    return taxonomyRepository.findLabels(schoolId);
  }

  async createLabel(
    schoolId: string,
    data: { code: string; name: string; color?: string; description?: string },
    actorId: string
  ): Promise<UserLabel> {
    const created = await taxonomyRepository.createLabel({
      school_id: schoolId,
      code: data.code,
      name: data.name,
      color: data.color || '#3b82f6',
      description: data.description,
      is_active: true,
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'CREATE',
      module: 'TAXONOMY',
      entity_name: 'user_label',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async updateLabel(schoolId: string, id: string, updates: Partial<UserLabel>, actorId: string): Promise<UserLabel | null> {
    const updated = await taxonomyRepository.updateLabel(id, updates);
    if (updated) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: actorId,
        action: 'UPDATE',
        module: 'TAXONOMY',
        entity_name: 'user_label',
        record_id: id,
        new_values: updates,
      });
    }
    return updated;
  }

  async deleteLabel(schoolId: string, id: string, actorId: string): Promise<boolean> {
    const deleted = await taxonomyRepository.deleteLabel(id);
    if (deleted) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: actorId,
        action: 'DELETE',
        module: 'TAXONOMY',
        entity_name: 'user_label',
        record_id: id,
      });
    }
    return deleted;
  }

  // ----------------------------------------------------------------------
  // User Taxonomy Sync
  // ----------------------------------------------------------------------
  async syncUserTaxonomy(
    schoolId: string,
    userId: string,
    taxonomy: {
      categoryIds?: string[];
      subcategoryIds?: string[];
      tagIds?: string[];
      labelIds?: string[];
    },
    actorId: string
  ): Promise<void> {
    const user = await userRepository.findById(userId, schoolId);
    if (!user) throw new Error('User not found in tenant');

    await taxonomyRepository.syncUserTaxonomy(userId, taxonomy);

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'UPDATE',
      module: 'TAXONOMY',
      entity_name: 'user_taxonomy_sync',
      record_id: userId,
      new_values: taxonomy,
    });
  }

  // ----------------------------------------------------------------------
  // Students Operational View & Management
  // ----------------------------------------------------------------------
  async listStudents(schoolId: string, filters: StudentFilters): Promise<User[]> {
    return userRepository.findStudents({
      ...filters,
      schoolId,
    });
  }

  async createStudent(schoolId: string, input: CreateStudentInput, actorId: string): Promise<User> {
    // 1. Validate student classification type
    const studentUserType = await accessControlRepository.getUserTypeByCode('STUDENT', schoolId);
    if (!studentUserType) throw new Error('STUDENT user type not configured in system');

    // 2. Validate admission number uniqueness in tenant
    const existingAdmission = await profileRepository.getStudentProfileByAdmissionNo(schoolId, input.admission_number);
    if (existingAdmission) {
      throw new Error(`Admission Number '${input.admission_number}' is already registered in this school`);
    }

    // 3. Validate username & email uniqueness
    const existingUser = await userRepository.findByUsername(input.username);
    if (existingUser) throw new Error(`Username '${input.username}' is already taken`);

    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail) throw new Error(`Email '${input.email}' is already registered`);

    // 4. Create base user record in universal users table
    const user = await userRepository.create({
      school_id: schoolId,
      user_type_id: studentUserType.id,
      username: input.username,
      email: input.email,
      phone: input.phone,
      first_name: input.first_name,
      middle_name: input.middle_name,
      last_name: input.last_name,
      profile_photo_url: input.profile_photo_url,
      status: 'ACTIVE',
    });

    // 5. Assign STUDENT role
    const studentRole = await accessControlRepository.getRoleByCode('STUDENT', schoolId);
    if (studentRole) {
      await accessControlRepository.assignRoleToUser(user.id, studentRole.id, schoolId, actorId);
    }

    // 6. IMPORTANT: STUDENTS DO NOT HAVE BRANCH ACCESS
    // Students belong to one school and their campus/placement is strictly recorded
    // in student_academic_enrollments. Do not create user_location_access records for students.

    // Optional Login Access Credentials
    if (input.create_login_access && input.location_id) {
      const loc = await locationRepository.findById(input.location_id);
      const schoolIdCode = loc?.school_id_code || 'DEFAULT';
      const password = input.login_password || input.password || 'password123';
      await credentialsRepository.create({
        user_id: user.id,
        school_id: schoolId,
        location_id: input.location_id,
        school_id_code: schoolIdCode,
        username: input.username,
        password_hash: hashPassword(password),
        login_status: input.login_status || 'ACTIVE',
        is_super_admin: false,
      });
    }

    // 7. Automatically resolve current academic session if not provided
    const currentSession = await academicService.getCurrentSession(schoolId);
    const resolvedSessionName = input.academic_session || currentSession.name;

    // Create Student Profile record
    await profileRepository.createStudentProfile({
      user_id: user.id,
      school_id: schoolId,
      admission_number: input.admission_number,
      roll_number: input.roll_number,
      academic_session: resolvedSessionName,
      class_name: input.class_name,
      section_name: input.section_name,
      stream: input.stream,
      medium: input.medium,
      house: input.house,
      gender: input.gender,
      date_of_birth: input.date_of_birth,
      blood_group: input.blood_group,
      admission_date: input.admission_date || new Date().toISOString().split('T')[0],
      emergency_contact_name: input.emergency_contact_name,
      emergency_contact_phone: input.emergency_contact_phone,
    });

    // 8. Authoritative Academic Enrollment in student_academic_enrollments
    try {
      let session = null;
      if (input.academic_session_id) {
        session = await academicRepository.findSessionById(input.academic_session_id, schoolId);
      }
      if (!session) {
        session = currentSession;
      }

      let targetClass = null;
      if (input.class_id) {
        targetClass = await academicRepository.findClassById(input.class_id, schoolId);
      }
      if (!targetClass && input.class_name) {
        const cName = input.class_name.toLowerCase();
        const classes = await academicRepository.findClasses(schoolId);
        targetClass = classes.find(c =>
          c.name.toLowerCase() === cName ||
          c.display_name?.toLowerCase() === cName ||
          c.code?.toLowerCase() === cName
        ) || null;
      }

      let targetSection = null;
      if (input.section_id) {
        targetSection = await academicRepository.findSectionById(input.section_id, schoolId);
      }
      if (!targetSection && input.section_name) {
        const sections = await academicRepository.findSections(schoolId);
        targetSection = sections.find(s =>
          s.name.toLowerCase() === input.section_name!.toLowerCase() ||
          s.code?.toLowerCase() === input.section_name!.toLowerCase()
        ) || null;
      }

      if (session && targetClass && targetSection && input.location_id) {
        let classSection = await academicRepository.findClassSectionExact(schoolId, session.id, targetClass.id, targetSection.id);
        if (!classSection) {
          classSection = await academicRepository.createClassSection({
            school_id: schoolId,
            academic_session_id: session.id,
            class_id: targetClass.id,
            section_id: targetSection.id,
            capacity: 40,
            status: 'ACTIVE',
          });
        }

        await academicRepository.createEnrollment({
          school_id: schoolId,
          student_user_id: user.id,
          academic_session_id: session.id,
          location_id: input.location_id,
          class_id: targetClass.id,
          section_id: targetSection.id,
          academic_class_section_id: classSection.id,
          admission_number: input.admission_number,
          roll_number: input.roll_number || null,
          enrollment_status: 'ENROLLED',
          start_date: input.admission_date || new Date().toISOString().split('T')[0],
          created_by: actorId,
        });
      }
    } catch (enrollErr) {
      console.warn('Could not auto-create academic enrollment for new student:', enrollErr);
    }

    // 9. Assign Taxonomy if provided
    await this.syncUserTaxonomy(schoolId, user.id, {
      categoryIds: input.category_ids,
      subcategoryIds: input.subcategory_ids,
      tagIds: input.tag_ids,
      labelIds: input.label_ids,
    }, actorId);

    // 10. Save Child Records (Previous Academic History, Achievements, Documents)
    if (input.previous_academic_records && input.previous_academic_records.length > 0) {
      await extendedRecordsRepository.insertPreviousRecords(
        input.previous_academic_records.map(rec => ({
          ...rec,
          school_id: schoolId,
          student_user_id: user.id,
        }))
      );
    }

    if (input.achievements && input.achievements.length > 0) {
      await extendedRecordsRepository.insertAchievements(
        input.achievements.map(ach => ({
          ...ach,
          school_id: schoolId,
          student_user_id: user.id,
        }))
      );
    }

    if (input.documents && input.documents.length > 0) {
      await extendedRecordsRepository.insertDocuments(
        input.documents.map(doc => ({
          ...doc,
          school_id: schoolId,
          user_id: user.id,
        }))
      );
    }

    // 9. Audit log
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'CREATE',
      module: 'STUDENTS',
      entity_name: 'student',
      record_id: user.id,
      new_values: {
        username: user.username,
        admission_number: input.admission_number,
        class_name: input.class_name,
      },
    });

    return (await userRepository.findById(user.id, schoolId))!;
  }

  async updateStudent(schoolId: string, userId: string, input: UpdateStudentInput, actorId: string): Promise<User> {
    const existing = await userRepository.findById(userId, schoolId);
    if (!existing) throw new Error('Student not found');

    // 1. Update user base info
    const userUpdates: Partial<User> = {};
    if (input.first_name) userUpdates.first_name = input.first_name;
    if (input.middle_name !== undefined) userUpdates.middle_name = input.middle_name;
    if (input.last_name !== undefined) userUpdates.last_name = input.last_name;
    if (input.phone !== undefined) userUpdates.phone = input.phone;
    if (input.status) userUpdates.status = input.status;

    if (Object.keys(userUpdates).length > 0) {
      await userRepository.update(userId, userUpdates);
    }

    // 2. Update Student Profile
    const profileUpdates: Partial<StudentProfile> = {};
    if (input.roll_number !== undefined) profileUpdates.roll_number = input.roll_number;
    if (input.academic_session) profileUpdates.academic_session = input.academic_session;
    if (input.class_name) profileUpdates.class_name = input.class_name;
    if (input.section_name !== undefined) profileUpdates.section_name = input.section_name;
    if (input.stream !== undefined) profileUpdates.stream = input.stream;
    if (input.medium !== undefined) profileUpdates.medium = input.medium;
    if (input.house !== undefined) profileUpdates.house = input.house;
    if (input.gender !== undefined) profileUpdates.gender = input.gender;
    if (input.date_of_birth !== undefined) profileUpdates.date_of_birth = input.date_of_birth;
    if (input.blood_group !== undefined) profileUpdates.blood_group = input.blood_group;
    if (input.emergency_contact_name !== undefined) profileUpdates.emergency_contact_name = input.emergency_contact_name;
    if (input.emergency_contact_phone !== undefined) profileUpdates.emergency_contact_phone = input.emergency_contact_phone;

    if (Object.keys(profileUpdates).length > 0) {
      await profileRepository.updateStudentProfile(userId, profileUpdates);
    }

    // 3. Update taxonomy if provided
    if (input.category_ids || input.subcategory_ids || input.tag_ids || input.label_ids) {
      await this.syncUserTaxonomy(schoolId, userId, {
        categoryIds: input.category_ids,
        subcategoryIds: input.subcategory_ids,
        tagIds: input.tag_ids,
        labelIds: input.label_ids,
      }, actorId);
    }

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'UPDATE',
      module: 'STUDENTS',
      entity_name: 'student',
      record_id: userId,
      new_values: input,
    });

    return (await userRepository.findById(userId, schoolId))!;
  }

  // ----------------------------------------------------------------------
  // Staff Operational View & Management
  // ----------------------------------------------------------------------
  async listStaff(schoolId: string, filters: StaffFilters): Promise<User[]> {
    return userRepository.findStaff({
      ...filters,
      schoolId,
    });
  }

  async createStaff(schoolId: string, input: CreateStaffInput, actorId: string): Promise<User> {
    const userTypeCode = input.user_type_code || 'TEACHER';
    const staffUserType = await accessControlRepository.getUserTypeByCode(userTypeCode, schoolId);
    if (!staffUserType) throw new Error(`User type '${userTypeCode}' not found`);

    // Validate employee code uniqueness
    const existingEmp = await profileRepository.getStaffProfileByEmployeeCode(schoolId, input.employee_code);
    if (existingEmp) {
      throw new Error(`Employee code '${input.employee_code}' already exists in this school`);
    }

    // Validate username & email uniqueness
    const existingUser = await userRepository.findByUsername(input.username);
    if (existingUser) throw new Error(`Username '${input.username}' is already taken`);

    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail) throw new Error(`Email '${input.email}' is already registered`);

    // Create base user record
    const user = await userRepository.create({
      school_id: schoolId,
      user_type_id: staffUserType.id,
      username: input.username,
      email: input.email,
      phone: input.phone,
      first_name: input.first_name,
      middle_name: input.middle_name,
      last_name: input.last_name,
      profile_photo_url: input.profile_photo_url,
      status: 'ACTIVE',
    });

    // Assign Roles
    const rolesToAssign = input.role_ids && input.role_ids.length > 0
      ? input.role_ids
      : input.role_id ? [input.role_id] : [];

    if (rolesToAssign.length > 0) {
      for (const rId of rolesToAssign) {
        await accessControlRepository.assignRoleToUser(user.id, rId, schoolId, actorId);
      }
    } else {
      const defaultRole = await accessControlRepository.getRoleByCode(userTypeCode, schoolId);
      if (defaultRole) {
        await accessControlRepository.assignRoleToUser(user.id, defaultRole.id, schoolId, actorId);
      }
    }

    // Assign Locations (Multi-branch assignment with primary location)
    if (input.location_ids && input.location_ids.length > 0) {
      for (const locId of input.location_ids) {
        const isPrimary = input.primary_location_id === locId || input.location_ids[0] === locId;
        await accessControlRepository.assignLocationToUser(user.id, locId, schoolId, isPrimary, actorId);
      }
    }

    // Optional Login Access Credentials
    if (input.create_login_access && input.location_ids && input.location_ids.length > 0) {
      const locId = input.primary_location_id || input.location_ids[0];
      const loc = await locationRepository.findById(locId);
      const schoolIdCode = loc?.school_id_code || 'DEFAULT';
      const password = input.login_password || input.password || 'password123';
      await credentialsRepository.create({
        user_id: user.id,
        school_id: schoolId,
        location_id: locId,
        school_id_code: schoolIdCode,
        username: input.username,
        password_hash: hashPassword(password),
        login_status: input.login_status || 'ACTIVE',
        is_super_admin: false,
      });
    }

    // Create Staff Profile
    await profileRepository.createStaffProfile({
      user_id: user.id,
      school_id: schoolId,
      employee_code: input.employee_code,
      designation_id: input.designation_id,
      department: input.department,
      employment_type: input.employment_type || 'PERMANENT',
      joining_date: input.joining_date || new Date().toISOString().split('T')[0],
      qualification: input.qualification,
      experience_years: input.experience_years,
      emergency_contact_name: input.emergency_contact_name,
      emergency_contact_phone: input.emergency_contact_phone,
    });

    // Save Staff Child Records
    if (input.qualifications && input.qualifications.length > 0) {
      await extendedRecordsRepository.insertQualifications(
        input.qualifications.map(q => ({
          ...q,
          school_id: schoolId,
          staff_user_id: user.id,
        }))
      );
    }

    if (input.experiences && input.experiences.length > 0) {
      await extendedRecordsRepository.insertExperiences(
        input.experiences.map(e => ({
          ...e,
          school_id: schoolId,
          staff_user_id: user.id,
        }))
      );
    }

    if (input.certifications && input.certifications.length > 0) {
      await extendedRecordsRepository.insertCertifications(
        input.certifications.map(c => ({
          ...c,
          school_id: schoolId,
          staff_user_id: user.id,
        }))
      );
    }

    if (input.documents && input.documents.length > 0) {
      await extendedRecordsRepository.insertDocuments(
        input.documents.map(d => ({
          ...d,
          school_id: schoolId,
          user_id: user.id,
        }))
      );
    }

    // Assign Taxonomy
    await this.syncUserTaxonomy(schoolId, user.id, {
      categoryIds: input.category_ids,
      subcategoryIds: input.subcategory_ids,
      tagIds: input.tag_ids,
      labelIds: input.label_ids,
    }, actorId);

    // Audit log
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'CREATE',
      module: 'STAFF',
      entity_name: 'staff',
      record_id: user.id,
      new_values: {
        username: user.username,
        employee_code: input.employee_code,
        department: input.department,
      },
    });

    return (await userRepository.findById(user.id, schoolId))!;
  }

  async updateStaff(schoolId: string, userId: string, input: UpdateStaffInput, actorId: string): Promise<User> {
    const existing = await userRepository.findById(userId, schoolId);
    if (!existing) throw new Error('Staff member not found');

    // 1. Update user base info
    const userUpdates: Partial<User> = {};
    if (input.first_name) userUpdates.first_name = input.first_name;
    if (input.middle_name !== undefined) userUpdates.middle_name = input.middle_name;
    if (input.last_name !== undefined) userUpdates.last_name = input.last_name;
    if (input.phone !== undefined) userUpdates.phone = input.phone;
    if (input.status) userUpdates.status = input.status;

    if (Object.keys(userUpdates).length > 0) {
      await userRepository.update(userId, userUpdates);
    }

    // 2. Update Staff Profile
    const profileUpdates: Partial<StaffProfile> = {};
    if (input.designation_id !== undefined) profileUpdates.designation_id = input.designation_id;
    if (input.department !== undefined) profileUpdates.department = input.department;
    if (input.employment_type) profileUpdates.employment_type = input.employment_type;
    if (input.joining_date !== undefined) profileUpdates.joining_date = input.joining_date;
    if (input.qualification !== undefined) profileUpdates.qualification = input.qualification;
    if (input.experience_years !== undefined) profileUpdates.experience_years = input.experience_years;
    if (input.emergency_contact_name !== undefined) profileUpdates.emergency_contact_name = input.emergency_contact_name;
    if (input.emergency_contact_phone !== undefined) profileUpdates.emergency_contact_phone = input.emergency_contact_phone;

    if (Object.keys(profileUpdates).length > 0) {
      await profileRepository.updateStaffProfile(userId, profileUpdates);
    }

    // 3. Update taxonomy
    if (input.category_ids || input.subcategory_ids || input.tag_ids || input.label_ids) {
      await this.syncUserTaxonomy(schoolId, userId, {
        categoryIds: input.category_ids,
        subcategoryIds: input.subcategory_ids,
        tagIds: input.tag_ids,
        labelIds: input.label_ids,
      }, actorId);
    }

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'UPDATE',
      module: 'STAFF',
      entity_name: 'staff',
      record_id: userId,
      new_values: input,
    });

    return (await userRepository.findById(userId, schoolId))!;
  }

  // ----------------------------------------------------------------------
  // Parents Operational View & Management
  // ----------------------------------------------------------------------
  async listParents(schoolId: string, filters: { search?: string; locationId?: string; status?: string }): Promise<User[]> {
    return userRepository.findParents({
      schoolId,
      search: filters.search,
      locationId: filters.locationId,
      status: filters.status,
    });
  }

  async createParent(schoolId: string, input: CreateParentInput, actorId: string): Promise<User> {
    // 1. Validate parent classification
    const parentUserType = await accessControlRepository.getUserTypeByCode('PARENT', schoolId);
    if (!parentUserType) throw new Error('PARENT user type not configured in system');

    // 2. Validate username & email uniqueness
    const existingUser = await userRepository.findByUsername(input.username);
    if (existingUser) throw new Error(`Username '${input.username}' is already taken`);

    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail) throw new Error(`Email '${input.email}' is already registered`);

    // 3. Create base user in universal users table
    const user = await userRepository.create({
      school_id: schoolId,
      user_type_id: parentUserType.id,
      username: input.username,
      email: input.email,
      phone: input.phone,
      first_name: input.first_name,
      middle_name: input.middle_name,
      last_name: input.last_name,
      status: 'ACTIVE',
    });

    // 4. Assign PARENT role
    const parentRole = await accessControlRepository.getRoleByCode('PARENT', schoolId);
    if (parentRole) {
      await accessControlRepository.assignRoleToUser(user.id, parentRole.id, schoolId, actorId);
    }

    // 5. Assign Location if provided
    if (input.location_id) {
      await accessControlRepository.assignLocationToUser(user.id, input.location_id, schoolId, true, actorId);
    }

    // 6. Link to student(s) if provided
    const relationshipType = input.relationship_type || 'GUARDIAN';
    const isEmergency = input.is_emergency_contact !== undefined ? input.is_emergency_contact : true;
    if (input.student_ids && input.student_ids.length > 0) {
      for (const studentId of input.student_ids) {
        await profileRepository.linkParentStudent(
          schoolId,
          user.id,
          studentId,
          relationshipType,
          isEmergency
        );
      }
    }

    // 7. Optional Login Access
    if (input.create_login_access && input.location_id) {
      const loc = await locationRepository.findById(input.location_id);
      const schoolIdCode = loc?.school_id_code || 'DEFAULT';
      const password = input.login_password || 'password123';
      await credentialsRepository.create({
        user_id: user.id,
        school_id: schoolId,
        location_id: input.location_id,
        school_id_code: schoolIdCode,
        username: input.username,
        password_hash: hashPassword(password),
        login_status: input.login_status || 'ACTIVE',
        is_super_admin: false,
      });
    }

    // 8. Assign Taxonomy if provided
    await this.syncUserTaxonomy(schoolId, user.id, {
      categoryIds: input.category_ids,
      subcategoryIds: input.subcategory_ids,
      tagIds: input.tag_ids,
      labelIds: input.label_ids,
    }, actorId);

    // 9. Audit log
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'CREATE',
      module: 'PARENTS',
      entity_name: 'parent',
      record_id: user.id,
      new_values: {
        username: user.username,
        relationship_type: relationshipType,
        student_count: input.student_ids?.length || 0,
      },
    });

    return (await userRepository.findById(user.id, schoolId))!;
  }

  async updateParent(schoolId: string, id: string, input: Partial<CreateParentInput>, actorId: string): Promise<User | null> {
    const existing = await userRepository.findById(id, schoolId);
    if (!existing) throw new Error('Parent user not found');

    const updates: Partial<User> = {};
    if (input.first_name) updates.first_name = input.first_name;
    if (input.middle_name !== undefined) updates.middle_name = input.middle_name;
    if (input.last_name !== undefined) updates.last_name = input.last_name;
    if (input.phone !== undefined) updates.phone = input.phone;
    if (input.email && input.email !== existing.email) updates.email = input.email;

    await userRepository.update(id, updates);

    if (input.category_ids || input.subcategory_ids || input.tag_ids || input.label_ids) {
      await this.syncUserTaxonomy(schoolId, id, {
        categoryIds: input.category_ids,
        subcategoryIds: input.subcategory_ids,
        tagIds: input.tag_ids,
        labelIds: input.label_ids,
      }, actorId);
    }

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorId,
      action: 'UPDATE',
      module: 'PARENTS',
      entity_name: 'parent',
      record_id: id,
      new_values: updates,
    });

    return userRepository.findById(id, schoolId);
  }

  async linkParentStudent(
    schoolId: string,
    parentUserId: string,
    studentUserId: string,
    relationshipType: string,
    isEmergencyContact = true,
    actorId?: string
  ): Promise<any> {
    const link = await profileRepository.linkParentStudent(
      schoolId,
      parentUserId,
      studentUserId,
      relationshipType,
      isEmergencyContact
    );

    if (actorId) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: actorId,
        action: 'CREATE',
        module: 'PARENTS',
        entity_name: 'parent_student_relationship',
        record_id: link.id,
        new_values: { parentUserId, studentUserId, relationshipType },
      });
    }

    return link;
  }

  async unlinkParentStudent(
    schoolId: string,
    parentUserId: string,
    studentUserId: string,
    actorId?: string
  ): Promise<boolean> {
    const ok = await profileRepository.unlinkParentStudent(parentUserId, studentUserId);

    if (ok && actorId) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: actorId,
        action: 'DELETE',
        module: 'PARENTS',
        entity_name: 'parent_student_relationship',
        record_id: `${parentUserId}:${studentUserId}`,
      });
    }

    return ok;
  }

  async getParentsForStudent(studentUserId: string): Promise<any[]> {
    return profileRepository.getParentsForStudent(studentUserId);
  }

  // ----------------------------------------------------------------------
  // Comprehensive Aggregated User Profile
  // ----------------------------------------------------------------------
  async getUserDetailedProfile(schoolId: string | null, userId: string): Promise<{
    user: User;
    student_profile?: StudentProfile | null;
    staff_profile?: StaffProfile | null;
    relationships?: Array<{ user: User; relationship_type: string }>;
    audit_history?: any[];
  }> {
    const user = await userRepository.findById(userId, schoolId);
    if (!user) throw new Error('User not found');

    const studentProfile = user.student_profile || await profileRepository.getStudentProfile(userId);
    const staffProfile = user.staff_profile || await profileRepository.getStaffProfile(userId);
    
    // Relationships (if student, find parents; if parent, find children)
    const relationships = user.user_type?.code === 'STUDENT'
      ? await profileRepository.getParentsForStudent(userId)
      : user.user_type?.code === 'PARENT'
        ? await profileRepository.getChildrenForParent(userId)
        : [];

    // Audit logs for this user record
    const auditHistory = await auditRepository.findLogs({
      schoolId: schoolId || undefined,
      recordId: userId,
      limit: 20,
    });

    return {
      user,
      student_profile: studentProfile,
      staff_profile: staffProfile,
      relationships,
      audit_history: auditHistory.logs,
    };
  }
}

export const peopleService = new PeopleService();
