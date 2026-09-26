// ========================================================================
// Timetable REST API Routes
// Endpoints for Student Timetable Configuration, Dynamic Periods,
// Version Snapshots, Cell Assignments, and Conflict Validations.
// ========================================================================

import { Router, Request, Response } from 'express';
import { timetableService } from '../services/timetable.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';

const router = Router();

// Standard authentication & tenant isolation boundaries
router.use(authMiddleware);
router.use(tenantIsolationMiddleware);

function getSchoolId(req: Request): string {
  return (req.userContext?.school_id || req.params.schoolId || req.query.schoolId || req.body?.school_id) as string;
}

function param(p: string | string[] | undefined): string {
  if (Array.isArray(p)) return p[0];
  return p || '';
}

// ------------------------------------------------------------------------
// 1. Dynamic Period Preview (Non-persisted calculation)
// ------------------------------------------------------------------------
router.get('/preview-periods', async (req: Request, res: Response) => {
  try {
    const {
      first_period_start_time,
      last_period_end_time,
      period_duration_minutes,
      lunch_start_time,
      lunch_end_time,
    } = req.query;

    if (
      !first_period_start_time ||
      !last_period_end_time ||
      !period_duration_minutes ||
      !lunch_start_time ||
      !lunch_end_time
    ) {
      return res.status(400).json({
        success: false,
        error: { message: 'All timing parameters (first_period_start_time, last_period_end_time, period_duration_minutes, lunch_start_time, lunch_end_time) are required.' },
      });
    }

    const periods = timetableService.previewPeriods({
      first_period_start_time: String(first_period_start_time),
      last_period_end_time: String(last_period_end_time),
      period_duration_minutes: Number(period_duration_minutes),
      lunch_start_time: String(lunch_start_time),
      lunch_end_time: String(lunch_end_time),
    });

    res.json({ success: true, data: periods });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 2. Timetable Configuration (Save / Create New Version)
// ------------------------------------------------------------------------
router.post('/config', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const result = await timetableService.saveConfiguration(schoolId, req.body, req.userContext || {});
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 3. Active Timetable
// ------------------------------------------------------------------------
router.get('/active', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const sessionId = (req.query.sessionId || req.query.session_id) as string;
    const locationId = (req.query.locationId || req.query.location_id) as string;
    const classId = (req.query.classId || req.query.class_id) as string | undefined;
    const sectionId = (req.query.sectionId || req.query.section_id) as string | undefined;

    if (!sessionId || !locationId) {
      return res.status(400).json({
        success: false,
        error: { message: 'sessionId and locationId query parameters are required.' },
      });
    }

    const result = await timetableService.getActiveTimetable(schoolId, sessionId, locationId, {
      classId,
      sectionId,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 3b. Teacher's My Schedule (Derived from Active Timetable + Teacher ID)
// ------------------------------------------------------------------------
router.get('/my-schedule', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const sessionId = (req.query.sessionId || req.query.session_id) as string | undefined;
    const locationId = (req.query.locationId || req.query.location_id) as string | undefined;
    const teacherId = (req.query.teacherId || req.query.teacher_id) as string | undefined;

    const result = await timetableService.getTeacherSchedule(schoolId, req.userContext || ({} as any), {
      sessionId,
      locationId,
      teacherId,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 4. Version History
// ------------------------------------------------------------------------
router.get('/history', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const sessionId = (req.query.sessionId || req.query.session_id) as string;
    const locationId = (req.query.locationId || req.query.location_id) as string;

    if (!sessionId || !locationId) {
      return res.status(400).json({
        success: false,
        error: { message: 'sessionId and locationId query parameters are required.' },
      });
    }

    const history = await timetableService.listVersionHistory(schoolId, sessionId, locationId);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 5. Single Version by ID
// ------------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const classId = (req.query.classId || req.query.class_id) as string | undefined;
    const sectionId = (req.query.sectionId || req.query.section_id) as string | undefined;

    const result = await timetableService.getTimetableVersion(schoolId, param(req.params.id), {
      classId,
      sectionId,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 6. Assign Cell (Produces New Timetable Version Snapshot)
// ------------------------------------------------------------------------
router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const result = await timetableService.assignCell(
      schoolId,
      param(req.params.id),
      req.body,
      req.userContext || {}
    );
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    const status = err.message?.includes('Conflict') || err.message?.includes('already') ? 409 : 400;
    res.status(status).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 7. Remove Cell (Produces New Timetable Version Snapshot)
// ------------------------------------------------------------------------
router.post('/:id/remove-cell', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const result = await timetableService.removeCell(
      schoolId,
      param(req.params.id),
      req.body,
      req.userContext || {}
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 8. Activate Version
// ------------------------------------------------------------------------
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const result = await timetableService.activateVersion(
      schoolId,
      param(req.params.id),
      req.userContext || {}
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

export default router;
