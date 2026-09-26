// ========================================================================
// Asset Service
// Core Business Logic, State Machine Transitions, Validation Rules,
// Sequential Code Generation, and Audit Logging
// ========================================================================

import {
  Asset,
  AssetCategory,
  AssetSubcategory,
  AssetAssignment,
  AssetMovement,
  AssetMaintenance,
  AssetDisposal,
  AssetDashboardMetrics,
  AssetStatus,
  AssetCondition,
  User,
} from '../types/index.js';
import { AssetRepository, assetRepository } from '../repositories/asset.repository.js';
import { getMemoryDbClient } from '../db/client.js';

export class AssetService {
  constructor(private repo: AssetRepository = assetRepository) {}

  // ======================================================================
  // 1. Code Generation
  // ======================================================================

  async generateNextAssetCode(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.repo.countAssets(schoolId);
    let nextNum = count + 1;
    let code = `AST-${year}-${String(nextNum).padStart(6, '0')}`;

    // Ensure collision avoidance
    while (await this.repo.getAssetByCode(code, schoolId)) {
      nextNum++;
      code = `AST-${year}-${String(nextNum).padStart(6, '0')}`;
    }
    return code;
  }

  // ======================================================================
  // 2. Categories & Subcategories
  // ======================================================================

  async getCategories(schoolId: string): Promise<AssetCategory[]> {
    return this.repo.getCategories(schoolId);
  }

  async createCategory(
    schoolId: string,
    data: { code: string; name: string; description?: string; is_active?: boolean }
  ): Promise<AssetCategory> {
    const existing = await this.repo.getCategories(schoolId);
    if (existing.some(c => c.code.toUpperCase() === data.code.toUpperCase())) {
      throw new Error(`Category code '${data.code}' already exists for this school.`);
    }

    return this.repo.createCategory({
      school_id: schoolId,
      code: data.code.toUpperCase().trim(),
      name: data.name.trim(),
      description: data.description,
      is_active: data.is_active ?? true,
    });
  }

  async updateCategory(
    id: string,
    schoolId: string,
    updates: Partial<AssetCategory>
  ): Promise<AssetCategory> {
    const updated = await this.repo.updateCategory(id, schoolId, updates);
    if (!updated) throw new Error('Category not found or update failed.');
    return updated;
  }

  async deleteCategory(id: string, schoolId: string): Promise<boolean> {
    const assets = await this.repo.getAssets(schoolId, { category_id: id });
    if (assets.length > 0) {
      throw new Error(`Cannot delete category with ${assets.length} existing asset records.`);
    }
    const subcats = await this.repo.getSubcategories(schoolId, id);
    if (subcats.length > 0) {
      throw new Error(`Cannot delete category with ${subcats.length} existing subcategories.`);
    }
    return this.repo.deleteCategory(id, schoolId);
  }

  async getSubcategories(schoolId: string, categoryId?: string): Promise<AssetSubcategory[]> {
    return this.repo.getSubcategories(schoolId, categoryId);
  }

  async createSubcategory(
    schoolId: string,
    data: { category_id: string; code: string; name: string; description?: string; is_active?: boolean }
  ): Promise<AssetSubcategory> {
    const existing = await this.repo.getSubcategories(schoolId, data.category_id);
    if (existing.some(s => s.code.toUpperCase() === data.code.toUpperCase())) {
      throw new Error(`Subcategory code '${data.code}' already exists for this category.`);
    }

    return this.repo.createSubcategory({
      school_id: schoolId,
      category_id: data.category_id,
      code: data.code.toUpperCase().trim(),
      name: data.name.trim(),
      description: data.description,
      is_active: data.is_active ?? true,
    });
  }

  async updateSubcategory(
    id: string,
    schoolId: string,
    updates: Partial<AssetSubcategory>
  ): Promise<AssetSubcategory> {
    const updated = await this.repo.updateSubcategory(id, schoolId, updates);
    if (!updated) throw new Error('Subcategory not found or update failed.');
    return updated;
  }

