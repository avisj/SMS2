// ========================================================================
// Configuration Routes
// Dynamic Settings, Feature Flags, and User Types
// ZERO hardcoded business configuration
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { configService } from '../services/config.service.js';
import { accessControlService } from '../services/access-control.service.js';
import { academicService } from '../services/academic.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const configRouter = Router();

configRouter.use(authMiddleware);
configRouter.use(tenantIsolationMiddleware);

// ------------------------------------------------------------------------
// Dynamic User Types
// ------------------------------------------------------------------------
configRouter.get('/user-types', async (req: Request, res: Response): Promise<void> => {
  try {
    const userTypes = await accessControlService.listUserTypes(req.userContext!);
    res.json({ success: true, data: userTypes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

configRouter.post('/user-types', requirePermission('settings.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) {
      res.status(400).json({ success: false, error: { message: 'Code and name are required' } });
      return;
    }
    const created = await accessControlService.createUserType({ code, name, description }, req.userContext!);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// School Features (Module Toggles)
// ------------------------------------------------------------------------
configRouter.get('/features', requirePermission('features.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const targetSchoolId = (req.query.school_id as string) || req.userContext!.school_id;
    if (!targetSchoolId) {
      res.status(400).json({ success: false, error: { message: 'School ID required' } });
      return;
    }
    const features = await configService.getSchoolFeatures(targetSchoolId, req.userContext!);
    res.json({ success: true, data: features });
  } catch (err: any) {
    res.status(403).json({ success: false, error: { message: err.message } });
  }
});

configRouter.put('/features/:key', requirePermission('features.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const targetSchoolId = (req.query.school_id as string) || req.userContext!.school_id;
    if (!targetSchoolId) {
      res.status(400).json({ success: false, error: { message: 'School ID required' } });
      return;
    }
    const { isEnabled, configuration } = req.body;
    const updated = await configService.updateSchoolFeature(
      targetSchoolId,
      req.params.key as string,
      !!isEnabled,
      configuration || {},
      req.userContext!
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// School Settings (Configurable Structured Settings)
// ------------------------------------------------------------------------
configRouter.get('/settings', requirePermission('settings.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const targetSchoolId = (req.query.school_id as string) || req.userContext!.school_id;
    if (!targetSchoolId) {
      res.status(400).json({ success: false, error: { message: 'School ID required' } });
      return;
    }
    const settings = await configService.getSchoolSettings(targetSchoolId, req.userContext!);
    res.json({ success: true, data: settings });
  } catch (err: any) {
    res.status(403).json({ success: false, error: { message: err.message } });
  }
});

configRouter.put('/settings/:key', requirePermission('settings.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const targetSchoolId = (req.query.school_id as string) || req.userContext!.school_id;
    if (!targetSchoolId) {
      res.status(400).json({ success: false, error: { message: 'School ID required' } });
      return;
    }
    const { value, category, dataType } = req.body;
    const updated = await configService.updateSchoolSetting(
      targetSchoolId,
      req.params.key as string,
      String(value),
      category,
      dataType,
      req.userContext!
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// Platform Master Catalog (Available Modules)
// ------------------------------------------------------------------------
configRouter.get('/platform-catalog', async (_req: Request, res: Response): Promise<void> => {
  try {
    const features = await configService.getPlatformFeatures();
    const settings = await configService.getPlatformSettings();
    res.json({ success: true, data: { features, settings } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// Automatic Academic Session Settings
// Driven strictly by start_month and end_month in school settings
// ------------------------------------------------------------------------
configRouter.get('/settings/academic-session', requirePermission('settings.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const targetSchoolId = (req.query.school_id as string) || req.userContext!.school_id;
    if (!targetSchoolId) {
      res.status(400).json({ success: false, error: { message: 'School ID required' } });
      return;
    }
    const sessionConfig = await academicService.getAcademicSessionSettings(targetSchoolId);
    res.json({ success: true, data: sessionConfig });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

configRouter.put('/settings/academic-session', requirePermission('settings.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const targetSchoolId = (req.query.school_id as string) || req.userContext!.school_id;
    if (!targetSchoolId) {
      res.status(400).json({ success: false, error: { message: 'School ID required' } });
      return;
    }
    const { start_month, end_month } = req.body;
    if (typeof start_month !== 'number' || typeof end_month !== 'number') {
      res.status(400).json({ success: false, error: { message: 'start_month and end_month numbers (1-12) are required' } });
      return;
    }
    const updated = await academicService.updateAcademicSessionSettings(
      targetSchoolId,
      { start_month, end_month },
      req.userContext!
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ------------------------------------------------------------------------
// School General & Localization Settings
// Configures Currency, Symbol, Position, Decimals, Date/Time format, Timezone, Locale
// ------------------------------------------------------------------------
configRouter.get('/settings/localization', requirePermission('settings.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const targetSchoolId = (req.query.school_id as string) || req.userContext!.school_id;
    if (!targetSchoolId) {
      res.status(400).json({ success: false, error: { message: 'School ID required' } });
      return;
    }
    const localization = await configService.getLocalizationSettings(targetSchoolId, req.userContext!);
    res.json({ success: true, data: localization });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

configRouter.put('/settings/localization', requirePermission('settings.manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const targetSchoolId = (req.query.school_id as string) || req.userContext!.school_id;
    if (!targetSchoolId) {
      res.status(400).json({ success: false, error: { message: 'School ID required' } });
      return;
    }
    const updated = await configService.updateLocalizationSettings(
      targetSchoolId,
      req.body,
      req.userContext!
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

