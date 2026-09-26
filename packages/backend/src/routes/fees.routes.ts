// ========================================================================
// Fees Management REST API Routes
// Endpoints for Fee Heads, Fee Structures, Demands, Collection, Receipts,
// Refunds, Student Ledger, and Analytics / Reports.
// ========================================================================

import { Router, Request, Response } from 'express';
import { feesService } from '../services/fees.service.js';
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
// 1. Fee Heads Master
// ------------------------------------------------------------------------
router.get('/heads', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { category, status, search } = req.query;
    const heads = await feesService.getHeads(schoolId, {
      category: category ? String(category) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
    });
    res.json({ success: true, data: heads });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to fetch fee heads' } });
  }
});

router.get('/heads/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const head = await feesService.getHeadById(schoolId, String(req.params.id));
    res.json({ success: true, data: head });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message || 'Fee head not found' } });
  }
});

router.post('/heads', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const created = await feesService.createHead(schoolId, req.body, userId);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to create fee head' } });
  }
});

router.put('/heads/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const updated = await feesService.updateHead(schoolId, String(req.params.id), req.body, userId);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to update fee head' } });
  }
});

router.delete('/heads/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    await feesService.deleteHead(schoolId, String(req.params.id));
    res.json({ success: true, message: 'Fee head deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to delete fee head' } });
  }
});

// ------------------------------------------------------------------------
// 2. Fee Structures Master
// ------------------------------------------------------------------------
router.get('/structures', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { academicSessionId, locationId, classId, sectionId, feeHeadId, status, exactSection } = req.query;
    const structures = await feesService.getStructures(schoolId, {
      academicSessionId: academicSessionId ? String(academicSessionId) : undefined,
      locationId: locationId ? String(locationId) : undefined,
      classId: classId ? String(classId) : undefined,
      sectionId: sectionId ? String(sectionId) : undefined,
      exactSection: exactSection === 'true',
      feeHeadId: feeHeadId ? String(feeHeadId) : undefined,
      status: status ? String(status) : undefined,
    });
    res.json({ success: true, data: structures });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to fetch fee structures' } });
  }
});

router.get('/structures/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const structure = await feesService.getStructureById(schoolId, String(req.params.id));
    res.json({ success: true, data: structure });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message || 'Fee structure not found' } });
  }
});

router.post('/structures', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const created = await feesService.createStructure(schoolId, req.body, userId);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to create fee structure' } });
  }
});

router.put('/structures/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const updated = await feesService.updateStructure(schoolId, String(req.params.id), req.body, userId);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to update fee structure' } });
  }
});

router.delete('/structures/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    await feesService.deleteStructure(schoolId, String(req.params.id));
    res.json({ success: true, message: 'Fee structure deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to delete fee structure' } });
  }
});

// ------------------------------------------------------------------------
// 3. Demands (Receivables)
// ------------------------------------------------------------------------
router.get('/demands', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentUserId, academicSessionId, locationId, classId, sectionId, feeHeadId, status, startDate, endDate } = req.query;
    const demands = await feesService.getDemands(schoolId, {
      studentUserId: studentUserId ? String(studentUserId) : undefined,
      academicSessionId: academicSessionId ? String(academicSessionId) : undefined,
      locationId: locationId ? String(locationId) : undefined,
      classId: classId ? String(classId) : undefined,
      sectionId: sectionId ? String(sectionId) : undefined,
      feeHeadId: feeHeadId ? String(feeHeadId) : undefined,
      status: status ? String(status) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });
    res.json({ success: true, data: demands });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to fetch fee demands' } });
  }
});

router.post('/demands/generate', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const result = await feesService.generateDemands(schoolId, req.body, userId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to generate fee demands' } });
  }
});

router.get('/demands/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const demand = await feesService.getDemandById(schoolId, String(req.params.id));
    res.json({ success: true, data: demand });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message || 'Fee demand not found' } });
  }
});