  async deleteSubcategory(id: string, schoolId: string): Promise<boolean> {
    const assets = await this.repo.getAssets(schoolId, { subcategory_id: id });
    if (assets.length > 0) {
      throw new Error(`Cannot delete subcategory with ${assets.length} existing asset records.`);
    }
    return this.repo.deleteSubcategory(id, schoolId);
  }

  // ======================================================================
  // 3. Asset Master Lifecycle
  // ======================================================================

  async getAssets(
    schoolId: string,
    filters?: {
      location_id?: string;
      category_id?: string;
      subcategory_id?: string;
      status?: AssetStatus;
      condition?: AssetCondition;
      custodian_id?: string;
      search?: string;
    }
  ): Promise<Asset[]> {
    return this.repo.getAssets(schoolId, filters);
  }

  async getAssetById(id: string, schoolId: string): Promise<Asset> {
    const asset = await this.repo.getAssetById(id, schoolId);
    if (!asset) throw new Error(`Asset with ID '${id}' not found.`);
    return asset;
  }

  async createAsset(
    schoolId: string,
    data: {
      asset_code?: string;
      asset_name: string;
      category_id: string;
      subcategory_id?: string | null;
      brand?: string | null;
      model?: string | null;
      serial_number?: string | null;
      barcode?: string | null;
      asset_tag?: string | null;
      description?: string | null;
      purchase_date?: string | null;
      purchase_price: number;
      vendor_id?: string | null;
      purchase_order_id?: string | null;
      invoice_number?: string | null;
      invoice_date?: string | null;
      warranty_start_date?: string | null;
      warranty_end_date?: string | null;
      current_location_id: string;
      building?: string | null;
      floor?: string | null;
      room?: string | null;
      room_number?: string | null;
      area?: string | null;
      rack?: string | null;
      seat_desk?: string | null;
      current_custodian_user_id?: string | null;
      condition?: AssetCondition;
      status?: AssetStatus;
      remarks?: string | null;
      useful_life_years?: number | null;
      salvage_value?: number | null;
      created_by?: string;
    }
  ): Promise<Asset> {
    if (!data.asset_name || !data.asset_name.trim()) {
      throw new Error('Asset name is required.');
    }
    if (!data.category_id) {
      throw new Error('Asset category is required.');
    }
    if (!data.current_location_id) {
      throw new Error('Location is required.');
    }

    let code = data.asset_code?.trim();
    if (!code) {
      code = await this.generateNextAssetCode(schoolId);
    } else {
      const existing = await this.repo.getAssetByCode(code, schoolId);
      if (existing) throw new Error(`Asset code '${code}' already exists.`);
    }

    return this.repo.createAsset({
      school_id: schoolId,
      asset_code: code,
      asset_name: data.asset_name.trim(),
      category_id: data.category_id,
      subcategory_id: data.subcategory_id || null,
      brand: data.brand || null,
      model: data.model || null,
      serial_number: data.serial_number || null,
      barcode: data.barcode || null,
      asset_tag: data.asset_tag || null,
      description: data.description || null,
      purchase_date: data.purchase_date || null,
      purchase_price: Number(data.purchase_price) || 0,
      vendor_id: data.vendor_id || null,
      purchase_order_id: data.purchase_order_id || null,
      invoice_number: data.invoice_number || null,
      invoice_date: data.invoice_date || null,
      warranty_start_date: data.warranty_start_date || null,
      warranty_end_date: data.warranty_end_date || null,
      current_location_id: data.current_location_id,
      building: data.building || null,
      floor: data.floor || null,
      room: data.room || data.room_number || null,
      room_number: data.room_number || data.room || null,
      area: data.area || null,
      rack: data.rack || null,
      seat_desk: data.seat_desk || null,
      current_custodian_user_id: data.current_custodian_user_id || null,
      condition: data.condition || 'NEW',
      status: data.status || (data.current_custodian_user_id ? 'ASSIGNED' : 'AVAILABLE'),
      remarks: data.remarks || null,
      useful_life_years: data.useful_life_years ? Number(data.useful_life_years) : null,
      salvage_value: Number(data.salvage_value) || 0,
      created_by: data.created_by || null,
      updated_by: data.created_by || null,
    });
  }

