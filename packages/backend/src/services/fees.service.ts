// ========================================================================
// Fees Management Service
// Multi-Tenant Core Financial Engine, Relational Invariance & Audit Integrity
// ========================================================================

import { FeesRepository } from '../repositories/fees.repository.js';
import { academicRepository } from '../repositories/academic.repository.js';
import {
  FeeHead,
  FeeStructure,
  StudentFeeDemand,
  FeeDemandAdjustment,
  FeePayment,
  FeeReceipt,
  FeeRefund,
  StudentFeeLedgerItem,
  FeeDashboardMetrics,
  PaymentMode,
} from '../types/index.js';

export const feesRepository = new FeesRepository();

export interface GenerateDemandsPayload {
  academic_session_id: string;
  location_id?: string;
  class_id: string;
  section_id?: string;
  student_user_ids?: string[];
  fee_structure_ids?: string[];
  billing_period: string; // e.g. 'April 2026', 'Term 1 2026', 'Q1-2026'
  issue_date: string;
  due_date: string;
}

export interface CollectPaymentPayload {
  student_user_id: string;
  academic_session_id: string;
  location_id: string;
  payment_date: string;
  payment_mode: PaymentMode;
  transaction_reference?: string;
  remarks?: string;
  allocations: Array<{
    demand_id: string;
    amount: number;
  }>;
}

export interface ApplyAdjustmentPayload {
  demand_id: string;
  adjustment_type: 'DISCOUNT' | 'WAIVER' | 'LATE_FEE_OVERRIDE';
  discount_name?: string;
  amount: number;
  reason: string;
}

export interface ProcessRefundPayload {
  payment_id: string;
  refund_amount: number;
  refund_mode: string;
  reason: string;
  reference_no?: string;
}

export class FeesService {
  private repo = feesRepository;

  // ======================================================================
  // 1. Fee Heads Master
  // ======================================================================
  async getHeads(schoolId: string, filters?: { category?: string; status?: string; search?: string }) {
    return this.repo.findHeads(schoolId, filters);
  }

  async getHeadById(schoolId: string, id: string) {
    const head = await this.repo.findHeadById(schoolId, id);
    if (!head) throw new Error('Fee Head not found');
    return head;
  }

  async createHead(schoolId: string, data: Partial<FeeHead>, userId?: string) {
    if (!data.name || !data.name.trim()) throw new Error('Fee Head name is required');
    if (!data.code || !data.code.trim()) throw new Error('Fee Head code is required');

    const code = data.code.trim().toUpperCase();
    const existing = await this.repo.findHeadByCode(schoolId, code);
    if (existing) {
      throw new Error(`Fee Head with code '${code}' already exists in this school.`);
    }

    return this.repo.createHead(schoolId, {
      ...data,
      created_by: userId,
      updated_by: userId,
    });
  }

  async updateHead(schoolId: string, id: string, data: Partial<FeeHead>, userId?: string) {
    const head = await this.repo.findHeadById(schoolId, id);
    if (!head) throw new Error('Fee Head not found');

    if (data.code && data.code.trim().toUpperCase() !== head.code) {
      const code = data.code.trim().toUpperCase();
      const existing = await this.repo.findHeadByCode(schoolId, code);
      if (existing && existing.id !== id) {
        throw new Error(`Fee Head with code '${code}' already exists in this school.`);
      }
    }

    const updated = await this.repo.updateHead(schoolId, id, {
      ...data,
      updated_by: userId,
    });
    if (!updated) throw new Error('Failed to update Fee Head');
    return updated;
  }

  async deleteHead(schoolId: string, id: string) {
    const head = await this.repo.findHeadById(schoolId, id);
    if (!head) throw new Error('Fee Head not found');

    // Check if any fee structures reference this head
    const structures = await this.repo.findStructures(schoolId, { feeHeadId: id });
    if (structures.length > 0) {
      throw new Error('Cannot delete Fee Head: it is referenced by existing Fee Structures. Deactivate it instead.');
    }

    // Check if any demands reference this head
    const demands = await this.repo.findDemands(schoolId, { feeHeadId: id });
    if (demands.length > 0) {
      throw new Error('Cannot delete Fee Head: existing fee demands reference this head. Deactivate it instead.');
    }

    return this.repo.deleteHead(schoolId, id);
  }