router.post('/demands/:id/cancel', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const { reason } = req.body;
    const updated = await feesService.cancelDemand(schoolId, String(req.params.id), reason, userId);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to cancel fee demand' } });
  }
});

router.post('/demands/:id/adjustments', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const result = await feesService.applyAdjustment(schoolId, { ...req.body, demand_id: String(req.params.id) }, userId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to apply adjustment' } });
  }
});

// ------------------------------------------------------------------------
// 4. Collections & Payments
// ------------------------------------------------------------------------
router.get('/payments', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentUserId, academicSessionId, locationId, paymentMode, status, startDate, endDate } = req.query;
    const payments = await feesService.getPayments(schoolId, {
      studentUserId: studentUserId ? String(studentUserId) : undefined,
      academicSessionId: academicSessionId ? String(academicSessionId) : undefined,
      locationId: locationId ? String(locationId) : undefined,
      paymentMode: paymentMode ? String(paymentMode) : undefined,
      status: status ? String(status) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });
    res.json({ success: true, data: payments });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to fetch payments' } });
  }
});

router.post('/payments', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const result = await feesService.collectPayment(schoolId, req.body, userId);
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Payment collection failed' } });
  }
});

router.get('/payments/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const payment = await feesService.getPaymentById(schoolId, String(req.params.id));
    res.json({ success: true, data: payment });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message || 'Payment not found' } });
  }
});

// ------------------------------------------------------------------------
// 5. Receipts (Vouchers)
// ------------------------------------------------------------------------
router.get('/receipts', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { studentUserId, academicSessionId, locationId, startDate, endDate, search } = req.query;
    const receipts = await feesService.getReceipts(schoolId, {
      studentUserId: studentUserId ? String(studentUserId) : undefined,
      academicSessionId: academicSessionId ? String(academicSessionId) : undefined,
      locationId: locationId ? String(locationId) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      search: search ? String(search) : undefined,
    });
    res.json({ success: true, data: receipts });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to fetch receipts' } });
  }
});

router.get('/receipts/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const receipt = await feesService.getReceiptById(schoolId, String(req.params.id));
    res.json({ success: true, data: receipt });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message || 'Receipt not found' } });
  }
});

// ------------------------------------------------------------------------
// 6. Refunds
// ------------------------------------------------------------------------
router.get('/refunds', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { paymentId, studentUserId, startDate, endDate } = req.query;
    const refunds = await feesService.getRefunds(schoolId, {
      paymentId: paymentId ? String(paymentId) : undefined,
      studentUserId: studentUserId ? String(studentUserId) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });
    res.json({ success: true, data: refunds });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to fetch refunds' } });
  }
});

router.post('/refunds', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const result = await feesService.processRefund(schoolId, req.body, userId);
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Refund processing failed' } });
  }
});

// ------------------------------------------------------------------------
// 7. Student Ledger
// ------------------------------------------------------------------------
router.get('/ledger/:studentUserId', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const ledger = await feesService.getStudentLedger(schoolId, String(req.params.studentUserId));
    res.json({ success: true, data: ledger });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to fetch student ledger' } });
  }
});

// ------------------------------------------------------------------------
// 8. Executive Dashboard & Reports
// ------------------------------------------------------------------------
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { academicSessionId, locationId } = req.query;
    const metrics = await feesService.getDashboardMetrics(
      schoolId,
      academicSessionId ? String(academicSessionId) : undefined,
      locationId ? String(locationId) : undefined
    );
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to fetch dashboard metrics' } });
  }
});

router.get('/reports/:reportType', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const reportType = String(req.params.reportType);
    const { academicSessionId, locationId, classId, startDate, endDate } = req.query;
    const report = await feesService.getReports(schoolId, reportType, {
      academicSessionId: academicSessionId ? String(academicSessionId) : undefined,
      locationId: locationId ? String(locationId) : undefined,
      classId: classId ? String(classId) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message || 'Failed to generate report' } });
  }
});

export default router;
