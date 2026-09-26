// ========================================================================
// Academic REST API Routes
// Endpoints for Academic Sessions, Classes, Sections, Subjects, Groups,
// Offerings, Student Academic Enrollments, and Teacher Allocations.
// Governed strictly by Dynamic RBAC, Data Scopes, and Tenant Isolation.
// ========================================================================

import { Router, Request, Response } from 'express';
import { academicService } from '../services/academic.service.js';
import { timetableService } from '../services/timetable.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';

const router = Router();

// Apply authentication and tenant boundary check across all academic routes
router.use(authMiddleware);
router.use(tenantIsolationMiddleware);

// Helper to extract schoolId
function getSchoolId(req: Request): string {
  return (req.userContext?.school_id || req.params.schoolId || req.query.schoolId || req.body?.school_id) as string;
}

function param(p: string | string[] | undefined): string {
  if (Array.isArray(p)) return p[0];
  return p || '';
}

// ------------------------------------------------------------------------
// 1. Academic Sessions
// ------------------------------------------------------------------------
router.get(
  '/sessions',
  requirePermission('academic_sessions.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const includeInactive = req.query.includeInactive === 'true';
      const sessions = await academicService.listSessions(schoolId, { includeInactive });
      res.json({ success: true, data: sessions });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.get(
  '/sessions/current',
  requirePermission('academic_sessions.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const session = await academicService.getCurrentSession(schoolId);
      res.json({ success: true, data: session });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/sessions',
  requirePermission('academic_sessions.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const session = await academicService.createSession(schoolId, req.body, req.userContext!);
      res.status(201).json({ success: true, data: session });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.put(
  '/sessions/:id',
  requirePermission('academic_sessions.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const updated = await academicService.updateSession(schoolId, param(req.params.id), req.body, req.userContext!);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/sessions/:id/set-current',
  requirePermission('academic_sessions.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const updated = await academicService.setCurrentSession(schoolId, param(req.params.id), req.userContext!);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.delete(
  '/sessions/:id',
  requirePermission('academic_sessions.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      await academicService.deleteSession(schoolId, param(req.params.id), req.userContext!);
      res.json({ success: true, message: 'Academic session deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ------------------------------------------------------------------------
// 2. Classes Master
// ------------------------------------------------------------------------
router.get(
  '/classes',
  requirePermission('classes.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const includeInactive = req.query.includeInactive === 'true';
      const list = await academicService.listClasses(schoolId, { includeInactive });
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/classes',
  requirePermission('classes.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const cls = await academicService.createClass(schoolId, req.body, req.userContext!);
      res.status(201).json({ success: true, data: cls });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.put(
  '/classes/:id',
  requirePermission('classes.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const updated = await academicService.updateClass(schoolId, param(req.params.id), req.body, req.userContext!);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/classes/reorder',
  requirePermission('classes.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      await academicService.reorderClasses(schoolId, req.body.orderedIds, req.userContext!);
      res.json({ success: true, message: 'Classes reordered successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.delete(
  '/classes/:id',
  requirePermission('classes.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      await academicService.deleteClass(schoolId, param(req.params.id), req.userContext!);
      res.json({ success: true, message: 'Class deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ------------------------------------------------------------------------
// 3. Sections Master
// ------------------------------------------------------------------------
router.get(
  '/sections',
  requirePermission('sections.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const includeInactive = req.query.includeInactive === 'true';
      const list = await academicService.listSections(schoolId, { includeInactive });
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/sections',
  requirePermission('sections.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const sec = await academicService.createSection(schoolId, req.body, req.userContext!);
      res.status(201).json({ success: true, data: sec });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.put(
  '/sections/:id',
  requirePermission('sections.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const updated = await academicService.updateSection(schoolId, param(req.params.id), req.body, req.userContext!);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.delete(
  '/sections/:id',
  requirePermission('sections.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      await academicService.deleteSection(schoolId, param(req.params.id), req.userContext!);
      res.json({ success: true, message: 'Section deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ------------------------------------------------------------------------
// 4. Academic Class-Section Offerings
// ------------------------------------------------------------------------
router.get(
  '/class-sections',
  requirePermission('classes.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const sessionId = req.query.sessionId as string;
      const classId = req.query.classId as string | undefined;
      if (!sessionId) {
        res.status(400).json({ success: false, error: { message: 'sessionId is required' } });
        return;
      }
      const list = await academicService.listClassSections(schoolId, sessionId, classId);
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/class-sections',
  requirePermission('classes.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const created = await academicService.createClassSection(schoolId, req.body, req.userContext!);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.delete(
  '/class-sections/:id',
  requirePermission('classes.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      await academicService.deleteClassSection(schoolId, param(req.params.id), req.userContext!);
      res.json({ success: true, message: 'Class-section offering removed' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ------------------------------------------------------------------------
// 5. Subjects Master
// ------------------------------------------------------------------------
router.get(
  '/subjects',
  requirePermission('subjects.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const includeInactive = req.query.includeInactive === 'true';
      const list = await academicService.listSubjects(schoolId, { includeInactive });
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/subjects',
  requirePermission('subjects.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const subj = await academicService.createSubject(schoolId, req.body, req.userContext!);
      res.status(201).json({ success: true, data: subj });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.put(
  '/subjects/:id',
  requirePermission('subjects.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const updated = await academicService.updateSubject(schoolId, param(req.params.id), req.body, req.userContext!);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.delete(
  '/subjects/:id',
  requirePermission('subjects.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      await academicService.deleteSubject(schoolId, param(req.params.id), req.userContext!);
      res.json({ success: true, message: 'Subject deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ------------------------------------------------------------------------
// 6. Subject Groups Master
// ------------------------------------------------------------------------
router.get(
  '/subject-groups',
  requirePermission('subject_groups.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const list = await academicService.listSubjectGroups(schoolId);
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/subject-groups',
  requirePermission('subject_groups.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const subjectIds = req.body.subject_ids || [];
      const grp = await academicService.createSubjectGroup(schoolId, req.body, subjectIds, req.userContext!);
      res.status(201).json({ success: true, data: grp });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.put(
  '/subject-groups/:id',
  requirePermission('subject_groups.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const subjectIds = req.body.subject_ids;
      const updated = await academicService.updateSubjectGroup(schoolId, param(req.params.id), req.body, subjectIds, req.userContext!);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.delete(
  '/subject-groups/:id',
  requirePermission('subject_groups.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      await academicService.deleteSubjectGroup(schoolId, param(req.params.id), req.userContext!);
      res.json({ success: true, message: 'Subject group deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ------------------------------------------------------------------------
// 7. Academic Class Subjects (Subject Offerings per Class)
// ------------------------------------------------------------------------
router.get(
  '/class-subjects',
  requirePermission('subjects.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const sessionId = req.query.sessionId as string;
      const classId = req.query.classId as string | undefined;
      if (!sessionId) {
        res.status(400).json({ success: false, error: { message: 'sessionId is required' } });
        return;
      }
      const list = await academicService.listClassSubjects(schoolId, sessionId, classId);
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/class-subjects',
  requirePermission('class_subjects.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const created = await academicService.createClassSubject(schoolId, req.body, req.userContext!);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.delete(
  '/class-subjects/:id',
  requirePermission('class_subjects.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      await academicService.deleteClassSubject(schoolId, param(req.params.id), req.userContext!);
      res.json({ success: true, message: 'Class subject offering deleted successfully' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ------------------------------------------------------------------------
// 8. Student Academic Enrollments (Assignments & History)
// ------------------------------------------------------------------------
router.get(
  '/student-enrollments',
  requirePermission('users.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const filters = {
        sessionId: req.query.sessionId as string | undefined,
        locationId: req.query.locationId as string | undefined,
        classId: req.query.classId as string | undefined,
        sectionId: req.query.sectionId as string | undefined,
        studentId: req.query.studentId as string | undefined,
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
      };
      const list = await academicService.listStudentEnrollments(schoolId, filters, req.userContext!);
      res.json({ success: true, data: list });
    } catch (err: any) {
      const status = err.message?.includes('Data Scope Violation') ? 403 : 400;
      res.status(status).json({ success: false, error: { message: err.message } });
    }
  }
);

router.get(
  '/student-enrollments/available',
  requirePermission(['students.class_assign', 'users.view']),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const sessionId = req.query.sessionId as string;
      const locationId = req.query.locationId as string;
      const classId = req.query.classId as string;
      const sectionId = req.query.sectionId as string;
      const search = req.query.search as string | undefined;

      if (!sessionId || !locationId || !classId || !sectionId) {
        res.status(400).json({
          success: false,
          error: { message: 'sessionId, locationId, classId, and sectionId are required' },
        });
        return;
      }

      const available = await academicService.getAvailableStudentsForEnrollment(
        schoolId,
        { sessionId, locationId, classId, sectionId, search },
        req.userContext!
      );
      res.json({ success: true, data: available });
    } catch (err: any) {
      const status = err.message?.includes('Permission Denied') ? 403 : 400;
      res.status(status).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/student-enrollments/:id/end',
  requirePermission('students.class_assign'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const reason = (req.body?.reason as string) || 'Enrollment ended by administrator';
      const result = await academicService.endStudentEnrollment(
        schoolId,
        param(req.params.id),
        reason,
        req.userContext!
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      const status = err.message?.includes('Permission Denied') ? 403 : 400;
      res.status(status).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/student-enrollments',
  requirePermission('students.class_assign'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const enrollment = await academicService.assignStudentToClass(schoolId, req.body, req.userContext!);
      res.status(201).json({ success: true, data: enrollment });
    } catch (err: any) {
      const status = err.message?.includes('Permission Denied') || err.message?.includes('Data Scope Violation') ? 403 : 400;
      res.status(status).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/student-enrollments/bulk',
  requirePermission('students.class_assign'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const result = await academicService.bulkAssignStudents(schoolId, req.body, req.userContext!);
      res.json({ success: true, data: result });
    } catch (err: any) {
      const status = err.message?.includes('Permission Denied') || err.message?.includes('Data Scope Violation') ? 403 : 400;
      res.status(status).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/student-enrollments/:id/transfer',
  requirePermission('students.class_assign'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const updated = await academicService.transferStudentSection(schoolId, param(req.params.id), req.body, req.userContext!);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      const status = err.message?.includes('Permission Denied') ? 403 : 400;
      res.status(status).json({ success: false, error: { message: err.message } });
    }
  }
);

router.get(
  '/student-enrollments/student/:studentId/history',
  requirePermission('users.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const history = await academicService.getStudentAcademicHistory(schoolId, param(req.params.studentId), req.userContext!);
      res.json({ success: true, data: history });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ------------------------------------------------------------------------
// 9. Teacher Subject Assignments
// ------------------------------------------------------------------------
router.get(
  '/teacher-assignments',
  requirePermission('teacher_assignments.view'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const filters = {
        sessionId: req.query.sessionId as string | undefined,
        locationId: req.query.locationId as string | undefined,
        classId: req.query.classId as string | undefined,
        sectionId: req.query.sectionId as string | undefined,
        subjectId: req.query.subjectId as string | undefined,
        teacherId: req.query.teacherId as string | undefined,
        status: req.query.status as string | undefined,
      };
      const list = await academicService.listTeacherAssignments(schoolId, filters, req.userContext!);
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

router.post(
  '/teacher-assignments',
  requirePermission('teacher_assignments.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const assignment = await academicService.assignTeacher(schoolId, req.body, req.userContext!);
      res.status(201).json({ success: true, data: assignment });
    } catch (err: any) {
      const status = err.message?.includes('Permission Denied') || err.message?.includes('Data Scope Violation') ? 403 : 400;
      res.status(status).json({ success: false, error: { message: err.message } });
    }
  }
);

router.delete(
  '/teacher-assignments/:id',
  requirePermission('teacher_assignments.manage'),
  async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      await academicService.deactivateTeacherAssignment(schoolId, param(req.params.id), req.userContext!);
      res.json({ success: true, message: 'Teacher unassigned successfully' });
    } catch (err: any) {
      const status = err.message?.includes('Permission Denied') ? 403 : 400;
      res.status(status).json({ success: false, error: { message: err.message } });
    }
  }
);

// Teacher's Personal View (Any authenticated teacher can see their own responsibilities)
router.get(
  '/my-teaching-responsibilities',
  async (req: Request, res: Response) => {
    try {
      const teacherUserId = req.userContext!.user_id;
      const sessionId = req.query.sessionId as string | undefined;
      const list = await academicService.getMyTeachingResponsibilities(teacherUserId, sessionId);
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// Teacher's Timetable Schedule (Authoritative schedule derived from Timetable Master + Details)
router.get(
  '/my-teaching-schedule',
  async (req: Request, res: Response) => {
    try {
      const schoolId = req.userContext!.school_id || (req.query.schoolId as string);
      const sessionId = req.query.sessionId as string | undefined;
      const locationId = req.query.locationId as string | undefined;
      const teacherId = req.query.teacherId as string | undefined;

      const result = await timetableService.getTeacherSchedule(schoolId, req.userContext || ({} as any), {
        sessionId,
        locationId,
        teacherId,
      });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

export default router;
