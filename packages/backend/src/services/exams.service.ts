// ========================================================================
// Exams & Results Service
// Multi-Tenant Core Examination Engine
// Complete Business Logic: Definitions, Structures, Timetable Schedules,
// Bulk Marks Validation, Dynamic Grade Engine & Result Publication Snapshots
// ========================================================================

import {
  ExamMaster,
  ExamStructure,
  ExamSchedule,
  GradeRule,
  ExamMark,
  ExamResult,
  ExamResultDetail,
  ExamDashboardStats,
  StudentAcademicEnrollment,
} from '../types/index.js';
import { examsRepository, ExamsRepository } from '../repositories/exams.repository.js';
import { academicRepository } from '../repositories/academic.repository.js';
import { schoolRepository } from '../repositories/school.repository.js';
import { locationRepository } from '../repositories/location.repository.js';

export interface CreateExamDTO {
  academic_session_id: string;
  exam_name: string;
  exam_code: string;
  exam_type?: string;
  description?: string;
  start_date: string;
  end_date: string;
  status?: 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'RESULTS_READY' | 'PUBLISHED' | 'CANCELLED';
}

export interface CreateExamStructureDTO {
  exam_id: string;
  academic_session_id: string;
  location_id?: string;
  class_id: string;
  section_id?: string;
  subjects: Array<{
    subject_id: string;
    maximum_marks: number;
    passing_marks: number;
    grade_applicable?: boolean;
    weightage?: number;
  }>;
}

export interface CreateExamScheduleDTO {
  exam_id: string;
  academic_session_id: string;
  location_id: string;
  class_id: string;
  section_id?: string;
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue?: string;
  maximum_marks?: number;
  instructions?: string;
}

export interface BulkSaveMarksDTO {
  exam_id: string;
  academic_session_id: string;
  location_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  marks: Array<{
    student_user_id: string;
    obtained_marks?: number | null;
    attendance_status: 'PRESENT' | 'ABSENT' | 'EXEMPT';
    remarks?: string;
  }>;
}

export class ExamsService {
  constructor(private repo: ExamsRepository = examsRepository) {}

  // ======================================================================
  // 1. Exam Master
  // ======================================================================
  async listExams(
    schoolId: string,
    filters?: { academicSessionId?: string; status?: string; search?: string }
  ): Promise<ExamMaster[]> {
    return this.repo.findExams(schoolId, filters);
  }

  async getExamById(schoolId: string, id: string): Promise<ExamMaster> {
    const exam = await this.repo.findExamById(schoolId, id);
    if (!exam) throw new Error(`Exam not found with ID [${id}].`);
    return exam;
  }

  async createExam(schoolId: string, dto: CreateExamDTO, actorUserId?: string): Promise<ExamMaster> {
    if (!dto.exam_name?.trim()) throw new Error('Exam Name is required.');
    if (!dto.exam_code?.trim()) throw new Error('Exam Code is required.');
    if (!dto.academic_session_id) throw new Error('Academic Session is required.');
    if (!dto.start_date) throw new Error('Start Date is required.');
    if (!dto.end_date) throw new Error('End Date is required.');

    if (new Date(dto.start_date) > new Date(dto.end_date)) {
      throw new Error('Start Date cannot be after End Date.');
    }

    // Check duplicate code within same session
    const existing = await this.repo.findExamByCode(schoolId, dto.academic_session_id, dto.exam_code);
    if (existing) {
      throw new Error(`An exam with code "${dto.exam_code.toUpperCase()}" already exists in this Academic Session.`);
    }

    return this.repo.createExam(schoolId, {
      ...dto,
      created_by: actorUserId,
      updated_by: actorUserId,
    });
  }