  async updateAsset(
    id: string,
    schoolId: string,
    data: Partial<Asset> & { updated_by?: string }
  ): Promise<Asset> {
    const existing = await this.getAssetById(id, schoolId);

    // If location changed, log movement
    if (data.current_location_id && data.current_location_id !== existing.current_location_id) {
      await this.repo.createMovement({
        school_id: schoolId,
        asset_id: id,
        from_location_id: existing.current_location_id,
        to_location_id: data.current_location_id,
        from_building: existing.building,
        to_building: data.building !== undefined ? data.building : existing.building,
        from_room: existing.room_number || existing.room,
        to_room: (data.room_number !== undefined ? data.room_number : data.room) || existing.room_number,
        reason: 'Location updated via Asset Master edit',
        condition: data.condition || existing.condition,
        moved_by: data.updated_by,
        movement_date: new Date().toISOString().split('T')[0],
      });
    }

    const updated = await this.repo.updateAsset(id, schoolId, data);
    if (!updated) throw new Error('Asset update failed.');
    return updated;
  }

  async deleteAsset(id: string, schoolId: string): Promise<boolean> {
    const asset = await this.getAssetById(id, schoolId);
    if (asset.status === 'ASSIGNED') {
      throw new Error('Cannot delete an asset that is currently assigned to a user/custodian. Please return it first.');
    }
    if (asset.status === 'UNDER_MAINTENANCE') {
      throw new Error('Cannot delete an asset that is currently under active maintenance.');
    }
    return this.repo.deleteAsset(id, schoolId);
  }

  // ======================================================================
  // 4. Asset Assignment Workflow
  // ======================================================================

  async getAssignments(schoolId: string, assetId?: string, userId?: string): Promise<AssetAssignment[]> {
    return this.repo.getAssignments(schoolId, assetId, userId);
  }

  async assignAsset(
    schoolId: string,
    data: {
      asset_id: string;
      assigned_to_user_id: string;
      location_id?: string;
      assignment_date?: string;
      expected_return_date?: string | null;
      condition_at_assignment?: AssetCondition;
      remarks?: string | null;
      assigned_by?: string;
    }
  ): Promise<AssetAssignment> {
    const asset = await this.getAssetById(data.asset_id, schoolId);

    if (asset.status === 'ASSIGNED') {
      throw new Error(`Asset '${asset.asset_code}' is already assigned to a custodian.`);
    }
    if (asset.status === 'UNDER_MAINTENANCE') {
      throw new Error(`Asset '${asset.asset_code}' is currently under maintenance.`);
    }
    if (asset.status === 'DISPOSED' || asset.status === 'RETIRED') {
      throw new Error(`Asset '${asset.asset_code}' is ${asset.status.toLowerCase()} and cannot be assigned.`);
    }

    const assignment = await this.repo.createAssignment({
      school_id: schoolId,
      asset_id: data.asset_id,
      assigned_to_user_id: data.assigned_to_user_id,
      location_id: data.location_id || asset.current_location_id,
      assignment_date: data.assignment_date || new Date().toISOString().split('T')[0],
      expected_return_date: data.expected_return_date || null,
      actual_return_date: null,
      condition_at_assignment: data.condition_at_assignment || asset.condition,
      remarks: data.remarks || null,
      assigned_by: data.assigned_by || null,
      is_active: true,
    });

    // Update asset master
    await this.repo.updateAsset(data.asset_id, schoolId, {
      status: 'ASSIGNED',
      current_custodian_user_id: data.assigned_to_user_id,
      condition: data.condition_at_assignment || asset.condition,
      updated_by: data.assigned_by,
    });

    return assignment;
  }