  // ======================================================================
  // 2. Fee Structures Master
  // ======================================================================
  async getStructures(schoolId: string, filters?: { academicSessionId?: string; locationId?: string; classId?: string; sectionId?: string; exactSection?: boolean; feeHeadId?: string; status?: string }) {
    return this.repo.findStructures(schoolId, filters);
  }

  async getStructureById(schoolId: string, id: string) {
    const s = await this.repo.findStructureById(schoolId, id);
    if (!s) throw new Error('Fee Structure not found');
    return s;
  }

  async createStructure(schoolId: string, data: Partial<FeeStructure>, userId?: string) {
    if (!data.academic_session_id) throw new Error('Academic Session is required');
    if (!data.class_id) throw new Error('Class is required');
    if (!data.fee_head_id) throw new Error('Fee Head is required');
    if (data.amount === undefined || Number(data.amount) < 0) {
      throw new Error('Valid non-negative fee amount is required');
    }

    const head = await this.repo.findHeadById(schoolId, data.fee_head_id);
    if (!head) throw new Error('Referenced Fee Head does not exist');

    return this.repo.createStructure(schoolId, {
      ...data,
      created_by: userId,
      updated_by: userId,
    });
  }

  async updateStructure(schoolId: string, id: string, data: Partial<FeeStructure>, userId?: string) {
    const existing = await this.repo.findStructureById(schoolId, id);
    if (!existing) throw new Error('Fee Structure not found');

    if (data.amount !== undefined && Number(data.amount) < 0) {
      throw new Error('Amount cannot be negative');
    }

    const updated = await this.repo.updateStructure(schoolId, id, {
      ...data,
      updated_by: userId,
    });
    if (!updated) throw new Error('Failed to update Fee Structure');
    return updated;
  }

  async deleteStructure(schoolId: string, id: string) {
    const existing = await this.repo.findStructureById(schoolId, id);
    if (!existing) throw new Error('Fee Structure not found');

    // Demands check: past demands remain immutable even if structure is deleted
    return this.repo.deleteStructure(schoolId, id);
  }

  // ======================================================================
  // 3. Authoritative Demand Generation & Management
  // ======================================================================
  async generateDemands(schoolId: string, payload: GenerateDemandsPayload, userId?: string) {
    const {
      academic_session_id,
      location_id,
      class_id,
      section_id,
      student_user_ids,
      fee_structure_ids,
      billing_period,
      issue_date,
      due_date,
    } = payload;

    if (!academic_session_id) throw new Error('Academic Session is required');
    if (!class_id) throw new Error('Class is required');
    if (!billing_period || !billing_period.trim()) throw new Error('Billing Period is required');
    if (!issue_date) throw new Error('Issue Date is required');
    if (!due_date) throw new Error('Due Date is required');

    // 1. Authoritative Student Resolution from student_academic_enrollments
    const enrollmentFilters: any = {
      sessionId: academic_session_id,
      classId: class_id,
      status: 'ENROLLED',
    };
    if (location_id) enrollmentFilters.locationId = location_id;
    if (section_id) enrollmentFilters.sectionId = section_id;

    const enrollments = await academicRepository.findEnrollments(schoolId, enrollmentFilters);

    // Filter to selected students if specified
    const targetEnrollments = student_user_ids && student_user_ids.length > 0
      ? enrollments.filter((e) => student_user_ids.includes(e.student_user_id))
      : enrollments;

    if (targetEnrollments.length === 0) {
      throw new Error('No active enrolled students found matching the specified criteria.');
    }

    // 2. Resolve Applicable Fee Structures
    let structures = await this.repo.findStructures(schoolId, {
      academicSessionId: academic_session_id,
      classId: class_id,
      status: 'ACTIVE',
    });

    if (fee_structure_ids && fee_structure_ids.length > 0) {
      structures = structures.filter((s) => fee_structure_ids.includes(s.id));
    }

    if (structures.length === 0) {
      throw new Error('No active Fee Structures found for the selected Class and Session.');
    }

    // 3. Generate Demands (with Idempotent Duplicate Prevention)
    const generated: StudentFeeDemand[] = [];
    let skippedCount = 0;

    for (const enr of targetEnrollments) {
      for (const struct of structures) {
        // If structure is section-specific and doesn't match student's section, skip
        if (struct.section_id && struct.section_id !== enr.section_id) {
          continue;
        }

        // Check if demand already exists for this student, head, period, and session
        const existing = await this.repo.findExistingDemand(
          schoolId,
          enr.student_user_id,
          struct.fee_head_id,
          billing_period.trim(),
          academic_session_id
        );

        if (existing) {
          skippedCount++;
          continue;
        }

        const demand = await this.repo.createDemand(schoolId, {
          student_user_id: enr.student_user_id,
          student_enrollment_id: enr.id,
          academic_session_id,
          location_id: enr.location_id,
          class_id: enr.class_id,
          section_id: enr.section_id,
          fee_structure_id: struct.id,
          fee_head_id: struct.fee_head_id,
          billing_period: billing_period.trim(),
          issue_date,
          due_date,
          original_amount: struct.amount,
          discount_amount: 0,
          waiver_amount: 0,
          late_fee_amount: 0,
          paid_amount: 0,
          status: 'UNPAID',
          created_by: userId,
        });

        generated.push(demand);
      }
    }

    return {
      message: `Demand generation completed: ${generated.length} demands generated, ${skippedCount} duplicate/existing demands skipped.`,
      generated_count: generated.length,
      skipped_count: skippedCount,
      demands: generated,
    };
  }