  async updateExam(schoolId: string, id: string, dto: Partial<CreateExamDTO>, actorUserId?: string): Promise<ExamMaster> {
    const existing = await this.getExamById(schoolId, id);

    if (dto.start_date && dto.end_date && new Date(dto.start_date) > new Date(dto.end_date)) {
      throw new Error('Start Date cannot be after End Date.');
    }

    if (dto.exam_code && dto.exam_code.trim().toUpperCase() !== existing.exam_code) {
      const duplicate = await this.repo.findExamByCode(
        schoolId,
        dto.academic_session_id || existing.academic_session_id,
        dto.exam_code
      );
      if (duplicate && duplicate.id !== id) {
        throw new Error(`An exam with code "${dto.exam_code.toUpperCase()}" already exists in this Academic Session.`);
      }
    }

    const updated = await this.repo.updateExam(schoolId, id, {
      ...dto,
      updated_by: actorUserId,
    });
    return updated!;
  }

  async updateExamStatus(
    schoolId: string,
    id: string,
    newStatus: 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'RESULTS_READY' | 'PUBLISHED' | 'CANCELLED',
    actorUserId?: string
  ): Promise<ExamMaster> {
    const validStatuses = ['DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'RESULTS_READY', 'PUBLISHED', 'CANCELLED'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid exam status "${newStatus}". Allowed: ${validStatuses.join(', ')}`);
    }
    return this.updateExam(schoolId, id, { status: newStatus }, actorUserId);
  }

  async deleteExam(schoolId: string, id: string): Promise<boolean> {
    await this.getExamById(schoolId, id);
    return this.repo.deleteExam(schoolId, id);
  }

  // ======================================================================
  // 2. Exam Structure
  // ======================================================================
  async listStructures(
    schoolId: string,
    filters?: {
      examId?: string;
      academicSessionId?: string;
      locationId?: string;
      classId?: string;
      sectionId?: string;
      exactSection?: boolean;
      status?: string;
    }
  ): Promise<ExamStructure[]> {
    return this.repo.findStructures(schoolId, filters);
  }

  async createStructure(schoolId: string, dto: CreateExamStructureDTO, actorUserId?: string): Promise<ExamStructure> {
    if (!dto.exam_id) throw new Error('Exam is required.');
    if (!dto.academic_session_id) throw new Error('Academic Session is required.');
    if (!dto.class_id) throw new Error('Class is required.');
    if (!dto.subjects || dto.subjects.length === 0) {
      throw new Error('At least one subject must be configured in the Exam Structure.');
    }

    // Validate subjects
    const seenSubjects = new Set<string>();
    for (const subj of dto.subjects) {
      if (!subj.subject_id) throw new Error('Subject ID is required.');
      if (seenSubjects.has(subj.subject_id)) {
        throw new Error('Duplicate subject found in exam structure definition.');
      }
      seenSubjects.add(subj.subject_id);

      const max = Number(subj.maximum_marks);
      const pass = Number(subj.passing_marks);
      if (isNaN(max) || max <= 0) {
        throw new Error('Maximum Marks must be greater than 0.');
      }
      if (isNaN(pass) || pass < 0 || pass > max) {
        throw new Error(`Passing Marks (${pass}) must be between 0 and Maximum Marks (${max}).`);
      }
    }

    // Check if structure already exists for this exam + class + section
    const existing = await this.repo.findStructures(schoolId, {
      examId: dto.exam_id,
      classId: dto.class_id,
      sectionId: dto.section_id,
      exactSection: true,
    });
    if (existing.length > 0) {
      throw new Error('An Exam Structure already exists for this Exam, Class, and Section.');
    }

    return this.repo.createStructure(
      schoolId,
      {
        exam_id: dto.exam_id,
        academic_session_id: dto.academic_session_id,
        location_id: dto.location_id || null,
        class_id: dto.class_id,
        section_id: dto.section_id || null,
        created_by: actorUserId,
        updated_by: actorUserId,
      },
      dto.subjects
    );
  }