  async returnAsset(
    assignmentId: string,
    schoolId: string,
    data: {
      actual_return_date?: string;
      condition_at_return: AssetCondition;
      returned_by?: string;
      remarks?: string;
    }
  ): Promise<AssetAssignment> {
    const assignment = await this.repo.getAssignmentById(assignmentId, schoolId);
    if (!assignment) throw new Error('Assignment record not found.');
    if (!assignment.is_active && assignment.actual_return_date) {
      throw new Error('This asset assignment has already been closed/returned.');
    }

    const returnedAssignment = await this.repo.returnAssignment(assignmentId, schoolId, {
      actual_return_date: data.actual_return_date || new Date().toISOString().split('T')[0],
      condition_at_return: data.condition_at_return,
      returned_by: data.returned_by,
      remarks: data.remarks,
    });

    if (!returnedAssignment) throw new Error('Failed to update assignment return.');

    // Status is AVAILABLE unless returned DAMAGED/CRITICAL
    const nextStatus: AssetStatus = (data.condition_at_return === 'DAMAGED' || data.condition_at_return === 'CRITICAL')
      ? 'DAMAGED'
      : 'AVAILABLE';

    await this.repo.updateAsset(assignment.asset_id, schoolId, {
      status: nextStatus,
      condition: data.condition_at_return,
      current_custodian_user_id: null,
      updated_by: data.returned_by,
    });

    return returnedAssignment;
  }

  // ======================================================================
  // 5. Asset Movement / Transfer
  // ======================================================================

  async getMovements(schoolId: string, assetId?: string): Promise<AssetMovement[]> {
    return this.repo.getMovements(schoolId, assetId);
  }

  async transferAsset(
    schoolId: string,
    data: {
      asset_id: string;
      to_location_id: string;
      to_building?: string | null;
      to_room?: string | null;
      to_user_id?: string | null;
      movement_date?: string;
      reason: string;
      condition?: AssetCondition;
      remarks?: string | null;
      moved_by?: string;
    }
  ): Promise<AssetMovement> {
    const asset = await this.getAssetById(data.asset_id, schoolId);

    const movement = await this.repo.createMovement({
      school_id: schoolId,
      asset_id: data.asset_id,
      from_location_id: asset.current_location_id,
      to_location_id: data.to_location_id,
      from_building: asset.building,
      to_building: data.to_building || null,
      from_room: asset.room_number || asset.room,
      to_room: data.to_room || null,
      from_user_id: asset.current_custodian_user_id,
      to_user_id: data.to_user_id || null,
      movement_date: data.movement_date || new Date().toISOString().split('T')[0],
      reason: data.reason,
      condition: data.condition || asset.condition,
      remarks: data.remarks || null,
      moved_by: data.moved_by || null,
    });

    // Update asset master with new placement
    await this.repo.updateAsset(data.asset_id, schoolId, {
      current_location_id: data.to_location_id,
      building: data.to_building || asset.building,
      room_number: data.to_room || asset.room_number,
      room: data.to_room || asset.room,
      condition: data.condition || asset.condition,
      current_custodian_user_id: data.to_user_id !== undefined ? data.to_user_id : asset.current_custodian_user_id,
      updated_by: data.moved_by,
    });

    return movement;
  }

  // ======================================================================
  // 6. Asset Maintenance Lifecycle
  // ======================================================================

  async getMaintenanceRecords(schoolId: string, assetId?: string, status?: string): Promise<AssetMaintenance[]> {
    return this.repo.getMaintenanceRecords(schoolId, assetId, status);
  }

  async scheduleMaintenance(
    schoolId: string,
    data: {
      asset_id: string;
      maintenance_type: string;
      service_date?: string;
      vendor_id?: string | null;
      service_provider?: string | null;
      issue_description: string;
      cost?: number;
      warranty_claim?: boolean;
      created_by?: string;
      remarks?: string | null;
    }
  ): Promise<AssetMaintenance> {
    const asset = await this.getAssetById(data.asset_id, schoolId);

    const record = await this.repo.createMaintenanceRecord({
      school_id: schoolId,
      asset_id: data.asset_id,
      maintenance_type: data.maintenance_type,
      service_date: data.service_date || new Date().toISOString().split('T')[0],
      vendor_id: data.vendor_id || null,
      service_provider: data.service_provider || null,
      issue_description: data.issue_description,
      work_performed: null,
      cost: Number(data.cost) || 0,
      next_service_date: null,
      warranty_claim: !!data.warranty_claim,
      status: 'IN_PROGRESS',
      previous_asset_status: asset.status,
      remarks: data.remarks || null,
      created_by: data.created_by || null,
    });

    // Update asset to UNDER_MAINTENANCE
    await this.repo.updateAsset(data.asset_id, schoolId, {
      status: 'UNDER_MAINTENANCE',
      updated_by: data.created_by,
    });

    return record;
  }

