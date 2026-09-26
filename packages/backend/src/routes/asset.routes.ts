// ========================================================================
// Asset Management Routes
// REST API v1 for Assets, Categories, Assignments, Movements, Maintenance,
// Disposals, and Aggregated Metrics
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { assetService } from '../services/asset.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const assetRouter = Router();

assetRouter.use(authMiddleware);
assetRouter.use(tenantIsolationMiddleware);

// Helper for single request param
function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val;
}

// ----------------------------------------------------------------------
// 1. Dashboard Metrics
// ----------------------------------------------------------------------
assetRouter.get(
  '/dashboard',
  requirePermission(['assets.dashboard.view', 'assets.master.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const metrics = await assetService.getDashboardMetrics(schoolId, locationId);
      res.json({ success: true, data: metrics });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 2. Categories & Subcategories
// ----------------------------------------------------------------------
assetRouter.get(
  '/categories',
  requirePermission(['assets.master.view', 'assets.category.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const categories = await assetService.getCategories(schoolId);
      res.json({ success: true, data: categories });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

const CreateCategorySchema = z.object({
  code: z.string().min(1, 'Category code is required'),
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

assetRouter.post(
  '/categories',
  requirePermission(['assets.category.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const validated = CreateCategorySchema.parse(req.body);
      const category = await assetService.createCategory(schoolId, validated);
      res.status(201).json({ success: true, data: category });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

assetRouter.put(
  '/categories/:id',
  requirePermission(['assets.category.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const id = getParam(req, 'id');
      const updated = await assetService.updateCategory(id, schoolId, req.body);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

assetRouter.delete(
  '/categories/:id',
  requirePermission(['assets.category.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const id = getParam(req, 'id');
      await assetService.deleteCategory(id, schoolId);
      res.json({ success: true, data: { deleted: true } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

assetRouter.get(
  '/subcategories',
  requirePermission(['assets.master.view', 'assets.category.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const categoryId = (req.query.category_id as string)?.trim() || undefined;
      const subcategories = await assetService.getSubcategories(schoolId, categoryId);
      res.json({ success: true, data: subcategories });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

const CreateSubcategorySchema = z.object({
  category_id: z.string().uuid('Valid Category ID is required'),
  code: z.string().min(1, 'Subcategory code is required'),
  name: z.string().min(1, 'Subcategory name is required'),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

assetRouter.post(
  '/subcategories',
  requirePermission(['assets.category.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const validated = CreateSubcategorySchema.parse(req.body);
      const subcategory = await assetService.createSubcategory(schoolId, validated);
      res.status(201).json({ success: true, data: subcategory });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

assetRouter.put(
  '/subcategories/:id',
  requirePermission(['assets.category.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const id = getParam(req, 'id');
      const updated = await assetService.updateSubcategory(id, schoolId, req.body);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

assetRouter.delete(
  '/subcategories/:id',
  requirePermission(['assets.category.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const id = getParam(req, 'id');
      await assetService.deleteSubcategory(id, schoolId);
      res.json({ success: true, data: { deleted: true } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 3. Asset Master CRUD
// ----------------------------------------------------------------------
assetRouter.get(
  '/assets',
  requirePermission(['assets.master.view', 'assets.dashboard.view', 'assets.reports.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        location_id: (req.query.location_id as string)?.trim() || undefined,
        category_id: (req.query.category_id as string)?.trim() || undefined,
        subcategory_id: (req.query.subcategory_id as string)?.trim() || undefined,
        status: (req.query.status as any) || undefined,
        condition: (req.query.condition as any) || undefined,
        custodian_id: (req.query.custodian_id as string)?.trim() || undefined,
        search: (req.query.search as string)?.trim() || undefined,
      };
      const assets = await assetService.getAssets(schoolId, filters);
      res.json({ success: true, data: assets });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

const CreateAssetSchema = z.object({
  asset_code: z.string().optional(),
  asset_name: z.string().min(1, 'Asset name is required'),
  category_id: z.string().uuid('Valid Category ID is required'),
  subcategory_id: z.string().uuid().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  asset_tag: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_price: z.coerce.number().min(0, 'Purchase price must be positive'),
  vendor_id: z.string().uuid().optional().nullable(),
  purchase_order_id: z.string().uuid().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  invoice_date: z.string().optional().nullable(),
  warranty_start_date: z.string().optional().nullable(),
  warranty_end_date: z.string().optional().nullable(),
  current_location_id: z.string().uuid('Valid Location is required'),
  building: z.string().optional().nullable(),
  floor: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  room_number: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  rack: z.string().optional().nullable(),
  seat_desk: z.string().optional().nullable(),
  current_custodian_user_id: z.string().uuid().optional().nullable(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'CRITICAL']).optional(),
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'UNDER_MAINTENANCE', 'DAMAGED', 'LOST', 'DISPOSED', 'RETIRED']).optional(),
  remarks: z.string().optional().nullable(),
  useful_life_years: z.coerce.number().optional().nullable(),
  salvage_value: z.coerce.number().optional().nullable(),
});

assetRouter.post(
  '/assets',
  requirePermission(['assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;
      const validated = CreateAssetSchema.parse(req.body);
      const asset = await assetService.createAsset(schoolId, {
        ...validated,
        created_by: userId,
      });
      res.status(201).json({ success: true, data: asset });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

assetRouter.get(
  '/assets/:id',
  requirePermission(['assets.master.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const id = getParam(req, 'id');
      const asset = await assetService.getAssetById(id, schoolId);
      res.json({ success: true, data: asset });
    } catch (err: any) {
      res.status(404).json({ success: false, error: { message: err.message } });
    }
  }
);

assetRouter.put(
  '/assets/:id',
  requirePermission(['assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;
      const id = getParam(req, 'id');
      const asset = await assetService.updateAsset(id, schoolId, {
        ...req.body,
        updated_by: userId,
      });
      res.json({ success: true, data: asset });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

assetRouter.delete(
  '/assets/:id',
  requirePermission(['assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const id = getParam(req, 'id');
      await assetService.deleteAsset(id, schoolId);
      res.json({ success: true, data: { deleted: true } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 4. Asset Assignments (Custody & Returns)
// ----------------------------------------------------------------------
assetRouter.get(
  '/assignments',
  requirePermission(['assets.assignment.manage', 'assets.master.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const assetId = (req.query.asset_id as string)?.trim() || undefined;
      const userId = (req.query.user_id as string)?.trim() || undefined;
      const assignments = await assetService.getAssignments(schoolId, assetId, userId);
      res.json({ success: true, data: assignments });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

const AssignAssetSchema = z.object({
  asset_id: z.string().uuid('Valid Asset ID is required'),
  assigned_to_user_id: z.string().uuid('Target user/custodian is required'),
  location_id: z.string().uuid().optional(),
  assignment_date: z.string().optional(),
  expected_return_date: z.string().optional().nullable(),
  condition_at_assignment: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'CRITICAL']).optional(),
  remarks: z.string().optional().nullable(),
});

assetRouter.post(
  '/assignments',
  requirePermission(['assets.assignment.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;
      const validated = AssignAssetSchema.parse(req.body);
      const assignment = await assetService.assignAsset(schoolId, {
        ...validated,
        assigned_by: userId,
      });
      res.status(201).json({ success: true, data: assignment });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

const ReturnAssetSchema = z.object({
  actual_return_date: z.string().optional(),
  condition_at_return: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'CRITICAL']),
  remarks: z.string().optional(),
});

assetRouter.post(
  '/assignments/:id/return',
  requirePermission(['assets.assignment.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;
      const id = getParam(req, 'id');
      const validated = ReturnAssetSchema.parse(req.body);
      const returned = await assetService.returnAsset(id, schoolId, {
        ...validated,
        returned_by: userId,
      });
      res.json({ success: true, data: returned });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 5. Asset Movements (Transfers & Relocations)
// ----------------------------------------------------------------------
assetRouter.get(
  '/movements',
  requirePermission(['assets.movement.manage', 'assets.master.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const assetId = (req.query.asset_id as string)?.trim() || undefined;
      const movements = await assetService.getMovements(schoolId, assetId);
      res.json({ success: true, data: movements });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

const TransferAssetSchema = z.object({
  asset_id: z.string().uuid('Valid Asset ID is required'),
  to_location_id: z.string().uuid('Destination Location is required'),
  to_building: z.string().optional().nullable(),
  to_room: z.string().optional().nullable(),
  to_user_id: z.string().uuid().optional().nullable(),
  movement_date: z.string().optional(),
  reason: z.string().min(1, 'Transfer reason is required'),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'CRITICAL']).optional(),
  remarks: z.string().optional().nullable(),
});

assetRouter.post(
  '/movements',
  requirePermission(['assets.movement.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;
      const validated = TransferAssetSchema.parse(req.body);
      const movement = await assetService.transferAsset(schoolId, {
        ...validated,
        moved_by: userId,
      });
      res.status(201).json({ success: true, data: movement });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 6. Asset Maintenance Lifecycle
// ----------------------------------------------------------------------
assetRouter.get(
  '/maintenance',
  requirePermission(['assets.maintenance.manage', 'assets.master.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const assetId = (req.query.asset_id as string)?.trim() || undefined;
      const status = (req.query.status as string)?.trim() || undefined;
      const records = await assetService.getMaintenanceRecords(schoolId, assetId, status);
      res.json({ success: true, data: records });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

const ScheduleMaintenanceSchema = z.object({
  asset_id: z.string().uuid('Valid Asset ID is required'),
  maintenance_type: z.string().min(1, 'Maintenance type is required'),
  service_date: z.string().optional(),
  vendor_id: z.string().uuid().optional().nullable(),
  service_provider: z.string().optional().nullable(),
  issue_description: z.string().min(1, 'Issue description is required'),
  cost: z.coerce.number().optional(),
  warranty_claim: z.boolean().optional(),
  remarks: z.string().optional().nullable(),
});

assetRouter.post(
  '/maintenance',
  requirePermission(['assets.maintenance.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;
      const validated = ScheduleMaintenanceSchema.parse(req.body);
      const maint = await assetService.scheduleMaintenance(schoolId, {
        ...validated,
        created_by: userId,
      });
      res.status(201).json({ success: true, data: maint });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

const CompleteMaintenanceSchema = z.object({
  work_performed: z.string().min(1, 'Description of work performed is required'),
  cost: z.coerce.number().optional(),
  next_service_date: z.string().optional().nullable(),
  final_condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'CRITICAL']).optional(),
  remarks: z.string().optional().nullable(),
});

assetRouter.put(
  '/maintenance/:id/complete',
  requirePermission(['assets.maintenance.manage', 'assets.master.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;
      const id = getParam(req, 'id');
      const validated = CompleteMaintenanceSchema.parse(req.body);
      const completed = await assetService.completeMaintenance(id, schoolId, {
        ...validated,
        updated_by: userId,
      });
      res.json({ success: true, data: completed });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 7. Asset Disposals & Write-Offs
// ----------------------------------------------------------------------
assetRouter.get(
  '/disposals',
  requirePermission(['assets.disposal.manage', 'assets.reports.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const disposals = await assetService.getDisposals(schoolId);
      res.json({ success: true, data: disposals });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

const DisposeAssetSchema = z.object({
  asset_id: z.string().uuid('Valid Asset ID is required'),
  disposal_date: z.string().optional(),
  disposal_reason: z.string().min(1, 'Disposal reason is required'),
  disposal_method: z.string().min(1, 'Disposal method is required'),
  disposal_value: z.coerce.number().min(0, 'Disposal value must be positive'),
  approved_by: z.string().uuid().optional().nullable(),
  document_url: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

assetRouter.post(
  '/disposals',
  requirePermission(['assets.disposal.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;
      const validated = DisposeAssetSchema.parse(req.body);
      const disposal = await assetService.disposeAsset(schoolId, {
        ...validated,
        created_by: userId,
      });
      res.status(201).json({ success: true, data: disposal });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);