  async updateStructure(
    schoolId: string,
    id: string,
    dto: Partial<CreateExamStructureDTO>,
    actorUserId?: string
  ): Promise<ExamStructure> {
    const existing = await this.repo.findStructureById(schoolId, id);
    if (!existing) throw new Error(`Exam Structure not found with ID [${id}].`);

    if (dto.subjects) {
      const seenSubjects = new Set<string>();
      for (const subj of dto.subjects) {
        if (!subj.subject_id) throw new Error('Subject ID is required.');
        if (seenSubjects.has(subj.subject_id)) {
          throw new Error('Duplicate subject found in exam structure definition.');
        }
        seenSubjects.add(subj.subject_id);

        const max = Number(subj.maximum_marks);
        const pass = Number(subj.passing_marks);
        if (isNaN(max) || max <= 0) throw new Error('Maximum Marks must be greater than 0.');
        if (isNaN(pass) || pass < 0 || pass > max) {
          throw new Error(`Passing Marks (${pass}) must be between 0 and Maximum Marks (${max}).`);
        }
      }
    }

    const updated = await this.repo.updateStructure(
      schoolId,
      id,
      {
        location_id: dto.location_id,
        section_id: dto.section_id,
        updated_by: actorUserId,
      },
      dto.subjects
    );
    return updated!;
  }

  async deleteStructure(schoolId: string, id: string): Promise<boolean> {
    const existing = await this.repo.findStructureById(schoolId, id);
    if (!existing) throw new Error(`Exam Structure not found with ID [${id}].`);
    return this.repo.deleteStructure(schoolId, id);
  }

  // ======================================================================
  // 3. Exam Schedule
  // ======================================================================
  async listSchedules(
    schoolId: string,
    filters?: {
      examId?: string;
      academicSessionId?: string;
      locationId?: string;
      classId?: string;
      sectionId?: string;
      subjectId?: string;
      examDate?: string;
      status?: string;
    }
  ): Promise<ExamSchedule[]> {
    return this.repo.findSchedules(schoolId, filters);
  }

  async createSchedule(schoolId: string, dto: CreateExamScheduleDTO, actorUserId?: string): Promise<ExamSchedule> {
    if (!dto.exam_id) throw new Error('Exam is required.');
    if (!dto.academic_session_id) throw new Error('Academic Session is required.');
    if (!dto.location_id) {
      const branches = await locationRepository.findBySchoolId(schoolId);
      if (branches.length > 0) {
        dto.location_id = branches[0].id;
      } else {
        throw new Error('Branch / Location is required.');
      }
    }
    if (!dto.class_id) throw new Error('Class is required.');
    if (!dto.subject_id) throw new Error('Subject is required.');
    if (!dto.exam_date) throw new Error('Exam Date is required.');
    if (!dto.start_time) throw new Error('Start Time is required.');
    if (!dto.end_time) throw new Error('End Time is required.');

    if (dto.start_time >= dto.end_time) {
      throw new Error(`End Time (${dto.end_time}) must be after Start Time (${dto.start_time}).`);
    }

    // Check conflict (same class, date, overlapping time)
    const conflicts = await this.repo.findScheduleConflicts(
      schoolId,
      dto.class_id,
      dto.section_id,
      dto.exam_date,
      dto.start_time,
      dto.end_time
    );

    if (conflicts.length > 0) {
      const c = conflicts[0];
      throw new Error(
        `Schedule Conflict: Class already has an exam for "${c.subject?.name || 'Subject'}" on ${dto.exam_date} between ${c.start_time} and ${c.end_time}.`
      );
    }

    return this.repo.createSchedule(schoolId, {
      ...dto,
      created_by: actorUserId,
    });
  }

