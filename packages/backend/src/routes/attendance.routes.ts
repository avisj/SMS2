// ========================================================================
// Attendance REST API Routes
// Endpoints for Student Attendance, Staff & Faculty Attendance,
// History, Reports, and Real-Time Summaries.
// ========================================================================

import { Router, Request, Response } from 'express';
import { attendanceService } from '../services/attendance.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { AttendanceType } from '../types/index.js';

const router = Router();

// Enforce standard authentication and multi-tenant isolation
router.use(authMiddleware);
router.use(tenantIsolationMiddleware);

function getSchoolId(req: Request): string {
  return (req.userContext?.school_id || req.params.schoolId || req.query.schoolId || req.body?.school_id) as string;
}

function getUserId(req: Request): string {
  return req.userContext?.user_id as string;
}

// ------------------------------------------------------------------------
// 1. Student Attendance Roster & Save
// ------------------------------------------------------------------------
router.get('/students', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { sessionId, locationId, classId, sectionId, date } = req.query;

    if (!sessionId || !locationId || !classId || !sectionId || !date) {
      return res.status(400).json({
        success: false,
        error: { message: 'Parameters sessionId, locationId, classId, sectionId, and date (YYYY-MM-DD) are required.' },
      });
    }

    const result = await attendanceService.getStudentAttendanceRoster(
      schoolId,
      String(sessionId),
      String(locationId),
      String(classId),
      String(sectionId),
      String(date)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Failed to fetch student attendance roster.' },
    });
  }
});

router.post('/students', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);

    const result = await attendanceService.saveStudentAttendance(schoolId, userId, req.body);
    res.json({
      success: true,
      message: `Successfully saved attendance for ${result.saved_count} students.`,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Failed to save student attendance.' },
    });
  }
});

// ------------------------------------------------------------------------
// 2. Staff & Faculty Attendance Roster & Save
// ------------------------------------------------------------------------
router.get('/staff', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { locationId, date, department } = req.query;

    if (!locationId || !date) {
      return res.status(400).json({
        success: false,
        error: { message: 'Parameters locationId and date (YYYY-MM-DD) are required.' },
      });
    }

    const result = await attendanceService.getStaffAttendanceRoster(
      schoolId,
      String(locationId),
      String(date),
      department ? String(department) : undefined
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Failed to fetch staff attendance roster.' },
    });
  }
});

router.post('/staff', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);

    const result = await attendanceService.saveStaffAttendance(schoolId, userId, req.body);
    res.json({
      success: true,
      message: `Successfully saved attendance for ${result.saved_count} staff members.`,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Failed to save staff attendance.' },
    });
  }
});

// ------------------------------------------------------------------------
// 3. Attendance History & Reports
// ------------------------------------------------------------------------
router.get('/history', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const {
      startDate,
      endDate,
      date,
      attendanceType,
      sessionId,
      locationId,
      classId,
      sectionId,
      userId,
      department,
      status,
    } = req.query;

    const result = await attendanceService.getAttendanceHistory(schoolId, {
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      date: date ? String(date) : undefined,
      attendanceType: attendanceType ? (String(attendanceType) as AttendanceType) : undefined,
      academicSessionId: sessionId ? String(sessionId) : undefined,
      locationId: locationId ? String(locationId) : undefined,
      classId: classId ? String(classId) : undefined,
      sectionId: sectionId ? String(sectionId) : undefined,
      userId: userId ? String(userId) : undefined,
      department: department ? String(department) : undefined,
      status: status ? String(status) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Failed to fetch attendance history.' },
    });
  }
});

// ------------------------------------------------------------------------
// 4. Executive Attendance Dashboard
// ------------------------------------------------------------------------
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { locationId, date, sessionId } = req.query;

    if (!locationId || !date) {
      return res.status(400).json({
        success: false,
        error: { message: 'Parameters locationId and date (YYYY-MM-DD) are required.' },
      });
    }

    const result = await attendanceService.getAttendanceDashboard(
      schoolId,
      String(locationId),
      String(date),
      sessionId ? String(sessionId) : undefined
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Failed to fetch attendance dashboard.' },
    });
  }
});

// ------------------------------------------------------------------------
// 5. Configurable Status Master
// ------------------------------------------------------------------------
router.get('/statuses', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { type } = req.query;

    const statuses = await attendanceService.getStatusMasters(
      schoolId,
      type ? (String(type) as AttendanceType) : undefined
    );

    res.json({
      success: true,
      data: statuses,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Failed to fetch attendance statuses.' },
    });
  }
});

export default router;