  async getDemands(schoolId: string, filters?: any) {
    return this.repo.findDemands(schoolId, filters);
  }

  async getDemandById(schoolId: string, id: string) {
    const demand = await this.repo.findDemandById(schoolId, id);
    if (!demand) throw new Error('Fee Demand not found');
    return demand;
  }

  async cancelDemand(schoolId: string, id: string, reason: string, userId?: string) {
    if (!reason || !reason.trim()) throw new Error('Cancellation reason is required');

    const demand = await this.repo.findDemandById(schoolId, id);
    if (!demand) throw new Error('Fee Demand not found');

    if (demand.paid_amount > 0) {
      throw new Error(
        `Cannot cancel demand ${demand.demand_number}: ₹${demand.paid_amount.toFixed(2)} has already been paid on this invoice. Refund or reverse payment first.`
      );
    }

    const updated = await this.repo.updateDemand(schoolId, id, {
      status: 'CANCELLED',
      cancellation_reason: reason.trim(),
      cancelled_by: userId,
      cancelled_at: new Date().toISOString(),
      updated_by: userId,
    });

    return updated;
  }

  // ======================================================================
  // 4. Concessions, Discounts & Waivers
  // ======================================================================
  async applyAdjustment(schoolId: string, payload: ApplyAdjustmentPayload, userId?: string) {
    const { demand_id, adjustment_type, discount_name, amount, reason } = payload;

    if (!demand_id) throw new Error('Demand ID is required');
    if (!amount || Number(amount) <= 0) throw new Error('Adjustment amount must be greater than zero');
    if (!reason || !reason.trim()) throw new Error('Reason is required');

    const demand = await this.repo.findDemandById(schoolId, demand_id);
    if (!demand) throw new Error('Fee Demand not found');

    if (demand.status === 'CANCELLED') {
      throw new Error('Cannot apply adjustment to a cancelled fee demand');
    }

    const currentOutstanding = demand.net_amount - demand.paid_amount;
    const adjAmount = Number(amount);

    if (adjAmount > currentOutstanding) {
      throw new Error(
        `Adjustment amount (₹${adjAmount.toFixed(2)}) cannot exceed the current outstanding balance (₹${currentOutstanding.toFixed(2)})`
      );
    }

    // Record adjustment entry
    const adjustment = await this.repo.createAdjustment(schoolId, {
      student_fee_demand_id: demand_id,
      student_user_id: demand.student_user_id,
      adjustment_type,
      discount_name: discount_name || null,
      amount: adjAmount,
      reason: reason.trim(),
      status: 'APPROVED',
      approved_by: userId,
      created_by: userId,
    });

    // Update demand totals
    const updates: Partial<StudentFeeDemand> = {};
    if (adjustment_type === 'WAIVER') {
      updates.waiver_amount = demand.waiver_amount + adjAmount;
    } else if (adjustment_type === 'DISCOUNT') {
      updates.discount_amount = demand.discount_amount + adjAmount;
    } else if (adjustment_type === 'LATE_FEE_OVERRIDE') {
      updates.late_fee_amount = Math.max(0, demand.late_fee_amount - adjAmount);
    }

    const updatedDemand = await this.repo.updateDemand(schoolId, demand_id, updates);

    return {
      adjustment,
      updated_demand: updatedDemand,
    };
  }