  async updateSchedule(
    schoolId: string,
    id: string,
    dto: Partial<CreateExamScheduleDTO>,
    actorUserId?: string
  ): Promise<ExamSchedule> {
    const existing = await this.repo.findScheduleById(schoolId, id);
    if (!existing) throw new Error(`Exam Schedule not found with ID [${id}].`);

    const sTime = dto.start_time || existing.start_time;
    const eTime = dto.end_time || existing.end_time;
    if (sTime >= eTime) {
      throw new Error(`End Time (${eTime}) must be after Start Time (${sTime}).`);
    }

    if (dto.exam_date || dto.start_time || dto.end_time) {
      const conflicts = await this.repo.findScheduleConflicts(
        schoolId,
        dto.class_id || existing.class_id,
        dto.section_id !== undefined ? dto.section_id : existing.section_id,
        dto.exam_date || existing.exam_date,
        sTime,
        eTime,
        id
      );
      if (conflicts.length > 0) {
        const c = conflicts[0];
        throw new Error(
          `Schedule Conflict: Overlaps with "${c.subject?.name || 'Subject'}" on ${dto.exam_date || existing.exam_date} (${c.start_time} - ${c.end_time}).`
        );
      }
    }

    const updated = await this.repo.updateSchedule(schoolId, id, dto);
    return updated!;
  }

  async deleteSchedule(schoolId: string, id: string): Promise<boolean> {
    const existing = await this.repo.findScheduleById(schoolId, id);
    if (!existing) throw new Error(`Exam Schedule not found with ID [${id}].`);
    return this.repo.deleteSchedule(schoolId, id);
  }

  // ======================================================================
  // 4. Student Roster for Marks Entry
  // ======================================================================
  async getMarksRoster(
    schoolId: string,
    params: {
      examId: string;
      academicSessionId: string;
      locationId?: string;
      classId: string;
      sectionId?: string;
      subjectId: string;
    }
  ) {
    // 1. Authoritative Student Enrollments
    const enrollments = await academicRepository.findEnrollments(schoolId, {
      sessionId: params.academicSessionId,
      locationId: params.locationId,
      classId: params.classId,
      sectionId: params.sectionId,
      status: 'ENROLLED',
    });

    // 2. Resolve Maximum & Passing Marks from Exam Structure
    const structures = await this.repo.findStructures(schoolId, {
      examId: params.examId,
      classId: params.classId,
      sectionId: params.sectionId,
    });

    let maxMarks = 100;
    let passMarks = 33;
    if (structures.length > 0) {
      const structSubj = structures
        .flatMap((s) => s.subjects || [])
        .find((sub) => sub.subject_id === params.subjectId);
      if (structSubj) {
        maxMarks = structSubj.maximum_marks;
        passMarks = structSubj.passing_marks;
      }
    }

    // 3. Existing Marks
    const existingMarks = await this.repo.findMarks(schoolId, {
      examId: params.examId,
      classId: params.classId,
      sectionId: params.sectionId,
      subjectId: params.subjectId,
    });

    const marksMap = new Map<string, ExamMark>();
    for (const m of existingMarks) {
      marksMap.set(m.student_user_id, m);
    }

    // 4. Grade Rules for preview
    const gradeRules = await this.repo.findGradeRules(schoolId);

    // Build unified roster
    const roster = enrollments.map((enr) => {
      const existing = marksMap.get(enr.student_user_id);
      const studentName = enr.student
        ? `${enr.student.first_name} ${enr.student.last_name || ''}`.trim()
        : 'Student';

      let grade = '';
      let isPass = false;
      if (existing && existing.attendance_status === 'PRESENT' && existing.obtained_marks !== null && existing.obtained_marks !== undefined) {
        const pct = (existing.obtained_marks / maxMarks) * 100;
        const matched = gradeRules.find((g) => pct >= g.min_percentage && pct <= g.max_percentage);
        grade = matched ? matched.grade_name : 'F';
        isPass = existing.obtained_marks >= passMarks;
      }

      return {
        enrollment_id: enr.id,
        student_user_id: enr.student_user_id,
        student_name: studentName,
        admission_number: enr.admission_number,
        roll_number: enr.roll_number || '',
        maximum_marks: maxMarks,
        passing_marks: passMarks,
        obtained_marks: existing ? existing.obtained_marks : null,
        attendance_status: existing ? existing.attendance_status : 'PRESENT',
        status: existing ? existing.status : 'NOT_ENTERED',
        remarks: existing?.remarks || '',
        grade,
        is_pass: isPass,
      };
    });

    return {
      exam_id: params.examId,
      class_id: params.classId,
      section_id: params.sectionId,
      subject_id: params.subjectId,
      maximum_marks: maxMarks,
      passing_marks: passMarks,
      roster,
    };
  }

