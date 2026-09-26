// ========================================================================
// Exams & Results REST API Routes
// Complete Endpoints for Examination Management, Timetable Scheduling,
// Marks Entry, Result Calculation, Publication Snapshots & Analytics
// ========================================================================

import { Router, Request, Response } from 'express';
import { examsService } from '../services/exams.service.js';
import { examsRepository } from '../repositories/exams.repository.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';

const router = Router();

// Multi-tenant isolation & authentication
router.use(authMiddleware);
router.use(tenantIsolationMiddleware);

function getSchoolId(req: Request): string {
  return (req.userContext?.school_id || req.params.schoolId || req.query.schoolId || req.body?.school_id) as string;
}

function getUserId(req: Request): string {
  return req.userContext?.user_id as string;
}

// ------------------------------------------------------------------------
// 1. Exam Master
// ------------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { academicSessionId, status, search } = req.query;
    const exams = await examsService.listExams(schoolId, {
      academicSessionId: academicSessionId ? String(academicSessionId) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
    });
    res.json({ success: true, data: exams });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const exam = await examsService.createExam(schoolId, req.body, actorId);
    res.status(201).json({ success: true, data: exam });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 2. Exam Structures
// ------------------------------------------------------------------------
router.get('/structures/list', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { examId, academicSessionId, locationId, classId, sectionId, exactSection, status } = req.query;
    const structures = await examsService.listStructures(schoolId, {
      examId: examId ? String(examId) : undefined,
      academicSessionId: academicSessionId ? String(academicSessionId) : undefined,
      locationId: locationId ? String(locationId) : undefined,
      classId: classId ? String(classId) : undefined,
      sectionId: sectionId ? String(sectionId) : undefined,
      exactSection: exactSection === 'true',
      status: status ? String(status) : undefined,
    });
    res.json({ success: true, data: structures });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/structures', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const struct = await examsService.createStructure(schoolId, req.body, actorId);
    res.status(201).json({ success: true, data: struct });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.put('/structures/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const struct = await examsService.updateStructure(schoolId, req.params.id as string, req.body, actorId);
    res.json({ success: true, data: struct });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.delete('/structures/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    await examsService.deleteStructure(schoolId, req.params.id as string);
    res.json({ success: true, message: 'Exam structure deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 3. Exam Schedules
// ------------------------------------------------------------------------
router.get('/schedules/list', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { examId, academicSessionId, locationId, classId, sectionId, subjectId, examDate, status } = req.query;
    const schedules = await examsService.listSchedules(schoolId, {
      examId: examId ? String(examId) : undefined,
      academicSessionId: academicSessionId ? String(academicSessionId) : undefined,
      locationId: locationId ? String(locationId) : undefined,
      classId: classId ? String(classId) : undefined,
      sectionId: sectionId ? String(sectionId) : undefined,
      subjectId: subjectId ? String(subjectId) : undefined,
      examDate: examDate ? String(examDate) : undefined,
      status: status ? String(status) : undefined,
    });
    res.json({ success: true, data: schedules });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/schedules', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const locationId = req.body.location_id || req.headers['x-branch-id'] || req.userContext?.active_location_id;
    const schedule = await examsService.createSchedule(
      schoolId,
      {
        ...req.body,
        location_id: locationId,
      },
      actorId
    );
    res.status(201).json({ success: true, data: schedule });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.put('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const schedule = await examsService.updateSchedule(schoolId, req.params.id as string, req.body, actorId);
    res.json({ success: true, data: schedule });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.delete('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    await examsService.deleteSchedule(schoolId, req.params.id as string);
    res.json({ success: true, message: 'Exam schedule deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 4. Grade Rules
// ------------------------------------------------------------------------
router.get('/grades', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const grades = await examsRepository.findGradeRules(schoolId);
    res.json({ success: true, data: grades });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 5. Marks Entry & Enrolled Roster
// ------------------------------------------------------------------------
router.get('/marks-roster', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { examId, academicSessionId, locationId, classId, sectionId, subjectId } = req.query;

    if (!examId || !academicSessionId || !classId || !subjectId) {
      res.status(400).json({
        success: false,
        error: { message: 'examId, academicSessionId, classId, and subjectId are required.' },
      });
      return;
    }

    const rosterData = await examsService.getMarksRoster(schoolId, {
      examId: String(examId),
      academicSessionId: String(academicSessionId),
      locationId: locationId ? String(locationId) : undefined,
      classId: String(classId),
      sectionId: sectionId ? String(sectionId) : undefined,
      subjectId: String(subjectId),
    });

    res.json({ success: true, data: rosterData });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/marks/bulk', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const saved = await examsService.saveMarks(schoolId, req.body, actorId);
    res.json({ success: true, data: saved, message: `Successfully saved marks for ${saved.length} students.` });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 6. Results Calculation & Publication
// ------------------------------------------------------------------------
router.get('/results', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { examId, academicSessionId, locationId, classId, sectionId, studentUserId } = req.query;

    if (!examId || !academicSessionId || !classId) {
      res.status(400).json({
        success: false,
        error: { message: 'examId, academicSessionId, and classId are required.' },
      });
      return;
    }

    // Check if published results exist first
    const published = await examsRepository.findResults(schoolId, {
      examId: String(examId),
      academicSessionId: String(academicSessionId),
      locationId: locationId ? String(locationId) : undefined,
      classId: String(classId),
      sectionId: sectionId ? String(sectionId) : undefined,
      studentUserId: studentUserId ? String(studentUserId) : undefined,
      status: 'PUBLISHED',
    });

    const isPublished = published.length > 0;
    let finalResults: any[] = [];

    if (isPublished) {
      finalResults = published;
    } else {
      // Calculate dynamically
      const results = await examsService.calculateResults(schoolId, {
        examId: String(examId),
        academicSessionId: String(academicSessionId),
        locationId: locationId ? String(locationId) : undefined,
        classId: String(classId),
        sectionId: sectionId ? String(sectionId) : undefined,
      });

      finalResults = studentUserId
        ? results.filter((r) => r.student_user_id === String(studentUserId))
        : results;
    }

    // Calculate marks completion & pending counts
    const statusReport = await examsService.getMarksEntryStatusReport(schoolId, {
      examId: String(examId),
      academicSessionId: String(academicSessionId),
      classId: String(classId),
      sectionId: sectionId ? String(sectionId) : undefined,
    }).catch(() => []);

    const totalExpected = statusReport.reduce((acc, r) => acc + (r.total_students || 0), 0);
    const totalEntered = statusReport.reduce((acc, r) => acc + (r.entered_count || 0), 0);
    const pendingMarksCount = Math.max(0, totalExpected - totalEntered);

    const totalStudents = finalResults.length;
    const passCount = finalResults.filter((r) => r.result_status === 'PASS').length;
    const failCount = finalResults.filter((r) => r.result_status === 'FAIL').length;

    res.json({
      success: true,
      data: {
        results: finalResults,
        isPublished,
        pendingMarksCount,
        totalStudents,
        passCount,
        failCount,
      },
      results: finalResults,
      isPublished,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/results/publish', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const { examId, academicSessionId, locationId, classId, sectionId } = req.body;

    if (!examId || !academicSessionId || !classId) {
      res.status(400).json({
        success: false,
        error: { message: 'examId, academicSessionId, and classId are required.' },
      });
      return;
    }

    const published = await examsService.publishResults(
      schoolId,
      {
        examId: String(examId),
        academicSessionId: String(academicSessionId),
        locationId: locationId ? String(locationId) : undefined,
        classId: String(classId),
        sectionId: sectionId ? String(sectionId) : undefined,
      },
      actorId
    );

    res.json({
      success: true,
      data: published,
      message: `Successfully published results for ${published.length} students.`,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 7. Report Card Data
// ------------------------------------------------------------------------
router.get('/report-card/:studentUserId', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { examId } = req.query;

    if (!examId) {
      res.status(400).json({ success: false, error: { message: 'examId is required.' } });
      return;
    }

    const card = await examsService.getReportCard(schoolId, String(examId), req.params.studentUserId as string);
    res.json({ success: true, data: card });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 8. Analytics & Reports
// ------------------------------------------------------------------------
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { academicSessionId, locationId } = req.query;
    const stats = await examsService.getDashboard(schoolId, {
      academicSessionId: academicSessionId ? String(academicSessionId) : undefined,
      locationId: locationId ? String(locationId) : undefined,
    });
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.get('/reports/subject-performance', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { examId, classId, sectionId } = req.query;

    if (!examId || !classId) {
      res.status(400).json({ success: false, error: { message: 'examId and classId are required.' } });
      return;
    }

    const report = await examsService.getSubjectPerformanceReport(schoolId, {
      examId: String(examId),
      classId: String(classId),
      sectionId: sectionId ? String(sectionId) : undefined,
    });

    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.get('/reports/marks-entry-status', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { examId, academicSessionId, classId, sectionId } = req.query;

    if (!examId || !academicSessionId || !classId) {
      res.status(400).json({
        success: false,
        error: { message: 'examId, academicSessionId, and classId are required.' },
      });
      return;
    }

    const report = await examsService.getMarksEntryStatusReport(schoolId, {
      examId: String(examId),
      academicSessionId: String(academicSessionId),
      classId: String(classId),
      sectionId: sectionId ? String(sectionId) : undefined,
    });

    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 8. Individual Exam CRUD by Specific UUID (Placed at bottom to prevent route shadowing)
// ------------------------------------------------------------------------
router.get('/:id([0-9a-fA-F-]{36})', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const exam = await examsService.getExamById(schoolId, req.params.id as string);
    res.json({ success: true, data: exam });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message } });
  }
});

router.put('/:id([0-9a-fA-F-]{36})', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const exam = await examsService.updateExam(schoolId, req.params.id as string, req.body, actorId);
    res.json({ success: true, data: exam });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/:id([0-9a-fA-F-]{36})/status', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ success: false, error: { message: 'Status is required.' } });
      return;
    }
    const updated = await examsService.updateExamStatus(schoolId, req.params.id as string, status, actorId);
    res.json({ success: true, data: updated, message: `Exam status successfully updated to ${status}.` });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.delete('/:id([0-9a-fA-F-]{36})', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    await examsService.deleteExam(schoolId, req.params.id as string);
    res.json({ success: true, message: 'Exam deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

export default router;