  // ======================================================================
  // 5. Fee Collection & Instant Receipt Generation
  // ======================================================================
  async collectPayment(schoolId: string, payload: CollectPaymentPayload, userId?: string) {
    const {
      student_user_id,
      academic_session_id,
      location_id,
      payment_date,
      payment_mode,
      transaction_reference,
      remarks,
      allocations,
    } = payload;

    if (!student_user_id) throw new Error('Student is required');
    if (!academic_session_id) throw new Error('Academic Session is required');
    if (!location_id) throw new Error('Location/Campus is required');
    if (!payment_date) throw new Error('Payment Date is required');
    if (!payment_mode) throw new Error('Payment Mode is required');
    if (!allocations || allocations.length === 0) throw new Error('At least one fee demand allocation is required');

    let totalAmount = 0;
    const validatedAllocations: Array<{ demand: StudentFeeDemand; amount: number }> = [];

    // Pre-validate all line item allocations
    for (const alloc of allocations) {
      const amount = Number(alloc.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Allocation amount must be greater than zero');
      }

      const demand = await this.repo.findDemandById(schoolId, alloc.demand_id);
      if (!demand) {
        throw new Error(`Fee demand ${alloc.demand_id} not found`);
      }
      if (demand.student_user_id !== student_user_id) {
        throw new Error(`Fee demand ${demand.demand_number} does not belong to the specified student`);
      }
      if (demand.status === 'CANCELLED') {
        throw new Error(`Fee demand ${demand.demand_number} is cancelled`);
      }

      const outstanding = Math.max(0, demand.net_amount - demand.paid_amount);
      // Small epsilon for float tolerances
      if (amount > outstanding + 0.01) {
        throw new Error(
          `Overpayment rejected: Allocated amount ₹${amount.toFixed(2)} exceeds outstanding balance ₹${outstanding.toFixed(2)} on demand ${demand.demand_number}`
        );
      }

      totalAmount += amount;
      validatedAllocations.push({ demand, amount });
    }

    // 1. Create Payment Record
    const payment = await this.repo.createPayment(schoolId, {
      student_user_id,
      academic_session_id,
      location_id,
      payment_date,
      total_amount: Math.round(totalAmount * 100) / 100,
      payment_mode,
      transaction_reference: transaction_reference?.trim() || null,
      remarks: remarks?.trim() || null,
      status: 'SUCCESS',
      created_by: userId,
    });

    // 2. Create Payment Allocations
    await this.repo.createPaymentAllocations(
      schoolId,
      payment.id,
      validatedAllocations.map((a) => ({
        student_fee_demand_id: a.demand.id,
        allocated_amount: a.amount,
      }))
    );

    // 3. Update Demands' Paid Amount & Status
    for (const item of validatedAllocations) {
      const newPaidAmount = Math.round((item.demand.paid_amount + item.amount) * 100) / 100;
      await this.repo.updateDemand(schoolId, item.demand.id, {
        paid_amount: newPaidAmount,
        updated_by: userId,
      });
    }

    // 4. Authoritative Immutable Receipt Generation
    const receipt = await this.repo.createReceipt(schoolId, {
      payment_id: payment.id,
      student_user_id,
      academic_session_id,
      location_id,
      receipt_date: payment_date,
      total_amount: payment.total_amount,
      status: 'ACTIVE',
      created_by: userId,
    });

    return {
      payment,
      receipt,
      allocations: validatedAllocations.map((a) => ({
        demand_number: a.demand.demand_number,
        allocated_amount: a.amount,
      })),
    };
  }

  async getPayments(schoolId: string, filters?: any) {
    return this.repo.findPayments(schoolId, filters);
  }