  // ======================================================================
  // 5. Bulk Save Marks
  // ======================================================================
  async saveMarks(schoolId: string, dto: BulkSaveMarksDTO, actorUserId?: string): Promise<ExamMark[]> {
    if (!dto.exam_id) throw new Error('Exam is required.');
    if (!dto.class_id) throw new Error('Class is required.');
    if (!dto.subject_id) throw new Error('Subject is required.');
    if (!dto.marks || dto.marks.length === 0) throw new Error('No marks submitted to save.');

    // Resolve Exam Structure for authoritative max/pass marks
    const structures = await this.repo.findStructures(schoolId, {
      examId: dto.exam_id,
      classId: dto.class_id,
      sectionId: dto.section_id,
    });

    let maxMarks = 100;
    let passMarks = 33;
    if (structures.length > 0) {
      const structSubj = structures
        .flatMap((s) => s.subjects || [])
        .find((sub) => sub.subject_id === dto.subject_id);
      if (structSubj) {
        maxMarks = structSubj.maximum_marks;
        passMarks = structSubj.passing_marks;
      }
    }

    const marksToSave: Array<Partial<ExamMark>> = [];
    for (const m of dto.marks) {
      if (m.attendance_status === 'PRESENT') {
        const val = Number(m.obtained_marks);
        if (isNaN(val) || val < 0) {
          throw new Error(`Marks cannot be negative.`);
        }
        if (val > maxMarks) {
          throw new Error(`Marks (${val}) cannot exceed Maximum Marks (${maxMarks}).`);
        }
      }

      marksToSave.push({
        exam_id: dto.exam_id,
        academic_session_id: dto.academic_session_id,
        location_id: dto.location_id,
        class_id: dto.class_id,
        section_id: dto.section_id,
        student_user_id: m.student_user_id,
        subject_id: dto.subject_id,
        maximum_marks: maxMarks,
        passing_marks: passMarks,
        obtained_marks: m.attendance_status === 'PRESENT' ? Number(m.obtained_marks) : null,
        attendance_status: m.attendance_status,
        remarks: m.remarks || null,
        status: 'ENTERED',
        created_by: actorUserId,
        updated_by: actorUserId,
      });
    }

    return this.repo.upsertMarks(schoolId, marksToSave);
  }