  async completeMaintenance(
    id: string,
    schoolId: string,
    data: {
      work_performed: string;
      cost?: number;
      next_service_date?: string | null;
      final_condition?: AssetCondition;
      remarks?: string | null;
      updated_by?: string;
    }
  ): Promise<AssetMaintenance> {
    const maint = await this.repo.getMaintenanceById(id, schoolId);
    if (!maint) throw new Error('Maintenance record not found.');

    const updatedMaint = await this.repo.updateMaintenanceRecord(id, schoolId, {
      status: 'COMPLETED',
      work_performed: data.work_performed,
      cost: data.cost !== undefined ? Number(data.cost) : maint.cost,
      next_service_date: data.next_service_date || null,
      remarks: data.remarks || maint.remarks,
    });

    if (!updatedMaint) throw new Error('Failed to complete maintenance record.');

    // Restore asset status
    const prevStatus = (maint.previous_asset_status as AssetStatus) || 'AVAILABLE';
    const nextStatus = prevStatus === 'UNDER_MAINTENANCE' ? 'AVAILABLE' : prevStatus;

    await this.repo.updateAsset(maint.asset_id, schoolId, {
      status: nextStatus,
      condition: data.final_condition || 'GOOD',
      updated_by: data.updated_by,
    });

    return updatedMaint;
  }

  // ======================================================================
  // 7. Asset Disposal
  // ======================================================================

  async getDisposals(schoolId: string): Promise<AssetDisposal[]> {
    return this.repo.getDisposals(schoolId);
  }

  async disposeAsset(
    schoolId: string,
    data: {
      asset_id: string;
      disposal_date?: string;
      disposal_reason: string;
      disposal_method: string;
      disposal_value?: number;
      approved_by?: string | null;
      document_url?: string | null;
      remarks?: string | null;
      created_by?: string;
    }
  ): Promise<AssetDisposal> {
    const asset = await this.getAssetById(data.asset_id, schoolId);

    if (asset.status === 'ASSIGNED') {
      throw new Error(`Cannot dispose asset '${asset.asset_code}'. It is currently assigned to a custodian. Please return custody first.`);
    }
    if (asset.status === 'UNDER_MAINTENANCE') {
      throw new Error(`Cannot dispose asset '${asset.asset_code}'. It is currently undergoing maintenance. Cancel or close maintenance first.`);
    }
    if (asset.status === 'DISPOSED') {
      throw new Error(`Asset '${asset.asset_code}' is already disposed.`);
    }

    const disposal = await this.repo.createDisposal({
      school_id: schoolId,
      asset_id: data.asset_id,
      disposal_date: data.disposal_date || new Date().toISOString().split('T')[0],
      disposal_reason: data.disposal_reason,
      disposal_method: data.disposal_method,
      disposal_value: Number(data.disposal_value) || 0,
      approved_by: data.approved_by || null,
      document_url: data.document_url || null,
      remarks: data.remarks || null,
      created_by: data.created_by || null,
    });

    // Mark asset DISPOSED
    await this.repo.updateAsset(data.asset_id, schoolId, {
      status: 'DISPOSED',
      condition: 'CRITICAL',
      current_custodian_user_id: null,
      updated_by: data.created_by,
    });

    return disposal;
  }

  // ======================================================================
  // 8. Dashboard Metrics
  // ======================================================================

  async getDashboardMetrics(schoolId: string, locationId?: string): Promise<AssetDashboardMetrics> {
    return this.repo.getDashboardMetrics(schoolId, locationId);
  }
}

export const assetService = new AssetService();