  async getPaymentById(schoolId: string, id: string) {
    const p = await this.repo.findPaymentById(schoolId, id);
    if (!p) throw new Error('Payment not found');
    return p;
  }

  // ======================================================================
  // 6. Receipts
  // ======================================================================
  async getReceipts(schoolId: string, filters?: any) {
    return this.repo.findReceipts(schoolId, filters);
  }

  async getReceiptById(schoolId: string, id: string) {
    const r = await this.repo.findReceiptById(schoolId, id);
    if (!r) throw new Error('Fee Receipt not found');
    return r;
  }

  // ======================================================================
  // 7. Refunds & Adjustments
  // ======================================================================
  async processRefund(schoolId: string, payload: ProcessRefundPayload, userId?: string) {
    const { payment_id, refund_amount, refund_mode, reason, reference_no } = payload;

    if (!payment_id) throw new Error('Payment ID is required');
    const amount = Number(refund_amount);
    if (isNaN(amount) || amount <= 0) throw new Error('Valid positive refund amount is required');
    if (!reason || !reason.trim()) throw new Error('Refund reason is required');

    const payment = await this.repo.findPaymentById(schoolId, payment_id);
    if (!payment) throw new Error('Payment record not found');

    const maxRefundable = Math.max(0, payment.total_amount - payment.refunded_amount);
    if (amount > maxRefundable + 0.01) {
      throw new Error(
        `Refund amount ₹${amount.toFixed(2)} exceeds remaining refundable balance ₹${maxRefundable.toFixed(2)} on this payment.`
      );
    }

    // 1. Create Refund Record
    const refund = await this.repo.createRefund(schoolId, {
      payment_id,
      student_user_id: payment.student_user_id,
      refund_amount: amount,
      refund_mode: refund_mode || 'BANK_TRANSFER',
      reason: reason.trim(),
      reference_no: reference_no?.trim() || null,
      approved_by: userId,
      created_by: userId,
    });

    // 2. Update Payment Refunded Amount & Status
    const newRefunded = Math.round((payment.refunded_amount + amount) * 100) / 100;
    const newStatus = newRefunded >= payment.total_amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    const updatedPayment = await this.repo.updatePayment(schoolId, payment_id, {
      refunded_amount: newRefunded,
      status: newStatus,
    });

    // 3. Roll back paid amounts on allocated demands sequentially
    const allocations = await this.repo.findAllocationsByPaymentId(schoolId, payment_id);
    let remainingToDeduct = amount;

    for (const alloc of allocations) {
      if (remainingToDeduct <= 0) break;
      const demand = await this.repo.findDemandById(schoolId, alloc.student_fee_demand_id);
      if (!demand) continue;

      const deduction = Math.min(remainingToDeduct, demand.paid_amount, alloc.allocated_amount);
      if (deduction > 0) {
        await this.repo.updateDemand(schoolId, demand.id, {
          paid_amount: Math.max(0, Math.round((demand.paid_amount - deduction) * 100) / 100),
          updated_by: userId,
        });
        remainingToDeduct -= deduction;
      }
    }

    return {
      refund,
      updated_payment: updatedPayment,
    };
  }

  async getRefunds(schoolId: string, filters?: any) {
    return this.repo.findRefunds(schoolId, filters);
  }

  // ======================================================================
  // 8. Financial Ledger & Executive Reports
  // ======================================================================
  async getStudentLedger(schoolId: string, studentUserId: string): Promise<StudentFeeLedgerItem[]> {
    if (!studentUserId) throw new Error('Student user ID is required');
    return this.repo.getStudentLedger(schoolId, studentUserId);
  }

  async getDashboardMetrics(schoolId: string, academicSessionId?: string, locationId?: string): Promise<FeeDashboardMetrics> {
    return this.repo.getDashboardMetrics(schoolId, academicSessionId, locationId);
  }

