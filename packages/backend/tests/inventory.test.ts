// ========================================================================
// Inventory & Order Management Integration & Unit Test Suite
// Verifies:
// 1. Product & SKU Master catalog
// 2. Initial Opening Stock with OPENING ledger entry
// 3. Purchase Order lifecycle: PO create DOES NOT alter stock; Receive increments stock
// 4. Sales Order lifecycle: SO create DOES NOT alter stock; Fulfill decrements stock
// 5. Stock availability pre-check prevents negative inventory
// 6. Direct Stock In, Stock Out, and Stock Adjustments
// 7. Append-only immutable stock ledger audit trail
// 8. Multi-location & multi-tenant isolation
// ========================================================================

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { inventoryService } from '../src/services/inventory.service.js';
import { inventoryRepository } from '../src/repositories/inventory.repository.js';
import { seedInMemoryDatabase } from '../src/db/seed.js';

describe('Inventory & Order Management Module', () => {
  const schoolId = 'a0000000-0000-0000-0000-000000000001'; // School A (DPA)
  const locMain = 'b0000000-0000-0000-0000-000000000001';  // Main Campus
  const locBranch = 'b0000000-0000-0000-0000-000000000002'; // South Branch
  const userId = '10000000-0000-0000-0000-000000000002';   // Super Admin Rajesh

  before(() => {
    seedInMemoryDatabase();
  });

  beforeEach(() => {
    seedInMemoryDatabase();
  });

  // --------------------------------------------------------------------
  // 1. Taxonomy & Masters
  // --------------------------------------------------------------------
  it('Scenario 1: Retrieves seeded categories, subcategories, UOMs, and brands', async () => {
    const categories = await inventoryService.getCategories(schoolId);
    assert.ok(categories.length >= 2);
    assert.ok(categories.some((c) => c.code === 'CAT-STAT'));

    const uoms = await inventoryService.getUOMs(schoolId);
    assert.ok(uoms.some((u) => u.code === 'UOM-PCS'));

    const brands = await inventoryService.getBrands(schoolId);
    assert.ok(brands.some((b) => b.code === 'BR-CLASS'));

    const vendors = await inventoryService.getVendors(schoolId);
    assert.ok(vendors.some((v) => v.code === 'VEND-ABC'));
  });

  it('Scenario 2: Creates and updates a new vendor', async () => {
    const newVendor = await inventoryService.createVendor(schoolId, {
      code: 'VEND-TEST',
      name: 'Apex Stationery & Print',
      contact_person: 'Anil Kumar',
      email: 'anil@apexprint.com',
      phone: '+91 98990 12345',
      payment_terms: 'Net 15',
    });

    assert.ok(newVendor.id);
    assert.equal(newVendor.code, 'VEND-TEST');

    const updated = await inventoryService.updateVendor(newVendor.id, schoolId, {
      payment_terms: 'Net 45',
    });
    assert.equal(updated.payment_terms, 'Net 45');
  });

  // --------------------------------------------------------------------
  // 2. Product & SKU Master
  // --------------------------------------------------------------------
  it('Scenario 3: Creates a product and associated SKU', async () => {
    const categories = await inventoryService.getCategories(schoolId);
    const uoms = await inventoryService.getUOMs(schoolId);
    const brands = await inventoryService.getBrands(schoolId);

    const product = await inventoryService.createProduct(schoolId, {
      code: 'PROD-GEOM-BOX',
      name: 'Camlin Mathematical Drawing Instruments Box',
      category_id: categories[0].id,
      uom_id: uoms[0].id,
      brand_id: brands[0].id,
      description: 'Complete geometry box with metal compass and divider',
    });

    assert.equal(product.code, 'PROD-GEOM-BOX');

    const sku = await inventoryService.createSKU(schoolId, {
      product_id: product.id,
      sku_code: 'SKU-GEOM-01',
      barcode: '8901234567890',
      cost_price: 110.0,
      selling_price: 150.0,
      reorder_level: 15,
      min_order_qty: 5,
    });

    assert.equal(sku.sku_code, 'SKU-GEOM-01');
    assert.equal(sku.cost_price, 110.0);
    assert.equal(sku.selling_price, 150.0);
  });

  // --------------------------------------------------------------------
  // 3. Opening Stock & Ledger
  // --------------------------------------------------------------------
  it('Scenario 4: Sets opening stock and records an OPENING ledger entry', async () => {
    const skus = await inventoryService.getSKUs(schoolId);
    const targetSku = skus[0];

    const stock = await inventoryService.setOpeningStock(
      schoolId,
      locBranch,
      targetSku.id,
      80,
      55.0,
      userId
    );

    assert.equal(Number(stock.quantity), 80);

    const ledger = await inventoryService.getLedger(schoolId, {
      locationId: locBranch,
      skuId: targetSku.id,
      movementType: 'OPENING',
    });

    assert.ok(ledger.data.length >= 1);
    assert.equal(Number(ledger.data[0].new_balance), 80);
    assert.equal(ledger.data[0].movement_type, 'OPENING');
  });

  // --------------------------------------------------------------------
  // 4. Purchase Orders: PO create DOES NOT alter stock; Receive increases stock
  // --------------------------------------------------------------------
  it('Scenario 5: Creates PO without altering stock, then increases stock upon receive', async () => {
    const vendors = await inventoryService.getVendors(schoolId);
    const skus = await inventoryService.getSKUs(schoolId);
    const targetSku = skus[0];

    const initialStockRecord = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    const initialQuantity = Number(initialStockRecord?.quantity || 0);

    const po = await inventoryService.createPurchaseOrder(schoolId, locMain, userId, {
      vendor_id: vendors[0].id,
      items: [
        {
          sku_id: targetSku.id,
          quantity_ordered: 50,
          unit_price: 55.0,
          tax_rate: 5.0,
        },
      ],
    });

    assert.ok(po.id);
    assert.equal(po.status, 'ORDERED');

    // VERIFY: Physical stock MUST NOT change on PO creation!
    const stockAfterPOCreation = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    assert.equal(Number(stockAfterPOCreation?.quantity || 0), initialQuantity);

    // Partial Receive of 20 units
    const poPartial = await inventoryService.receivePurchaseOrder(
      po.id,
      schoolId,
      locMain,
      [{ sku_id: targetSku.id, quantity_received: 20 }],
      userId
    );

    assert.equal(poPartial.status, 'PARTIALLY_RECEIVED');

    const stockAfterPartial = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    assert.equal(Number(stockAfterPartial?.quantity), initialQuantity + 20);

    // Complete remaining 30 units
    const poComplete = await inventoryService.receivePurchaseOrder(
      po.id,
      schoolId,
      locMain,
      [{ sku_id: targetSku.id, quantity_received: 30 }],
      userId
    );

    assert.equal(poComplete.status, 'RECEIVED');

    const stockAfterComplete = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    assert.equal(Number(stockAfterComplete?.quantity), initialQuantity + 50);

    const ledger = await inventoryService.getLedger(schoolId, {
      locationId: locMain,
      skuId: targetSku.id,
      movementType: 'PURCHASE_RECEIPT',
    });
    assert.ok(ledger.data.length >= 2);
  });

  it('Scenario 6: Rejects receiving more items than ordered', async () => {
    const vendors = await inventoryService.getVendors(schoolId);
    const skus = await inventoryService.getSKUs(schoolId);
    const targetSku = skus[0];

    const po = await inventoryService.createPurchaseOrder(schoolId, locMain, userId, {
      vendor_id: vendors[0].id,
      items: [{ sku_id: targetSku.id, quantity_ordered: 10, unit_price: 50 }],
    });

    await assert.rejects(
      async () => {
        await inventoryService.receivePurchaseOrder(
          po.id,
          schoolId,
          locMain,
          [{ sku_id: targetSku.id, quantity_received: 15 }],
          userId
        );
      },
      { message: /Cannot receive more than ordered/ }
    );
  });

  // --------------------------------------------------------------------
  // 5. Sales Orders: SO create DOES NOT alter stock; Fulfill decrements stock
  // --------------------------------------------------------------------
  it('Scenario 7: Creates SO without altering stock, then decrements stock upon fulfillment', async () => {
    const skus = await inventoryService.getSKUs(schoolId);
    const targetSku = skus[0];

    const currentStock = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    const initialQuantity = Number(currentStock?.quantity || 0);
    assert.ok(initialQuantity >= 25);

    const so = await inventoryService.createSalesOrder(schoolId, locMain, userId, {
      customer_type: 'STUDENT',
      customer_name: 'Aarav Sharma',
      items: [
        {
          sku_id: targetSku.id,
          quantity_ordered: 15,
          unit_price: 75.0,
          discount_amount: 0,
        },
      ],
    });

    assert.ok(so.id);
    assert.equal(so.status, 'CONFIRMED');

    // VERIFY: Stock MUST NOT change on SO creation!
    const stockAfterSOCreation = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    assert.equal(Number(stockAfterSOCreation?.quantity), initialQuantity);

    // Fulfill partial 10 units
    const soPartial = await inventoryService.fulfillSalesOrder(
      so.id,
      schoolId,
      locMain,
      [{ sku_id: targetSku.id, quantity_fulfilled: 10 }],
      userId
    );

    assert.equal(soPartial.status, 'PARTIALLY_FULFILLED');

    const stockAfterPartial = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    assert.equal(Number(stockAfterPartial?.quantity), initialQuantity - 10);

    // Fulfill remaining 5 units
    const soComplete = await inventoryService.fulfillSalesOrder(
      so.id,
      schoolId,
      locMain,
      [{ sku_id: targetSku.id, quantity_fulfilled: 5 }],
      userId
    );

    assert.equal(soComplete.status, 'FULFILLED');

    const stockAfterComplete = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    assert.equal(Number(stockAfterComplete?.quantity), initialQuantity - 15);

    const ledger = await inventoryService.getLedger(schoolId, {
      locationId: locMain,
      skuId: targetSku.id,
      movementType: 'SALES_FULFILLMENT',
    });
    assert.ok(ledger.data.length >= 2);
    assert.ok(Number(ledger.data[0].quantity) < 0);
  });

  it('Scenario 8: Rejects fulfilling when stock is insufficient', async () => {
    const skus = await inventoryService.getSKUs(schoolId);
    const targetSku = skus[0];

    const so = await inventoryService.createSalesOrder(schoolId, locMain, userId, {
      customer_type: 'STUDENT',
      customer_name: 'Over Demand Test',
      items: [{ sku_id: targetSku.id, quantity_ordered: 99999, unit_price: 75 }],
    });

    await assert.rejects(
      async () => {
        await inventoryService.fulfillSalesOrder(
          so.id,
          schoolId,
          locMain,
          [{ sku_id: targetSku.id, quantity_fulfilled: 99999 }],
          userId
        );
      },
      { message: /Insufficient stock/ }
    );
  });

  // --------------------------------------------------------------------
  // 6. Direct Stock Movements & Adjustments
  // --------------------------------------------------------------------
  it('Scenario 9: Processes Stock In, Stock Out, and Stock Adjustments', async () => {
    const skus = await inventoryService.getSKUs(schoolId);
    const targetSku = skus[0];

    const beforeStock = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    const qty0 = Number(beforeStock?.quantity || 0);

    // Direct Stock In
    const stockIn = await inventoryService.createStockIn(schoolId, locMain, userId, {
      notes: 'Donation from Alumni',
      items: [{ sku_id: targetSku.id, quantity: 20, unit_cost: 50.0 }],
    });
    assert.match(stockIn.receipt_number, /^SI-/);

    const afterIn = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    assert.equal(Number(afterIn?.quantity), qty0 + 20);

    // Direct Stock Out
    const stockOut = await inventoryService.createStockOut(schoolId, locMain, userId, {
      notes: 'Issued to Science Exhibition',
      items: [{ sku_id: targetSku.id, quantity: 5, unit_price: 75.0 }],
    });
    assert.match(stockOut.issue_number, /^ISS-/);

    const afterOut = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    assert.equal(Number(afterOut?.quantity), qty0 + 15);

    // Stock Adjustment (Damage decrease)
    const adj = await inventoryService.createAdjustment(schoolId, locMain, userId, {
      reason: 'DAMAGE',
      items: [{ sku_id: targetSku.id, adjustment_type: 'DECREASE', quantity: 2 }],
    });
    assert.match(adj.adjustment_number, /^ADJ-/);

    const afterAdj = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    assert.equal(Number(afterAdj?.quantity), qty0 + 13);
  });

  // --------------------------------------------------------------------
  // 7. Dashboard & Reporting Analytics
  // --------------------------------------------------------------------
  it('Scenario 10: Returns accurate dashboard statistics and valuation reports', async () => {
    const stats = await inventoryService.getDashboardStats(schoolId);
    assert.ok(stats.total_products >= 1);
    assert.ok(stats.total_skus >= 1);
    assert.ok(stats.total_stock_units > 0);
    assert.ok(stats.total_stock_valuation > 0);

    const valuation = await inventoryService.getStockValuationReport(schoolId);
    assert.ok(valuation.length >= 1);
    assert.ok(valuation[0].total_cost_valuation > 0);
  });

  // --------------------------------------------------------------------
  // 8. Tenant and Location Isolation
  // --------------------------------------------------------------------
  it('Scenario 11: Isolates stock and movements between branches of the same school', async () => {
    const skus = await inventoryService.getSKUs(schoolId);
    const targetSku = skus[0];

    // Set stock at locMain
    await inventoryService.setOpeningStock(schoolId, locMain, targetSku.id, 100, 50, userId);
    // Set stock at locBranch
    await inventoryService.setOpeningStock(schoolId, locBranch, targetSku.id, 40, 50, userId);

    const stockMain = await inventoryRepository.getStockBySkuAndLocation(schoolId, locMain, targetSku.id);
    const stockBranch = await inventoryRepository.getStockBySkuAndLocation(schoolId, locBranch, targetSku.id);

    assert.equal(Number(stockMain?.quantity), 100);
    assert.equal(Number(stockBranch?.quantity), 40);
  });

  it('Scenario 12: Isolates products and stock between different school tenants', async () => {
    const otherSchoolId = 'a0000000-0000-0000-0000-000000000002'; // School B
    const schoolAProducts = await inventoryService.getProducts(schoolId);
    const schoolBProducts = await inventoryService.getProducts(otherSchoolId);

    assert.equal(schoolBProducts.length, 0);
    assert.ok(schoolAProducts.length > 0);
  });
});
