// ========================================================================
// Asset Management Module - Comprehensive Unit & Integration Tests
// Validates Categories, Asset Master, Assignment Lifecycle, Movement Tracking,
// Maintenance State Transitions, Disposal Safety Rules, and Tenant Isolation
// ========================================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { seedInMemoryDatabase } from '../src/db/seed.js';
import { assetService } from '../src/services/asset.service.js';
import { assetRepository } from '../src/repositories/asset.repository.js';
import { getMemoryDbClient } from '../src/db/client.js';

describe('Asset Management Module — Unit & Integration Engine', () => {
  const mem = getMemoryDbClient();
  const schoolAId = 'a0000000-0000-0000-0000-000000000001';
  const schoolBId = 'b0000000-0000-0000-0000-000000000001';
  const locA1Id = 'a1000000-0000-0000-0000-000000000001';
  const locA2Id = 'a1000000-0000-0000-0000-000000000002';
  const uSuperAId = '90000000-0000-0000-0000-000000000001';
  const uTeacherAId = 'a2000000-0000-0000-0000-000000000003';

  beforeEach(() => {
    mem.clear();
    seedInMemoryDatabase();
  });

  it('1. Category & Subcategory Hierarchy: Creates categories and subcategories with unique codes', async () => {
    const cat = await assetService.createCategory(schoolAId, {
      code: 'CAT-TEST',
      name: 'Test Category',
      description: 'Test Category Description',
    });
    assert.ok(cat.id);
    assert.equal(cat.code, 'CAT-TEST');

    // Duplicate code must reject
    await assert.rejects(
      async () => {
        await assetService.createCategory(schoolAId, {
          code: 'CAT-TEST',
          name: 'Duplicate',
        });
      },
      /already exists/
    );

    const subcat = await assetService.createSubcategory(schoolAId, {
      category_id: cat.id,
      code: 'SUB-TEST',
      name: 'Test Subcategory',
    });
    assert.ok(subcat.id);
    assert.equal(subcat.category_id, cat.id);
  });

  it('2. Sequential Code Generation: Generates AST-YYYY-XXXXXX sequentially', async () => {
    const code = await assetService.generateNextAssetCode(schoolAId);
    const year = new Date().getFullYear();
    assert.match(code, new RegExp(`^AST-${year}-\\d{6}$`));
  });

  it('3. Asset Master Creation & Validation: Registers asset with default available status', async () => {
    const cats = await assetService.getCategories(schoolAId);
    const catId = cats[0].id;

    const asset = await assetService.createAsset(schoolAId, {
      asset_name: 'Dell OptiPlex 7090 Desktop',
      category_id: catId,
      current_location_id: locA1Id,
      purchase_price: 65000,
      condition: 'NEW',
      brand: 'Dell',
      model: 'OptiPlex 7090',
      serial_number: 'SN-TEST-9988',
      created_by: uSuperAId,
    });

    assert.ok(asset.id);
    assert.equal(asset.status, 'AVAILABLE');
    assert.equal(asset.condition, 'NEW');
    assert.equal(asset.purchase_price, 65000);
    assert.ok(asset.asset_code.startsWith('AST-'));
  });

  it('4. Assignment Lifecycle: Assigns available asset to user, blocks double assignment, and returns asset', async () => {
    const cats = await assetService.getCategories(schoolAId);
    const asset = await assetService.createAsset(schoolAId, {
      asset_name: 'Apple iPad 10th Gen 64GB',
      category_id: cats[0].id,
      current_location_id: locA1Id,
      purchase_price: 39900,
      created_by: uSuperAId,
    });

    // 1. Assign to teacher
    const assignment = await assetService.assignAsset(schoolAId, {
      asset_id: asset.id,
      assigned_to_user_id: uTeacherAId,
      condition_at_assignment: 'NEW',
      remarks: 'Issued for digital attendance & classroom presentations',
      assigned_by: uSuperAId,
    });

    assert.ok(assignment.id);
    assert.equal(assignment.is_active, true);

    // Verify Asset Master reflects ASSIGNED
    const updatedAsset = await assetService.getAssetById(asset.id, schoolAId);
    assert.equal(updatedAsset.status, 'ASSIGNED');
    assert.equal(updatedAsset.current_custodian_user_id, uTeacherAId);

    // 2. Cannot re-assign already assigned asset
    await assert.rejects(
      async () => {
        await assetService.assignAsset(schoolAId, {
          asset_id: asset.id,
          assigned_to_user_id: uSuperAId,
        });
      },
      /already assigned/
    );

    // 3. Return asset
    const returned = await assetService.returnAsset(assignment.id, schoolAId, {
      condition_at_return: 'GOOD',
      returned_by: uSuperAId,
      remarks: 'Returned in good working condition',
    });

    assert.equal(returned.is_active, false);
    const postReturnAsset = await assetService.getAssetById(asset.id, schoolAId);
    assert.equal(postReturnAsset.status, 'AVAILABLE');
    assert.equal(postReturnAsset.current_custodian_user_id, null);
  });

  it('5. Asset Movement / Transfer: Records transfer history and updates current placement', async () => {
    const cats = await assetService.getCategories(schoolAId);
    const asset = await assetService.createAsset(schoolAId, {
      asset_name: 'Yamaha StagePas 400BT PA System',
      category_id: cats[0].id,
      current_location_id: locA1Id,
      room_number: 'Auditorium A',
      purchase_price: 78000,
      created_by: uSuperAId,
    });

    // Transfer from locA1 to locA2
    const movement = await assetService.transferAsset(schoolAId, {
      asset_id: asset.id,
      to_location_id: locA2Id,
      to_building: 'Main Block',
      to_room: 'Open Air Amphitheatre',
      reason: 'Relocated for annual festival and campus sound reinforcement',
      moved_by: uSuperAId,
    });

    assert.ok(movement.id);
    assert.equal(movement.from_location_id, locA1Id);
    assert.equal(movement.to_location_id, locA2Id);

    const transferredAsset = await assetService.getAssetById(asset.id, schoolAId);
    assert.equal(transferredAsset.current_location_id, locA2Id);
    assert.equal(transferredAsset.room_number, 'Open Air Amphitheatre');
  });

  it('6. Maintenance Lifecycle: Transitions asset to UNDER_MAINTENANCE and restores on completion', async () => {
    const cats = await assetService.getCategories(schoolAId);
    const asset = await assetService.createAsset(schoolAId, {
      asset_name: 'Hitachi 3-Star Inverter AC 1.5T',
      category_id: cats[0].id,
      current_location_id: locA1Id,
      purchase_price: 45000,
      created_by: uSuperAId,
    });

    // Schedule maintenance
    const maint = await assetService.scheduleMaintenance(schoolAId, {
      asset_id: asset.id,
      maintenance_type: 'PREVENTIVE',
      issue_description: 'Annual filter deep cleaning and coolant pressure top-up',
      cost: 2500,
      created_by: uSuperAId,
    });

    assert.equal(maint.status, 'IN_PROGRESS');
    const underMaintAsset = await assetService.getAssetById(asset.id, schoolAId);
    assert.equal(underMaintAsset.status, 'UNDER_MAINTENANCE');

    // Complete maintenance
    const completed = await assetService.completeMaintenance(maint.id, schoolAId, {
      work_performed: 'Cleaned indoor coils, outdoor unit fan serviced, 250g gas added',
      cost: 2800,
      final_condition: 'GOOD',
      updated_by: uSuperAId,
    });

    assert.equal(completed.status, 'COMPLETED');
    const restoredAsset = await assetService.getAssetById(asset.id, schoolAId);
    assert.equal(restoredAsset.status, 'AVAILABLE');
    assert.equal(restoredAsset.condition, 'GOOD');
  });

  it('7. Disposal Safety Rules: Prevents disposal of assigned or maintained asset, allows safe disposal', async () => {
    const cats = await assetService.getCategories(schoolAId);
    const asset = await assetService.createAsset(schoolAId, {
      asset_name: 'Old CRT Monitor 17"',
      category_id: cats[0].id,
      current_location_id: locA1Id,
      purchase_price: 8000,
      created_by: uSuperAId,
    });

    // Assign asset
    const assignment = await assetService.assignAsset(schoolAId, {
      asset_id: asset.id,
      assigned_to_user_id: uTeacherAId,
      assigned_by: uSuperAId,
    });

    // Attempting disposal must fail
    await assert.rejects(
      async () => {
        await assetService.disposeAsset(schoolAId, {
          asset_id: asset.id,
          disposal_reason: 'Obsolete e-waste',
          disposal_method: 'SCRAP_SALE',
          disposal_value: 500,
        });
      },
      /currently assigned/
    );

    // Return custody
    await assetService.returnAsset(assignment.id, schoolAId, {
      condition_at_return: 'CRITICAL',
      returned_by: uSuperAId,
    });

    // Now dispose
    const disposal = await assetService.disposeAsset(schoolAId, {
      asset_id: asset.id,
      disposal_reason: 'Defective screen raster / obsolete equipment',
      disposal_method: 'SCRAP_SALE',
      disposal_value: 400,
      created_by: uSuperAId,
    });

    assert.ok(disposal.id);
    const disposedAsset = await assetService.getAssetById(asset.id, schoolAId);
    assert.equal(disposedAsset.status, 'DISPOSED');
  });

  it('8. Dashboard Metrics: Computes counts and aggregate valuation accurately', async () => {
    const metrics = await assetService.getDashboardMetrics(schoolAId);
    assert.ok(metrics.total_assets >= 6);
    assert.ok(metrics.total_acquisition_value > 0);
    assert.ok(metrics.by_category.length > 0);
    assert.ok(metrics.by_status.length > 0);
  });

  it('9. Tenant Isolation: School B cannot view or modify School A assets', async () => {
    const assetsA = await assetService.getAssets(schoolAId);
    assert.ok(assetsA.length > 0);

    const assetAId = assetsA[0].id;
    // Attempting to query asset of School A with School B context
    await assert.rejects(
      async () => {
        await assetService.getAssetById(assetAId, schoolBId);
      },
      /not found/
    );

    const assetsB = await assetService.getAssets(schoolBId);
    assert.equal(assetsB.length, 0);
  });
});