  async getReports(schoolId: string, reportType: string, filters?: any) {
    const demands = await this.repo.findDemands(schoolId, filters);
    const payments = await this.repo.findPayments(schoolId, filters);

    if (reportType === 'daily_collection') {
      const dateMap = new Map<string, { total: number; cash: number; upi: number; bank: number; card: number; count: number }>();
      for (const p of payments) {
        if (p.status !== 'SUCCESS' && p.status !== 'PARTIALLY_REFUNDED') continue;
        const d = p.payment_date;
        const entry = dateMap.get(d) || { total: 0, cash: 0, upi: 0, bank: 0, card: 0, count: 0 };
        const net = p.total_amount - (p.refunded_amount || 0);
        entry.total += net;
        entry.count += 1;
        if (p.payment_mode === 'CASH') entry.cash += net;
        else if (p.payment_mode === 'UPI') entry.upi += net;
        else if (p.payment_mode === 'BANK_TRANSFER') entry.bank += net;
        else if (p.payment_mode === 'CARD') entry.card += net;
        dateMap.set(d, entry);
      }

      const rows = Array.from(dateMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => b.date.localeCompare(a.date));

      return { report_type: 'daily_collection', data: rows };
    }

    if (reportType === 'monthly_collection') {
      const monthMap = new Map<string, { total: number; count: number }>();
      for (const p of payments) {
        if (p.status !== 'SUCCESS' && p.status !== 'PARTIALLY_REFUNDED') continue;
        const m = p.payment_date.slice(0, 7);
        const entry = monthMap.get(m) || { total: 0, count: 0 };
        entry.total += p.total_amount - (p.refunded_amount || 0);
        entry.count += 1;
        monthMap.set(m, entry);
      }

      const rows = Array.from(monthMap.entries())
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => b.month.localeCompare(a.month));

      return { report_type: 'monthly_collection', data: rows };
    }

    if (reportType === 'head_wise') {
      const headMap = new Map<string, { head_name: string; head_code: string; demand: number; collected: number; outstanding: number }>();
      for (const d of demands) {
        if (d.status === 'CANCELLED') continue;
        const key = d.fee_head_id;
        const name = d.fee_head?.name || 'Unknown Head';
        const code = d.fee_head?.code || '';
        const entry = headMap.get(key) || { head_name: name, head_code: code, demand: 0, collected: 0, outstanding: 0 };
        entry.demand += d.net_amount;
        entry.collected += d.paid_amount;
        entry.outstanding += Math.max(0, d.net_amount - d.paid_amount);
        headMap.set(key, entry);
      }

      const rows = Array.from(headMap.values()).sort((a, b) => b.demand - a.demand);
      return { report_type: 'head_wise', data: rows };
    }

    if (reportType === 'class_wise') {
      const classMap = new Map<string, { class_name: string; total_students: Set<string>; demand: number; collected: number; outstanding: number }>();
      for (const d of demands) {
        if (d.status === 'CANCELLED') continue;
        const key = d.class_id;
        const name = d.class?.name || 'Class';
        const entry = classMap.get(key) || { class_name: name, total_students: new Set<string>(), demand: 0, collected: 0, outstanding: 0 };
        entry.total_students.add(d.student_user_id);
        entry.demand += d.net_amount;
        entry.collected += d.paid_amount;
        entry.outstanding += Math.max(0, d.net_amount - d.paid_amount);
        classMap.set(key, entry);
      }

      const rows = Array.from(classMap.values())
        .map((r) => ({
          class_name: r.class_name,
          student_count: r.total_students.size,
          demand: Math.round(r.demand * 100) / 100,
          collected: Math.round(r.collected * 100) / 100,
          outstanding: Math.round(r.outstanding * 100) / 100,
        }))
        .sort((a, b) => a.class_name.localeCompare(b.class_name));

      return { report_type: 'class_wise', data: rows };
    }

    if (reportType === 'payment_mode') {
      const modeMap = new Map<string, { mode: string; count: number; total: number }>();
      for (const p of payments) {
        if (p.status !== 'SUCCESS' && p.status !== 'PARTIALLY_REFUNDED') continue;
        const mode = p.payment_mode;
        const entry = modeMap.get(mode) || { mode, count: 0, total: 0 };
        entry.count += 1;
        entry.total += p.total_amount - (p.refunded_amount || 0);
        modeMap.set(mode, entry);
      }

      const rows = Array.from(modeMap.values()).sort((a, b) => b.total - a.total);
      return { report_type: 'payment_mode', data: rows };
    }

    return { report_type: 'unknown', data: [] };
  }
}

export const feesService = new FeesService();
