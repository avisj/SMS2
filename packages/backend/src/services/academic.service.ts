// ========================================================================
// Academic Domain Service
// Business logic, validations, scope checks, and audit logging for
// Academic Structure, Student Enrollments, and Teacher Allocations.
// Zero hardcoded values or business rules.
// ========================================================================

import { academicRepository } from '../repositories/academic.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { accessControlRepository } from '../repositories/access-control.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { getMemoryDbClient } from '../db/client.js';
import {
  AcademicSession,
  ClassItem,
  SectionItem,
  AcademicClassSection,
  SubjectItem,
  SubjectGroup,
  AcademicClassSubject,
  StudentAcademicEnrollment,
  TeacherSubjectAssignment,
  TeacherResponsibility,
  UserContext,
  AcademicSessionSetting,
  AvailableStudentForEnrollment,
} from '../types/index.js';

export class AcademicService {
  private mem = getMemoryDbClient();

  // ----------------------------------------------------------------------
  // 1. Academic Sessions (Automated Dynamic Cycle & Settings)
  // ----------------------------------------------------------------------
  calculateSessionWindow(startMonth: number, endMonth: number, refDate: Date = new Date()) {
    const curYear = refDate.getFullYear();
    const curMonth = refDate.getMonth() + 1; // 1-12

    let startYear = curYear;
    let endYear = curYear;

    if (startMonth <= endMonth) {
      // e.g. January (1) to December (12)
      startYear = curYear;
      endYear = curYear;
    } else {
      // Crosses calendar year, e.g. April (4) to March (3)
      if (curMonth >= startMonth) {
        startYear = curYear;
        endYear = curYear + 1;
      } else {
        startYear = curYear - 1;
        endYear = curYear;
      }
    }

    const startMonthStr = String(startMonth).padStart(2, '0');
    const endMonthStr = String(endMonth).padStart(2, '0');
    const startDate = `${startYear}-${startMonthStr}-01`;
    // Last day of end month
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    const endDate = `${endYear}-${endMonthStr}-${String(lastDay).padStart(2, '0')}`;

    const shortEndYear = String(endYear).slice(-2);
    const code = startYear === endYear ? `AY${startYear}` : `AY${startYear}-${shortEndYear}`;
    const name = startYear === endYear ? `${startYear}` : `${startYear}-${shortEndYear}`;

    return { startYear, endYear, startDate, endDate, code, name };
  }

  async getAcademicSessionSettings(schoolId: string): Promise<AcademicSessionSetting> {
    const startSetting = this.mem.findAll('school_settings', (s: any) => s.school_id === schoolId && s.setting_key === 'academic_session_start_month')[0];
    const endSetting = this.mem.findAll('school_settings', (s: any) => s.school_id === schoolId && s.setting_key === 'academic_session_end_month')[0];

    const startMonth = startSetting ? parseInt(startSetting.setting_value, 10) : 4; // default April
    const endMonth = endSetting ? parseInt(endSetting.setting_value, 10) : 3;     // default March

    const calc = this.calculateSessionWindow(startMonth, endMonth);

    return {
      start_month: startMonth,
      end_month: endMonth,
      calculated_session_code: calc.code,
      calculated_session_name: calc.name,
      start_date: calc.startDate,
      end_date: calc.endDate,
    };
  }

