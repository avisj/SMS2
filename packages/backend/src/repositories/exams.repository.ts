// ========================================================================
// Exams & Results Repository
// Multi-Tenant PostgREST (Supabase) + In-Memory Fallback Data Access Layer
// Complete Persistence for Examinations, Structures, Schedules, Marks & Results
// ========================================================================

import crypto from 'crypto';
import {
  ExamMaster,
  ExamStructure,
  ExamStructureSubject,
  ExamSchedule,
  GradeRule,
  ExamMark,
  ExamResult,
  ExamResultDetail,
  ExamDashboardStats,
  AcademicSession,
  Location,
  ClassItem,
  SectionItem,
  SubjectItem,
  User,
} from '../types/index.js';
import {
  getMemoryDbClient,
  getSupabaseClient,
  isSupabaseDatabaseActive,
} from '../db/client.js';
import { academicRepository } from './academic.repository.js';
import { locationRepository } from './location.repository.js';

export interface ExamMasterFilters {
  academicSessionId?: string;
  status?: string;
  search?: string;
}

export interface ExamStructureFilters {
  examId?: string;
  academicSessionId?: string;
  locationId?: string;
  classId?: string;
  sectionId?: string;
  exactSection?: boolean;
  status?: string;
}

export interface ExamScheduleFilters {
  examId?: string;
  academicSessionId?: string;
  locationId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  examDate?: string;
  status?: string;
}

export interface ExamMarksFilters {
  examId: string;
  academicSessionId?: string;
  locationId?: string;
  classId: string;
  sectionId?: string;
  subjectId?: string;
  studentUserId?: string;
}

export interface ExamResultFilters {
  examId: string;
  academicSessionId?: string;
  locationId?: string;
  classId?: string;
  sectionId?: string;
  studentUserId?: string;
  status?: string;
}

export class ExamsRepository {
  private mem = getMemoryDbClient();

  // ======================================================================
  // 1. Exam Master
  // ======================================================================
  async findExams(schoolId: string, filters?: ExamMasterFilters): Promise<ExamMaster[]> {
    let rawList: ExamMaster[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('exam_master')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
        if (filters?.status) q = q.eq('status', filters.status);
        if (filters?.search) {
          q = q.or(`exam_name.ilike.%${filters.search}%,exam_code.ilike.%${filters.search}%`);
        }
        q = q.order('start_date', { ascending: false });

        const { data, error } = await q;
        if (!error && data) {
          rawList = data as ExamMaster[];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase findExams error:', err);
      }
    }

    if (rawList.length === 0) {
      rawList = this.mem.findAll('exam_master', (row: ExamMaster) => {
        if (row.school_id !== schoolId) return false;
        if (row.deleted_at) return false;
        if (filters?.academicSessionId && row.academic_session_id !== filters.academicSessionId) return false;
        if (filters?.status && row.status !== filters.status) return false;
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          if (!row.exam_name.toLowerCase().includes(s) && !row.exam_code.toLowerCase().includes(s)) return false;
        }
        return true;
      }) as ExamMaster[];
      rawList.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    }

