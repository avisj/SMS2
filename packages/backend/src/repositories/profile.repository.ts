// ========================================================================
// Profile Repository
// Specialized domain details linked to universal users.id
// Student Profiles, Staff Profiles, and Parent-Student Relationships
// ========================================================================

import { getMemoryDbClient, getSupabaseClient, isSupabaseDatabaseActive } from '../db/client.js';
import {
  StudentProfile,
  StaffProfile,
  ParentStudentRelationship,
  User,
} from '../types/index.js';
import { taxonomyRepository } from './taxonomy.repository.js';

export class ProfileRepository {
  private mem = getMemoryDbClient();

  // ----------------------------------------------------------------------
  // Student Profile
  // ----------------------------------------------------------------------
  async getStudentProfile(userId: string): Promise<StudentProfile | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data } = await getSupabaseClient()!
        .from('student_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) return data as StudentProfile;
    }
    const list = this.mem.findAll('student_profiles', (row: StudentProfile) => row.user_id === userId);
    return list[0] || null;
  }

  async getStudentProfileByAdmissionNo(schoolId: string, admissionNo: string): Promise<StudentProfile | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data } = await getSupabaseClient()!
        .from('student_profiles')
        .select('*')
        .eq('school_id', schoolId)
        .ilike('admission_number', admissionNo)
        .maybeSingle();
      if (data) return data as StudentProfile;
    }
    const list = this.mem.findAll(
      'student_profiles',
      (row: StudentProfile) => row.school_id === schoolId && row.admission_number?.toLowerCase() === admissionNo?.toLowerCase()
    );
    return list[0] || null;
  }

  async createStudentProfile(data: Omit<StudentProfile, 'id' | 'created_at' | 'updated_at'>): Promise<StudentProfile> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data: inserted, error } = await getSupabaseClient()!
        .from('student_profiles')
        .insert(data)
        .select()
        .single();
      if (!error && inserted) {
        this.mem.getTable('student_profiles').set(inserted.id, inserted);
        return inserted as StudentProfile;
      }
    }
    return this.mem.insert('student_profiles', data) as StudentProfile;
  }

  async updateStudentProfile(userId: string, updates: Partial<StudentProfile>): Promise<StudentProfile | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!
        .from('student_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }
    const existing = await this.getStudentProfile(userId);
    if (!existing) return null;
    return this.mem.update('student_profiles', existing.id, updates) as StudentProfile | null;
  }

  // ----------------------------------------------------------------------
  // Staff Profile
  // ----------------------------------------------------------------------
  async getStaffProfile(userId: string): Promise<StaffProfile | null> {
    let profile: StaffProfile | null = null;
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data } = await getSupabaseClient()!
        .from('staff_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) profile = data as StaffProfile;
    }
    if (!profile) {
      const list = this.mem.findAll('staff_profiles', (row: StaffProfile) => row.user_id === userId);
      if (list.length > 0) profile = list[0] as StaffProfile;
    }
    if (!profile) return null;

    // Hydrate designation
    if (profile.designation_id) {
      const desig = await taxonomyRepository.findDesignationById(profile.designation_id);
      if (desig) profile.designation = desig;
    }
    return profile;
  }

  async getStaffProfileByEmployeeCode(schoolId: string, employeeCode: string): Promise<StaffProfile | null> {
    if (!employeeCode) return null;
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data } = await getSupabaseClient()!
        .from('staff_profiles')
        .select('*')
        .eq('school_id', schoolId)
        .ilike('employee_code', employeeCode)
        .maybeSingle();
      if (data) return data as StaffProfile;
    }
    const list = this.mem.findAll(
      'staff_profiles',
      (row: StaffProfile) => row.school_id === schoolId && !!row.employee_code && row.employee_code.toLowerCase() === employeeCode.toLowerCase()
    );
    return list[0] || null;
  }

  async createStaffProfile(data: Omit<StaffProfile, 'id' | 'created_at' | 'updated_at'>): Promise<StaffProfile> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data: inserted, error } = await getSupabaseClient()!
        .from('staff_profiles')
        .insert(data)
        .select()
        .single();
      if (!error && inserted) {
        this.mem.getTable('staff_profiles').set(inserted.id, inserted);
        return inserted as StaffProfile;
      }
    }
    return this.mem.insert('staff_profiles', data) as StaffProfile;
  }

  async updateStaffProfile(userId: string, updates: Partial<StaffProfile>): Promise<StaffProfile | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!
        .from('staff_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }
    const existing = await this.getStaffProfile(userId);
    if (!existing) return null;
    return this.mem.update('staff_profiles', existing.id, updates) as StaffProfile | null;
  }

  // ----------------------------------------------------------------------
  // Parent-Student Relationships
  // ----------------------------------------------------------------------
  async getParentsForStudent(studentUserId: string): Promise<Array<{ user: User; parent: User; relationship_type: string; is_emergency_contact: boolean }>> {
    const mappings = this.mem.findAll(
      'parent_student_relationships',
      (row: ParentStudentRelationship) => row.student_user_id === studentUserId
    );
    const result: Array<{ user: User; parent: User; relationship_type: string; is_emergency_contact: boolean }> = [];
    for (const m of mappings) {
      const parentUser = this.mem.findById('users', m.parent_user_id) as User | null;
      if (parentUser && !parentUser.deleted_at) {
        result.push({
          user: parentUser,
          parent: parentUser,
          relationship_type: m.relationship_type,
          is_emergency_contact: m.is_emergency_contact,
        });
      }
    }
    return result;
  }

  async getChildrenForParent(parentUserId: string): Promise<Array<{ user: User; child: User; relationship_type: string; is_emergency_contact: boolean }>> {
    const mappings = this.mem.findAll(
      'parent_student_relationships',
      (row: ParentStudentRelationship) => row.parent_user_id === parentUserId
    );
    const result: Array<{ user: User; child: User; relationship_type: string; is_emergency_contact: boolean }> = [];
    for (const m of mappings) {
      const studentUser = this.mem.findById('users', m.student_user_id) as User | null;
      if (studentUser && !studentUser.deleted_at) {
        result.push({
          user: studentUser,
          child: studentUser,
          relationship_type: m.relationship_type,
          is_emergency_contact: m.is_emergency_contact || false,
        });
      }
    }
    return result;
  }

  async linkParentStudent(
    schoolId: string,
    parentUserId: string,
    studentUserId: string,
    relationshipType: string,
    isEmergencyContact = true
  ): Promise<ParentStudentRelationship> {
    const existing = this.mem.findAll(
      'parent_student_relationships',
      (row: ParentStudentRelationship) => row.parent_user_id === parentUserId && row.student_user_id === studentUserId
    );
    if (existing.length > 0) {
      return this.mem.update('parent_student_relationships', existing[0].id, {
        relationship_type: relationshipType,
        is_emergency_contact: isEmergencyContact,
      }) as ParentStudentRelationship;
    }
    return this.mem.insert('parent_student_relationships', {
      school_id: schoolId,
      parent_user_id: parentUserId,
      student_user_id: studentUserId,
      relationship_type: relationshipType,
      is_emergency_contact: isEmergencyContact,
    }) as ParentStudentRelationship;
  }

  async unlinkParentStudent(parentUserId: string, studentUserId: string): Promise<boolean> {
    const existing = this.mem.findAll(
      'parent_student_relationships',
      (row: ParentStudentRelationship) => row.parent_user_id === parentUserId && row.student_user_id === studentUserId
    );
    if (existing.length > 0) {
      return this.mem.delete('parent_student_relationships', existing[0].id);
    }
    return false;
  }
}

export const profileRepository = new ProfileRepository();