  async updateAcademicSessionSettings(
    schoolId: string,
    data: { start_month: number; end_month: number },
    actorContext: UserContext
  ): Promise<AcademicSessionSetting> {
    const startMonth = Math.max(1, Math.min(12, Number(data.start_month)));
    const endMonth = Math.max(1, Math.min(12, Number(data.end_month)));

    const saveSetting = (key: string, val: string) => {
      const existing = this.mem.findAll('school_settings', (s: any) => s.school_id === schoolId && s.setting_key === key)[0];
      if (existing) {
        this.mem.update('school_settings', existing.id, { setting_value: val });
      } else {
        this.mem.insert('school_settings', {
          id: crypto.randomUUID(),
          school_id: schoolId,
          setting_key: key,
          setting_value: val,
          category: 'ACADEMIC',
          data_type: 'NUMBER',
        });
      }
    };

    saveSetting('academic_session_start_month', String(startMonth));
    saveSetting('academic_session_end_month', String(endMonth));

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'UPDATE',
      module: 'SETTINGS',
      entity_name: 'academic_session_settings',
      record_id: schoolId,
      new_values: { startMonth, endMonth },
    });

    // Automatically reconcile current session for school
    await this.getCurrentSession(schoolId);

    return this.getAcademicSessionSettings(schoolId);
  }

  async getCurrentSession(schoolId: string, refDate?: Date): Promise<AcademicSession> {
    const settings = await this.getAcademicSessionSettings(schoolId);
    const win = this.calculateSessionWindow(settings.start_month, settings.end_month, refDate || new Date());

    let session = await academicRepository.findSessionByCode(schoolId, win.code);

    if (!session) {
      // Auto-generate session representation automatically in DB for current cycle
      session = await academicRepository.createSession({
        school_id: schoolId,
        name: win.name,
        code: win.code,
        start_date: win.startDate,
        end_date: win.endDate,
        status: 'ACTIVE',
        is_current: true,
      });

      await academicRepository.setCurrentSession(schoolId, session.id);
    } else if (!session.is_current) {
      await academicRepository.setCurrentSession(schoolId, session.id);
      session = (await academicRepository.findSessionById(session.id, schoolId))!;
    }

    return session;
  }

  async listSessions(schoolId: string, options?: { includeInactive?: boolean }): Promise<AcademicSession[]> {
    return academicRepository.findSessions(schoolId, options);
  }

  async getSessionById(schoolId: string, id: string): Promise<AcademicSession | null> {
    return academicRepository.findSessionById(id, schoolId);
  }

  async createSession(
    schoolId: string,
    data: { name: string; code: string; start_date: string; end_date: string; status?: 'ACTIVE' | 'INACTIVE'; is_current?: boolean },
    actorContext: UserContext
  ): Promise<AcademicSession> {
    const existing = await academicRepository.findSessionByCode(schoolId, data.code);
    if (existing) {
      throw new Error(`Academic session with code [${data.code}] already exists.`);
    }

    if (new Date(data.end_date) <= new Date(data.start_date)) {
      throw new Error('Academic session end date must be after start date.');
    }

    if (data.is_current) {
      const all = this.mem.findAll('academic_sessions', (row: any) => row.school_id === schoolId);
      for (const s of all) {
        this.mem.update('academic_sessions', s.id, { is_current: false });
      }
    }

    const session = await academicRepository.createSession({
      school_id: schoolId,
      name: data.name,
      code: data.code,
      start_date: data.start_date,
      end_date: data.end_date,
      status: data.status || 'ACTIVE',
      is_current: data.is_current ?? false,
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'CREATE',
      module: 'ACADEMICS',
      entity_name: 'academic_sessions',
      record_id: session.id,
      new_values: session,
    });

    return session;
  }

  async updateSession(
    schoolId: string,
    id: string,
    updates: Partial<AcademicSession>,
    actorContext: UserContext
  ): Promise<AcademicSession> {
    const session = await academicRepository.findSessionById(id, schoolId);
    if (!session) {
      throw new Error('Academic session not found.');
    }

    const updated = await academicRepository.updateSession(id, updates);
    if (!updated) throw new Error('Failed to update academic session.');

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'UPDATE',
      module: 'ACADEMICS',
      entity_name: 'academic_sessions',
      record_id: id,
      old_values: session,
      new_values: updated,
    });

    return updated;
  }

  async setCurrentSession(schoolId: string, sessionId: string, actorContext: UserContext): Promise<AcademicSession> {
    const session = await academicRepository.findSessionById(sessionId, schoolId);
    if (!session) throw new Error('Academic session not found.');

    const updated = await academicRepository.setCurrentSession(schoolId, sessionId);
    if (!updated) throw new Error('Failed to set current session.');

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'SET_CURRENT_SESSION',
      module: 'ACADEMICS',
      entity_name: 'academic_sessions',
      record_id: sessionId,
      new_values: { is_current: true, session_name: session.name },
    });

    return updated;
  }

  async deleteSession(schoolId: string, sessionId: string, actorContext: UserContext): Promise<boolean> {
    const session = await academicRepository.findSessionById(sessionId, schoolId);
    if (!session) throw new Error('Academic session not found.');

    // Check if transactional enrollment data exists
    const enrollments = await academicRepository.findEnrollments(schoolId, { sessionId });
    if (enrollments.length > 0) {
      throw new Error(`Cannot delete academic session [${session.name}]: ${enrollments.length} student enrollment records exist.`);
    }

    const res = await academicRepository.deleteSession(sessionId);
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'DELETE',
      module: 'ACADEMICS',
      entity_name: 'academic_sessions',
      record_id: sessionId,
      old_values: session,
    });
    return res;
  }

  // ----------------------------------------------------------------------
  // 2. Class Master
  // ----------------------------------------------------------------------
  async listClasses(schoolId: string, options?: { includeInactive?: boolean }): Promise<ClassItem[]> {
    return academicRepository.findClasses(schoolId, options);
  }

  async createClass(
    schoolId: string,
    data: { name: string; code: string; display_name?: string; numeric_order?: number; status?: 'ACTIVE' | 'INACTIVE' },
    actorContext: UserContext
  ): Promise<ClassItem> {
    const existing = await academicRepository.findClassByCode(schoolId, data.code);
    if (existing) throw new Error(`Class with code [${data.code}] already exists.`);

    const created = await academicRepository.createClass({
      school_id: schoolId,
      name: data.name,
      code: data.code,
      display_name: data.display_name || data.name,
      numeric_order: data.numeric_order ?? 0,
      status: data.status || 'ACTIVE',
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'CREATE',
      module: 'ACADEMICS',
      entity_name: 'classes',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async updateClass(schoolId: string, id: string, updates: Partial<ClassItem>, actorContext: UserContext): Promise<ClassItem> {
    const cls = await academicRepository.findClassById(id, schoolId);
    if (!cls) throw new Error('Class not found.');

    const updated = await academicRepository.updateClass(id, updates);
    if (!updated) throw new Error('Failed to update class.');

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'UPDATE',
      module: 'ACADEMICS',
      entity_name: 'classes',
      record_id: id,
      old_values: cls,
      new_values: updated,
    });

    return updated;
  }

  async reorderClasses(schoolId: string, orderedIds: string[], actorContext: UserContext): Promise<void> {
    await academicRepository.reorderClasses(schoolId, orderedIds);
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'REORDER',
      module: 'ACADEMICS',
      entity_name: 'classes',
      record_id: 'BULK_REORDER',
      new_values: { orderedIds },
    });
  }

  async deleteClass(schoolId: string, id: string, actorContext: UserContext): Promise<boolean> {
    const cls = await academicRepository.findClassById(id, schoolId);
    if (!cls) throw new Error('Class not found.');

    const res = await academicRepository.deleteClass(id);
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'DELETE',
      module: 'ACADEMICS',
      entity_name: 'classes',
      record_id: id,
      old_values: cls,
    });
    return res;
  }

  // ----------------------------------------------------------------------
  // 3. Section Master
  // ----------------------------------------------------------------------
  async listSections(schoolId: string, options?: { includeInactive?: boolean }): Promise<SectionItem[]> {
    return academicRepository.findSections(schoolId, options);
  }

  async createSection(
    schoolId: string,
    data: { name: string; code: string; status?: 'ACTIVE' | 'INACTIVE' },
    actorContext: UserContext
  ): Promise<SectionItem> {
    const existing = await academicRepository.findSectionByCode(schoolId, data.code);
    if (existing) throw new Error(`Section with code [${data.code}] already exists.`);

    const created = await academicRepository.createSection({
      school_id: schoolId,
      name: data.name,
      code: data.code,
      status: data.status || 'ACTIVE',
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'CREATE',
      module: 'ACADEMICS',
      entity_name: 'sections',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async updateSection(schoolId: string, id: string, updates: Partial<SectionItem>, actorContext: UserContext): Promise<SectionItem> {
    const sec = await academicRepository.findSectionById(id, schoolId);
    if (!sec) throw new Error('Section not found.');

    const updated = await academicRepository.updateSection(id, updates);
    if (!updated) throw new Error('Failed to update section.');

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'UPDATE',
      module: 'ACADEMICS',
      entity_name: 'sections',
      record_id: id,
      old_values: sec,
      new_values: updated,
    });

    return updated;
  }

  async deleteSection(schoolId: string, id: string, actorContext: UserContext): Promise<boolean> {
    const sec = await academicRepository.findSectionById(id, schoolId);
    if (!sec) throw new Error('Section not found.');

    const res = await academicRepository.deleteSection(id);
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'DELETE',
      module: 'ACADEMICS',
      entity_name: 'sections',
      record_id: id,
      old_values: sec,
    });
    return res;
  }

  // ----------------------------------------------------------------------
  // 4. Academic Class-Section Offerings
  // ----------------------------------------------------------------------
  async listClassSections(schoolId: string, sessionId: string, classId?: string): Promise<AcademicClassSection[]> {
    return academicRepository.findClassSections(schoolId, sessionId, classId);
  }

  async createClassSection(
    schoolId: string,
    data: { academic_session_id: string; class_id: string; section_id: string; capacity?: number; status?: 'ACTIVE' | 'INACTIVE' },
    actorContext: UserContext
  ): Promise<AcademicClassSection> {
    // Validate session, class, section belong to school
    const session = await academicRepository.findSessionById(data.academic_session_id, schoolId);
    if (!session) throw new Error('Invalid academic session.');
    const cls = await academicRepository.findClassById(data.class_id, schoolId);
    if (!cls) throw new Error('Invalid class.');
    const sec = await academicRepository.findSectionById(data.section_id, schoolId);
    if (!sec) throw new Error('Invalid section.');

    // Check duplicate
    const existing = await academicRepository.findClassSectionExact(schoolId, data.academic_session_id, data.class_id, data.section_id);
    if (existing) throw new Error(`Section [${sec.name}] is already assigned to Class [${cls.name}] in this session.`);

    const created = await academicRepository.createClassSection({
      school_id: schoolId,
      academic_session_id: data.academic_session_id,
      class_id: data.class_id,
      section_id: data.section_id,
      capacity: data.capacity,
      status: data.status || 'ACTIVE',
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'CREATE',
      module: 'ACADEMICS',
      entity_name: 'academic_class_sections',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async deleteClassSection(schoolId: string, id: string, actorContext: UserContext): Promise<boolean> {
    const item = await academicRepository.findClassSectionById(id);
    if (!item || item.school_id !== schoolId) throw new Error('Class-section configuration not found.');

    const res = await academicRepository.deleteClassSection(id);
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'DELETE',
      module: 'ACADEMICS',
      entity_name: 'academic_class_sections',
      record_id: id,
      old_values: item,
    });
    return res;
  }

  // ----------------------------------------------------------------------
  // 5. Subject Master
  // ----------------------------------------------------------------------
  async listSubjects(schoolId: string, options?: { includeInactive?: boolean }): Promise<SubjectItem[]> {
    return academicRepository.findSubjects(schoolId, options);
  }

  async createSubject(
    schoolId: string,
    data: { name: string; code: string; short_name?: string; description?: string; status?: 'ACTIVE' | 'INACTIVE' },
    actorContext: UserContext
  ): Promise<SubjectItem> {
    const existing = await academicRepository.findSubjectByCode(schoolId, data.code);
    if (existing) throw new Error(`Subject with code [${data.code}] already exists.`);

    const created = await academicRepository.createSubject({
      school_id: schoolId,
      name: data.name,
      code: data.code,
      short_name: data.short_name,
      description: data.description,
      status: data.status || 'ACTIVE',
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'CREATE',
      module: 'ACADEMICS',
      entity_name: 'subjects',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async updateSubject(schoolId: string, id: string, updates: Partial<SubjectItem>, actorContext: UserContext): Promise<SubjectItem> {
    const item = await academicRepository.findSubjectById(id, schoolId);
    if (!item) throw new Error('Subject not found.');

    const updated = await academicRepository.updateSubject(id, updates);
    if (!updated) throw new Error('Failed to update subject.');

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'UPDATE',
      module: 'ACADEMICS',
      entity_name: 'subjects',
      record_id: id,
      old_values: item,
      new_values: updated,
    });

    return updated;
  }

  async deleteSubject(schoolId: string, id: string, actorContext: UserContext): Promise<boolean> {
    const item = await academicRepository.findSubjectById(id, schoolId);
    if (!item) throw new Error('Subject not found.');

    const res = await academicRepository.deleteSubject(id);
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'DELETE',
      module: 'ACADEMICS',
      entity_name: 'subjects',
      record_id: id,
      old_values: item,
    });
    return res;
  }

  // ----------------------------------------------------------------------
  // 6. Subject Groups Master
  // ----------------------------------------------------------------------
  async listSubjectGroups(schoolId: string): Promise<SubjectGroup[]> {
    return academicRepository.findSubjectGroups(schoolId);
  }

  async createSubjectGroup(
    schoolId: string,
    data: { name: string; code: string; description?: string; status?: 'ACTIVE' | 'INACTIVE' },
    subjectIds: string[] = [],
    actorContext: UserContext
  ): Promise<SubjectGroup> {
    const created = await academicRepository.createSubjectGroup({
      school_id: schoolId,
      name: data.name,
      code: data.code,
      description: data.description,
      status: data.status || 'ACTIVE',
    }, subjectIds);

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'CREATE',
      module: 'ACADEMICS',
      entity_name: 'subject_groups',
      record_id: created.id,
      new_values: { ...created, subjectIds },
    });

    return created;
  }

  async updateSubjectGroup(
    schoolId: string,
    id: string,
    updates: Partial<SubjectGroup>,
    subjectIds: string[] | undefined,
    actorContext: UserContext
  ): Promise<SubjectGroup> {
    const item = await academicRepository.findSubjectGroupById(id, schoolId);
    if (!item) throw new Error('Subject group not found.');

    const updated = await academicRepository.updateSubjectGroup(id, updates, subjectIds);
    if (!updated) throw new Error('Failed to update subject group.');

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'UPDATE',
      module: 'ACADEMICS',
      entity_name: 'subject_groups',
      record_id: id,
      old_values: item,
      new_values: updated,
    });

    return updated;
  }

  async deleteSubjectGroup(schoolId: string, id: string, actorContext: UserContext): Promise<boolean> {
    const item = await academicRepository.findSubjectGroupById(id, schoolId);
    if (!item) throw new Error('Subject group not found.');

    const res = await academicRepository.deleteSubjectGroup(id);
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'DELETE',
      module: 'ACADEMICS',
      entity_name: 'subject_groups',
      record_id: id,
      old_values: item,
    });
    return res;
  }

  // ----------------------------------------------------------------------
  // 7. Academic Class Subjects (Subject Offerings per Class/Session)
  // ----------------------------------------------------------------------
  async listClassSubjects(schoolId: string, sessionId: string, classId?: string): Promise<AcademicClassSubject[]> {
    return academicRepository.findClassSubjects(schoolId, sessionId, classId);
  }

  async createClassSubject(
    schoolId: string,
    data: {
      academic_session_id: string;
      class_id: string;
      subject_id: string;
      subject_group_id?: string | null;
      is_required?: boolean;
      subject_type?: 'THEORY' | 'PRACTICAL' | 'BOTH';
      status?: 'ACTIVE' | 'INACTIVE';
      credits?: number;
      max_marks?: number;
    },
    actorContext: UserContext
  ): Promise<AcademicClassSubject> {
    const existing = await academicRepository.findClassSubjectExact(schoolId, data.academic_session_id, data.class_id, data.subject_id);
    if (existing) {
      throw new Error('This subject is already offered to this class in the selected academic session.');
    }

    const created = await academicRepository.createClassSubject({
      school_id: schoolId,
      academic_session_id: data.academic_session_id,
      class_id: data.class_id,
      subject_id: data.subject_id,
      subject_group_id: data.subject_group_id,
      is_required: data.is_required ?? true,
      subject_type: data.subject_type || 'THEORY',
      status: data.status || 'ACTIVE',
      credits: data.credits,
      max_marks: data.max_marks,
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'CREATE',
      module: 'ACADEMICS',
      entity_name: 'academic_class_subjects',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async deleteClassSubject(schoolId: string, id: string, actorContext: UserContext): Promise<boolean> {
    const item = await academicRepository.findClassSubjectById(id);
    if (!item || item.school_id !== schoolId) throw new Error('Class subject offering not found.');

    const res = await academicRepository.deleteClassSubject(id);
    await auditRepository.log({
      school_id: schoolId,
      user_id: actorContext.user_id,
      action: 'DELETE',
      module: 'ACADEMICS',
      entity_name: 'academic_class_subjects',
      record_id: id,
      old_values: item,
    });
    return res;
  }

  // ----------------------------------------------------------------------
  // 8. Student Academic Enrollments (Assignments & History)
  // ----------------------------------------------------------------------
  async listStudentEnrollments(
    schoolId: string,
    filters: {
      sessionId?: string;
      locationId?: string;
      classId?: string;
      sectionId?: string;
      studentId?: string;
      status?: string;
      search?: string;
    },
    actorContext: UserContext
  ): Promise<StudentAcademicEnrollment[]> {
    // Check location scope if actor is restricted
    if (filters.locationId && !actorContext.is_super_admin) {
      if (actorContext.permitted_location_ids.length > 0 && !actorContext.permitted_location_ids.includes(filters.locationId)) {
        throw new Error(`Data Scope Violation: You do not have access to location [${filters.locationId}].`);
      }
    }

    return academicRepository.findEnrollments(schoolId, filters);
  }

  async assignStudentToClass(
    schoolId: string,
    data: {
      student_user_id: string;
      academic_session_id: string;
      location_id: string;
      class_id: string;
      section_id: string;
      admission_number?: string;
      roll_number?: string;
      start_date?: string;
    },
    actorContext: UserContext
  ): Promise<StudentAcademicEnrollment> {
    // 1. Permission check
    const hasAssignPerm = actorContext.is_super_admin || actorContext.permissions.some(p => p.code === 'students.class_assign');
    if (!hasAssignPerm) {
      throw new Error('Permission Denied: You do not have [students.class_assign] permission.');
    }

    // 2. Data Scope check (Location access)
    if (!actorContext.is_super_admin) {
      if (actorContext.permitted_location_ids.length > 0 && !actorContext.permitted_location_ids.includes(data.location_id)) {
        throw new Error(`Data Scope Violation: You do not have access to location [${data.location_id}].`);
      }
    }

    // 3. Confirm student exists in universal users table
    const studentUser = await userRepository.findById(data.student_user_id);
    if (!studentUser || studentUser.school_id !== schoolId) {
      throw new Error('Student user does not exist or does not belong to this school.');
    }

    // 4. Confirm section is configured for class in this session
    const classSection = await academicRepository.findClassSectionExact(
      schoolId,
      data.academic_session_id,
      data.class_id,
      data.section_id
    );
    if (!classSection) {
      throw new Error('Invalid Assignment: Target Section is not configured for this Class in the selected Academic Session.');
    }

    // 5. Determine admission number
    let admissionNum = data.admission_number;
    if (!admissionNum) {
      // Look up existing profile or enrollment
      const profile = this.mem.findAll('student_profiles', (p: any) => p.user_id === data.student_user_id)[0];
      if (profile?.admission_number) {
        admissionNum = profile.admission_number;
      } else {
        const prevEnrollment = (await academicRepository.findStudentAcademicHistory(schoolId, data.student_user_id))[0];
        admissionNum = prevEnrollment?.admission_number || `ADM-${Date.now().toString().slice(-6)}`;
      }
    }

    // 6. Check if active enrollment already exists for this session
    const existingActive = await academicRepository.findActiveEnrollmentForStudent(
      schoolId,
      data.student_user_id,
      data.academic_session_id
    );

    let enrollment: StudentAcademicEnrollment;

    if (existingActive) {
      if (
        existingActive.class_id === data.class_id &&
        existingActive.section_id === data.section_id &&
        existingActive.location_id === data.location_id
      ) {
        // Already actively enrolled in the exact same class-section
        return (await academicRepository.findEnrollmentById(existingActive.id))!;
      }

      // Preserve old enrollment historically: update to TRANSFERRED with end_date
      await academicRepository.updateEnrollment(existingActive.id, {
        enrollment_status: 'TRANSFERRED',
        end_date: new Date().toISOString().split('T')[0],
        updated_by: actorContext.user_id,
      });

      // Create new active enrollment for target class/section
      enrollment = await academicRepository.createEnrollment({
        school_id: schoolId,
        student_user_id: data.student_user_id,
        academic_session_id: data.academic_session_id,
        location_id: data.location_id,
        class_id: data.class_id,
        section_id: data.section_id,
        academic_class_section_id: classSection.id,
        admission_number: admissionNum || existingActive.admission_number,
        roll_number: data.roll_number ?? existingActive.roll_number,
        enrollment_status: 'ENROLLED',
        start_date: data.start_date || new Date().toISOString().split('T')[0],
        created_by: actorContext.user_id,
      });

      await auditRepository.log({
        school_id: schoolId,
        location_id: data.location_id,
        user_id: actorContext.user_id,
        action: 'STUDENT_REASSIGNED',
        module: 'ACADEMICS',
        entity_name: 'student_academic_enrollments',
        record_id: enrollment.id,
        old_values: existingActive,
        new_values: enrollment,
      });
    } else {
      // Fresh enrollment for this session (preserves any past sessions!)
      enrollment = await academicRepository.createEnrollment({
        school_id: schoolId,
        student_user_id: data.student_user_id,
        academic_session_id: data.academic_session_id,
        location_id: data.location_id,
        class_id: data.class_id,
        section_id: data.section_id,
        academic_class_section_id: classSection.id,
        admission_number: admissionNum || `ADM-${Date.now().toString().slice(-6)}`,
        roll_number: data.roll_number || null,
        enrollment_status: 'ENROLLED',
        start_date: data.start_date || new Date().toISOString().split('T')[0],
        created_by: actorContext.user_id,
      });

      await auditRepository.log({
        school_id: schoolId,
        location_id: data.location_id,
        user_id: actorContext.user_id,
        action: 'STUDENT_ENROLLED',
        module: 'ACADEMICS',
        entity_name: 'student_academic_enrollments',
        record_id: enrollment.id,
        new_values: enrollment,
      });
    }

    // Synchronize student profile with newly assigned class and section
    try {
      const cls = await academicRepository.findClassById(data.class_id);
      const sec = await academicRepository.findSectionById(data.section_id);
      const sess = await academicRepository.findSessionById(data.academic_session_id);
      if (cls && sec) {
        await profileRepository.updateStudentProfile(data.student_user_id, {
          class_name: cls.display_name || cls.name,
          section_name: sec.name,
          academic_session: sess?.name,
          roll_number: data.roll_number ?? existingActive?.roll_number ?? undefined,
        });
      }
    } catch (profErr) {
      console.warn('Could not sync student_profile after class assignment:', profErr);
    }

    return (await academicRepository.findEnrollmentById(enrollment.id))!;
  }

  async bulkAssignStudents(
    schoolId: string,
    data: {
      student_ids: string[];
      academic_session_id: string;
      location_id: string;
      class_id: string;
      section_id: string;
    },
    actorContext: UserContext
  ): Promise<{ assignedCount: number; skippedCount: number; enrollments: StudentAcademicEnrollment[] }> {
    let assignedCount = 0;
    let skippedCount = 0;
    const enrollments: StudentAcademicEnrollment[] = [];

    for (const studentId of data.student_ids) {
      const enr = await this.assignStudentToClass(schoolId, {
        student_user_id: studentId,
        academic_session_id: data.academic_session_id,
        location_id: data.location_id,
        class_id: data.class_id,
        section_id: data.section_id,
      }, actorContext);

      enrollments.push(enr);
      assignedCount++;
    }
    return { assignedCount, skippedCount, enrollments };
  }

  async transferStudentSection(
    schoolId: string,
    enrollmentId: string,
    data: { target_class_id: string; target_section_id: string; roll_number?: string },
    actorContext: UserContext
  ): Promise<StudentAcademicEnrollment> {
    const existing = await academicRepository.findEnrollmentById(enrollmentId);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Student enrollment record not found.');
    }

    // Verify target class-section offering
    const classSection = await academicRepository.findClassSectionExact(
      schoolId,
      existing.academic_session_id,
      data.target_class_id,
      data.target_section_id
    );
    if (!classSection) {
      throw new Error('Target section is not configured for this class in this session.');
    }

    // Preserve previous enrollment with TRANSFERRED status
    await academicRepository.updateEnrollment(enrollmentId, {
      enrollment_status: 'TRANSFERRED',
      end_date: new Date().toISOString().split('T')[0],
      updated_by: actorContext.user_id,
    });

    // Create new active enrollment
    const newEnrollment = await academicRepository.createEnrollment({
      school_id: schoolId,
      student_user_id: existing.student_user_id,
      academic_session_id: existing.academic_session_id,
      location_id: existing.location_id,
      class_id: data.target_class_id,
      section_id: data.target_section_id,
      academic_class_section_id: classSection.id,
      admission_number: existing.admission_number,
      roll_number: data.roll_number ?? existing.roll_number,
      enrollment_status: 'ENROLLED',
      start_date: new Date().toISOString().split('T')[0],
      created_by: actorContext.user_id,
    });

    await auditRepository.log({
      school_id: schoolId,
      location_id: existing.location_id,
      user_id: actorContext.user_id,
      action: 'STUDENT_SECTION_TRANSFER',
      module: 'ACADEMICS',
      entity_name: 'student_academic_enrollments',
      record_id: newEnrollment.id,
      old_values: { class_id: existing.class_id, section_id: existing.section_id, enrollment_id: existing.id },
      new_values: { class_id: data.target_class_id, section_id: data.target_section_id, enrollment_id: newEnrollment.id },
    });

    // Synchronize student profile with newly transferred class and section
    try {
      const cls = await academicRepository.findClassById(data.target_class_id);
      const sec = await academicRepository.findSectionById(data.target_section_id);
      if (cls && sec) {
        await profileRepository.updateStudentProfile(existing.student_user_id, {
          class_name: cls.display_name || cls.name,
          section_name: sec.name,
          roll_number: data.roll_number ?? existing.roll_number ?? undefined,
        });
      }
    } catch (profErr) {
      console.warn('Could not sync student_profile after section transfer:', profErr);
    }

    return (await academicRepository.findEnrollmentById(newEnrollment.id))!;
  }

  async getAvailableStudentsForEnrollment(
    schoolId: string,
    filters: {
      sessionId: string;
      locationId: string;
      classId: string;
      sectionId: string;
      search?: string;
    },
    actorContext: UserContext
  ): Promise<AvailableStudentForEnrollment[]> {
    const hasAssignPerm = actorContext.is_super_admin || actorContext.permissions.some(
      p => p.code === 'students.class_assign' || p.code === 'users.view'
    );
    if (!hasAssignPerm) {
      throw new Error('Permission Denied: You do not have permission to view student assignments.');
    }

    // 1. Fetch all student users belonging to the school
    const studentUserType = await accessControlRepository.getUserTypeByCode('STUDENT', schoolId);
    const allStudents = await userRepository.findUsers({
      schoolId,
      userTypeId: studentUserType?.id,
      status: 'ACTIVE',
      search: filters.search,
    });

    // 2. Fetch all student profiles for admission numbers
    const profiles = this.mem.findAll('student_profiles', (p: any) => p.school_id === schoolId);
    const profileMap = new Map<string, any>();
    for (const p of profiles) profileMap.set(p.user_id, p);

    // 3. Fetch all active enrollments for this session
    const sessionEnrollments = await academicRepository.findEnrollments(schoolId, {
      sessionId: filters.sessionId,
      status: 'ENROLLED',
    });

    const activeEnrollmentByStudent = new Map<string, StudentAcademicEnrollment>();
    for (const enr of sessionEnrollments) {
      activeEnrollmentByStudent.set(enr.student_user_id, enr);
    }

    const available: AvailableStudentForEnrollment[] = [];

    for (const student of allStudents) {
      const activeEnr = activeEnrollmentByStudent.get(student.id);

      // If student is already enrolled in the exact target class & section, EXCLUDE from available list
      if (
        activeEnr &&
        activeEnr.location_id === filters.locationId &&
        activeEnr.class_id === filters.classId &&
        activeEnr.section_id === filters.sectionId
      ) {
        continue;
      }

      const prof = profileMap.get(student.id);
      const admNo = prof?.admission_number || activeEnr?.admission_number || student.username;
      const fullName = `${student.first_name} ${student.last_name || ''}`.trim();

      if (activeEnr) {
        const clsName = activeEnr.class?.display_name || activeEnr.class?.name || 'Class';
        const secName = activeEnr.section?.name || '';
        available.push({
          student_user_id: student.id,
          admission_number: admNo,
          first_name: student.first_name,
          last_name: student.last_name,
          full_name: fullName,
          username: student.username,
          current_status: `Enrolled in ${clsName} - ${secName}`,
          is_enrolled_other: true,
          current_enrollment_id: activeEnr.id,
          current_class_name: clsName,
          current_section_name: secName,
        });
      } else {
        available.push({
          student_user_id: student.id,
          admission_number: admNo,
          first_name: student.first_name,
          last_name: student.last_name,
          full_name: fullName,
          username: student.username,
          current_status: 'Not Enrolled',
          is_enrolled_other: false,
        });
      }
    }

    return available.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  async endStudentEnrollment(
    schoolId: string,
    enrollmentId: string,
    reason: string,
    actorContext: UserContext
  ): Promise<StudentAcademicEnrollment> {
    const existing = await academicRepository.findEnrollmentById(enrollmentId);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Student enrollment record not found.');
    }

    const updated = await academicRepository.updateEnrollment(enrollmentId, {
      enrollment_status: 'WITHDRAWN',
      end_date: new Date().toISOString().split('T')[0],
      updated_by: actorContext.user_id,
    });

    await auditRepository.log({
      school_id: schoolId,
      location_id: existing.location_id,
      user_id: actorContext.user_id,
      action: 'STUDENT_ENROLLMENT_ENDED',
      module: 'ACADEMICS',
      entity_name: 'student_academic_enrollments',
      record_id: enrollmentId,
      old_values: existing,
      new_values: { ...existing, enrollment_status: 'WITHDRAWN', reason },
    });

    return (await academicRepository.findEnrollmentById(enrollmentId))!;
  }

  async getStudentAcademicHistory(
    schoolId: string,
    studentUserId: string,
    actorContext: UserContext
  ): Promise<StudentAcademicEnrollment[]> {
    return academicRepository.findStudentAcademicHistory(schoolId, studentUserId);
  }

  async findActiveEnrollment(
    schoolId: string,
    studentUserId: string,
    sessionId?: string
  ): Promise<StudentAcademicEnrollment | null> {
    return academicRepository.findActiveEnrollmentForStudent(schoolId, studentUserId, sessionId);
  }

  // ----------------------------------------------------------------------
  // 9. Teacher Subject Assignments
  // ----------------------------------------------------------------------
  async listTeacherAssignments(
    schoolId: string,
    filters: {
      sessionId?: string;
      locationId?: string;
      classId?: string;
      sectionId?: string;
      subjectId?: string;
      teacherId?: string;
      status?: string;
    },
    actorContext: UserContext
  ): Promise<TeacherSubjectAssignment[]> {
    return academicRepository.findTeacherAssignments(schoolId, filters);
  }

  async assignTeacher(
    schoolId: string,
    data: {
      teacher_user_id: string;
      academic_session_id: string;
      location_id: string;
      class_id: string;
      section_id: string;
      subject_id: string;
      is_primary_teacher?: boolean;
      effective_date?: string;
    },
    actorContext: UserContext
  ): Promise<TeacherSubjectAssignment> {
    // 1. Permission Check
    const hasPerm = actorContext.is_super_admin || actorContext.permissions.some(p => p.code === 'teacher_assignments.manage');
    if (!hasPerm) {
      throw new Error('Permission Denied: You lack [teacher_assignments.manage] permission.');
    }

    // 2. Data Scope Check (Location)
    if (!actorContext.is_super_admin) {
      if (actorContext.permitted_location_ids.length > 0 && !actorContext.permitted_location_ids.includes(data.location_id)) {
        throw new Error(`Data Scope Violation: You do not have access to location [${data.location_id}].`);
      }
    }

    // 3. Confirm Teacher User exists in universal users table
    const teacherUser = await userRepository.findById(data.teacher_user_id);
    if (!teacherUser || teacherUser.school_id !== schoolId) {
      throw new Error('Teacher user does not exist or does not belong to this school.');
    }

    // 4. Confirm teacher has access to this location
    const teacherLocationAccess = await accessControlRepository.getUserLocationAccess(data.teacher_user_id);
    const hasLocationAccess = teacherLocationAccess.some(l => l.location_id === data.location_id);
    if (!hasLocationAccess) {
      throw new Error(`Teacher [${teacherUser.first_name} ${teacherUser.last_name}] does not have branch access to the selected location.`);
    }

    // 5. Confirm class/section exists for academic session
    const classSection = await academicRepository.findClassSectionExact(
      schoolId,
      data.academic_session_id,
      data.class_id,
      data.section_id
    );
    if (!classSection) {
      throw new Error('Selected Section is not configured for Class in this Academic Session.');
    }

    // 6. Confirm subject is configured for that class & session
    const classSubject = await academicRepository.findClassSubjectExact(
      schoolId,
      data.academic_session_id,
      data.class_id,
      data.subject_id
    );
    if (!classSubject) {
      throw new Error('Selected Subject is not offered for this Class in this Academic Session.');
    }

    // 7. Confirm no duplicate assignment
    const duplicate = await academicRepository.findExactTeacherAssignment(
      schoolId,
      data.academic_session_id,
      data.location_id,
      data.class_id,
      data.section_id,
      data.subject_id,
      data.teacher_user_id
    );
    if (duplicate) {
      throw new Error('This teacher is already assigned to this Subject and Class-Section.');
    }

    // 8. Create assignment
    const assignment = await academicRepository.createTeacherAssignment({
      school_id: schoolId,
      teacher_user_id: data.teacher_user_id,
      academic_session_id: data.academic_session_id,
      location_id: data.location_id,
      class_id: data.class_id,
      section_id: data.section_id,
      subject_id: data.subject_id,
      academic_class_section_id: classSection.id,
      academic_class_subject_id: classSubject.id,
      is_primary_teacher: data.is_primary_teacher ?? false,
      status: 'ACTIVE',
      effective_date: data.effective_date || new Date().toISOString().split('T')[0],
      created_by: actorContext.user_id,
    });

    await auditRepository.log({
      school_id: schoolId,
      location_id: data.location_id,
      user_id: actorContext.user_id,
      action: 'TEACHER_ASSIGNED',
      module: 'ACADEMICS',
      entity_name: 'teacher_subject_assignments',
      record_id: assignment.id,
      new_values: assignment,
    });

    return (await academicRepository.findTeacherAssignmentById(assignment.id))!;
  }

  async deactivateTeacherAssignment(schoolId: string, id: string, actorContext: UserContext): Promise<boolean> {
    const item = await academicRepository.findTeacherAssignmentById(id);
    if (!item || item.school_id !== schoolId) throw new Error('Assignment not found.');

    const res = await academicRepository.deleteTeacherAssignment(id);
    await auditRepository.log({
      school_id: schoolId,
      location_id: item.location_id,
      user_id: actorContext.user_id,
      action: 'TEACHER_UNASSIGNED',
      module: 'ACADEMICS',
      entity_name: 'teacher_subject_assignments',
      record_id: id,
      old_values: item,
    });
    return res;
  }

  async getMyTeachingResponsibilities(
    teacherUserId: string,
    sessionId?: string
  ): Promise<TeacherResponsibility[]> {
    return academicRepository.findTeacherResponsibilities(teacherUserId, sessionId);
  }
}

export const academicService = new AcademicService();
