// ========================================================================
// Communication REST API Routes
// Multi-tenant endpoints for Communication Dashboard, Composer,
// Audience Resolution, Publishing, Delivery Reports, Inbox & Templates
// ========================================================================

import { Router, Request, Response } from 'express';
import { communicationService } from '../services/communication.service.js';
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

function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val || '');
}

// ------------------------------------------------------------------------
// 1. Dashboard Stats
// ------------------------------------------------------------------------
router.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { locationId } = req.query;
    const stats = await communicationService.getDashboardStats(
      schoolId,
      locationId ? String(locationId) : undefined
    );
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 2. Audience Preview
// ------------------------------------------------------------------------
router.post('/preview-audience', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { audience_type, audience_filters } = req.body;
    const result = await communicationService.previewAudience(schoolId, audience_type, audience_filters);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 3. Communications Listing & Filter
// ------------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const {
      academicSessionId,
      locationId,
      communicationType,
      status,
      audienceType,
      search,
      startDate,
      endDate,
      page,
      pageSize,
    } = req.query;

    const result = await communicationService.getCommunications(
      schoolId,
      {
        academicSessionId: academicSessionId ? String(academicSessionId) : undefined,
        locationId: locationId ? String(locationId) : undefined,
        communicationType: communicationType ? String(communicationType) : undefined,
        status: status ? String(status) : undefined,
        audienceType: audienceType ? String(audienceType) : undefined,
        search: search ? String(search) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
      },
      page ? parseInt(String(page), 10) : 1,
      pageSize ? parseInt(String(pageSize), 10) : 20
    );

    res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 4. Single Communication
// ------------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const comm = await communicationService.getCommunicationById(schoolId, getParam(req, 'id'));
    res.json({ success: true, data: comm });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 5. Draft Save / Update / Delete
// ------------------------------------------------------------------------
router.post('/draft', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const draft = await communicationService.saveDraft(schoolId, actorId, req.body);
    res.status(201).json({ success: true, data: draft });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.put('/:id/draft', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const draft = await communicationService.saveDraft(schoolId, actorId, {
      ...req.body,
      id: getParam(req, 'id'),
    });
    res.json({ success: true, data: draft });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.delete('/:id/draft', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    await communicationService.deleteDraft(schoolId, getParam(req, 'id'));
    res.json({ success: true, message: 'Draft communication deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 6. Publishing & Scheduling Actions
// ------------------------------------------------------------------------
router.post('/publish', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const result = await communicationService.publishCommunication(schoolId, actorId, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const result = await communicationService.scheduleCommunication(schoolId, actorId, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const result = await communicationService.cancelCommunication(schoolId, actorId, getParam(req, 'id'));
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const result = await communicationService.duplicateCommunication(schoolId, actorId, getParam(req, 'id'));
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 7. Delivery Reports
// ------------------------------------------------------------------------
router.get('/:id/delivery-report', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const report = await communicationService.getDeliveryReport(schoolId, getParam(req, 'id'));
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 8. Recipient Inbox & Interaction (IN_APP)
// ------------------------------------------------------------------------
router.get('/inbox/me', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const { readStatus, acknowledgementStatus, page, pageSize } = req.query;

    const result = await communicationService.getUserInbox(schoolId, actorId, {
      readStatus: readStatus ? String(readStatus) : undefined,
      acknowledgementStatus: acknowledgementStatus ? String(acknowledgementStatus) : undefined,
      page: page ? parseInt(String(page), 10) : 1,
      pageSize: pageSize ? parseInt(String(pageSize), 10) : 20,
    });

    res.json({
      success: true,
      data: result.inbox,
      total: result.total,
      unreadCount: result.unreadCount,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/inbox/:recipientId/read', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const result = await communicationService.markRead(schoolId, getParam(req, 'recipientId'), actorId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/inbox/:recipientId/acknowledge', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const result = await communicationService.acknowledge(schoolId, getParam(req, 'recipientId'), actorId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 9. Templates CRUD
// ------------------------------------------------------------------------
router.get('/templates/list', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const { communicationType, status, search } = req.query;
    const templates = await communicationService.getTemplates(schoolId, {
      communicationType: communicationType ? String(communicationType) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
    });
    res.json({ success: true, data: templates });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/templates', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const template = await communicationService.createTemplate(schoolId, actorId, req.body);
    res.status(201).json({ success: true, data: template });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const actorId = getUserId(req);
    const template = await communicationService.updateTemplate(schoolId, getParam(req, 'id'), actorId, req.body);
    res.json({ success: true, data: template });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    await communicationService.deleteTemplate(schoolId, getParam(req, 'id'));
    res.json({ success: true, message: 'Template removed successfully.' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// 10. Communication Gateways (SMS & Email Providers)
// ------------------------------------------------------------------------
router.get('/gateways/status', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const status = communicationService.getGatewayStatus(schoolId);
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/gateways/config', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const status = communicationService.configureGateway(schoolId, req.body);
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

router.post('/gateways/test', async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const result = await communicationService.testGateway(schoolId, req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

export default router;
