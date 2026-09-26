// ========================================================================
// Timetable Domain Service
// Authoritative Student Timetable Service
// Dynamic period generation, versioned snapshot scheduling,
// and cross-validation against Teacher Subject Assignments and Academic Offerings.
// ========================================================================

import { randomUUID } from 'crypto';
import { getMemoryDbClient } from '../db/client.js';
import { timetableRepository } from '../repositories/timetable.repository.js';
import { academicRepository } from '../repositories/academic.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { locationRepository } from '../repositories/location.repository.js';
import { accessControlRepository } from '../repositories/access-control.repository.js';
import {
  TimetableMaster,
  TimetableDetail,
  GeneratedPeriod,
  TimetableConfigInput,
  TimetableCellAssignmentInput,
  TimetableCellRemoveInput,
  School,
  Location,
  AcademicSession,
} from '../types/index.js';

export class TimetableService {
  private mem = getMemoryDbClient();

  // ----------------------------------------------------------------------
  // 1. Dynamic Period Generation Engine
  // ----------------------------------------------------------------------

  parseTimeToMinutes(timeStr: string): number {
    if (!timeStr || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) {
      throw new Error(`Invalid time format "${timeStr}". Expected HH:MM in 24-hour format.`);
    }
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  minutesToTimeString(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  calculateDynamicPeriods(
    firstStart: string,
    lastEnd: string,
    durationMinutes: number,
    lunchStart: string,
    lunchEnd: string
  ): GeneratedPeriod[] {
    const startM = this.parseTimeToMinutes(firstStart);
    const endM = this.parseTimeToMinutes(lastEnd);
    const lunchStartM = this.parseTimeToMinutes(lunchStart);
    const lunchEndM = this.parseTimeToMinutes(lunchEnd);

    if (durationMinutes < 15 || durationMinutes > 180) {
      throw new Error(`Period duration must be between 15 and 180 minutes. Got ${durationMinutes}.`);
    }

    if (startM >= endM) {
      throw new Error(`First period start time (${firstStart}) must be before last period end time (${lastEnd}).`);
    }

    if (lunchStartM >= lunchEndM) {
      throw new Error(`Lunch start time (${lunchStart}) must be before lunch end time (${lunchEnd}).`);
    }

    if (lunchStartM <= startM || lunchEndM >= endM) {
      throw new Error(`Lunch window (${lunchStart} - ${lunchEnd}) must be strictly within the school day (${firstStart} - ${lastEnd}).`);
    }

    const periods: GeneratedPeriod[] = [];
    let curr = startM;
    let periodOrdinal = 1;

    // 1. Periods before Lunch
    while (curr < lunchStartM) {
      const next = curr + durationMinutes;
      if (next > lunchStartM) {
        throw new Error(
          `Teaching period starting at ${this.minutesToTimeString(curr)} with duration ${durationMinutes}m overshoots lunch start (${lunchStart}). Please adjust timings so periods align cleanly with lunch.`
        );
      }
      periods.push({
        period_no: periodOrdinal++,
        start_time: this.minutesToTimeString(curr),
        end_time: this.minutesToTimeString(next),
        is_lunch: false,
        label: `Period ${periodOrdinal - 1}`,
      });
      curr = next;
    }

    // 2. Lunch Break
    periods.push({
      period_no: periodOrdinal++,
      start_time: lunchStart,
      end_time: lunchEnd,
      is_lunch: true,
      label: 'Lunch Break',
    });
    curr = lunchEndM;

    // 3. Periods after Lunch
    let postLunchPeriodNumber = periodOrdinal - 1; // logical teaching period count
    while (curr < endM) {
      const next = curr + durationMinutes;
      if (next > endM) {
        throw new Error(
          `Teaching period starting at ${this.minutesToTimeString(curr)} with duration ${durationMinutes}m overshoots last period end time (${lastEnd}). Please adjust timings so periods align cleanly with day end.`
        );
      }
      periods.push({
        period_no: periodOrdinal++,
        start_time: this.minutesToTimeString(curr),
        end_time: this.minutesToTimeString(next),
        is_lunch: false,
        label: `Period ${postLunchPeriodNumber++}`,
      });
      curr = next;
    }

    return periods;
  }

  previewPeriods(config: {
    first_period_start_time: string;
    last_period_end_time: string;
    period_duration_minutes: number;
    lunch_start_time: string;
    lunch_end_time: string;
  }): GeneratedPeriod[] {
    return this.calculateDynamicPeriods(
      config.first_period_start_time,
      config.last_period_end_time,
      Number(config.period_duration_minutes),
      config.lunch_start_time,
      config.lunch_end_time
    );
  }

  // ----------------------------------------------------------------------
  // 2. Timetable Identifier Generation
  // ----------------------------------------------------------------------

  private buildTimetableId(
    schoolCode: string,
    locationCode: string,
    sessionCode: string,
    versionNo: number
  ): string {
    const clean = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
    const sc = clean(schoolCode) || 'SCH';
    const lc = clean(locationCode) || 'MAIN';
    const yc = clean(sessionCode) || 'AY';
    const ver = `V${String(versionNo).padStart(3, '0')}`;
    return `TT-${sc}-${lc}-${yc}-${ver}`;
  }

  // ----------------------------------------------------------------------
  // 3. Timetable Configuration & Master Versioning
  // ----------------------------------------------------------------------

  async saveConfiguration(
    schoolId: string,
    input: TimetableConfigInput,
    actorContext: { user_id?: string; [key: string]: any }
  ): Promise<{ master: TimetableMaster; periods: GeneratedPeriod[] }> {
    // 1. Verify session and location
    const session = await academicRepository.findSessionById(input.academic_session_id, schoolId);
    if (!session) {
      throw new Error(`Academic session ${input.academic_session_id} not found for this school.`);
    }

    const location = this.mem.findById('locations', input.location_id) as Location | null;
    if (!location || location.school_id !== schoolId) {
      throw new Error(`Location ${input.location_id} not found for this school.`);
    }

    const school = this.mem.findById('schools', schoolId) as School | null;
    const schoolCode = school?.school_code || 'SCH';
    const locationCode = location.location_code || 'LOC';
    const sessionCode = session.code || 'AY';

    // 2. Validate working days and canonicalize order
    const STANDARD_WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
    if (!Array.isArray(input.working_days) || input.working_days.length === 0) {
      throw new Error('At least one working day must be selected.');
    }
    for (const d of input.working_days) {
      const match = STANDARD_WEEK_DAYS.find((swd) => swd.toLowerCase() === d.trim().toLowerCase());
      if (!match) {
        throw new Error(`Invalid working day "${d}". Valid days are: ${STANDARD_WEEK_DAYS.join(', ')}`);
      }
    }

    // Standard chronological week ordering
    const normalizedWorkingDays = STANDARD_WEEK_DAYS.filter((swd) =>
      input.working_days.some((d) => d.trim().toLowerCase() === swd.toLowerCase())
    );

    // 3. Validate timing and calculate periods
    const periods = this.calculateDynamicPeriods(
      input.first_period_start_time,
      input.last_period_end_time,
      Number(input.period_duration_minutes),
      input.lunch_start_time,
      input.lunch_end_time
    );

    // 4. Determine next version number
    const nextVersionNo = await timetableRepository.getNextVersionNo(
      schoolId,
      input.academic_session_id,
      input.location_id
    );

    const timetableId = this.buildTimetableId(schoolCode, locationCode, sessionCode, nextVersionNo);

    // 5. Look for previous active master
    const prevActive = await timetableRepository.findActiveMaster(
      schoolId,
      input.academic_session_id,
      input.location_id
    );

    // 6. Archive existing active versions
    await timetableRepository.archiveAllActiveVersions(
      schoolId,
      input.academic_session_id,
      input.location_id
    );

    const now = new Date().toISOString();
    const newMaster: TimetableMaster = {
      id: randomUUID(),
      timetable_id: timetableId,
      school_id: schoolId,
      academic_session_id: input.academic_session_id,
      location_id: input.location_id,
      version_no: nextVersionNo,
      working_days: normalizedWorkingDays,
      first_period_start_time: input.first_period_start_time,
      last_period_end_time: input.last_period_end_time,
      period_duration_minutes: Number(input.period_duration_minutes),
      lunch_start_time: input.lunch_start_time,
      lunch_end_time: input.lunch_end_time,
      status: 'ACTIVE',
      effective_from: input.effective_from || null,
      effective_to: input.effective_to || null,
      created_by: actorContext.user_id || null,
      updated_by: actorContext.user_id || null,
      created_at: now,
      updated_at: now,
    };

    const savedMaster = await timetableRepository.createMaster(newMaster);

    // 7. If previous active master had details, copy details that still fit in the new timetable structure
    if (prevActive) {
      const prevDetails = await timetableRepository.findDetails(prevActive.id, schoolId);
      const validPeriodNumbers = new Set(periods.filter((p) => !p.is_lunch).map((p) => p.period_no));
      const validDaysSet = new Set(normalizedWorkingDays.map((d) => d.toLowerCase()));

      const compatibleDetails: TimetableDetail[] = [];
      for (const d of prevDetails) {
        if (validDaysSet.has(d.day_of_week.toLowerCase()) && validPeriodNumbers.has(d.period_no)) {
          const matchedPeriod = periods.find((p) => p.period_no === d.period_no);
          const canonicalDay = STANDARD_WEEK_DAYS.find((swd) => swd.toLowerCase() === d.day_of_week.toLowerCase()) || d.day_of_week;
          compatibleDetails.push({
            ...d,
            id: randomUUID(),
            timetable_detail_id: `TTD-${randomUUID().slice(0, 8).toUpperCase()}`,
            timetable_master_id: savedMaster.id,
            timetable_id: timetableId,
            school_id: schoolId,
            academic_session_id: input.academic_session_id,
            location_id: input.location_id,
            day_of_week: canonicalDay,
            start_time: matchedPeriod?.start_time || d.start_time,
            end_time: matchedPeriod?.end_time || d.end_time,
            created_at: now,
            updated_at: now,
          });
        }
      }

      if (compatibleDetails.length > 0) {
        await timetableRepository.createDetails(compatibleDetails);
      }
    }

    return { master: savedMaster, periods };
  }

  // ----------------------------------------------------------------------
  // 4. Queries & Version History
  // ----------------------------------------------------------------------

  async getActiveTimetable(
    schoolId: string,
    sessionId: string,
    locationId: string,
    filters?: { classId?: string; sectionId?: string }
  ): Promise<{ master: TimetableMaster | null; periods: GeneratedPeriod[]; details: TimetableDetail[] }> {
    const master = await timetableRepository.findActiveMaster(schoolId, sessionId, locationId);
    if (!master) {
      return { master: null, periods: [], details: [] };
    }

    const periods = this.calculateDynamicPeriods(
      master.first_period_start_time,
      master.last_period_end_time,
      master.period_duration_minutes,
      master.lunch_start_time,
      master.lunch_end_time
    );

    const details = await timetableRepository.findDetails(master.id, schoolId, filters);
    return { master, periods, details };
  }

  async getTimetableVersion(
    schoolId: string,
    masterId: string,
    filters?: { classId?: string; sectionId?: string }
  ): Promise<{ master: TimetableMaster; periods: GeneratedPeriod[]; details: TimetableDetail[] }> {
    const master = await timetableRepository.findMasterById(masterId, schoolId);
    if (!master) {
      throw new Error(`Timetable version ${masterId} not found`);
    }

    const periods = this.calculateDynamicPeriods(
      master.first_period_start_time,
      master.last_period_end_time,
      master.period_duration_minutes,
      master.lunch_start_time,
      master.lunch_end_time
    );

    const details = await timetableRepository.findDetails(master.id, schoolId, filters);
    return { master, periods, details };
  }

  async listVersionHistory(
    schoolId: string,
    sessionId: string,
    locationId: string
  ): Promise<TimetableMaster[]> {
    return timetableRepository.listMasterVersions(schoolId, sessionId, locationId);
  }

  // ----------------------------------------------------------------------
  // 4b. Teacher Timetable (Authoritative Schedule Filtered by Teacher ID)
  // ----------------------------------------------------------------------
  async getTeacherSchedule(
    schoolId: string,
    userContext: {
      user_id: string;
      school_id: string | null;
      is_super_admin?: boolean;
      is_school_super_admin?: boolean;
      permissions?: Array<{ code: string }>;
      permitted_location_ids?: string[];
      primary_location_id?: string;
      [key: string]: any;
    },
    options?: {
      sessionId?: string;
      locationId?: string;
      teacherId?: string;
    }
  ): Promise<{
    master: TimetableMaster | null;
    periods: GeneratedPeriod[];
    details: TimetableDetail[];
    working_days: string[];
    teacher: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      employee_code?: string;
      designation?: string;
    };
    session: AcademicSession | null;
    location: Location | null;
    authorized_locations: Location[];
    sessions: AcademicSession[];
  }> {
    // 1. Resolve target teacher ID
    let targetTeacherId = userContext.user_id;
    if (options?.teacherId && options.teacherId !== userContext.user_id) {
      const canManage =
        userContext.is_super_admin ||
        userContext.is_school_super_admin ||
        userContext.permissions?.some(
          (p) =>
            p.code === 'academics.manage' ||
            p.code === 'teacher_assignments.manage' ||
            p.code === 'timetable.manage' ||
            p.code === 'users.manage'
        );

      if (canManage) {
        targetTeacherId = options.teacherId;
      } else {
        throw new Error('Access denied: You are not authorized to view schedules of other teachers.');
      }
    }

    // 2. Fetch target teacher record
    const teacherUser = await userRepository.findById(targetTeacherId, schoolId);
    if (!teacherUser) {
      throw new Error(`Teacher with ID ${targetTeacherId} not found in this school.`);
    }

    // 3. Resolve Academic Sessions
    const allSessions = await academicRepository.findSessions(schoolId, { includeInactive: true });
    let targetSession: AcademicSession | null = null;
    if (options?.sessionId) {
      targetSession = allSessions.find((s) => s.id === options.sessionId) || null;
      if (!targetSession) {
        throw new Error(`Academic session ${options.sessionId} not found.`);
      }
    } else {
      targetSession = allSessions.find((s) => s.is_current) || allSessions[0] || null;
    }

    if (!targetSession) {
      throw new Error('No academic sessions available for this school.');
    }

    // 4. Resolve Authorized Locations
    const allLocations = await locationRepository.findBySchoolId(schoolId);
    let authorizedLocations: Location[] = [];

    if (userContext.is_super_admin) {
      authorizedLocations = allLocations;
    } else if (targetTeacherId !== userContext.user_id) {
      const targetLocAccess = await accessControlRepository.getUserLocationAccess(targetTeacherId);
      const targetLocIds = targetLocAccess.map((la) => la.location_id);
      authorizedLocations = allLocations.filter((l) => targetLocIds.includes(l.id));
      if (authorizedLocations.length === 0) {
        authorizedLocations = allLocations;
      }
    } else {
      const permittedIds = userContext.permitted_location_ids || [];
      authorizedLocations = allLocations.filter((l) => permittedIds.includes(l.id));
      if (authorizedLocations.length === 0) {
        authorizedLocations = allLocations;
      }
    }

    // 5. Resolve Target Location
    let targetLocation: Location | null = null;
    if (options?.locationId) {
      targetLocation = authorizedLocations.find((l) => l.id === options.locationId) || null;
      if (!targetLocation) {
        throw new Error(`Location ${options.locationId} is not accessible for this teacher.`);
      }
    } else {
      targetLocation =
        (userContext.primary_location_id
          ? authorizedLocations.find((l) => l.id === userContext.primary_location_id)
          : null) ||
        authorizedLocations[0] ||
        null;
    }

    if (!targetLocation) {
      throw new Error('No accessible campus branch location found for this school.');
    }

    const teacherInfo = {
      id: teacherUser.id,
      first_name: teacherUser.first_name,
      last_name: teacherUser.last_name || '',
      email: teacherUser.email,
      employee_code: teacherUser.staff_profile?.employee_code,
      designation: teacherUser.designation?.name || teacherUser.staff_profile?.designation?.name,
    };

    // 6. Resolve Active Timetable Master
    const master = await timetableRepository.findActiveMaster(schoolId, targetSession.id, targetLocation.id);
    if (!master) {
      return {
        master: null,
        periods: [],
        details: [],
        working_days: [],
        teacher: teacherInfo,
        session: targetSession,
        location: targetLocation,
        authorized_locations: authorizedLocations,
        sessions: allSessions,
      };
    }

    // 7. Calculate dynamic periods from master
    const periods = this.calculateDynamicPeriods(
      master.first_period_start_time,
      master.last_period_end_time,
      master.period_duration_minutes,
      master.lunch_start_time,
      master.lunch_end_time
    );

    // 8. Fetch timetable details filtered strictly by teacherId
    const details = await timetableRepository.findDetails(master.id, schoolId, {
      teacherId: targetTeacherId,
    });

    return {
      master,
      periods,
      details,
      working_days: master.working_days,
      teacher: teacherInfo,
      session: targetSession,
      location: targetLocation,
      authorized_locations: authorizedLocations,
      sessions: allSessions,
    };
  }

  // ----------------------------------------------------------------------
  // 5. Assignment & Snapshot Cell Operations
  // ----------------------------------------------------------------------

  async assignCell(
    schoolId: string,
    masterId: string,
    input: TimetableCellAssignmentInput,
    actorContext: { user_id?: string; [key: string]: any }
  ): Promise<{ master: TimetableMaster; periods: GeneratedPeriod[]; details: TimetableDetail[] }> {
    // 1. Fetch current master
    const master = await timetableRepository.findMasterById(masterId, schoolId);
    if (!master) {
      throw new Error(`Timetable master ${masterId} not found`);
    }

    // 2. Validate day of week
    const workingDaysUpper = master.working_days.map((d) => d.toUpperCase());
    if (!workingDaysUpper.includes(input.day_of_week.toUpperCase())) {
      throw new Error(`Day "${input.day_of_week}" is not a configured working day for this timetable.`);
    }

    // Normalize day of week casing to match master
    const matchedDay = master.working_days.find((d) => d.toUpperCase() === input.day_of_week.toUpperCase())!;

    // 3. Validate period
    const periods = this.calculateDynamicPeriods(
      master.first_period_start_time,
      master.last_period_end_time,
      master.period_duration_minutes,
      master.lunch_start_time,
      master.lunch_end_time
    );

    const period = periods.find((p) => p.period_no === input.period_no);
    if (!period) {
      throw new Error(`Period ${input.period_no} does not exist in this timetable schedule.`);
    }
    if (period.is_lunch) {
      throw new Error('Cannot assign a teaching class or teacher during the lunch break.');
    }

    // 4. Validate Class & Section
    const classRow = await academicRepository.findClassById(input.class_id, schoolId);
    if (!classRow) {
      throw new Error(`Class ${input.class_id} not found.`);
    }
    const sectionRow = await academicRepository.findSectionById(input.section_id, schoolId);
    if (!sectionRow) {
      throw new Error(`Section ${input.section_id} not found.`);
    }

    // 5. Validate Subject Offering (Must be assigned to Class in this Session)
    const classSubjects = await academicRepository.findClassSubjects(
      schoolId,
      master.academic_session_id,
      input.class_id
    );
    const subjectOffered = classSubjects.find((cs) => cs.subject_id === input.subject_id);
    if (!subjectOffered) {
      throw new Error(`Subject is not offered for ${classRow.name} in this academic session.`);
    }

    // 6. Validate Teacher Subject Assignment
    // Must be assigned to teach this class + section + subject in this session + location
    const teacherAssignments = await academicRepository.findTeacherAssignments(schoolId, {
      sessionId: master.academic_session_id,
      locationId: master.location_id,
      classId: input.class_id,
      sectionId: input.section_id,
      subjectId: input.subject_id,
      teacherId: input.teacher_id,
      status: 'ACTIVE',
    });

    if (!teacherAssignments.length) {
      throw new Error(
        `Selected teacher is not assigned to teach this subject for ${classRow.name} - ${sectionRow.name} in this session and branch.`
      );
    }

    // 7. Load all current details from existing master
    const currentDetails = await timetableRepository.findDetails(master.id, schoolId);

    // 8. Conflict Check: Teacher Double-Booking
    // Check if the teacher is already assigned to a DIFFERENT class/section in the same day and period
    const teacherConflict = currentDetails.find((d) => {
      if (d.day_of_week.toLowerCase() !== matchedDay.toLowerCase()) return false;
      if (d.period_no !== input.period_no) return false;
      if (d.teacher_id !== input.teacher_id) return false;
      // If it's the exact same cell being overwritten/updated, it's allowed
      if (d.class_id === input.class_id && d.section_id === input.section_id) return false;
      return true;
    });

    if (teacherConflict) {
      throw new Error(
        `Teacher Conflict: ${teacherConflict.teacher_name || 'This teacher'} is already booked for ${teacherConflict.class_name || 'another class'} - ${teacherConflict.section_name || ''} on ${matchedDay} during Period ${input.period_no} (${period.start_time} - ${period.end_time}).`
      );
    }

    // 9. Build NEW TIMETABLE VERSION (Snapshot copy)
    const nextVersionNo = await timetableRepository.getNextVersionNo(
      schoolId,
      master.academic_session_id,
      master.location_id
    );

    const school = this.mem.findById('schools', schoolId) as School | null;
    const location = this.mem.findById('locations', master.location_id) as Location | null;
    const session = this.mem.findById('academic_sessions', master.academic_session_id) as AcademicSession | null;

    const newTimetableId = this.buildTimetableId(
      school?.school_code || 'SCH',
      location?.location_code || 'LOC',
      session?.code || 'AY',
      nextVersionNo
    );

    const now = new Date().toISOString();
    const newMasterId = randomUUID();

    const newMaster: TimetableMaster = {
      ...master,
      id: newMasterId,
      timetable_id: newTimetableId,
      version_no: nextVersionNo,
      status: 'ACTIVE',
      created_by: actorContext.user_id || master.created_by,
      updated_by: actorContext.user_id || master.updated_by,
      created_at: now,
      updated_at: now,
    };

    // 10. Replicate snapshot: clone existing details except the target cell
    const clonedDetails: TimetableDetail[] = [];
    for (const d of currentDetails) {
      const isTargetCell =
        d.day_of_week.toLowerCase() === matchedDay.toLowerCase() &&
        d.period_no === input.period_no &&
        d.class_id === input.class_id &&
        d.section_id === input.section_id;

      if (!isTargetCell) {
        clonedDetails.push({
          ...d,
          id: randomUUID(),
          timetable_detail_id: `TTD-${randomUUID().slice(0, 8).toUpperCase()}`,
          timetable_master_id: newMasterId,
          timetable_id: newTimetableId,
          created_at: now,
          updated_at: now,
        });
      }
    }

    // 11. Add the newly assigned cell
    const newDetail: TimetableDetail = {
      id: randomUUID(),
      timetable_detail_id: `TTD-${randomUUID().slice(0, 8).toUpperCase()}`,
      timetable_master_id: newMasterId,
      timetable_id: newTimetableId,
      school_id: schoolId,
      academic_session_id: master.academic_session_id,
      location_id: master.location_id,
      day_of_week: matchedDay,
      period_no: input.period_no,
      start_time: period.start_time,
      end_time: period.end_time,
      class_id: input.class_id,
      section_id: input.section_id,
      subject_id: input.subject_id,
      teacher_id: input.teacher_id,
      room_id: input.room_id || null,
      remarks: input.remarks || null,
      is_free_period: false,
      is_lunch: false,
      created_by: actorContext.user_id || null,
      updated_by: actorContext.user_id || null,
      created_at: now,
      updated_at: now,
    };
    clonedDetails.push(newDetail);

    // 12. Archive old active versions and save new master + details
    await timetableRepository.archiveAllActiveVersions(
      schoolId,
      master.academic_session_id,
      master.location_id
    );

    const savedMaster = await timetableRepository.createMaster(newMaster);
    await timetableRepository.createDetails(clonedDetails);

    const savedDetails = await timetableRepository.findDetails(savedMaster.id, schoolId);
    return { master: savedMaster, periods, details: savedDetails };
  }

  async removeCell(
    schoolId: string,
    masterId: string,
    input: TimetableCellRemoveInput,
    actorContext: { user_id?: string; [key: string]: any }
  ): Promise<{ master: TimetableMaster; periods: GeneratedPeriod[]; details: TimetableDetail[] }> {
    const master = await timetableRepository.findMasterById(masterId, schoolId);
    if (!master) {
      throw new Error(`Timetable master ${masterId} not found`);
    }

    const currentDetails = await timetableRepository.findDetails(master.id, schoolId);
    const target = currentDetails.find(
      (d) =>
        d.day_of_week.toLowerCase() === input.day_of_week.toLowerCase() &&
        d.period_no === input.period_no &&
        d.class_id === input.class_id &&
        d.section_id === input.section_id
    );

    if (!target) {
      throw new Error('No assignment found in this cell to remove.');
    }

    // Build NEW VERSION
    const nextVersionNo = await timetableRepository.getNextVersionNo(
      schoolId,
      master.academic_session_id,
      master.location_id
    );

    const school = this.mem.findById('schools', schoolId) as School | null;
    const location = this.mem.findById('locations', master.location_id) as Location | null;
    const session = this.mem.findById('academic_sessions', master.academic_session_id) as AcademicSession | null;

    const newTimetableId = this.buildTimetableId(
      school?.school_code || 'SCH',
      location?.location_code || 'LOC',
      session?.code || 'AY',
      nextVersionNo
    );

    const now = new Date().toISOString();
    const newMasterId = randomUUID();

    const newMaster: TimetableMaster = {
      ...master,
      id: newMasterId,
      timetable_id: newTimetableId,
      version_no: nextVersionNo,
      status: 'ACTIVE',
      created_by: actorContext.user_id || master.created_by,
      updated_by: actorContext.user_id || master.updated_by,
      created_at: now,
      updated_at: now,
    };

    const clonedDetails: TimetableDetail[] = [];
    for (const d of currentDetails) {
      const isTargetCell =
        d.day_of_week.toLowerCase() === input.day_of_week.toLowerCase() &&
        d.period_no === input.period_no &&
        d.class_id === input.class_id &&
        d.section_id === input.section_id;

      if (!isTargetCell) {
        clonedDetails.push({
          ...d,
          id: randomUUID(),
          timetable_detail_id: `TTD-${randomUUID().slice(0, 8).toUpperCase()}`,
          timetable_master_id: newMasterId,
          timetable_id: newTimetableId,
          created_at: now,
          updated_at: now,
        });
      }
    }

    await timetableRepository.archiveAllActiveVersions(
      schoolId,
      master.academic_session_id,
      master.location_id
    );

    const savedMaster = await timetableRepository.createMaster(newMaster);
    if (clonedDetails.length > 0) {
      await timetableRepository.createDetails(clonedDetails);
    }

    const periods = this.calculateDynamicPeriods(
      savedMaster.first_period_start_time,
      savedMaster.last_period_end_time,
      savedMaster.period_duration_minutes,
      savedMaster.lunch_start_time,
      savedMaster.lunch_end_time
    );

    const savedDetails = await timetableRepository.findDetails(savedMaster.id, schoolId);
    return { master: savedMaster, periods, details: savedDetails };
  }

  async activateVersion(
    schoolId: string,
    masterId: string,
    actorContext: { user_id?: string; [key: string]: any }
  ): Promise<TimetableMaster> {
    const master = await timetableRepository.findMasterById(masterId, schoolId);
    if (!master) {
      throw new Error(`Timetable version ${masterId} not found`);
    }

    await timetableRepository.archiveAllActiveVersions(
      schoolId,
      master.academic_session_id,
      master.location_id,
      master.id
    );

    return timetableRepository.updateMaster(master.id, {
      status: 'ACTIVE',
      updated_by: actorContext.user_id || null,
    });
  }
}

export const timetableService = new TimetableService();