  // ======================================================================
  // 6. Dynamic Result Calculation & Publication
  // ======================================================================
  async calculateResults(
    schoolId: string,
    params: {
      examId: string;
      academicSessionId: string;
      locationId?: string;
      classId: string;
      sectionId?: string;
    }
  ): Promise<ExamResult[]> {
    // 1. Authoritative Student Enrollments
    const enrollments = await academicRepository.findEnrollments(schoolId, {
      sessionId: params.academicSessionId,
      locationId: params.locationId,
      classId: params.classId,
      sectionId: params.sectionId,
      status: 'ENROLLED',
    });

    if (enrollments.length === 0) return [];

    // 2. Applicable Exam Structure
    const structures = await this.repo.findStructures(schoolId, {
      examId: params.examId,
      classId: params.classId,
      sectionId: params.sectionId,
    });

    let structureSubjects = structures.flatMap((s) => s.subjects || []);
    const gradeRules = await this.repo.findGradeRules(schoolId);

    // 3. Existing Marks
    const marks = await this.repo.findMarks(schoolId, {
      examId: params.examId,
      classId: params.classId,
      sectionId: params.sectionId,
    });

    // Fallback: If no structure subjects defined, extract from existing marks or schedules
    if (structureSubjects.length === 0) {
      const uniqueSubjMap = new Map<string, { maximum_marks: number; passing_marks: number; subject?: any }>();
      for (const m of marks) {
        if (!uniqueSubjMap.has(m.subject_id)) {
          uniqueSubjMap.set(m.subject_id, {
            maximum_marks: m.maximum_marks || 100,
            passing_marks: m.passing_marks || 33,
            subject: m.subject,
          });
        }
      }
      if (uniqueSubjMap.size === 0) {
        const schedules = await this.repo.findSchedules(schoolId, {
          examId: params.examId,
          classId: params.classId,
          sectionId: params.sectionId,
        });
        for (const sch of schedules) {
          if (!uniqueSubjMap.has(sch.subject_id)) {
            uniqueSubjMap.set(sch.subject_id, {
              maximum_marks: sch.maximum_marks || 100,
              passing_marks: 33,
              subject: sch.subject,
            });
          }
        }
      }
      structureSubjects = Array.from(uniqueSubjMap.entries()).map(([subId, data]) => ({
        id: '',
        school_id: schoolId,
        exam_structure_id: '',
        subject_id: subId,
        maximum_marks: data.maximum_marks,
        passing_marks: data.passing_marks,
        grade_applicable: true,
        weightage: 100,
        subject: data.subject,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    }

    const marksByStudent = new Map<string, ExamMark[]>();
    for (const m of marks) {
      const arr = marksByStudent.get(m.student_user_id) || [];
      arr.push(m);
      marksByStudent.set(m.student_user_id, arr);
    }

    // 4. Calculate for each enrolled student
    const calculatedResults: ExamResult[] = [];

    for (const enr of enrollments) {
      const studentMarks = marksByStudent.get(enr.student_user_id) || [];
      let totalObtained = 0;
      let totalMax = 0;
      let hasFailSubject = false;
      let hasAbsent = false;
      let allAbsent = studentMarks.length > 0;

      const details: ExamResultDetail[] = [];

      for (const subj of structureSubjects) {
        const mark = studentMarks.find((m) => m.subject_id === subj.subject_id);
        const subMax = subj.maximum_marks;
        const subPass = subj.passing_marks;

        totalMax += subMax;

        let subObtained: number | null = null;
        let subGrade = 'F';
        let isPass = false;
        let attStatus: 'PRESENT' | 'ABSENT' | 'EXEMPT' = mark ? mark.attendance_status : 'PRESENT';

        if (mark && mark.attendance_status === 'PRESENT' && mark.obtained_marks !== null && mark.obtained_marks !== undefined) {
          subObtained = mark.obtained_marks;
          totalObtained += subObtained;
          allAbsent = false;

          const pct = (subObtained / subMax) * 100;
          const matched = gradeRules.find((g) => pct >= g.min_percentage && pct <= g.max_percentage);
          subGrade = matched ? matched.grade_name : 'F';
          isPass = subObtained >= subPass;
          if (!isPass) hasFailSubject = true;
        } else if (mark && mark.attendance_status === 'ABSENT') {
          hasAbsent = true;
          hasFailSubject = true;
          subGrade = 'ABS';
          isPass = false;
        } else {
          // Not entered yet
          hasFailSubject = true;
          allAbsent = false;
        }

        details.push({
          id: '',
          school_id: schoolId,
          exam_result_id: '',
          subject_id: subj.subject_id,
          subject_name: subj.subject?.name || 'Subject',
          maximum_marks: subMax,
          passing_marks: subPass,
          obtained_marks: subObtained,
          attendance_status: attStatus,
          grade: subGrade,
          is_pass: isPass,
          created_at: new Date().toISOString(),
        });
      }

      const overallPct = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
      const matchedOverall = gradeRules.find((g) => overallPct >= g.min_percentage && overallPct <= g.max_percentage);
      const overallGrade = matchedOverall ? matchedOverall.grade_name : 'F';

      let resultStatus: 'PASS' | 'FAIL' | 'ABSENT' | 'WITHHELD' = 'PASS';
      if (allAbsent) {
        resultStatus = 'ABSENT';
      } else if (hasFailSubject || hasAbsent) {
        resultStatus = 'FAIL';
      }

      calculatedResults.push({
        id: crypto.randomUUID(),
        school_id: schoolId,
        exam_id: params.examId,
        academic_session_id: params.academicSessionId,
        location_id: enr.location_id,
        class_id: enr.class_id,
        section_id: enr.section_id,
        student_user_id: enr.student_user_id,
        total_obtained_marks: totalObtained,
        total_maximum_marks: totalMax,
        percentage: overallPct,
        grade: overallGrade,
        result_status: resultStatus,
        status: 'DRAFT',
        details,
        student: enr.student,
        admission_number: enr.admission_number,
        roll_number: enr.roll_number || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return calculatedResults;
  }

  async publishResults(
    schoolId: string,
    params: {
      examId: string;
      academicSessionId: string;
      locationId?: string;
      classId: string;
      sectionId?: string;
    },
    actorUserId?: string
  ): Promise<ExamResult[]> {
    const calculated = await this.calculateResults(schoolId, params);
    if (calculated.length === 0) {
      throw new Error('No enrolled students found to publish results.');
    }

    const now = new Date().toISOString();
    const payloads = calculated.map((res) => ({
      result: {
        ...res,
        status: 'PUBLISHED' as const,
        published_at: now,
        published_by: actorUserId,
      },
      details: res.details || [],
    }));

    const saved = await this.repo.saveResults(schoolId, payloads);

    // Auto-transition exam status to PUBLISHED upon publishing results
    try {
      await this.repo.updateExam(schoolId, params.examId, {
        status: 'PUBLISHED',
        updated_by: actorUserId,
      });
    } catch (err) {
      console.warn('[ExamsService] Note: Could not update exam status to PUBLISHED:', err);
    }

    return saved;
  }

  // ======================================================================
  // 7. Report Card Data Generation
  // ======================================================================
  async getReportCard(schoolId: string, examId: string, studentUserId: string) {
    const exam = await this.getExamById(schoolId, examId);
    const school = await schoolRepository.findById(schoolId);

    // Retrieve results
    const results = await this.repo.findResults(schoolId, { examId, studentUserId });
    let result = results[0];

    // If not published yet, calculate dynamically
    if (!result) {
      const enrollments = await academicRepository.findEnrollments(schoolId, {
        studentId: studentUserId,
        status: 'ENROLLED',
      });
      if (enrollments.length === 0) throw new Error('Student has no active academic enrollment.');
      const enr = enrollments[0];

      const calc = await this.calculateResults(schoolId, {
        examId,
        academicSessionId: enr.academic_session_id,
        locationId: enr.location_id,
        classId: enr.class_id,
        sectionId: enr.section_id,
      });

      result = calc.find((c) => c.student_user_id === studentUserId)!;
    }

    if (!result) throw new Error('Result could not be generated for this student.');

    const location = result.location_id ? await locationRepository.findById(result.location_id) : null;
    const isPublished = result.status === 'PUBLISHED';

    return {
      school: {
        name: school?.school_name || 'Delhi Public Academy',
        school_code: school?.school_code || 'DPA',
        address: school?.address || 'Dwarka Sector 12, New Delhi, 110078',
        email: school?.email || 'contact@delhipublicacademy.edu.in',
        phone: school?.phone || '+91 11 2805 1200',
      },
      location: location ? { name: location.location_name, code: location.location_code } : null,
      exam: {
        id: exam.id,
        name: exam.exam_name,
        code: exam.exam_code,
        type: exam.exam_type,
        session_name: exam.session?.name || '2026-27',
        status: exam.status,
      },
      student: {
        id: result.student_user_id,
        full_name: result.student
          ? `${result.student.first_name} ${result.student.last_name || ''}`.trim()
          : 'Student',
        admission_number: result.admission_number,
        roll_number: result.roll_number,
        class_name: result.class?.display_name || result.class?.name || 'Class 10',
        section_name: result.section?.name ? `Section ${result.section.name}` : 'Section A',
      },
      summary: {
        total_obtained: result.total_obtained_marks,
        total_maximum: result.total_maximum_marks,
        percentage: result.percentage,
        grade: result.grade,
        result_status: result.result_status,
        status: result.status,
        is_published: isPublished,
        published_at: result.published_at,
      },
      subjects: result.details || [],
      is_published: isPublished,
      generated_at: new Date().toISOString(),
    };
  }

  // ======================================================================
  // 8. Reports & Dashboard
  // ======================================================================
  async getDashboard(schoolId: string, filters?: { academicSessionId?: string; locationId?: string }) {
    return this.repo.getDashboardStats(schoolId, filters);
  }

  async getSubjectPerformanceReport(
    schoolId: string,
    params: { examId: string; classId: string; sectionId?: string }
  ) {
    const marks = await this.repo.findMarks(schoolId, {
      examId: params.examId,
      classId: params.classId,
      sectionId: params.sectionId,
    });

    const bySubject = new Map<string, ExamMark[]>();
    for (const m of marks) {
      const arr = bySubject.get(m.subject_id) || [];
      arr.push(m);
      bySubject.set(m.subject_id, arr);
    }

    const report: any[] = [];
    for (const [subjId, mList] of bySubject.entries()) {
      const subjName = mList[0]?.subject?.name || 'Subject';
      const appeared = mList.filter((m) => m.attendance_status === 'PRESENT' && m.obtained_marks !== null);
      const absent = mList.filter((m) => m.attendance_status === 'ABSENT');
      const scores = appeared.map((m) => Number(m.obtained_marks));

      const avg = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0;
      const highest = scores.length > 0 ? Math.max(...scores) : 0;
      const lowest = scores.length > 0 ? Math.min(...scores) : 0;
      const pass = appeared.filter((m) => Number(m.obtained_marks) >= Number(m.passing_marks)).length;
      const fail = appeared.length - pass;

      report.push({
        subject_id: subjId,
        subject_name: subjName,
        total_students: mList.length,
        appeared: appeared.length,
        absent: absent.length,
        average_score: avg,
        highest_score: highest,
        lowest_score: lowest,
        passed_count: pass,
        failed_count: fail,
        pass_percentage: appeared.length > 0 ? Number(((pass / appeared.length) * 100).toFixed(1)) : 0,
      });
    }

    return report;
  }

  async getMarksEntryStatusReport(
    schoolId: string,
    params: { examId: string; academicSessionId: string; classId: string; sectionId?: string }
  ) {
    const structures = await this.repo.findStructures(schoolId, {
      examId: params.examId,
      classId: params.classId,
      sectionId: params.sectionId,
    });
    const structureSubjects = structures.flatMap((s) => s.subjects || []);

    const enrollments = await academicRepository.findEnrollments(schoolId, {
      sessionId: params.academicSessionId,
      classId: params.classId,
      sectionId: params.sectionId,
      status: 'ENROLLED',
    });
    const totalStudents = enrollments.length;

    const report: any[] = [];
    for (const sub of structureSubjects) {
      const marks = await this.repo.findMarks(schoolId, {
        examId: params.examId,
        classId: params.classId,
        sectionId: params.sectionId,
        subjectId: sub.subject_id,
      });

      const entered = marks.length;
      const pending = Math.max(0, totalStudents - entered);

      report.push({
        subject_id: sub.subject_id,
        subject_name: sub.subject?.name || 'Subject',
        maximum_marks: sub.maximum_marks,
        total_students: totalStudents,
        entered_count: entered,
        pending_count: pending,
        completion_percentage: totalStudents > 0 ? Number(((entered / totalStudents) * 100).toFixed(1)) : 0,
      });
    }

    return report;
  }
}

export const examsService = new ExamsService();
