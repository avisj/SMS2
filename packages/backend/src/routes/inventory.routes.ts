// ========================================================================
// Inventory Routes
// REST API v1 for Inventory Masters, Catalog, Stock, Ledger, POs and SOs
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { inventoryService } from '../services/inventory.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const inventoryRouter = Router();

inventoryRouter.use(authMiddleware);
inventoryRouter.use(tenantIsolationMiddleware);

// Helper for single request param
function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val;
}

// ----------------------------------------------------------------------
// 1. Dashboard & Reports
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/dashboard',
  requirePermission(['inventory.dashboard.view', 'inventory.stock.view', 'inventory.product.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const stats = await inventoryService.getDashboardStats(schoolId, locationId);
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.get(
  '/reports/valuation',
  requirePermission(['inventory.reports.view', 'inventory.stock.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const data = await inventoryService.getStockValuationReport(schoolId, locationId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.get(
  '/reports/low-stock',
  requirePermission(['inventory.reports.view', 'inventory.stock.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const data = await inventoryService.getLowStockAlerts(schoolId, locationId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 2. Categories
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/categories',
  requirePermission(['inventory.taxonomy.manage', 'inventory.product.view', 'inventory.dashboard.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.getCategories(schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/categories',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.createCategory(schoolId, parsed);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.put(
  '/categories/:id',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.updateCategory(getParam(req, 'id'), schoolId, parsed);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.delete(
  '/categories/:id',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      await inventoryService.deleteCategory(getParam(req, 'id'), schoolId);
      res.json({ success: true, message: 'Category deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 3. Subcategories
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/subcategories',
  requirePermission(['inventory.taxonomy.manage', 'inventory.product.view', 'inventory.dashboard.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const categoryId = (req.query.category_id as string)?.trim() || undefined;
      const data = await inventoryService.getSubcategories(schoolId, categoryId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/subcategories',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        category_id: z.string().uuid(),
        code: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.createSubcategory(schoolId, parsed);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.put(
  '/subcategories/:id',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.updateSubcategory(getParam(req, 'id'), schoolId, parsed);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.delete(
  '/subcategories/:id',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      await inventoryService.deleteSubcategory(getParam(req, 'id'), schoolId);
      res.json({ success: true, message: 'Subcategory deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 4. Units of Measure (UOM)
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/uoms',
  requirePermission(['inventory.taxonomy.manage', 'inventory.product.view', 'inventory.dashboard.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.getUOMs(schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/uoms',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        symbol: z.string().min(1),
        is_fractional: z.boolean().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.createUOM(schoolId, parsed);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.put(
  '/uoms/:id',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        name: z.string().optional(),
        symbol: z.string().optional(),
        is_fractional: z.boolean().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.updateUOM(getParam(req, 'id'), schoolId, parsed);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.delete(
  '/uoms/:id',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      await inventoryService.deleteUOM(getParam(req, 'id'), schoolId);
      res.json({ success: true, message: 'UOM deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 5. Brands
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/brands',
  requirePermission(['inventory.taxonomy.manage', 'inventory.product.view', 'inventory.dashboard.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.getBrands(schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/brands',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.createBrand(schoolId, parsed);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.put(
  '/brands/:id',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.updateBrand(getParam(req, 'id'), schoolId, parsed);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.delete(
  '/brands/:id',
  requirePermission('inventory.taxonomy.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      await inventoryService.deleteBrand(getParam(req, 'id'), schoolId);
      res.json({ success: true, message: 'Brand deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 6. Vendors / Suppliers
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/vendors',
  requirePermission(['inventory.vendor.manage', 'inventory.purchase_order.view', 'inventory.dashboard.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const status = (req.query.status as string)?.trim() || undefined;
      const data = await inventoryService.getVendors(schoolId, status);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/vendors',
  requirePermission('inventory.vendor.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        contact_person: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        address: z.string().optional(),
        tax_id: z.string().optional(),
        payment_terms: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.createVendor(schoolId, parsed);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.put(
  '/vendors/:id',
  requirePermission('inventory.vendor.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        name: z.string().optional(),
        contact_person: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        address: z.string().optional(),
        tax_id: z.string().optional(),
        payment_terms: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.updateVendor(getParam(req, 'id'), schoolId, parsed);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.delete(
  '/vendors/:id',
  requirePermission('inventory.vendor.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      await inventoryService.deleteVendor(getParam(req, 'id'), schoolId);
      res.json({ success: true, message: 'Vendor deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 7. Products Master
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/products',
  requirePermission(['inventory.product.view', 'inventory.sku.view', 'inventory.dashboard.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const categoryId = (req.query.category_id as string)?.trim() || undefined;
      const search = (req.query.search as string)?.trim() || undefined;
      const status = (req.query.status as string)?.trim() || undefined;
      const data = await inventoryService.getProducts(schoolId, { categoryId, search, status });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.get(
  '/products/:id',
  requirePermission('inventory.product.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.getProductById(getParam(req, 'id'), schoolId);
      if (!data) {
        res.status(404).json({ success: false, error: { message: 'Product not found' } });
        return;
      }
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/products',
  requirePermission('inventory.product.create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        category_id: z.string().uuid().optional(),
        subcategory_id: z.string().uuid().optional(),
        uom_id: z.string().uuid().optional(),
        brand_id: z.string().uuid().optional(),
        description: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.createProduct(schoolId, parsed);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.put(
  '/products/:id',
  requirePermission('inventory.product.update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        name: z.string().optional(),
        category_id: z.string().uuid().optional().nullable(),
        subcategory_id: z.string().uuid().optional().nullable(),
        uom_id: z.string().uuid().optional().nullable(),
        brand_id: z.string().uuid().optional().nullable(),
        description: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.updateProduct(getParam(req, 'id'), schoolId, parsed as any);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.delete(
  '/products/:id',
  requirePermission('inventory.product.delete'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      await inventoryService.deleteProduct(getParam(req, 'id'), schoolId);
      res.json({ success: true, message: 'Product deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 8. SKUs Master
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/skus',
  requirePermission(['inventory.sku.view', 'inventory.product.view', 'inventory.stock.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const categoryId = (req.query.category_id as string)?.trim() || undefined;
      const productId = (req.query.product_id as string)?.trim() || undefined;
      const search = (req.query.search as string)?.trim() || undefined;
      const status = (req.query.status as string)?.trim() || undefined;
      const data = await inventoryService.getSKUs(schoolId, { categoryId, productId, search, status });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.get(
  '/skus/:id',
  requirePermission('inventory.sku.view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.getSKUById(getParam(req, 'id'), schoolId);
      if (!data) {
        res.status(404).json({ success: false, error: { message: 'SKU not found' } });
        return;
      }
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/skus',
  requirePermission('inventory.sku.create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        sku_code: z.string().min(1),
        sku_name: z.string().optional(),
        product_id: z.string().uuid().optional().nullable(),
        barcode: z.string().optional().nullable(),
        alternate_barcode: z.string().optional().nullable(),
        category_id: z.string().uuid().optional().nullable(),
        subcategory_id: z.string().uuid().optional().nullable(),
        uom_id: z.string().uuid().optional().nullable(),
        brand_id: z.string().uuid().optional().nullable(),
        description: z.string().optional().nullable(),
        reorder_level: z.coerce.number().min(0).optional(),
        min_order_qty: z.coerce.number().min(0).optional(),
        max_stock: z.coerce.number().min(0).optional().nullable(),
        cost_price: z.coerce.number().min(0).optional(),
        selling_price: z.coerce.number().min(0).optional(),
        attributes: z.record(z.any()).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.createSKU(schoolId, parsed as any);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.put(
  '/skus/:id',
  requirePermission('inventory.sku.update'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        sku_code: z.string().optional(),
        sku_name: z.string().optional(),
        product_id: z.string().uuid().optional().nullable(),
        barcode: z.string().optional().nullable(),
        alternate_barcode: z.string().optional().nullable(),
        category_id: z.string().uuid().optional().nullable(),
        subcategory_id: z.string().uuid().optional().nullable(),
        uom_id: z.string().uuid().optional().nullable(),
        brand_id: z.string().uuid().optional().nullable(),
        description: z.string().optional().nullable(),
        reorder_level: z.coerce.number().min(0).optional(),
        min_order_qty: z.coerce.number().min(0).optional(),
        max_stock: z.coerce.number().min(0).optional().nullable(),
        cost_price: z.coerce.number().min(0).optional(),
        selling_price: z.coerce.number().min(0).optional(),
        attributes: z.record(z.any()).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.updateSKU(getParam(req, 'id'), schoolId, parsed as any);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.delete(
  '/skus/:id',
  requirePermission('inventory.sku.delete'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      await inventoryService.deleteSKU(getParam(req, 'id'), schoolId);
      res.json({ success: true, message: 'SKU deleted' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 9. Multi-Location Stock & Opening Stock
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/stock',
  requirePermission(['inventory.stock.view', 'inventory.dashboard.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const skuId = (req.query.sku_id as string)?.trim() || undefined;
      const search = (req.query.search as string)?.trim() || undefined;
      const data = await inventoryService.getStock(schoolId, { locationId, skuId, search });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/opening-stock',
  requirePermission('inventory.stock.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        location_id: z.string().uuid(),
        sku_id: z.string().uuid(),
        quantity: z.coerce.number().min(0),
        unit_cost: z.coerce.number().min(0).default(0),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;

      const data = await inventoryService.setOpeningStock(
        schoolId,
        parsed.location_id,
        parsed.sku_id,
        parsed.quantity,
        parsed.unit_cost,
        userId
      );
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 10. Stock Ledger (Append-Only Audit Trail)
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/ledger',
  requirePermission(['inventory.ledger.view', 'inventory.stock.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const skuId = (req.query.sku_id as string)?.trim() || undefined;
      const movementType = (req.query.movement_type as string)?.trim() || undefined;
      const startDate = (req.query.start_date as string)?.trim() || undefined;
      const endDate = (req.query.end_date as string)?.trim() || undefined;
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;

      const result = await inventoryService.getLedger(schoolId, {
        locationId,
        skuId,
        movementType,
        startDate,
        endDate,
        limit,
        offset,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 11. Purchase Orders
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/purchase-orders',
  requirePermission(['inventory.purchase_order.view', 'inventory.purchase_order.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const vendorId = (req.query.vendor_id as string)?.trim() || undefined;
      const status = (req.query.status as string)?.trim() || undefined;
      const search = (req.query.search as string)?.trim() || undefined;

      const data = await inventoryService.getPurchaseOrders(schoolId, { locationId, vendorId, status, search });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.get(
  '/purchase-orders/:id',
  requirePermission(['inventory.purchase_order.view', 'inventory.purchase_order.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.getPurchaseOrderById(getParam(req, 'id'), schoolId);
      if (!data) {
        res.status(404).json({ success: false, error: { message: 'Purchase Order not found' } });
        return;
      }
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/purchase-orders',
  requirePermission('inventory.purchase_order.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        location_id: z.string().uuid(),
        vendor_id: z.string().uuid(),
        order_date: z.string().optional(),
        expected_date: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            sku_id: z.string().uuid(),
            quantity_ordered: z.coerce.number().positive(),
            unit_price: z.coerce.number().min(0),
            tax_rate: z.coerce.number().min(0).optional(),
          })
        ).min(1),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;

      const data = await inventoryService.createPurchaseOrder(
        schoolId,
        parsed.location_id,
        userId,
        parsed
      );
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/purchase-orders/:id/receive',
  requirePermission('inventory.purchase_order.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        location_id: z.string().uuid(),
        received_items: z.array(
          z.object({
            sku_id: z.string().uuid(),
            quantity_received: z.coerce.number().positive(),
            unit_cost: z.coerce.number().min(0).optional(),
          })
        ).min(1),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;

      const data = await inventoryService.receivePurchaseOrder(
        getParam(req, 'id'),
        schoolId,
        parsed.location_id,
        parsed.received_items,
        userId
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/purchase-orders/:id/cancel',
  requirePermission('inventory.purchase_order.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.cancelPurchaseOrder(getParam(req, 'id'), schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 12. Sales Orders
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/sales-orders',
  requirePermission(['inventory.sales_order.view', 'inventory.sales_order.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const customerType = (req.query.customer_type as string)?.trim() || undefined;
      const status = (req.query.status as string)?.trim() || undefined;
      const search = (req.query.search as string)?.trim() || undefined;

      const data = await inventoryService.getSalesOrders(schoolId, { locationId, customerType, status, search });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.get(
  '/sales-orders/:id',
  requirePermission(['inventory.sales_order.view', 'inventory.sales_order.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.getSalesOrderById(getParam(req, 'id'), schoolId);
      if (!data) {
        res.status(404).json({ success: false, error: { message: 'Sales Order not found' } });
        return;
      }
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/sales-orders',
  requirePermission('inventory.sales_order.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        location_id: z.string().uuid(),
        customer_type: z.enum(['STUDENT', 'STAFF', 'PARENT', 'EXTERNAL']),
        customer_id: z.string().uuid().optional(),
        customer_name: z.string().min(1),
        order_date: z.string().optional(),
        payment_status: z.enum(['PENDING', 'PAID', 'PARTIALLY_PAID', 'WAIVED']).optional(),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            sku_id: z.string().uuid(),
            quantity_ordered: z.coerce.number().positive(),
            unit_price: z.coerce.number().min(0),
            discount_amount: z.coerce.number().min(0).optional(),
          })
        ).min(1),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;

      const data = await inventoryService.createSalesOrder(
        schoolId,
        parsed.location_id,
        userId,
        parsed
      );
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/sales-orders/:id/fulfill',
  requirePermission('inventory.sales_order.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        location_id: z.string().uuid(),
        fulfilled_items: z.array(
          z.object({
            sku_id: z.string().uuid(),
            quantity_fulfilled: z.coerce.number().positive(),
          })
        ).min(1),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;

      const data = await inventoryService.fulfillSalesOrder(
        getParam(req, 'id'),
        schoolId,
        parsed.location_id,
        parsed.fulfilled_items,
        userId
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/sales-orders/:id/cancel',
  requirePermission('inventory.sales_order.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const data = await inventoryService.cancelSalesOrder(getParam(req, 'id'), schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 13. Direct Stock In, Stock Out & Adjustments
// ----------------------------------------------------------------------
inventoryRouter.get(
  '/stock-in',
  requirePermission(['inventory.stock.manage', 'inventory.stock.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const data = await inventoryService.getStockIns(schoolId, locationId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/stock-in',
  requirePermission('inventory.stock.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        location_id: z.string().uuid(),
        vendor_id: z.string().uuid().optional(),
        po_id: z.string().uuid().optional(),
        receipt_date: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            sku_id: z.string().uuid(),
            quantity: z.coerce.number().positive(),
            unit_cost: z.coerce.number().min(0).optional(),
            remarks: z.string().optional(),
          })
        ).min(1),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;

      const data = await inventoryService.createStockIn(
        schoolId,
        parsed.location_id,
        userId,
        parsed
      );
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.get(
  '/stock-out',
  requirePermission(['inventory.stock.manage', 'inventory.stock.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const data = await inventoryService.getStockOuts(schoolId, locationId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/stock-out',
  requirePermission('inventory.stock.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        location_id: z.string().uuid(),
        so_id: z.string().uuid().optional(),
        issue_date: z.string().optional(),
        issued_to_type: z.string().optional(),
        issued_to_id: z.string().uuid().optional(),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            sku_id: z.string().uuid(),
            quantity: z.coerce.number().positive(),
            unit_price: z.coerce.number().min(0).optional(),
            remarks: z.string().optional(),
          })
        ).min(1),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;

      const data = await inventoryService.createStockOut(
        schoolId,
        parsed.location_id,
        userId,
        parsed
      );
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.get(
  '/adjustments',
  requirePermission(['inventory.stock.manage', 'inventory.stock.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const locationId = (req.query.location_id as string)?.trim() || undefined;
      const data = await inventoryService.getAdjustments(schoolId, locationId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

inventoryRouter.post(
  '/adjustments',
  requirePermission('inventory.stock.manage'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        location_id: z.string().uuid(),
        reason: z.string().min(1),
        adjustment_date: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            sku_id: z.string().uuid(),
            adjustment_type: z.enum(['INCREASE', 'DECREASE']),
            quantity: z.coerce.number().positive(),
            unit_cost: z.coerce.number().min(0).optional(),
            remarks: z.string().optional(),
          })
        ).min(1),
      });
      const parsed = schema.parse(req.body);
      const schoolId = req.userContext!.school_id!;
      const userId = req.userContext!.user_id;

      const data = await inventoryService.createAdjustment(
        schoolId,
        parsed.location_id,
        userId,
        parsed
      );
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);
