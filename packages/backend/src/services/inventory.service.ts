// ========================================================================
// Inventory Service
// Domain Business Logic for Inventory, Stock Movements, POs and SOs
// Enforces Strict Separation:
// - PO Create/Approve DOES NOT increase stock (only Receive does)
// - SO Create/Confirm DOES NOT decrease stock (only Fulfill does)
// - Real-time stock availability verification preventing negative inventory
// - Immutable append-only audit trail in inventory_stock_ledger
// ========================================================================

import { inventoryRepository } from '../repositories/inventory.repository.js';
import {
  InventoryCategory,
  InventorySubcategory,
  InventoryUOM,
  InventoryBrand,
  InventoryVendor,
  Product,
  SKU,
  InventoryStock,
  InventoryStockLedger,
  PurchaseOrder,
  SalesOrder,
  InventoryStockIn,
  InventoryStockOut,
  InventoryAdjustment,
  InventoryDashboardStats,
  StockValuationReportItem,
  LowStockAlertItem,
} from '../types/index.js';

export class InventoryService {
  // ======================================================================
  // 1. Taxonomy & Masters
  // ======================================================================

  async getCategories(schoolId: string): Promise<InventoryCategory[]> {
    return inventoryRepository.getCategories(schoolId);
  }

  async createCategory(
    schoolId: string,
    data: { code: string; name: string; description?: string; status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<InventoryCategory> {
    const code = data.code.trim().toUpperCase();
    const name = data.name.trim();
    if (!code || !name) throw new Error('Category code and name are required');

    return inventoryRepository.createCategory({
      school_id: schoolId,
      code,
      name,
      description: data.description?.trim() || null,
      status: data.status || 'ACTIVE',
    });
  }

  async updateCategory(
    id: string,
    schoolId: string,
    updates: { name?: string; description?: string; status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<InventoryCategory> {
    return inventoryRepository.updateCategory(id, schoolId, updates);
  }

  async deleteCategory(id: string, schoolId: string): Promise<boolean> {
    return inventoryRepository.deleteCategory(id, schoolId);
  }

  async getSubcategories(schoolId: string, categoryId?: string): Promise<InventorySubcategory[]> {
    return inventoryRepository.getSubcategories(schoolId, categoryId);
  }

  async createSubcategory(
    schoolId: string,
    data: { category_id: string; code: string; name: string; description?: string; status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<InventorySubcategory> {
    const code = data.code.trim().toUpperCase();
    const name = data.name.trim();
    if (!code || !name || !data.category_id) throw new Error('Category, subcategory code, and name are required');

    return inventoryRepository.createSubcategory({
      school_id: schoolId,
      category_id: data.category_id,
      code,
      name,
      description: data.description?.trim() || null,
      status: data.status || 'ACTIVE',
    });
  }

  async updateSubcategory(
    id: string,
    schoolId: string,
    updates: { name?: string; description?: string; status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<InventorySubcategory> {
    return inventoryRepository.updateSubcategory(id, schoolId, updates);
  }

  async deleteSubcategory(id: string, schoolId: string): Promise<boolean> {
    return inventoryRepository.deleteSubcategory(id, schoolId);
  }

  async getUOMs(schoolId: string): Promise<InventoryUOM[]> {
    return inventoryRepository.getUOMs(schoolId);
  }

  async createUOM(
    schoolId: string,
    data: { code: string; name: string; symbol: string; is_fractional?: boolean; status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<InventoryUOM> {
    const code = data.code.trim().toUpperCase();
    const name = data.name.trim();
    const symbol = data.symbol.trim();
    if (!code || !name || !symbol) throw new Error('UOM code, name, and symbol are required');

    return inventoryRepository.createUOM({
      school_id: schoolId,
      code,
      name,
      symbol,
      is_fractional: data.is_fractional || false,
      status: data.status || 'ACTIVE',
    });
  }

  async updateUOM(
    id: string,
    schoolId: string,
    updates: { name?: string; symbol?: string; is_fractional?: boolean; status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<InventoryUOM> {
    return inventoryRepository.updateUOM(id, schoolId, updates);
  }

  async deleteUOM(id: string, schoolId: string): Promise<boolean> {
    return inventoryRepository.deleteUOM(id, schoolId);
  }

  async getBrands(schoolId: string): Promise<InventoryBrand[]> {
    return inventoryRepository.getBrands(schoolId);
  }

  async createBrand(
    schoolId: string,
    data: { code: string; name: string; description?: string; status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<InventoryBrand> {
    const code = data.code.trim().toUpperCase();
    const name = data.name.trim();
    if (!code || !name) throw new Error('Brand code and name are required');

    return inventoryRepository.createBrand({
      school_id: schoolId,
      code,
      name,
      description: data.description?.trim() || null,
      status: data.status || 'ACTIVE',
    });
  }

  async updateBrand(
    id: string,
    schoolId: string,
    updates: { name?: string; description?: string; status?: 'ACTIVE' | 'INACTIVE' }
  ): Promise<InventoryBrand> {
    return inventoryRepository.updateBrand(id, schoolId, updates);
  }

  async deleteBrand(id: string, schoolId: string): Promise<boolean> {
    return inventoryRepository.deleteBrand(id, schoolId);
  }

  async getVendors(schoolId: string, status?: string): Promise<InventoryVendor[]> {
    return inventoryRepository.getVendors(schoolId, status);
  }

  async createVendor(
    schoolId: string,
    data: {
      code: string;
      name: string;
      contact_person?: string;
      email?: string;
      phone?: string;
      address?: string;
      tax_id?: string;
      payment_terms?: string;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ): Promise<InventoryVendor> {
    const code = data.code.trim().toUpperCase();
    const name = data.name.trim();
    if (!code || !name) throw new Error('Vendor code and name are required');

    return inventoryRepository.createVendor({
      school_id: schoolId,
      code,
      name,
      contact_person: data.contact_person?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      tax_id: data.tax_id?.trim() || null,
      payment_terms: data.payment_terms?.trim() || 'Net 30',
      status: data.status || 'ACTIVE',
    });
  }

  async updateVendor(
    id: string,
    schoolId: string,
    updates: Partial<InventoryVendor>
  ): Promise<InventoryVendor> {
    return inventoryRepository.updateVendor(id, schoolId, updates);
  }

  async deleteVendor(id: string, schoolId: string): Promise<boolean> {
    return inventoryRepository.deleteVendor(id, schoolId);
  }

  // ======================================================================
  // 2. Products Master
  // ======================================================================

  async getProducts(
    schoolId: string,
    filters?: { categoryId?: string; search?: string; status?: string }
  ): Promise<Product[]> {
    return inventoryRepository.getProducts(schoolId, filters);
  }

  async getProductById(id: string, schoolId: string): Promise<Product | null> {
    return inventoryRepository.getProductById(id, schoolId);
  }

  async createProduct(
    schoolId: string,
    data: {
      code: string;
      name: string;
      category_id?: string;
      subcategory_id?: string;
      uom_id?: string;
      brand_id?: string;
      description?: string;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ): Promise<Product> {
    const code = data.code.trim().toUpperCase();
    const name = data.name.trim();
    if (!code || !name) throw new Error('Product code and name are required');

    return inventoryRepository.createProduct({
      school_id: schoolId,
      code,
      name,
      category_id: data.category_id || null,
      subcategory_id: data.subcategory_id || null,
      uom_id: data.uom_id || null,
      brand_id: data.brand_id || null,
      description: data.description?.trim() || null,
      status: data.status || 'ACTIVE',
    });
  }

  async updateProduct(
    id: string,
    schoolId: string,
    updates: Partial<Product>
  ): Promise<Product> {
    return inventoryRepository.updateProduct(id, schoolId, updates);
  }

  async deleteProduct(id: string, schoolId: string): Promise<boolean> {
    return inventoryRepository.deleteProduct(id, schoolId);
  }

  // ======================================================================
  // 3. SKUs Master
  // ======================================================================

  async getSKUs(
    schoolId: string,
    filters?: { categoryId?: string; productId?: string; search?: string; status?: string }
  ): Promise<SKU[]> {
    return inventoryRepository.getSKUs(schoolId, filters);
  }

  async getSKUById(id: string, schoolId: string): Promise<SKU | null> {
    return inventoryRepository.getSKUById(id, schoolId);
  }

  async createSKU(
    schoolId: string,
    data: {
      sku_code: string;
      sku_name?: string;
      product_id?: string | null;
      barcode?: string | null;
      alternate_barcode?: string | null;
      category_id?: string | null;
      subcategory_id?: string | null;
      uom_id?: string | null;
      brand_id?: string | null;
      description?: string | null;
      reorder_level?: number;
      min_order_qty?: number;
      max_stock?: number | null;
      cost_price?: number;
      selling_price?: number;
      attributes?: Record<string, any>;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ): Promise<SKU> {
    const sku_code = data.sku_code?.trim().toUpperCase();
    if (!sku_code) throw new Error('SKU code is required');

    return inventoryRepository.createSKU({
      school_id: schoolId,
      sku_code,
      sku_name: data.sku_name?.trim() || sku_code,
      product_id: data.product_id || null,
      barcode: data.barcode?.trim() || null,
      alternate_barcode: data.alternate_barcode?.trim() || null,
      category_id: data.category_id || null,
      subcategory_id: data.subcategory_id || null,
      uom_id: data.uom_id || null,
      brand_id: data.brand_id || null,
      description: data.description?.trim() || null,
      reorder_level: data.reorder_level !== undefined ? Number(data.reorder_level) : 10,
      min_order_qty: data.min_order_qty !== undefined ? Number(data.min_order_qty) : 1,
      max_stock: data.max_stock !== undefined && data.max_stock !== null ? Number(data.max_stock) : null,
      cost_price: data.cost_price !== undefined ? Number(data.cost_price) : 0,
      selling_price: data.selling_price !== undefined ? Number(data.selling_price) : 0,
      attributes: data.attributes || {},
      status: data.status || 'ACTIVE',
    });
  }

  async updateSKU(
    id: string,
    schoolId: string,
    updates: Partial<SKU>
  ): Promise<SKU> {
    return inventoryRepository.updateSKU(id, schoolId, updates);
  }

  async deleteSKU(id: string, schoolId: string): Promise<boolean> {
    return inventoryRepository.deleteSKU(id, schoolId);
  }

  // ======================================================================
  // 4. Stock & Opening Stock
  // ======================================================================

  async getStock(
    schoolId: string,
    filters?: { locationId?: string; skuId?: string; search?: string }
  ): Promise<InventoryStock[]> {
    return inventoryRepository.getStock(schoolId, filters);
  }

  /**
   * Set Initial Opening Stock for an SKU at a specific Location.
   * Logs an immutable OPENING entry into the stock ledger.
   */
  async setOpeningStock(
    schoolId: string,
    locationId: string,
    skuId: string,
    quantity: number,
    unitCost: number,
    createdBy: string
  ): Promise<InventoryStock> {
    if (quantity < 0) throw new Error('Opening stock quantity cannot be negative');

    const sku = await inventoryRepository.getSKUById(skuId, schoolId);
    if (!sku) throw new Error('SKU not found');

    const { previousBalance, newBalance, stock } = await inventoryRepository.upsertStock(
      schoolId,
      locationId,
      skuId,
      quantity,
      { isAbsolute: true }
    );

    await inventoryRepository.recordLedger({
      school_id: schoolId,
      location_id: locationId,
      sku_id: skuId,
      movement_type: 'OPENING',
      reference_type: 'OPENING_STOCK',
      reference_id: stock.id,
      quantity: quantity - previousBalance,
      previous_balance: previousBalance,
      new_balance: newBalance,
      unit_cost: unitCost,
      notes: `Opening stock initialized to ${quantity}`,
      created_by: createdBy,
    });

    return stock;
  }

  // ======================================================================
  // 5. Stock Ledger
  // ======================================================================

  async getLedger(
    schoolId: string,
    filters?: {
      locationId?: string;
      skuId?: string;
      movementType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: InventoryStockLedger[]; total: number }> {
    return inventoryRepository.getLedger(schoolId, filters);
  }

  // ======================================================================
  // 6. Purchase Orders (Intent to Purchase)
  // ======================================================================

  async getPurchaseOrders(
    schoolId: string,
    filters?: { locationId?: string; vendorId?: string; status?: string; search?: string }
  ): Promise<PurchaseOrder[]> {
    return inventoryRepository.getPurchaseOrders(schoolId, filters);
  }

  async getPurchaseOrderById(id: string, schoolId: string): Promise<PurchaseOrder | null> {
    return inventoryRepository.getPurchaseOrderById(id, schoolId);
  }

  /**
   * Create Purchase Order:
   * DOES NOT alter physical inventory stock.
   */
  async createPurchaseOrder(
    schoolId: string,
    locationId: string,
    createdBy: string,
    data: {
      vendor_id: string;
      order_date?: string;
      expected_date?: string;
      notes?: string;
      items: {
        sku_id: string;
        quantity_ordered: number;
        unit_price: number;
        tax_rate?: number;
      }[];
    }
  ): Promise<PurchaseOrder> {
    if (!data.vendor_id || !data.items || data.items.length === 0) {
      throw new Error('Vendor and at least one line item are required');
    }

    const year = new Date().getFullYear();
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const po_number = `PO-${year}-${randomHex}`;

    let subtotal = 0;
    let tax_amount = 0;

    const itemsData = data.items.map((it) => {
      const qty = Number(it.quantity_ordered);
      const price = Number(it.unit_price);
      const taxRate = Number(it.tax_rate || 0);
      const itemSubtotal = qty * price;
      const itemTax = (itemSubtotal * taxRate) / 100;
      const total = itemSubtotal + itemTax;

      subtotal += itemSubtotal;
      tax_amount += itemTax;

      return {
        sku_id: it.sku_id,
        quantity_ordered: qty,
        unit_price: price,
        tax_rate: taxRate,
        total_price: Math.round(total * 100) / 100,
      };
    });

    const total_amount = Math.round((subtotal + tax_amount) * 100) / 100;

    return inventoryRepository.createPurchaseOrder(
      {
        school_id: schoolId,
        location_id: locationId,
        po_number,
        vendor_id: data.vendor_id,
        order_date: data.order_date || new Date().toISOString().slice(0, 10),
        expected_date: data.expected_date || null,
        status: 'ORDERED',
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(tax_amount * 100) / 100,
        total_amount,
        notes: data.notes?.trim() || null,
        created_by: createdBy,
        updated_by: createdBy,
      },
      itemsData
    );
  }

  /**
   * Receive items against a PO:
   * Increases physical inventory stock and writes immutable entries to stock ledger.
   */
  async receivePurchaseOrder(
    poId: string,
    schoolId: string,
    locationId: string,
    receivedItems: { sku_id: string; quantity_received: number; unit_cost?: number }[],
    receivedBy: string
  ): Promise<PurchaseOrder> {
    return inventoryRepository.receivePurchaseOrder(poId, schoolId, locationId, receivedItems, receivedBy);
  }

  async cancelPurchaseOrder(poId: string, schoolId: string): Promise<PurchaseOrder> {
    const po = await inventoryRepository.getPurchaseOrderById(poId, schoolId);
    if (!po) throw new Error('Purchase Order not found');
    if (po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED') {
      throw new Error('Cannot cancel a purchase order that has already received items');
    }
    return inventoryRepository.updatePurchaseOrder(poId, schoolId, { status: 'CANCELLED' });
  }

  // ======================================================================
  // 7. Sales Orders (Intent to Sell / Issue)
  // ======================================================================

  async getSalesOrders(
    schoolId: string,
    filters?: { locationId?: string; customerType?: string; status?: string; search?: string }
  ): Promise<SalesOrder[]> {
    return inventoryRepository.getSalesOrders(schoolId, filters);
  }

  async getSalesOrderById(id: string, schoolId: string): Promise<SalesOrder | null> {
    return inventoryRepository.getSalesOrderById(id, schoolId);
  }

  /**
   * Create Sales Order:
   * DOES NOT alter physical inventory stock.
   */
  async createSalesOrder(
    schoolId: string,
    locationId: string,
    createdBy: string,
    data: {
      customer_type: 'STUDENT' | 'STAFF' | 'PARENT' | 'EXTERNAL';
      customer_id?: string;
      customer_name: string;
      order_date?: string;
      payment_status?: 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'WAIVED';
      notes?: string;
      items: {
        sku_id: string;
        quantity_ordered: number;
        unit_price: number;
        discount_amount?: number;
      }[];
    }
  ): Promise<SalesOrder> {
    if (!data.customer_name || !data.items || data.items.length === 0) {
      throw new Error('Customer name and at least one line item are required');
    }

    const year = new Date().getFullYear();
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const so_number = `SO-${year}-${randomHex}`;

    let subtotal = 0;
    let total_discount = 0;

    const itemsData = data.items.map((it) => {
      const qty = Number(it.quantity_ordered);
      const price = Number(it.unit_price);
      const discount = Number(it.discount_amount || 0);
      const lineTotal = Math.max(qty * price - discount, 0);

      subtotal += qty * price;
      total_discount += discount;

      return {
        sku_id: it.sku_id,
        quantity_ordered: qty,
        unit_price: price,
        discount_amount: discount,
        total_price: Math.round(lineTotal * 100) / 100,
      };
    });

    const total_amount = Math.max(subtotal - total_discount, 0);

    return inventoryRepository.createSalesOrder(
      {
        school_id: schoolId,
        location_id: locationId,
        so_number,
        customer_type: data.customer_type,
        customer_id: data.customer_id || null,
        customer_name: data.customer_name.trim(),
        order_date: data.order_date || new Date().toISOString().slice(0, 10),
        status: 'CONFIRMED',
        subtotal: Math.round(subtotal * 100) / 100,
        discount_amount: Math.round(total_discount * 100) / 100,
        tax_amount: 0,
        total_amount: Math.round(total_amount * 100) / 100,
        payment_status: data.payment_status || 'PENDING',
        notes: data.notes?.trim() || null,
        created_by: createdBy,
        updated_by: createdBy,
      },
      itemsData
    );
  }

  /**
   * Fulfill items against an SO:
   * Validates available stock first (cannot go negative).
   * Decrements physical inventory stock and writes immutable entries to stock ledger.
   */
  async fulfillSalesOrder(
    soId: string,
    schoolId: string,
    locationId: string,
    fulfilledItems: { sku_id: string; quantity_fulfilled: number }[],
    fulfilledBy: string
  ): Promise<SalesOrder> {
    return inventoryRepository.fulfillSalesOrder(soId, schoolId, locationId, fulfilledItems, fulfilledBy);
  }

  async cancelSalesOrder(soId: string, schoolId: string): Promise<SalesOrder> {
    const so = await inventoryRepository.getSalesOrderById(soId, schoolId);
    if (!so) throw new Error('Sales Order not found');
    if (so.status === 'FULFILLED' || so.status === 'PARTIALLY_FULFILLED') {
      throw new Error('Cannot cancel a sales order that has already fulfilled items');
    }
    return inventoryRepository.updateSalesOrder(soId, schoolId, { status: 'CANCELLED' });
  }

  // ======================================================================
  // 8. Direct Stock In, Stock Out & Adjustments
  // ======================================================================

  async createStockIn(
    schoolId: string,
    locationId: string,
    createdBy: string,
    data: {
      vendor_id?: string;
      po_id?: string;
      receipt_date?: string;
      notes?: string;
      items: { sku_id: string; quantity: number; unit_cost?: number; remarks?: string }[];
    }
  ): Promise<InventoryStockIn> {
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required for Stock In');

    const year = new Date().getFullYear();
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const receipt_number = `SI-${year}-${randomHex}`;

    let total_amount = 0;
    const detailRecords = data.items.map((it) => {
      const qty = Number(it.quantity);
      const cost = Number(it.unit_cost || 0);
      const lineCost = qty * cost;
      total_amount += lineCost;
      return {
        sku_id: it.sku_id,
        quantity: qty,
        unit_cost: cost,
        total_cost: Math.round(lineCost * 100) / 100,
        remarks: it.remarks?.trim() || null,
      };
    });

    return inventoryRepository.createStockIn(
      {
        school_id: schoolId,
        location_id: locationId,
        receipt_number,
        vendor_id: data.vendor_id || null,
        po_id: data.po_id || null,
        receipt_date: data.receipt_date || new Date().toISOString().slice(0, 10),
        total_amount: Math.round(total_amount * 100) / 100,
        notes: data.notes?.trim() || null,
        created_by: createdBy,
      },
      detailRecords
    );
  }

  async getStockIns(schoolId: string, locationId?: string): Promise<InventoryStockIn[]> {
    return inventoryRepository.getStockIns(schoolId, locationId);
  }

  async createStockOut(
    schoolId: string,
    locationId: string,
    createdBy: string,
    data: {
      so_id?: string;
      issue_date?: string;
      issued_to_type?: string;
      issued_to_id?: string;
      notes?: string;
      items: { sku_id: string; quantity: number; unit_price?: number; remarks?: string }[];
    }
  ): Promise<InventoryStockOut> {
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required for Stock Out');

    const year = new Date().getFullYear();
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const issue_number = `ISS-${year}-${randomHex}`;

    const detailRecords = data.items.map((it) => {
      const qty = Number(it.quantity);
      const price = Number(it.unit_price || 0);
      return {
        sku_id: it.sku_id,
        quantity: qty,
        unit_price: price,
        total_price: Math.round(qty * price * 100) / 100,
        remarks: it.remarks?.trim() || null,
      };
    });

    return inventoryRepository.createStockOut(
      {
        school_id: schoolId,
        location_id: locationId,
        issue_number,
        so_id: data.so_id || null,
        issue_date: data.issue_date || new Date().toISOString().slice(0, 10),
        issued_to_type: data.issued_to_type || 'GENERAL',
        issued_to_id: data.issued_to_id || null,
        notes: data.notes?.trim() || null,
        created_by: createdBy,
      },
      detailRecords
    );
  }

  async getStockOuts(schoolId: string, locationId?: string): Promise<InventoryStockOut[]> {
    return inventoryRepository.getStockOuts(schoolId, locationId);
  }

  async createAdjustment(
    schoolId: string,
    locationId: string,
    createdBy: string,
    data: {
      reason: string;
      adjustment_date?: string;
      notes?: string;
      items: { sku_id: string; adjustment_type: 'INCREASE' | 'DECREASE'; quantity: number; unit_cost?: number; remarks?: string }[];
    }
  ): Promise<InventoryAdjustment> {
    if (!data.items || data.items.length === 0) throw new Error('At least one item is required for Stock Adjustment');

    const year = new Date().getFullYear();
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const adjustment_number = `ADJ-${year}-${randomHex}`;

    const detailRecords = data.items.map((it) => ({
      sku_id: it.sku_id,
      adjustment_type: it.adjustment_type,
      quantity: Number(it.quantity),
      unit_cost: Number(it.unit_cost || 0),
      remarks: it.remarks?.trim() || null,
    }));

    return inventoryRepository.createAdjustment(
      {
        school_id: schoolId,
        location_id: locationId,
        adjustment_number,
        adjustment_date: data.adjustment_date || new Date().toISOString().slice(0, 10),
        reason: data.reason,
        notes: data.notes?.trim() || null,
        created_by: createdBy,
      },
      detailRecords
    );
  }

  async getAdjustments(schoolId: string, locationId?: string): Promise<InventoryAdjustment[]> {
    return inventoryRepository.getAdjustments(schoolId, locationId);
  }

  // ======================================================================
  // 9. Dashboard & Reports Analytics
  // ======================================================================

  async getDashboardStats(schoolId: string, locationId?: string): Promise<InventoryDashboardStats> {
    return inventoryRepository.getDashboardStats(schoolId, locationId);
  }

  async getStockValuationReport(schoolId: string, locationId?: string): Promise<StockValuationReportItem[]> {
    return inventoryRepository.getStockValuationReport(schoolId, locationId);
  }

  async getLowStockAlerts(schoolId: string, locationId?: string): Promise<LowStockAlertItem[]> {
    return inventoryRepository.getLowStockAlerts(schoolId, locationId);
  }
}

export const inventoryService = new InventoryService();
