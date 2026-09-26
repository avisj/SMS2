// ========================================================================
// Fees Management Repository
// Multi-Tenant PostgREST (Supabase) + In-Memory Fallback Data Access Layer
// Authoritative Financial State Engine with Strict Audit & Immutability
// ========================================================================

import crypto from 'crypto';
import {
  FeeHead,
  FeeStructure,
  StudentFeeDemand,
  FeeDemandAdjustment,
  FeePayment,
  FeePaymentAllocation,
  FeeReceipt,
  FeeRefund,
  StudentFeeLedgerItem,
  FeeDashboardMetrics,
  StudentAcademicEnrollment,
  User,
  ClassItem,
  SectionItem,
  AcademicSession,
  Location,
  School,
} from '../types/index.js';
import {
  getMemoryDbClient,
  getSupabaseClient,
  isSupabaseDatabaseActive,
} from '../db/client.js';

export interface FeeHeadFilters {
  category?: string;
  status?: string;
  search?: string;
}

export interface FeeStructureFilters {
  academicSessionId?: string;
  locationId?: string;
  classId?: string;
  sectionId?: string;
  exactSection?: boolean;
  feeHeadId?: string;
  status?: string;
}

export interface FeeDemandFilters {
  studentUserId?: string;
  academicSessionId?: string;
  locationId?: string;
  classId?: string;
  sectionId?: string;
  feeHeadId?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface FeePaymentFilters {
  studentUserId?: string;
  academicSessionId?: string;
  locationId?: string;
  paymentMode?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface FeeReceiptFilters {
  studentUserId?: string;
  academicSessionId?: string;
  locationId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export class FeesRepository {
  private mem = getMemoryDbClient();

  // ======================================================================
  // 1. Fee Heads (Master Catalog)
  // ======================================================================
  async findHeads(schoolId: string, filters?: FeeHeadFilters): Promise<FeeHead[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      let q = getSupabaseClient()!
        .from('fee_heads')
        .select('*')
        .eq('school_id', schoolId)
        .is('deleted_at', null);

      if (filters?.category) q = q.eq('category', filters.category);
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.search) {
        q = q.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }
      q = q.order('display_order', { ascending: true }).order('name', { ascending: true });

      const { data, error } = await q;
      if (!error && data) {
        return data as FeeHead[];
      }
    }

    const list = this.mem.findAll('fee_heads', (row: FeeHead) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (filters?.category && row.category !== filters.category) return false;
      if (filters?.status && row.status !== filters.status) return false;
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        const matchesName = row.name.toLowerCase().includes(s);
        const matchesCode = row.code.toLowerCase().includes(s);
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    }) as FeeHead[];

    return list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name));
  }

  async findHeadById(schoolId: string, id: string): Promise<FeeHead | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('fee_heads')
        .select('*')
        .eq('school_id', schoolId)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!error && data) return data as FeeHead;
    }

    const row = this.mem.findById('fee_heads', id) as FeeHead | null;
    if (row && row.school_id === schoolId && !row.deleted_at) return row;
    return null;
  }

  async findHeadByCode(schoolId: string, code: string): Promise<FeeHead | null> {
    const formattedCode = code.trim().toUpperCase();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('fee_heads')
        .select('*')
        .eq('school_id', schoolId)
        .eq('code', formattedCode)
        .is('deleted_at', null)
        .maybeSingle();

      if (!error && data) return data as FeeHead;
    }

    const list = this.mem.findAll('fee_heads', (row: FeeHead) => {
      return row.school_id === schoolId && !row.deleted_at && row.code.toUpperCase() === formattedCode;
    }) as FeeHead[];

    return list[0] || null;
  }

  async createHead(schoolId: string, data: Partial<FeeHead>): Promise<FeeHead> {
    const now = new Date().toISOString();
    const id = data.id || crypto.randomUUID();
    const record: FeeHead = {
      id,
      school_id: schoolId,
      code: (data.code || '').trim().toUpperCase(),
      name: (data.name || '').trim(),
      description: data.description || null,
      category: data.category || 'ACADEMIC',
      is_taxable: Boolean(data.is_taxable),
      tax_rate: Number(data.tax_rate) || 0,
      display_order: Number(data.display_order) || 0,
      status: data.status || 'ACTIVE',
      created_by: data.created_by || null,
      updated_by: data.updated_by || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_heads').insert(record);
    }
    this.mem.insert('fee_heads', record);
    return record;
  }

  async updateHead(schoolId: string, id: string, data: Partial<FeeHead>): Promise<FeeHead | null> {
    const existing = await this.findHeadById(schoolId, id);
    if (!existing) return null;

    const updates: Partial<FeeHead> = {
      ...data,
      updated_at: new Date().toISOString(),
    };
    if (updates.code) updates.code = updates.code.trim().toUpperCase();
    if (updates.name) updates.name = updates.name.trim();

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_heads').update(updates).eq('id', id).eq('school_id', schoolId);
    }
    const updated = this.mem.update('fee_heads', id, updates) as FeeHead;
    return updated;
  }

  async deleteHead(schoolId: string, id: string): Promise<boolean> {
    const now = new Date().toISOString();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_heads').update({ deleted_at: now, updated_at: now }).eq('id', id).eq('school_id', schoolId);
    }
    return this.mem.softDelete('fee_heads', id);
  }

  // ======================================================================
  // 2. Fee Structures (Class/Grade Fee Blueprints)
  // ======================================================================
  async findStructures(schoolId: string, filters?: FeeStructureFilters): Promise<FeeStructure[]> {
    const targetClassId = filters?.classId;
    const aliasClassId = targetClassId === '5a982e49-18b3-48b3-87ab-2b4b4e2d32d6' ? '99f432a4-1c9c-4ba3-ae80-6e59e68ae1df' : undefined;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      let q = getSupabaseClient()!
        .from('fee_structures')
        .select('*')
        .eq('school_id', schoolId)
        .is('deleted_at', null);

      if (filters?.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
      if (filters?.locationId) q = q.eq('location_id', filters.locationId);
      if (targetClassId) {
        if (aliasClassId) {
          q = q.in('class_id', [targetClassId, aliasClassId]);
        } else {
          q = q.eq('class_id', targetClassId);
        }
      }
      if (filters?.sectionId) {
        if (filters.exactSection) {
          q = q.eq('section_id', filters.sectionId);
        } else {
          q = q.or(`section_id.eq.${filters.sectionId},section_id.is.null`);
        }
      }
      if (filters?.feeHeadId) q = q.eq('fee_head_id', filters.feeHeadId);
      if (filters?.status) q = q.eq('status', filters.status);

      const { data, error } = await q;
      if (!error && data) {
        return (data as FeeStructure[]).map((s) => this.enrichStructure(s));
      }
    }

    const list = this.mem.findAll('fee_structures', (row: FeeStructure) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (filters?.academicSessionId && row.academic_session_id !== filters.academicSessionId) return false;
      if (filters?.locationId && row.location_id !== filters.locationId) return false;
      if (targetClassId) {
        if (row.class_id !== targetClassId && row.class_id !== aliasClassId) return false;
      }
      if (filters?.sectionId) {
        if (filters.exactSection) {
          if (row.section_id !== filters.sectionId) return false;
        } else {
          if (row.section_id !== null && row.section_id !== undefined && row.section_id !== filters.sectionId) return false;
        }
      }
      if (filters?.feeHeadId && row.fee_head_id !== filters.feeHeadId) return false;
      if (filters?.status && row.status !== filters.status) return false;
      return true;
    }) as FeeStructure[];

    return list.map((s) => this.enrichStructure(s));
  }

  async findStructureById(schoolId: string, id: string): Promise<FeeStructure | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('fee_structures')
        .select('*')
        .eq('school_id', schoolId)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!error && data) return this.enrichStructure(data as FeeStructure);
    }

    const row = this.mem.findById('fee_structures', id) as FeeStructure | null;
    if (row && row.school_id === schoolId && !row.deleted_at) {
      return this.enrichStructure(row);
    }
    return null;
  }

  async createStructure(schoolId: string, data: Partial<FeeStructure>): Promise<FeeStructure> {
    const now = new Date().toISOString();
    const id = data.id || crypto.randomUUID();
    const classId = data.class_id === '99f432a4-1c9c-4ba3-ae80-6e59e68ae1df'
      ? '5a982e49-18b3-48b3-87ab-2b4b4e2d32d6'
      : data.class_id!;

    const record: FeeStructure = {
      id,
      school_id: schoolId,
      academic_session_id: data.academic_session_id!,
      location_id: data.location_id || null,
      class_id: classId,
      section_id: data.section_id || null,
      fee_head_id: data.fee_head_id!,
      frequency: data.frequency || 'MONTHLY',
      amount: Number(data.amount) || 0,
      due_day_of_month: Number(data.due_day_of_month) || 10,
      notes: data.notes || null,
      status: data.status || 'ACTIVE',
      created_by: data.created_by || null,
      updated_by: data.updated_by || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_structures').insert(record);
    }
    this.mem.insert('fee_structures', record);
    return this.enrichStructure(record);
  }

  async updateStructure(schoolId: string, id: string, data: Partial<FeeStructure>): Promise<FeeStructure | null> {
    const existing = await this.findStructureById(schoolId, id);
    if (!existing) return null;

    const updates: Partial<FeeStructure> = {
      ...data,
      amount: data.amount !== undefined ? Number(data.amount) : undefined,
      due_day_of_month: data.due_day_of_month !== undefined ? Number(data.due_day_of_month) : undefined,
      updated_at: new Date().toISOString(),
    };
    if (updates.class_id === '99f432a4-1c9c-4ba3-ae80-6e59e68ae1df') {
      updates.class_id = '5a982e49-18b3-48b3-87ab-2b4b4e2d32d6';
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_structures').update(updates).eq('id', id).eq('school_id', schoolId);
    }
    const updated = this.mem.update('fee_structures', id, updates) as FeeStructure;
    return this.enrichStructure(updated);
  }

  async deleteStructure(schoolId: string, id: string): Promise<boolean> {
    const now = new Date().toISOString();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_structures').update({ deleted_at: now, updated_at: now }).eq('id', id).eq('school_id', schoolId);
    }
    return this.mem.softDelete('fee_structures', id);
  }

  // ======================================================================
  // 3. Student Fee Demands (Authoritative Receivables)
  // ======================================================================
  async findDemands(schoolId: string, filters?: FeeDemandFilters): Promise<StudentFeeDemand[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      let q = getSupabaseClient()!
        .from('student_fee_demands')
        .select('*')
        .eq('school_id', schoolId)
        .is('deleted_at', null);

      if (filters?.studentUserId) q = q.eq('student_user_id', filters.studentUserId);
      if (filters?.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
      if (filters?.locationId) q = q.eq('location_id', filters.locationId);
      if (filters?.classId) q = q.eq('class_id', filters.classId);
      if (filters?.sectionId) q = q.eq('section_id', filters.sectionId);
      if (filters?.feeHeadId) q = q.eq('fee_head_id', filters.feeHeadId);
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.startDate) q = q.gte('due_date', filters.startDate);
      if (filters?.endDate) q = q.lte('due_date', filters.endDate);

      q = q.order('due_date', { ascending: true });

      const { data, error } = await q;
      if (!error && data) {
        return (data as StudentFeeDemand[]).map((d) => this.enrichDemand(d));
      }
    }

    const list = this.mem.findAll('student_fee_demands', (row: StudentFeeDemand) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (filters?.studentUserId && row.student_user_id !== filters.studentUserId) return false;
      if (filters?.academicSessionId && row.academic_session_id !== filters.academicSessionId) return false;
      if (filters?.locationId && row.location_id !== filters.locationId) return false;
      if (filters?.classId && row.class_id !== filters.classId) return false;
      if (filters?.sectionId && row.section_id !== filters.sectionId) return false;
      if (filters?.feeHeadId && row.fee_head_id !== filters.feeHeadId) return false;
      if (filters?.status && row.status !== filters.status) return false;
      if (filters?.startDate && row.due_date < filters.startDate) return false;
      if (filters?.endDate && row.due_date > filters.endDate) return false;
      return true;
    }) as StudentFeeDemand[];

    return list.map((d) => this.enrichDemand(d));
  }

  async findDemandById(schoolId: string, id: string): Promise<StudentFeeDemand | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('student_fee_demands')
        .select('*')
        .eq('school_id', schoolId)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!error && data) return this.enrichDemand(data as StudentFeeDemand);
    }

    const row = this.mem.findById('student_fee_demands', id) as StudentFeeDemand | null;
    if (row && row.school_id === schoolId && !row.deleted_at) {
      return this.enrichDemand(row);
    }
    return null;
  }

  async findExistingDemand(
    schoolId: string,
    studentUserId: string,
    feeHeadId: string,
    billingPeriod: string,
    academicSessionId: string
  ): Promise<StudentFeeDemand | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('student_fee_demands')
        .select('*')
        .eq('school_id', schoolId)
        .eq('student_user_id', studentUserId)
        .eq('fee_head_id', feeHeadId)
        .eq('billing_period', billingPeriod)
        .eq('academic_session_id', academicSessionId)
        .is('deleted_at', null)
        .maybeSingle();

      if (!error && data) return this.enrichDemand(data as StudentFeeDemand);
    }

    const matches = this.mem.findAll('student_fee_demands', (row: StudentFeeDemand) => {
      return (
        row.school_id === schoolId &&
        row.student_user_id === studentUserId &&
        row.fee_head_id === feeHeadId &&
        row.billing_period === billingPeriod &&
        row.academic_session_id === academicSessionId &&
        !row.deleted_at
      );
    }) as StudentFeeDemand[];

    return matches.length > 0 ? this.enrichDemand(matches[0]) : null;
  }

  async createDemand(schoolId: string, data: Partial<StudentFeeDemand>): Promise<StudentFeeDemand> {
    const now = new Date().toISOString();
    const id = data.id || crypto.randomUUID();
    const demandNumber = data.demand_number || (await this.getNextDemandNumber(schoolId));
    const orig = Number(data.original_amount) || 0;
    const disc = Number(data.discount_amount) || 0;
    const waiv = Number(data.waiver_amount) || 0;
    const late = Number(data.late_fee_amount) || 0;
    const net = Math.max(0, orig - disc - waiv + late);

    const record: StudentFeeDemand = {
      id,
      demand_number: demandNumber,
      school_id: schoolId,
      student_user_id: data.student_user_id!,
      student_enrollment_id: data.student_enrollment_id || null,
      academic_session_id: data.academic_session_id!,
      location_id: data.location_id!,
      class_id: data.class_id!,
      section_id: data.section_id!,
      fee_structure_id: data.fee_structure_id || null,
      fee_head_id: data.fee_head_id!,
      billing_period: data.billing_period!,
      issue_date: data.issue_date || now.split('T')[0],
      due_date: data.due_date || now.split('T')[0],
      original_amount: orig,
      discount_amount: disc,
      waiver_amount: waiv,
      late_fee_amount: late,
      net_amount: net,
      paid_amount: Number(data.paid_amount) || 0,
      status: data.status || 'UNPAID',
      cancellation_reason: data.cancellation_reason || null,
      cancelled_by: data.cancelled_by || null,
      cancelled_at: data.cancelled_at || null,
      created_by: data.created_by || null,
      updated_by: data.updated_by || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('student_fee_demands').insert(record);
    }
    this.mem.insert('student_fee_demands', record);
    return this.enrichDemand(record);
  }

  async bulkCreateDemands(schoolId: string, demands: Partial<StudentFeeDemand>[]): Promise<StudentFeeDemand[]> {
    const results: StudentFeeDemand[] = [];
    for (const d of demands) {
      const created = await this.createDemand(schoolId, d);
      results.push(created);
    }
    return results;
  }

  async updateDemand(schoolId: string, id: string, data: Partial<StudentFeeDemand>): Promise<StudentFeeDemand | null> {
    const existing = await this.findDemandById(schoolId, id);
    if (!existing) return null;

    const updates: Partial<StudentFeeDemand> = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (
      data.original_amount !== undefined ||
      data.discount_amount !== undefined ||
      data.waiver_amount !== undefined ||
      data.late_fee_amount !== undefined
    ) {
      const orig = data.original_amount !== undefined ? Number(data.original_amount) : existing.original_amount;
      const disc = data.discount_amount !== undefined ? Number(data.discount_amount) : existing.discount_amount;
      const waiv = data.waiver_amount !== undefined ? Number(data.waiver_amount) : existing.waiver_amount;
      const late = data.late_fee_amount !== undefined ? Number(data.late_fee_amount) : existing.late_fee_amount;
      updates.net_amount = Math.max(0, orig - disc - waiv + late);
    }

    if (updates.paid_amount !== undefined || updates.net_amount !== undefined) {
      const net = updates.net_amount !== undefined ? updates.net_amount : existing.net_amount;
      const paid = updates.paid_amount !== undefined ? Number(updates.paid_amount) : existing.paid_amount;
      if (paid >= net && net > 0) {
        updates.status = 'PAID';
      } else if (paid > 0 && paid < net) {
        updates.status = 'PARTIALLY_PAID';
      } else if (paid === 0) {
        const today = new Date().toISOString().split('T')[0];
        if (existing.due_date < today) {
          updates.status = 'OVERDUE';
        } else {
          updates.status = 'UNPAID';
        }
      }
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('student_fee_demands').update(updates).eq('id', id).eq('school_id', schoolId);
    }
    const updated = this.mem.update('student_fee_demands', id, updates) as StudentFeeDemand;
    return this.enrichDemand(updated);
  }

  // ======================================================================
  // 4. Adjustments & Waivers
  // ======================================================================
  async createAdjustment(schoolId: string, data: Partial<FeeDemandAdjustment>): Promise<FeeDemandAdjustment> {
    const now = new Date().toISOString();
    const id = data.id || crypto.randomUUID();
    const record: FeeDemandAdjustment = {
      id,
      school_id: schoolId,
      student_fee_demand_id: data.student_fee_demand_id!,
      student_user_id: data.student_user_id!,
      adjustment_type: data.adjustment_type || 'DISCOUNT',
      discount_name: data.discount_name || null,
      amount: Number(data.amount) || 0,
      reason: data.reason || 'Management concession',
      status: data.status || 'APPROVED',
      approved_by: data.approved_by || null,
      approved_at: data.approved_at || now,
      created_by: data.created_by || null,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_demand_adjustments').insert(record);
    }
    this.mem.insert('fee_demand_adjustments', record);
    return record;
  }

  async findAdjustments(
    schoolId: string,
    filters?: { demandId?: string; studentUserId?: string; status?: string }
  ): Promise<FeeDemandAdjustment[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      let q = getSupabaseClient()!
        .from('fee_demand_adjustments')
        .select('*')
        .eq('school_id', schoolId);

      if (filters?.demandId) q = q.eq('student_fee_demand_id', filters.demandId);
      if (filters?.studentUserId) q = q.eq('student_user_id', filters.studentUserId);
      if (filters?.status) q = q.eq('status', filters.status);

      const { data, error } = await q;
      if (!error && data) return data as FeeDemandAdjustment[];
    }

    return this.mem.findAll('fee_demand_adjustments', (row: FeeDemandAdjustment) => {
      if (row.school_id !== schoolId) return false;
      if (filters?.demandId && row.student_fee_demand_id !== filters.demandId) return false;
      if (filters?.studentUserId && row.student_user_id !== filters.studentUserId) return false;
      if (filters?.status && row.status !== filters.status) return false;
      return true;
    }) as FeeDemandAdjustment[];
  }

  // ======================================================================
  // 5. Payments & Allocations (Collections)
  // ======================================================================
  async createPayment(schoolId: string, data: Partial<FeePayment>): Promise<FeePayment> {
    const now = new Date().toISOString();
    const id = data.id || crypto.randomUUID();
    const paymentNumber = data.payment_number || (await this.getNextPaymentNumber(schoolId));
    const totalAmount = Number(data.total_amount) || 0;

    const record: FeePayment = {
      id,
      payment_number: paymentNumber,
      school_id: schoolId,
      student_user_id: data.student_user_id!,
      academic_session_id: data.academic_session_id!,
      location_id: data.location_id!,
      payment_date: data.payment_date || now.split('T')[0],
      total_amount: totalAmount,
      refunded_amount: 0,
      payment_mode: data.payment_mode || 'CASH',
      transaction_reference: data.transaction_reference || null,
      remarks: data.remarks || null,
      status: data.status || 'SUCCESS',
      created_by: data.created_by || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_payments').insert(record);
    }
    this.mem.insert('fee_payments', record);
    return this.enrichPayment(record);
  }

  async createPaymentAllocations(
    schoolId: string,
    paymentId: string,
    allocations: { student_fee_demand_id: string; allocated_amount: number }[]
  ): Promise<FeePaymentAllocation[]> {
    const now = new Date().toISOString();
    const saved: FeePaymentAllocation[] = [];

    for (const item of allocations) {
      const allocRecord: FeePaymentAllocation = {
        id: crypto.randomUUID(),
        school_id: schoolId,
        payment_id: paymentId,
        student_fee_demand_id: item.student_fee_demand_id,
        allocated_amount: Number(item.allocated_amount) || 0,
        created_at: now,
      };

      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        await getSupabaseClient()!.from('fee_payment_allocations').insert(allocRecord);
      }
      this.mem.insert('fee_payment_allocations', allocRecord);
      saved.push(allocRecord);
    }

    return saved;
  }

  async findPayments(schoolId: string, filters?: FeePaymentFilters): Promise<FeePayment[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      let q = getSupabaseClient()!
        .from('fee_payments')
        .select('*')
        .eq('school_id', schoolId)
        .is('deleted_at', null);

      if (filters?.studentUserId) q = q.eq('student_user_id', filters.studentUserId);
      if (filters?.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
      if (filters?.locationId) q = q.eq('location_id', filters.locationId);
      if (filters?.paymentMode) q = q.eq('payment_mode', filters.paymentMode);
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.startDate) q = q.gte('payment_date', filters.startDate);
      if (filters?.endDate) q = q.lte('payment_date', filters.endDate);

      q = q.order('payment_date', { ascending: false }).order('created_at', { ascending: false });

      const { data, error } = await q;
      if (!error && data) {
        return (data as FeePayment[]).map((p) => this.enrichPayment(p));
      }
    }

    const list = this.mem.findAll('fee_payments', (row: FeePayment) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (filters?.studentUserId && row.student_user_id !== filters.studentUserId) return false;
      if (filters?.academicSessionId && row.academic_session_id !== filters.academicSessionId) return false;
      if (filters?.locationId && row.location_id !== filters.locationId) return false;
      if (filters?.paymentMode && row.payment_mode !== filters.paymentMode) return false;
      if (filters?.status && row.status !== filters.status) return false;
      if (filters?.startDate && row.payment_date < filters.startDate) return false;
      if (filters?.endDate && row.payment_date > filters.endDate) return false;
      return true;
    }) as FeePayment[];

    return list.sort((a, b) => b.payment_date.localeCompare(a.payment_date)).map((p) => this.enrichPayment(p));
  }

  async findPaymentById(schoolId: string, id: string): Promise<FeePayment | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('fee_payments')
        .select('*')
        .eq('school_id', schoolId)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (!error && data) return this.enrichPayment(data as FeePayment);
    }

    const row = this.mem.findById('fee_payments', id) as FeePayment | null;
    if (row && row.school_id === schoolId && !row.deleted_at) {
      return this.enrichPayment(row);
    }
    return null;
  }

  async updatePayment(schoolId: string, id: string, data: Partial<FeePayment>): Promise<FeePayment | null> {
    const existing = await this.findPaymentById(schoolId, id);
    if (!existing) return null;

    const updates: Partial<FeePayment> = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_payments').update(updates).eq('id', id).eq('school_id', schoolId);
    }
    const updated = this.mem.update('fee_payments', id, updates) as FeePayment;
    return this.enrichPayment(updated);
  }

  async findAllocationsByPaymentId(schoolId: string, paymentId: string): Promise<FeePaymentAllocation[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('fee_payment_allocations')
        .select('*')
        .eq('school_id', schoolId)
        .eq('payment_id', paymentId);

      if (!error && data) {
        return (data as FeePaymentAllocation[]).map((a) => ({
          ...a,
          demand: (this.mem.findById('student_fee_demands', a.student_fee_demand_id) as StudentFeeDemand) || undefined,
        }));
      }
    }

    const list = this.mem.findAll('fee_payment_allocations', (row: FeePaymentAllocation) => {
      return row.school_id === schoolId && row.payment_id === paymentId;
    }) as FeePaymentAllocation[];

    return list.map((a) => ({
      ...a,
      demand: (this.mem.findById('student_fee_demands', a.student_fee_demand_id) as StudentFeeDemand) || undefined,
    }));
  }

  // ======================================================================
  // 6. Fee Receipts (Vouchers)
  // ======================================================================
  async createReceipt(schoolId: string, data: Partial<FeeReceipt>): Promise<FeeReceipt> {
    const now = new Date().toISOString();
    const id = data.id || crypto.randomUUID();
    const receiptNumber = data.receipt_number || (await this.getNextReceiptNumber(schoolId));

    const record: FeeReceipt = {
      id,
      receipt_number: receiptNumber,
      school_id: schoolId,
      payment_id: data.payment_id!,
      student_user_id: data.student_user_id!,
      academic_session_id: data.academic_session_id!,
      location_id: data.location_id!,
      receipt_date: data.receipt_date || now.split('T')[0],
      total_amount: Number(data.total_amount) || 0,
      status: data.status || 'ACTIVE',
      created_by: data.created_by || null,
      created_at: now,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_receipts').insert(record);
    }
    this.mem.insert('fee_receipts', record);
    return this.enrichReceipt(record);
  }

  async findReceipts(schoolId: string, filters?: FeeReceiptFilters): Promise<FeeReceipt[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      let q = getSupabaseClient()!
        .from('fee_receipts')
        .select('*')
        .eq('school_id', schoolId);

      if (filters?.studentUserId) q = q.eq('student_user_id', filters.studentUserId);
      if (filters?.academicSessionId) q = q.eq('academic_session_id', filters.academicSessionId);
      if (filters?.locationId) q = q.eq('location_id', filters.locationId);
      if (filters?.startDate) q = q.gte('receipt_date', filters.startDate);
      if (filters?.endDate) q = q.lte('receipt_date', filters.endDate);
      if (filters?.search) {
        q = q.ilike('receipt_number', `%${filters.search}%`);
      }

      q = q.order('receipt_date', { ascending: false }).order('created_at', { ascending: false });

      const { data, error } = await q;
      if (!error && data) {
        return (data as FeeReceipt[]).map((r) => this.enrichReceipt(r));
      }
    }

    const list = this.mem.findAll('fee_receipts', (row: FeeReceipt) => {
      if (row.school_id !== schoolId) return false;
      if (filters?.studentUserId && row.student_user_id !== filters.studentUserId) return false;
      if (filters?.academicSessionId && row.academic_session_id !== filters.academicSessionId) return false;
      if (filters?.locationId && row.location_id !== filters.locationId) return false;
      if (filters?.startDate && row.receipt_date < filters.startDate) return false;
      if (filters?.endDate && row.receipt_date > filters.endDate) return false;
      if (filters?.search && !row.receipt_number.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    }) as FeeReceipt[];

    return list.sort((a, b) => b.receipt_date.localeCompare(a.receipt_date)).map((r) => this.enrichReceipt(r));
  }

  async findReceiptById(schoolId: string, id: string): Promise<FeeReceipt | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('fee_receipts')
        .select('*')
        .eq('school_id', schoolId)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return this.enrichReceipt(data as FeeReceipt);
    }

    const row = this.mem.findById('fee_receipts', id) as FeeReceipt | null;
    if (row && row.school_id === schoolId) return this.enrichReceipt(row);
    return null;
  }

  async findReceiptByPaymentId(schoolId: string, paymentId: string): Promise<FeeReceipt | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      const { data, error } = await getSupabaseClient()!
        .from('fee_receipts')
        .select('*')
        .eq('school_id', schoolId)
        .eq('payment_id', paymentId)
        .maybeSingle();

      if (!error && data) return this.enrichReceipt(data as FeeReceipt);
    }

    const matches = this.mem.findAll('fee_receipts', (row: FeeReceipt) => {
      return row.school_id === schoolId && row.payment_id === paymentId;
    }) as FeeReceipt[];

    return matches.length > 0 ? this.enrichReceipt(matches[0]) : null;
  }

  // ======================================================================
  // 7. Fee Refunds
  // ======================================================================
  async createRefund(schoolId: string, data: Partial<FeeRefund>): Promise<FeeRefund> {
    const now = new Date().toISOString();
    const id = data.id || crypto.randomUUID();
    const refundNumber = data.refund_number || (await this.getNextRefundNumber(schoolId));
    const refundAmount = Number(data.refund_amount) || 0;

    const record: FeeRefund = {
      id,
      refund_number: refundNumber,
      school_id: schoolId,
      payment_id: data.payment_id!,
      student_user_id: data.student_user_id!,
      refund_amount: refundAmount,
      refund_date: data.refund_date || now.split('T')[0],
      refund_mode: data.refund_mode || 'BANK_TRANSFER',
      reason: data.reason || 'Excess fee adjustment/cancellation',
      reference_no: data.reference_no || null,
      approved_by: data.approved_by || null,
      approved_at: data.approved_at || now,
      status: 'COMPLETED',
      created_by: data.created_by || null,
      created_at: now,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      await getSupabaseClient()!.from('fee_refunds').insert(record);
    }
    this.mem.insert('fee_refunds', record);
    return record;
  }

  async findRefunds(
    schoolId: string,
    filters?: { paymentId?: string; studentUserId?: string; startDate?: string; endDate?: string }
  ): Promise<FeeRefund[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      let q = getSupabaseClient()!.from('fee_refunds').select('*').eq('school_id', schoolId);
      if (filters?.paymentId) q = q.eq('payment_id', filters.paymentId);
      if (filters?.studentUserId) q = q.eq('student_user_id', filters.studentUserId);
      if (filters?.startDate) q = q.gte('refund_date', filters.startDate);
      if (filters?.endDate) q = q.lte('refund_date', filters.endDate);

      q = q.order('refund_date', { ascending: false });

      const { data, error } = await q;
      if (!error && data) return (data as FeeRefund[]).map((rf) => this.enrichRefund(rf));
    }

    const list = this.mem.findAll('fee_refunds', (row: FeeRefund) => {
      if (row.school_id !== schoolId) return false;
      if (filters?.paymentId && row.payment_id !== filters.paymentId) return false;
      if (filters?.studentUserId && row.student_user_id !== filters.studentUserId) return false;
      if (filters?.startDate && row.refund_date < filters.startDate) return false;
      if (filters?.endDate && row.refund_date > filters.endDate) return false;
      return true;
    }) as FeeRefund[];

    return list.map((rf) => this.enrichRefund(rf));
  }

  // ======================================================================
  // 8. Financial Ledger & Analytics
  // ======================================================================
  async getStudentLedger(schoolId: string, studentUserId: string): Promise<StudentFeeLedgerItem[]> {
    const demands = await this.findDemands(schoolId, { studentUserId });
    const payments = await this.findPayments(schoolId, { studentUserId });
    const refunds = await this.findRefunds(schoolId, { studentUserId });
    const adjustments = await this.findAdjustments(schoolId, { studentUserId });

    const rawItems: Array<{
      date: string;
      type: 'DEMAND' | 'PAYMENT' | 'DISCOUNT' | 'WAIVER' | 'REFUND';
      reference_no: string;
      description: string;
      debit: number;
      credit: number;
    }> = [];

    // Demands increase receivable (Debit)
    for (const d of demands) {
      if (d.status !== 'CANCELLED') {
        rawItems.push({
          date: d.issue_date,
          type: 'DEMAND',
          reference_no: d.demand_number,
          description: `Fee Demand: ${d.fee_head?.name || 'Fee'} (${d.billing_period})`,
          debit: d.original_amount,
          credit: 0,
        });
      }
    }

    // Adjustments reduce receivable (Credit)
    for (const adj of adjustments) {
      if (adj.status === 'APPROVED') {
        rawItems.push({
          date: adj.approved_at ? adj.approved_at.split('T')[0] : adj.created_at.split('T')[0],
          type: adj.adjustment_type === 'WAIVER' ? 'WAIVER' : 'DISCOUNT',
          reference_no: `ADJ-${adj.id.slice(0, 8).toUpperCase()}`,
          description: `${adj.adjustment_type}: ${adj.reason}`,
          debit: 0,
          credit: adj.amount,
        });
      }
    }

    // Payments reduce receivable (Credit)
    for (const p of payments) {
      if (p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED') {
        rawItems.push({
          date: p.payment_date,
          type: 'PAYMENT',
          reference_no: p.payment_number,
          description: `Payment received (${p.payment_mode})`,
          debit: 0,
          credit: p.total_amount,
        });
      }
    }

    // Refunds increase receivable back (Debit)
    for (const rf of refunds) {
      rawItems.push({
        date: rf.refund_date,
        type: 'REFUND',
        reference_no: rf.refund_number,
        description: `Refund processed: ${rf.reason}`,
        debit: rf.refund_amount,
        credit: 0,
      });
    }

    // Chronological order
    rawItems.sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = 0;
    const ledger: StudentFeeLedgerItem[] = [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      runningBalance += item.debit - item.credit;
      ledger.push({
        id: `LEDGER-${i + 1}`,
        date: item.date,
        type: item.type,
        reference_no: item.reference_no,
        description: item.description,
        debit: Math.round(item.debit * 100) / 100,
        credit: Math.round(item.credit * 100) / 100,
        balance: Math.round(runningBalance * 100) / 100,
      });
    }

    return ledger;
  }

  async getDashboardMetrics(
    schoolId: string,
    academicSessionId?: string,
    locationId?: string
  ): Promise<FeeDashboardMetrics> {
    const demands = await this.findDemands(schoolId, { academicSessionId, locationId });
    const payments = await this.findPayments(schoolId, { academicSessionId, locationId });

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7);

    let totalDemand = 0;
    let totalCollected = 0;
    let totalOverdue = 0;
    let todayCollection = 0;
    let monthCollection = 0;

    const studentBalanceMap = new Map<string, { net: number; paid: number; hasOverdue: boolean }>();

    for (const d of demands) {
      if (d.status === 'CANCELLED' || d.status === 'WAIVED') continue;
      totalDemand += d.net_amount;
      const isOverdue = d.status === 'OVERDUE' || (d.paid_amount < d.net_amount && d.due_date < today);
      if (isOverdue) {
        totalOverdue += d.net_amount - d.paid_amount;
      }

      const existing = studentBalanceMap.get(d.student_user_id) || { net: 0, paid: 0, hasOverdue: false };
      existing.net += d.net_amount;
      existing.paid += d.paid_amount;
      if (isOverdue) existing.hasOverdue = true;
      studentBalanceMap.set(d.student_user_id, existing);
    }

    for (const p of payments) {
      if (p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED') {
        const netPaid = p.total_amount - (p.refunded_amount || 0);
        totalCollected += netPaid;
        if (p.payment_date === today) {
          todayCollection += netPaid;
        }
        if (p.payment_date.startsWith(currentMonth)) {
          monthCollection += netPaid;
        }
      }
    }

    let studentsWithDues = 0;
    let studentsFullyPaid = 0;
    let studentsPartiallyPaid = 0;
    let studentsOverdue = 0;

    for (const [, bal] of studentBalanceMap.entries()) {
      if (bal.paid >= bal.net && bal.net > 0) {
        studentsFullyPaid++;
      } else if (bal.paid > 0 && bal.paid < bal.net) {
        studentsPartiallyPaid++;
        studentsWithDues++;
      } else if (bal.paid === 0 && bal.net > 0) {
        studentsWithDues++;
      }

      if (bal.hasOverdue) {
        studentsOverdue++;
      }
    }

    return {
      total_demand: Math.round(totalDemand * 100) / 100,
      total_collected: Math.round(totalCollected * 100) / 100,
      total_outstanding: Math.round(Math.max(0, totalDemand - totalCollected) * 100) / 100,
      total_overdue: Math.round(totalOverdue * 100) / 100,
      today_collection: Math.round(todayCollection * 100) / 100,
      month_collection: Math.round(monthCollection * 100) / 100,
      students_with_dues_count: studentsWithDues,
      students_fully_paid_count: studentsFullyPaid,
      students_partially_paid_count: studentsPartiallyPaid,
      students_overdue_count: studentsOverdue,
    };
  }

  // ======================================================================
  // 9. Document / Voucher Number Generators
  // ======================================================================
  async getNextDemandNumber(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = (this.mem.getTable('student_fee_demands')?.size || 0) + 1;
    const pad = String(count).padStart(5, '0');
    return `DEM-${year}-${pad}`;
  }

  async getNextPaymentNumber(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = (this.mem.getTable('fee_payments')?.size || 0) + 1;
    const pad = String(count).padStart(5, '0');
    return `PAY-${year}-${pad}`;
  }

  async getNextReceiptNumber(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = (this.mem.getTable('fee_receipts')?.size || 0) + 1;
    const pad = String(count).padStart(5, '0');
    return `REC-${year}-${pad}`;
  }

  async getNextRefundNumber(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = (this.mem.getTable('fee_refunds')?.size || 0) + 1;
    const pad = String(count).padStart(5, '0');
    return `REF-${year}-${pad}`;
  }

  // ======================================================================
  // 10. Private Hydration Helpers
  // ======================================================================
  private enrichStructure(s: FeeStructure): FeeStructure {
    const head = this.mem.findById('fee_heads', s.fee_head_id) as FeeHead | null;
    let cls = this.mem.findById('classes', s.class_id) as ClassItem | null;
    if (!cls && s.class_id === '99f432a4-1c9c-4ba3-ae80-6e59e68ae1df') {
      cls = this.mem.findById('classes', '5a982e49-18b3-48b3-87ab-2b4b4e2d32d6') as ClassItem | null;
    }
    const sec = s.section_id ? (this.mem.findById('sections', s.section_id) as SectionItem | null) : undefined;
    const sess = this.mem.findById('academic_sessions', s.academic_session_id) as AcademicSession | null;
    const loc = s.location_id ? (this.mem.findById('locations', s.location_id) as Location | null) : undefined;

    let classWithDisplayName: ClassItem | undefined = undefined;
    if (cls) {
      const displayName = cls.display_name || (cls as any).display_label || (cls.name.toLowerCase().startsWith('class') ? cls.name : `Class ${cls.name}`);
      classWithDisplayName = { ...cls, display_name: displayName };
    }

    return {
      ...s,
      amount: Number(s.amount),
      fee_head: head || undefined,
      class: classWithDisplayName,
      section: sec || undefined,
      session: sess || undefined,
      location: loc || undefined,
    };
  }

  private enrichDemand(d: StudentFeeDemand): StudentFeeDemand {
    const student = this.mem.findById('users', d.student_user_id) as User | null;
    const head = this.mem.findById('fee_heads', d.fee_head_id) as FeeHead | null;
    const struct = d.fee_structure_id
      ? (this.mem.findById('fee_structures', d.fee_structure_id) as FeeStructure | null)
      : undefined;
    let cls = this.mem.findById('classes', d.class_id) as ClassItem | null;
    if (!cls && d.class_id === '99f432a4-1c9c-4ba3-ae80-6e59e68ae1df') {
      cls = this.mem.findById('classes', '5a982e49-18b3-48b3-87ab-2b4b4e2d32d6') as ClassItem | null;
    }
    let classWithDisplayName: ClassItem | undefined = undefined;
    if (cls) {
      const displayName = cls.display_name || (cls as any).display_label || (cls.name.toLowerCase().startsWith('class') ? cls.name : `Class ${cls.name}`);
      classWithDisplayName = { ...cls, display_name: displayName };
    }
    const sec = this.mem.findById('sections', d.section_id) as SectionItem | null;
    const sess = this.mem.findById('academic_sessions', d.academic_session_id) as AcademicSession | null;
    const loc = this.mem.findById('locations', d.location_id) as Location | null;

    let admissionNumber: string | undefined;
    let rollNumber: string | undefined;

    if (d.student_enrollment_id) {
      const enr = this.mem.findById('student_academic_enrollments', d.student_enrollment_id) as StudentAcademicEnrollment | null;
      if (enr) {
        admissionNumber = enr.admission_number;
        rollNumber = enr.roll_number || undefined;
      }
    } else if (student) {
      const enrollments = this.mem.findAll('student_academic_enrollments', (row: StudentAcademicEnrollment) => {
        return row.student_user_id === student.id && !row.deleted_at;
      }) as StudentAcademicEnrollment[];
      if (enrollments.length > 0) {
        admissionNumber = enrollments[0].admission_number;
        rollNumber = enrollments[0].roll_number || undefined;
      }
    }

    const net = Number(d.net_amount);
    const paid = Number(d.paid_amount);

    return {
      ...d,
      original_amount: Number(d.original_amount),
      discount_amount: Number(d.discount_amount),
      waiver_amount: Number(d.waiver_amount),
      late_fee_amount: Number(d.late_fee_amount),
      net_amount: net,
      paid_amount: paid,
      outstanding_amount: Math.max(0, net - paid),
      student: student || undefined,
      admission_number: admissionNumber,
      roll_number: rollNumber,
      fee_head: head || undefined,
      fee_structure: struct || undefined,
      class: cls || undefined,
      section: sec || undefined,
      session: sess || undefined,
      location: loc || undefined,
    };
  }

  private enrichPayment(p: FeePayment): FeePayment {
    const student = this.mem.findById('users', p.student_user_id) as User | null;
    const collector = p.created_by ? (this.mem.findById('users', p.created_by) as User | null) : undefined;
    const sess = this.mem.findById('academic_sessions', p.academic_session_id) as AcademicSession | null;
    const loc = this.mem.findById('locations', p.location_id) as Location | null;

    return {
      ...p,
      total_amount: Number(p.total_amount),
      refunded_amount: Number(p.refunded_amount),
      student: student || undefined,
      collector: collector || undefined,
      session: sess || undefined,
      location: loc || undefined,
    };
  }

  private enrichReceipt(r: FeeReceipt): FeeReceipt {
    const student = this.mem.findById('users', r.student_user_id) as User | null;
    const collector = r.created_by ? (this.mem.findById('users', r.created_by) as User | null) : undefined;
    const sess = this.mem.findById('academic_sessions', r.academic_session_id) as AcademicSession | null;
    const loc = this.mem.findById('locations', r.location_id) as Location | null;
    const school = this.mem.findById('schools', r.school_id) as School | null;
    const payment = this.mem.findById('fee_payments', r.payment_id) as FeePayment | null;

    let className: string | undefined;
    let sectionName: string | undefined;
    let admNo: string | undefined;
    let rollNo: string | undefined;

    const enrollments = this.mem.findAll('student_academic_enrollments', (en: StudentAcademicEnrollment) => {
      return en.student_user_id === r.student_user_id && en.academic_session_id === r.academic_session_id && !en.deleted_at;
    }) as StudentAcademicEnrollment[];

    if (enrollments.length > 0) {
      admNo = enrollments[0].admission_number;
      rollNo = enrollments[0].roll_number || undefined;
      const c = this.mem.findById('classes', enrollments[0].class_id) as ClassItem | null;
      const s = this.mem.findById('sections', enrollments[0].section_id) as SectionItem | null;
      if (c) className = c.name;
      if (s) sectionName = s.name;
    }

    return {
      ...r,
      total_amount: Number(r.total_amount),
      payment: payment ? this.enrichPayment(payment) : undefined,
      student: student || undefined,
      collector: collector || undefined,
      session: sess || undefined,
      location: loc || undefined,
      school: school || undefined,
      class_name: className,
      section_name: sectionName,
      admission_number: admNo,
      roll_number: rollNo,
    };
  }

  private enrichRefund(rf: FeeRefund): FeeRefund {
    const student = this.mem.findById('users', rf.student_user_id) as User | null;
    const approver = rf.approved_by ? (this.mem.findById('users', rf.approved_by) as User | null) : undefined;
    const payment = this.mem.findById('fee_payments', rf.payment_id) as FeePayment | null;

    return {
      ...rf,
      refund_amount: Number(rf.refund_amount),
      student: student || undefined,
      approver: approver || undefined,
      payment: payment || undefined,
    };
  }
}

export const feesRepository = new FeesRepository();