    return this.enrichExams(schoolId, rawList);
  }

  async findExamById(schoolId: string, id: string): Promise<ExamMaster | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('exam_master')
          .select('*')
          .eq('school_id', schoolId)
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();

        if (!error && data) {
          const enriched = await this.enrichExams(schoolId, [data as ExamMaster]);
          return enriched[0] || null;
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase findExamById error:', err);
      }
    }

    const row = this.mem.findById('exam_master', id) as ExamMaster | null;
    if (row && row.school_id === schoolId && !row.deleted_at) {
      const enriched = await this.enrichExams(schoolId, [row]);
      return enriched[0] || null;
    }
    return null;
  }

  async findExamByCode(schoolId: string, academicSessionId: string, code: string): Promise<ExamMaster | null> {
    const formattedCode = code.trim().toUpperCase();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('exam_master')
          .select('*')
          .eq('school_id', schoolId)
          .eq('academic_session_id', academicSessionId)
          .eq('exam_code', formattedCode)
          .is('deleted_at', null)
          .maybeSingle();

        if (!error && data) {
          const enriched = await this.enrichExams(schoolId, [data as ExamMaster]);
          return enriched[0] || null;
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase findExamByCode error:', err);
      }
    }

    const row = this.mem.findAll('exam_master', (r: ExamMaster) => (
      r.school_id === schoolId &&
      r.academic_session_id === academicSessionId &&
      r.exam_code.toUpperCase() === formattedCode &&
      !r.deleted_at
    ))[0] as ExamMaster | undefined;

    return row ? (await this.enrichExams(schoolId, [row]))[0] : null;
  }

  async createExam(schoolId: string, data: Partial<ExamMaster>): Promise<ExamMaster> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record: ExamMaster = {
      id,
      school_id: schoolId,
      academic_session_id: data.academic_session_id!,
      exam_name: data.exam_name!.trim(),
      exam_code: data.exam_code!.trim().toUpperCase(),
      exam_type: data.exam_type || 'ASSESSMENT',
      description: data.description || null,
      start_date: data.start_date!,
      end_date: data.end_date!,
      status: data.status || 'DRAFT',
      created_by: data.created_by || null,
      updated_by: data.updated_by || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: dbData, error } = await getSupabaseClient()!
          .from('exam_master')
          .insert(record)
          .select()
          .single();

        if (error) {
          console.error('[ExamsRepository] Supabase createExam error:', error);
          throw new Error(`Failed to create exam in database: ${error.message}`);
        }
        if (dbData) {
          this.mem.insert('exam_master', dbData);
          return (await this.enrichExams(schoolId, [dbData as ExamMaster]))[0];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase createExam error:', err);
        throw err;
      }
    }

    this.mem.insert('exam_master', record);
    return (await this.enrichExams(schoolId, [record]))[0];
  }

  async updateExam(schoolId: string, id: string, data: Partial<ExamMaster>): Promise<ExamMaster | null> {
    const existing = await this.findExamById(schoolId, id);
    if (!existing) return null;

    const updates: Partial<ExamMaster> = {
      ...data,
      exam_code: data.exam_code ? data.exam_code.trim().toUpperCase() : existing.exam_code,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: dbData, error } = await getSupabaseClient()!
          .from('exam_master')
          .update(updates)
          .eq('school_id', schoolId)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[ExamsRepository] Supabase updateExam error:', error);
          throw new Error(`Failed to update exam: ${error.message}`);
        }
        if (dbData) {
          this.mem.update('exam_master', id, dbData);
          return (await this.enrichExams(schoolId, [dbData as ExamMaster]))[0];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase updateExam error:', err);
        throw err;
      }
    }

    this.mem.update('exam_master', id, updates);
    const updated = this.mem.findById('exam_master', id) as ExamMaster;
    return (await this.enrichExams(schoolId, [updated]))[0];
  }

  async deleteExam(schoolId: string, id: string): Promise<boolean> {
    const now = new Date().toISOString();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('exam_master')
          .update({ deleted_at: now, updated_at: now })
          .eq('school_id', schoolId)
          .eq('id', id);

        if (error) {
          console.error('[ExamsRepository] Supabase deleteExam error:', error);
          throw new Error(`Failed to delete exam: ${error.message}`);
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase deleteExam error:', err);
        throw err;
      }
    }

    this.mem.update('exam_master', id, { deleted_at: now, updated_at: now });
    return true;
  }

  // ======================================================================
  // 2. Exam Structures & Subject Mappings
  // ======================================================================
  async findStructures(schoolId: string, filters?: ExamStructureFilters): Promise<ExamStructure[]> {
    let rawStructures: ExamStructure[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('exam_structures')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.examId) q = q.eq('exam_id', filters.examId);
        if (filters?.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
        if (filters?.locationId) q = q.eq('location_id', filters.locationId);
        if (filters?.classId) q = q.eq('class_id', filters.classId);
        if (filters?.status) q = q.eq('status', filters.status);

        if (filters?.sectionId) {
          if (filters.exactSection) {
            q = q.eq('section_id', filters.sectionId);
          } else {
            q = q.or(`section_id.eq.${filters.sectionId},section_id.is.null`);
          }
        }

        const { data, error } = await q;
        if (!error && data) {
          rawStructures = data as ExamStructure[];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase findStructures error:', err);
      }
    }

    if (rawStructures.length === 0) {
      rawStructures = this.mem.findAll('exam_structures', (row: ExamStructure) => {
        if (row.school_id !== schoolId) return false;
        if (row.deleted_at) return false;
        if (filters?.examId && row.exam_id !== filters.examId) return false;
        if (filters?.academicSessionId && row.academic_session_id !== filters.academicSessionId) return false;
        if (filters?.locationId && row.location_id !== filters.locationId) return false;
        if (filters?.classId && row.class_id !== filters.classId) return false;
        if (filters?.status && row.status !== filters.status) return false;

        if (filters?.sectionId) {
          if (filters.exactSection) {
            if (row.section_id !== filters.sectionId) return false;
          } else {
            if (row.section_id !== null && row.section_id !== filters.sectionId) return false;
          }
        }
        return true;
      }) as ExamStructure[];
    }

    return this.enrichStructures(schoolId, rawStructures);
  }

  async findStructureById(schoolId: string, id: string): Promise<ExamStructure | null> {
    const list = await this.findStructures(schoolId);
    return list.find((s) => s.id === id) || null;
  }

  async createStructure(
    schoolId: string,
    data: Partial<ExamStructure>,
    subjects: Array<{ subject_id: string; maximum_marks: number; passing_marks: number; grade_applicable?: boolean; weightage?: number }>
  ): Promise<ExamStructure> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record: ExamStructure = {
      id,
      school_id: schoolId,
      exam_id: data.exam_id!,
      academic_session_id: data.academic_session_id!,
      location_id: data.location_id || null,
      class_id: data.class_id!,
      section_id: data.section_id || null,
      status: data.status || 'ACTIVE',
      created_by: data.created_by || null,
      updated_by: data.updated_by || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: dbData, error } = await getSupabaseClient()!
          .from('exam_structures')
          .insert(record)
          .select()
          .single();

        if (error) {
          console.error('[ExamsRepository] Supabase createStructure error:', error);
          throw new Error(`Failed to create exam structure: ${error.message}`);
        }
        if (dbData) {
          this.mem.insert('exam_structures', dbData);
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase createStructure error:', err);
        throw err;
      }
    } else {
      this.mem.insert('exam_structures', record);
    }

    // Insert Structure Subjects
    const subjectRecords: ExamStructureSubject[] = [];
    for (const subj of subjects) {
      const sRec: ExamStructureSubject = {
        id: crypto.randomUUID(),
        school_id: schoolId,
        exam_structure_id: id,
        subject_id: subj.subject_id,
        maximum_marks: Number(subj.maximum_marks),
        passing_marks: Number(subj.passing_marks),
        grade_applicable: subj.grade_applicable ?? true,
        weightage: subj.weightage ?? 100,
        created_by: data.created_by || null,
        updated_by: data.updated_by || null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      subjectRecords.push(sRec);
      this.mem.insert('exam_structure_subjects', sRec);
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('exam_structure_subjects')
          .insert(subjectRecords);

        if (error) {
          console.error('[ExamsRepository] Supabase insert structure_subjects error:', error);
          throw new Error(`Failed to save structure subjects: ${error.message}`);
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase insert structure_subjects error:', err);
        throw err;
      }
    }

    return (await this.findStructureById(schoolId, id))!;
  }

  async updateStructure(
    schoolId: string,
    id: string,
    data: Partial<ExamStructure>,
    subjects?: Array<{ subject_id: string; maximum_marks: number; passing_marks: number; grade_applicable?: boolean; weightage?: number }>
  ): Promise<ExamStructure | null> {
    const existing = await this.findStructureById(schoolId, id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: Partial<ExamStructure> = {
      ...data,
      updated_at: now,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('exam_structures')
          .update(updates)
          .eq('school_id', schoolId)
          .eq('id', id);

        if (error) {
          console.error('[ExamsRepository] Supabase updateStructure error:', error);
          throw new Error(`Failed to update exam structure: ${error.message}`);
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase updateStructure error:', err);
        throw err;
      }
    }
    this.mem.update('exam_structures', id, updates);

    // Update subjects if passed
    if (subjects) {
      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          await getSupabaseClient()!
            .from('exam_structure_subjects')
            .delete()
            .eq('exam_structure_id', id);
        } catch (err) {
          console.error('[ExamsRepository] Supabase delete old subjects error:', err);
        }
      }

      const oldMem = this.mem.findAll('exam_structure_subjects', (r: ExamStructureSubject) => r.exam_structure_id === id);
      for (const o of oldMem) {
        this.mem.delete('exam_structure_subjects', o.id);
      }

      const newSubjs: ExamStructureSubject[] = [];
      for (const subj of subjects) {
        const sRec: ExamStructureSubject = {
          id: crypto.randomUUID(),
          school_id: schoolId,
          exam_structure_id: id,
          subject_id: subj.subject_id,
          maximum_marks: Number(subj.maximum_marks),
          passing_marks: Number(subj.passing_marks),
          grade_applicable: subj.grade_applicable ?? true,
          weightage: subj.weightage ?? 100,
          created_by: data.updated_by || null,
          updated_by: data.updated_by || null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        newSubjs.push(sRec);
        this.mem.insert('exam_structure_subjects', sRec);
      }

      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          const { error } = await getSupabaseClient()!.from('exam_structure_subjects').insert(newSubjs);
          if (error) {
            console.error('[ExamsRepository] Supabase insert new structure subjects error:', error);
            throw new Error(`Failed to insert structure subjects: ${error.message}`);
          }
        } catch (err) {
          console.error('[ExamsRepository] Supabase insert new structure subjects error:', err);
          throw err;
        }
      }
    }

    return this.findStructureById(schoolId, id);
  }

  async deleteStructure(schoolId: string, id: string): Promise<boolean> {
    const now = new Date().toISOString();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('exam_structures')
          .update({ deleted_at: now, updated_at: now })
          .eq('school_id', schoolId)
          .eq('id', id);

        if (error) {
          console.error('[ExamsRepository] Supabase deleteStructure error:', error);
          throw new Error(`Failed to delete structure: ${error.message}`);
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase deleteStructure error:', err);
        throw err;
      }
    }
    this.mem.update('exam_structures', id, { deleted_at: now, updated_at: now });
    return true;
  }

  // ======================================================================
  // 3. Exam Schedules
  // ======================================================================
  async findSchedules(schoolId: string, filters?: ExamScheduleFilters): Promise<ExamSchedule[]> {
    let rawList: ExamSchedule[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('exam_schedules')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.examId) q = q.eq('exam_id', filters.examId);
        if (filters?.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
        if (filters?.locationId) q = q.eq('location_id', filters.locationId);
        if (filters?.classId) q = q.eq('class_id', filters.classId);
        if (filters?.subjectId) q = q.eq('subject_id', filters.subjectId);
        if (filters?.examDate) q = q.eq('exam_date', filters.examDate);
        if (filters?.status) q = q.eq('status', filters.status);

        if (filters?.sectionId) {
          q = q.or(`section_id.eq.${filters.sectionId},section_id.is.null`);
        }

        q = q.order('exam_date', { ascending: true }).order('start_time', { ascending: true });

        const { data, error } = await q;
        if (!error && data) {
          rawList = data as ExamSchedule[];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase findSchedules error:', err);
      }
    }

    if (rawList.length === 0) {
      rawList = this.mem.findAll('exam_schedules', (row: ExamSchedule) => {
        if (row.school_id !== schoolId) return false;
        if (row.deleted_at) return false;
        if (filters?.examId && row.exam_id !== filters.examId) return false;
        if (filters?.academicSessionId && row.academic_session_id !== filters.academicSessionId) return false;
        if (filters?.locationId && row.location_id !== filters.locationId) return false;
        if (filters?.classId && row.class_id !== filters.classId) return false;
        if (filters?.subjectId && row.subject_id !== filters.subjectId) return false;
        if (filters?.examDate && row.exam_date !== filters.examDate) return false;
        if (filters?.status && row.status !== filters.status) return false;
        if (filters?.sectionId && row.section_id !== null && row.section_id !== filters.sectionId) return false;
        return true;
      }) as ExamSchedule[];
    }

    return this.enrichSchedules(schoolId, rawList);
  }

  async findScheduleById(schoolId: string, id: string): Promise<ExamSchedule | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('exam_schedules')
          .select('*')
          .eq('school_id', schoolId)
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();

        if (!error && data) {
          const list = await this.enrichSchedules(schoolId, [data as ExamSchedule]);
          return list[0] || null;
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase findScheduleById error:', err);
      }
    }

    const memRow = this.mem.findById('exam_schedules', id) as ExamSchedule | null;
    if (memRow && memRow.school_id === schoolId && !memRow.deleted_at) {
      const list = await this.enrichSchedules(schoolId, [memRow]);
      return list[0] || null;
    }
    return null;
  }

  async findScheduleConflicts(
    schoolId: string,
    classId: string,
    sectionId: string | null | undefined,
    examDate: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<ExamSchedule[]> {
    const schedules = await this.findSchedules(schoolId, { classId, examDate });
    return schedules.filter((s) => {
      if (excludeId && s.id === excludeId) return false;
      if (s.status === 'CANCELLED') return false;
      if (sectionId && s.section_id && s.section_id !== sectionId) return false;
      return startTime < s.end_time && endTime > s.start_time;
    });
  }

  async createSchedule(schoolId: string, data: Partial<ExamSchedule>): Promise<ExamSchedule> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record: ExamSchedule = {
      id,
      school_id: schoolId,
      exam_id: data.exam_id!,
      academic_session_id: data.academic_session_id!,
      location_id: data.location_id!,
      class_id: data.class_id!,
      section_id: data.section_id || null,
      subject_id: data.subject_id!,
      exam_date: data.exam_date!,
      start_time: data.start_time!,
      end_time: data.end_time!,
      venue: data.venue || null,
      maximum_marks: Number(data.maximum_marks) || 100,
      instructions: data.instructions || null,
      status: data.status || 'SCHEDULED',
      created_by: data.created_by || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: dbData, error } = await getSupabaseClient()!
          .from('exam_schedules')
          .insert(record)
          .select()
          .single();

        if (error) {
          console.error('[ExamsRepository] Supabase createSchedule error:', error);
          throw new Error(`Failed to save Exam Schedule to database: ${error.message}`);
        }
        if (dbData) {
          this.mem.insert('exam_schedules', dbData);
          return (await this.enrichSchedules(schoolId, [dbData as ExamSchedule]))[0];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase createSchedule error:', err);
        throw err;
      }
    }

    this.mem.insert('exam_schedules', record);
    return (await this.enrichSchedules(schoolId, [record]))[0];
  }

  async updateSchedule(schoolId: string, id: string, data: Partial<ExamSchedule>): Promise<ExamSchedule | null> {
    const existing = await this.findScheduleById(schoolId, id);
    if (!existing) return null;

    const updates: Partial<ExamSchedule> = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: dbData, error } = await getSupabaseClient()!
          .from('exam_schedules')
          .update(updates)
          .eq('school_id', schoolId)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('[ExamsRepository] Supabase updateSchedule error:', error);
          throw new Error(`Failed to update Exam Schedule: ${error.message}`);
        }
        if (dbData) {
          this.mem.update('exam_schedules', id, dbData);
          return (await this.enrichSchedules(schoolId, [dbData as ExamSchedule]))[0];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase updateSchedule error:', err);
        throw err;
      }
    }

    this.mem.update('exam_schedules', id, updates);
    const updated = this.mem.findById('exam_schedules', id) as ExamSchedule;
    return (await this.enrichSchedules(schoolId, [updated]))[0];
  }

  async deleteSchedule(schoolId: string, id: string): Promise<boolean> {
    const now = new Date().toISOString();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('exam_schedules')
          .update({ deleted_at: now, updated_at: now })
          .eq('school_id', schoolId)
          .eq('id', id);

        if (error) {
          console.error('[ExamsRepository] Supabase deleteSchedule error:', error);
          throw new Error(`Failed to delete schedule: ${error.message}`);
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase deleteSchedule error:', err);
        throw err;
      }
    }
    this.mem.update('exam_schedules', id, { deleted_at: now, updated_at: now });
    return true;
  }

  // ======================================================================
  // 4. Grade Rules
  // ======================================================================
  async findGradeRules(schoolId: string): Promise<GradeRule[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('grade_rules')
          .select('*')
          .eq('school_id', schoolId)
          .eq('status', 'ACTIVE')
          .order('min_percentage', { ascending: false });

        if (!error && data && data.length > 0) {
          return data as GradeRule[];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase findGradeRules error:', err);
      }
    }

    const list = this.mem.findAll('grade_rules', (r: GradeRule) => (
      r.school_id === schoolId && r.status === 'ACTIVE'
    )) as GradeRule[];

    if (list.length > 0) {
      return list.sort((a, b) => b.min_percentage - a.min_percentage);
    }

    // Default Fallback
    return [
      { id: 'g1', school_id: schoolId, grade_name: 'A+', min_percentage: 90.00, max_percentage: 100.00, grade_point: 10, description: 'Outstanding', status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: 'g2', school_id: schoolId, grade_name: 'A',  min_percentage: 80.00, max_percentage: 89.99,  grade_point: 9,  description: 'Excellent',   status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: 'g3', school_id: schoolId, grade_name: 'B+', min_percentage: 70.00, max_percentage: 79.99,  grade_point: 8,  description: 'Very Good',   status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: 'g4', school_id: schoolId, grade_name: 'B',  min_percentage: 60.00, max_percentage: 69.99,  grade_point: 7,  description: 'Good',        status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: 'g5', school_id: schoolId, grade_name: 'C+', min_percentage: 50.00, max_percentage: 59.99,  grade_point: 6,  description: 'Above Average', status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: 'g6', school_id: schoolId, grade_name: 'C',  min_percentage: 40.00, max_percentage: 49.99,  grade_point: 5,  description: 'Average',     status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: 'g7', school_id: schoolId, grade_name: 'D',  min_percentage: 33.00, max_percentage: 39.99,  grade_point: 4,  description: 'Pass',        status: 'ACTIVE', created_at: '', updated_at: '' },
      { id: 'g8', school_id: schoolId, grade_name: 'F',  min_percentage: 0.00,  max_percentage: 32.99,  grade_point: 0,  description: 'Needs Improvement', status: 'ACTIVE', created_at: '', updated_at: '' },
    ];
  }

  // ======================================================================
  // 5. Exam Marks
  // ======================================================================
  async findMarks(schoolId: string, filters: ExamMarksFilters): Promise<ExamMark[]> {
    let rawMarks: ExamMark[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('exam_marks')
          .select('*')
          .eq('school_id', schoolId)
          .eq('exam_id', filters.examId)
          .eq('class_id', filters.classId)
          .is('deleted_at', null);

        if (filters.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
        if (filters.locationId) q = q.eq('location_id', filters.locationId);
        if (filters.sectionId) q = q.eq('section_id', filters.sectionId);
        if (filters.subjectId) q = q.eq('subject_id', filters.subjectId);
        if (filters.studentUserId) q = q.eq('student_user_id', filters.studentUserId);

        const { data, error } = await q;
        if (!error && data) {
          rawMarks = data as ExamMark[];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase findMarks error:', err);
      }
    }

    if (rawMarks.length === 0) {
      rawMarks = this.mem.findAll('exam_marks', (r: ExamMark) => {
        if (r.school_id !== schoolId) return false;
        if (r.deleted_at) return false;
        if (r.exam_id !== filters.examId) return false;
        if (r.class_id !== filters.classId) return false;
        if (filters.academicSessionId && r.academic_session_id !== filters.academicSessionId) return false;
        if (filters.locationId && r.location_id !== filters.locationId) return false;
        if (filters.sectionId && r.section_id !== filters.sectionId) return false;
        if (filters.subjectId && r.subject_id !== filters.subjectId) return false;
        if (filters.studentUserId && r.student_user_id !== filters.studentUserId) return false;
        return true;
      }) as ExamMark[];
    }

    return this.enrichMarks(schoolId, rawMarks);
  }

  async upsertMarks(schoolId: string, marksData: Array<Partial<ExamMark>>): Promise<ExamMark[]> {
    const savedList: ExamMark[] = [];
    const now = new Date().toISOString();

    for (const item of marksData) {
      const existing = (this.mem.findAll('exam_marks', (r: ExamMark) => (
        r.school_id === schoolId &&
        r.exam_id === item.exam_id &&
        r.student_user_id === item.student_user_id &&
        r.subject_id === item.subject_id &&
        !r.deleted_at
      ))[0] as ExamMark | undefined);

      const recordId = existing ? existing.id : (item.id || crypto.randomUUID());
      const record: ExamMark = {
        id: recordId,
        school_id: schoolId,
        exam_id: item.exam_id!,
        academic_session_id: item.academic_session_id!,
        location_id: item.location_id!,
        class_id: item.class_id!,
        section_id: item.section_id!,
        student_user_id: item.student_user_id!,
        subject_id: item.subject_id!,
        maximum_marks: Number(item.maximum_marks),
        passing_marks: Number(item.passing_marks),
        obtained_marks: item.attendance_status === 'PRESENT' && item.obtained_marks !== undefined && item.obtained_marks !== null
          ? Number(item.obtained_marks)
          : null,
        attendance_status: item.attendance_status || 'PRESENT',
        remarks: item.remarks || null,
        status: item.status || 'ENTERED',
        created_by: existing ? existing.created_by : (item.created_by || null),
        updated_by: item.updated_by || null,
        created_at: existing ? existing.created_at : now,
        updated_at: now,
        deleted_at: null,
      };

      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          const { error } = await getSupabaseClient()!
            .from('exam_marks')
            .upsert(record, { onConflict: 'school_id,exam_id,student_user_id,subject_id' });

          if (error) {
            console.error('[ExamsRepository] Supabase upsert mark error:', error);
            throw new Error(`Failed to save mark: ${error.message}`);
          }
        } catch (err) {
          console.error('[ExamsRepository] Supabase upsert mark error:', err);
          throw err;
        }
      }

      if (existing) {
        this.mem.update('exam_marks', existing.id, record);
      } else {
        this.mem.insert('exam_marks', record);
      }
      savedList.push(record);
    }

    return this.enrichMarks(schoolId, savedList);
  }

  // ======================================================================
  // 6. Exam Results & Publication Snapshots
  // ======================================================================
  async findResults(schoolId: string, filters: ExamResultFilters): Promise<ExamResult[]> {
    let rawResults: ExamResult[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('exam_results')
          .select('*')
          .eq('school_id', schoolId)
          .eq('exam_id', filters.examId)
          .is('deleted_at', null);

        if (filters.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
        if (filters.locationId) q = q.eq('location_id', filters.locationId);
        if (filters.classId) q = q.eq('class_id', filters.classId);
        if (filters.sectionId) q = q.eq('section_id', filters.sectionId);
        if (filters.studentUserId) q = q.eq('student_user_id', filters.studentUserId);
        if (filters.status) q = q.eq('status', filters.status);

        const { data, error } = await q;
        if (!error && data) {
          rawResults = data as ExamResult[];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase findResults error:', err);
      }
    }

    if (rawResults.length === 0) {
      rawResults = this.mem.findAll('exam_results', (r: ExamResult) => {
        if (r.school_id !== schoolId) return false;
        if (r.deleted_at) return false;
        if (r.exam_id !== filters.examId) return false;
        if (filters.academicSessionId && r.academic_session_id !== filters.academicSessionId) return false;
        if (filters.locationId && r.location_id !== filters.locationId) return false;
        if (filters.classId && r.class_id !== filters.classId) return false;
        if (filters.sectionId && r.section_id !== filters.sectionId) return false;
        if (filters.studentUserId && r.student_user_id !== filters.studentUserId) return false;
        if (filters.status && r.status !== filters.status) return false;
        return true;
      }) as ExamResult[];
    }

    return this.enrichResults(schoolId, rawResults);
  }

  async saveResults(
    schoolId: string,
    payloads: Array<{ result: Partial<ExamResult>; details: Array<Partial<ExamResultDetail>> }>
  ): Promise<ExamResult[]> {
    const savedResults: ExamResult[] = [];
    const now = new Date().toISOString();

    for (const item of payloads) {
      const existing = (this.mem.findAll('exam_results', (r: ExamResult) => (
        r.school_id === schoolId &&
        r.exam_id === item.result.exam_id &&
        r.student_user_id === item.result.student_user_id &&
        !r.deleted_at
      ))[0] as ExamResult | undefined);

      const resId = existing ? existing.id : (item.result.id || crypto.randomUUID());
      const resRecord: ExamResult = {
        id: resId,
        school_id: schoolId,
        exam_id: item.result.exam_id!,
        academic_session_id: item.result.academic_session_id!,
        location_id: item.result.location_id!,
        class_id: item.result.class_id!,
        section_id: item.result.section_id!,
        student_user_id: item.result.student_user_id!,
        total_obtained_marks: Number(item.result.total_obtained_marks) || 0,
        total_maximum_marks: Number(item.result.total_maximum_marks) || 0,
        percentage: Number(item.result.percentage) || 0,
        grade: item.result.grade || 'F',
        result_status: item.result.result_status || 'PASS',
        status: item.result.status || 'DRAFT',
        published_at: item.result.published_at || null,
        published_by: item.result.published_by || null,
        created_at: existing ? existing.created_at : now,
        updated_at: now,
        deleted_at: null,
      };

      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          const { error } = await getSupabaseClient()!
            .from('exam_results')
            .upsert(resRecord, { onConflict: 'school_id,exam_id,student_user_id' });

          if (error) {
            console.error('[ExamsRepository] Supabase upsert result error:', error);
            throw new Error(`Failed to save exam result: ${error.message}`);
          }
        } catch (err) {
          console.error('[ExamsRepository] Supabase upsert result error:', err);
          throw err;
        }
      }

      if (existing) {
        this.mem.update('exam_results', existing.id, resRecord);
      } else {
        this.mem.insert('exam_results', resRecord);
      }

      // Save itemized details snapshot
      const oldDetails = this.mem.findAll('exam_result_details', (d: ExamResultDetail) => d.exam_result_id === resId);
      for (const od of oldDetails) this.mem.delete('exam_result_details', od.id);

      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          await getSupabaseClient()!.from('exam_result_details').delete().eq('exam_result_id', resId);
        } catch (err) {
          console.error('[ExamsRepository] Supabase delete old result details error:', err);
        }
      }

      const detRecords: ExamResultDetail[] = [];
      for (const d of item.details) {
        const dRec: ExamResultDetail = {
          id: crypto.randomUUID(),
          school_id: schoolId,
          exam_result_id: resId,
          subject_id: d.subject_id!,
          subject_name: d.subject_name!,
          maximum_marks: Number(d.maximum_marks),
          passing_marks: Number(d.passing_marks),
          obtained_marks: d.obtained_marks !== undefined && d.obtained_marks !== null ? Number(d.obtained_marks) : null,
          attendance_status: d.attendance_status || 'PRESENT',
          grade: d.grade || '',
          is_pass: d.is_pass ?? true,
          created_at: now,
        };
        detRecords.push(dRec);
        this.mem.insert('exam_result_details', dRec);
      }

      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        try {
          const { error } = await getSupabaseClient()!.from('exam_result_details').insert(detRecords);
          if (error) {
            console.error('[ExamsRepository] Supabase insert result details error:', error);
            throw new Error(`Failed to save result details: ${error.message}`);
          }
        } catch (err) {
          console.error('[ExamsRepository] Supabase insert result details error:', err);
          throw err;
        }
      }

      savedResults.push(resRecord);
    }

    return this.enrichResults(schoolId, savedResults);
  }

  // ======================================================================
  // 7. Dashboard & Analytics
  // ======================================================================
  async getDashboardStats(
    schoolId: string,
    filters?: { academicSessionId?: string; locationId?: string }
  ): Promise<ExamDashboardStats> {
    const exams = await this.findExams(schoolId, { academicSessionId: filters?.academicSessionId });
    const totalExams = exams.length;
    const draft = exams.filter((e) => e.status === 'DRAFT').length;
    const scheduled = exams.filter((e) => e.status === 'SCHEDULED').length;
    const ongoing = exams.filter((e) => e.status === 'ONGOING').length;
    const completed = exams.filter((e) => e.status === 'COMPLETED').length;
    const resultsReady = exams.filter((e) => e.status === 'RESULTS_READY').length;
    const publishedExams = exams.filter((e) => e.status === 'PUBLISHED').length;

    let allResults: ExamResult[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('exam_results')
          .select('percentage, status')
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
        if (filters?.locationId) q = q.eq('location_id', filters.locationId);

        const { data, error } = await q;
        if (!error && data) {
          allResults = data as ExamResult[];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase getDashboardStats error:', err);
      }
    }

    if (allResults.length === 0) {
      allResults = this.mem.findAll('exam_results', (r: ExamResult) => {
        if (r.school_id !== schoolId) return false;
        if (r.deleted_at) return false;
        if (filters?.academicSessionId && r.academic_session_id !== filters.academicSessionId) return false;
        if (filters?.locationId && r.location_id !== filters.locationId) return false;
        return true;
      }) as ExamResult[];
    }

    const published = allResults.filter((r) => r.status === 'PUBLISHED').length;
    const avgPercentage = allResults.length > 0
      ? Number((allResults.reduce((acc, r) => acc + Number(r.percentage), 0) / allResults.length).toFixed(2))
      : 0;

    return {
      total_exams: totalExams,
      draft_exams: draft,
      scheduled_exams: scheduled,
      ongoing_exams: ongoing,
      completed_exams: completed,
      results_ready_exams: resultsReady,
      published_exams: publishedExams,
      students_pending_marks: 0,
      results_published: published,
      average_percentage: avgPercentage,
    };
  }

  // ======================================================================
  // Hydration Helpers
  // ======================================================================
  private async getMasterLookups(schoolId: string) {
    const [sessions, classes, sections, subjects, locations, rawExams] = await Promise.all([
      academicRepository.findSessions(schoolId, { includeInactive: true }).catch(() => []),
      academicRepository.findClasses(schoolId, { includeInactive: true }).catch(() => []),
      academicRepository.findSections(schoolId, { includeInactive: true }).catch(() => []),
      academicRepository.findSubjects(schoolId, { includeInactive: true }).catch(() => []),
      locationRepository.findBySchoolId(schoolId, { includeDeleted: false }).catch(() => []),
      this.findRawExams(schoolId).catch(() => []),
    ]);

    return {
      sessions: new Map(sessions.map((s) => [s.id, s])),
      classes: new Map(classes.map((c) => [c.id, c])),
      sections: new Map(sections.map((s) => [s.id, s])),
      subjects: new Map(subjects.map((s) => [s.id, s])),
      locations: new Map(locations.map((l) => [l.id, l])),
      exams: new Map(rawExams.map((e) => [e.id, e])),
    };
  }

  private async findRawExams(schoolId: string): Promise<ExamMaster[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('exam_master')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null);
        if (!error && data) return data as ExamMaster[];
      } catch (err) {
        console.error('[ExamsRepository] findRawExams Supabase error:', err);
      }
    }
    return this.mem.findAll('exam_master', (r: ExamMaster) => r.school_id === schoolId && !r.deleted_at);
  }

  private async enrichExams(schoolId: string, exams: ExamMaster[]): Promise<ExamMaster[]> {
    if (exams.length === 0) return [];
    const sessions = await academicRepository.findSessions(schoolId, { includeInactive: true }).catch(() => []);
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    return exams.map((e) => ({
      ...e,
      session: sessionMap.get(e.academic_session_id) || (this.mem.findById('academic_sessions', e.academic_session_id) as AcademicSession | null) || undefined,
    }));
  }

  private async enrichStructures(schoolId: string, structures: ExamStructure[]): Promise<ExamStructure[]> {
    if (structures.length === 0) return [];
    const structIds = structures.map((s) => s.id);
    let structureSubjects: ExamStructureSubject[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient() && structIds.length > 0) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('exam_structure_subjects')
          .select('*')
          .in('exam_structure_id', structIds)
          .is('deleted_at', null);

        if (!error && data) {
          structureSubjects = data as ExamStructureSubject[];
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase findStructureSubjects error:', err);
      }
    }

    if (structureSubjects.length === 0 && structIds.length > 0) {
      structureSubjects = this.mem.findAll('exam_structure_subjects', (s: ExamStructureSubject) => (
        structIds.includes(s.exam_structure_id) && !s.deleted_at
      )) as ExamStructureSubject[];
    }

    const lookups = await this.getMasterLookups(schoolId);

    return structures.map((st) => {
      const exam = lookups.exams.get(st.exam_id);
      const session = lookups.sessions.get(st.academic_session_id);
      const location = st.location_id ? lookups.locations.get(st.location_id) : undefined;
      const cls = lookups.classes.get(st.class_id);
      const sec = st.section_id ? lookups.sections.get(st.section_id) : undefined;

      const rawSubjs = structureSubjects.filter((s) => s.exam_structure_id === st.id);
      const enrichedSubjs = rawSubjs.map((s) => ({
        ...s,
        subject: lookups.subjects.get(s.subject_id),
      }));

      return {
        ...st,
        exam,
        session,
        location,
        class: cls ? {
          ...cls,
          display_name: cls.display_name || (cls as any).display_label || (cls.name.toLowerCase().startsWith('class') ? cls.name : `Class ${cls.name}`),
        } : undefined,
        section: sec,
        subjects: enrichedSubjs,
      };
    });
  }

  private async enrichSchedules(schoolId: string, schedules: ExamSchedule[]): Promise<ExamSchedule[]> {
    if (schedules.length === 0) return [];
    const lookups = await this.getMasterLookups(schoolId);

    return schedules.map((s) => {
      const exam = lookups.exams.get(s.exam_id);
      const session = lookups.sessions.get(s.academic_session_id);
      const location = lookups.locations.get(s.location_id);
      const cls = lookups.classes.get(s.class_id);
      const sec = s.section_id ? lookups.sections.get(s.section_id) : undefined;
      const subj = lookups.subjects.get(s.subject_id);

      return {
        ...s,
        exam,
        session,
        location,
        class: cls ? {
          ...cls,
          display_name: cls.display_name || (cls as any).display_label || (cls.name.toLowerCase().startsWith('class') ? cls.name : `Class ${cls.name}`),
        } : undefined,
        section: sec,
        subject: subj,
      };
    });
  }

  private async enrichMarks(schoolId: string, marks: ExamMark[]): Promise<ExamMark[]> {
    if (marks.length === 0) return [];
    const lookups = await this.getMasterLookups(schoolId);
    const studentUserIds = Array.from(new Set(marks.map((m) => m.student_user_id)));
    const studentMap = new Map<string, any>();

    if (isSupabaseDatabaseActive() && getSupabaseClient() && studentUserIds.length > 0) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('users')
          .select('id, first_name, last_name, email, phone, avatar_url, user_type_id, status')
          .in('id', studentUserIds);
        if (!error && data) {
          data.forEach((u: any) => studentMap.set(u.id, u));
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase load student users error:', err);
      }
    }

    for (const uid of studentUserIds) {
      if (!studentMap.has(uid)) {
        const u = this.mem.findById('users', uid) as User | null;
        if (u) studentMap.set(uid, { ...u, password_hash: undefined });
      }
    }

    return marks.map((m) => {
      const student = studentMap.get(m.student_user_id);
      const studentName = student
        ? `${student.first_name} ${student.last_name || ''}`.trim()
        : 'Student';

      return {
        ...m,
        student: student ? { ...student, full_name: studentName } : undefined,
        subject: lookups.subjects.get(m.subject_id),
        class: lookups.classes.get(m.class_id),
        section: m.section_id ? lookups.sections.get(m.section_id) : undefined,
      };
    });
  }

  private async enrichResults(schoolId: string, results: ExamResult[]): Promise<ExamResult[]> {
    if (results.length === 0) return [];
    const lookups = await this.getMasterLookups(schoolId);
    const resultIds = results.map((r) => r.id);
    const studentUserIds = Array.from(new Set(results.map((r) => r.student_user_id)));

    // Load Result Details
    let detailsList: ExamResultDetail[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient() && resultIds.length > 0) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('exam_result_details')
          .select('*')
          .in('exam_result_id', resultIds);
        if (!error && data) detailsList = data as ExamResultDetail[];
      } catch (err) {
        console.error('[ExamsRepository] Supabase load result details error:', err);
      }
    }
    if (detailsList.length === 0 && resultIds.length > 0) {
      detailsList = this.mem.findAll('exam_result_details', (d: ExamResultDetail) =>
        resultIds.includes(d.exam_result_id)
      ) as ExamResultDetail[];
    }

    // Load Student Users
    const studentMap = new Map<string, any>();
    if (isSupabaseDatabaseActive() && getSupabaseClient() && studentUserIds.length > 0) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('users')
          .select('id, first_name, last_name, email, phone, avatar_url, user_type_id, status')
          .in('id', studentUserIds);
        if (!error && data) {
          data.forEach((u: any) => studentMap.set(u.id, u));
        }
      } catch (err) {
        console.error('[ExamsRepository] Supabase load result student users error:', err);
      }
    }
    for (const uid of studentUserIds) {
      if (!studentMap.has(uid)) {
        const u = this.mem.findById('users', uid) as User | null;
        if (u) studentMap.set(uid, { ...u, password_hash: undefined });
      }
    }

    // Load enrollments for roll_number / admission_number
    let enrollments: any[] = [];
    if (isSupabaseDatabaseActive() && getSupabaseClient() && studentUserIds.length > 0) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('student_academic_enrollments')
          .select('student_user_id, academic_session_id, admission_number, roll_number')
          .eq('school_id', schoolId)
          .in('student_user_id', studentUserIds)
          .is('deleted_at', null);
        if (!error && data) enrollments = data;
      } catch (err) {
        console.error('[ExamsRepository] Supabase load enrollments error:', err);
      }
    }
    if (enrollments.length === 0) {
      enrollments = this.mem.findAll('student_academic_enrollments', (e: any) =>
        e.school_id === schoolId && studentUserIds.includes(e.student_user_id) && !e.deleted_at
      );
    }
    const enrMap = new Map<string, any>();
    enrollments.forEach((e) => enrMap.set(`${e.student_user_id}_${e.academic_session_id}`, e));

    return results.map((r) => {
      const student = studentMap.get(r.student_user_id);
      const studentName = student
        ? `${student.first_name} ${student.last_name || ''}`.trim()
        : 'Student';
      const exam = lookups.exams.get(r.exam_id);
      const session = lookups.sessions.get(r.academic_session_id);
      const location = lookups.locations.get(r.location_id);
      const cls = lookups.classes.get(r.class_id);
      const sec = r.section_id ? lookups.sections.get(r.section_id) : undefined;
      const details = detailsList.filter((d) => d.exam_result_id === r.id);
      const enr = enrMap.get(`${r.student_user_id}_${r.academic_session_id}`);

      return {
        ...r,
        student: student ? { ...student, full_name: studentName } : undefined,
        exam,
        session,
        location,
        class: cls ? {
          ...cls,
          display_name: cls.display_name || (cls as any).display_label || (cls.name.toLowerCase().startsWith('class') ? cls.name : `Class ${cls.name}`),
        } : undefined,
        section: sec,
        details,
        admission_number: enr?.admission_number || '',
        roll_number: enr?.roll_number || '',
      };
    });
  }
}

export const examsRepository = new ExamsRepository();
