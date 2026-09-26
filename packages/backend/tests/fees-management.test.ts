// ========================================================================
// Fees Management Module Tests
// Multi-Tenant Core Financial Engine, Immutability, and Reconciliation
// ========================================================================

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { seedInMemoryDatabase } from '../src/db/seed.js';
import { getMemoryDbClient } from '../src/db/client.js';
import { feesService } from '../src/services/fees.service.js';
import { feesRepository } from '../src/repositories/fees.repository.js';
import {
  School,
  AcademicSession,
  Location,
  ClassItem,
  SectionItem,
  User,
  StudentAcademicEnrollment,
} from '../src/types/index.js';

describe('Fees Management Module - Complete Functional Suite', () => {
  let mem: ReturnType<typeof getMemoryDbClient>;
  let schoolA: School;
  let schoolB: School;
  let locA1: Location;
  let sessA2: AcademicSession;
  let cls10: ClassItem;
  let secA: SectionItem;
  let uAarav: User;
  let uSuperA: User;
  let enrollAarav: StudentAcademicEnrollment;

  beforeEach(() => {
    mem = getMemoryDbClient();
    mem.clear();
    seedInMemoryDatabase();

    const schools = mem.findAll('schools') as School[];
    schoolA = schools.find((s) => s.school_code === 'DPA')!;
    schoolB = schools.find((s) => s.school_code === 'GWI')!;

    const locations = mem.findAll('locations', (l: Location) => l.school_id === schoolA.id) as Location[];
    locA1 = locations.find((l) => l.location_code === 'DEL-MAIN')!;

    const sessions = mem.findAll('academic_sessions', (s: AcademicSession) => s.school_id === schoolA.id) as AcademicSession[];
    sessA2 = sessions.find((s) => s.name === '2026-27')!;

    const classes = mem.findAll('classes', (c: ClassItem) => c.school_id === schoolA.id) as ClassItem[];
    cls10 = classes.find((c) => c.code === 'CLS-10')!;

    const sections = mem.findAll('sections', (s: SectionItem) => s.school_id === schoolA.id) as SectionItem[];
    secA = sections.find((s) => s.name === 'A')!;

    const users = mem.findAll('users', (u: User) => u.school_id === schoolA.id) as User[];
    uAarav = users.find((u) => u.username === 'aarav.sharma')!;
    uSuperA = users.find((u) => u.username === 'superadmin')!;

    const enrollments = mem.findAll('student_academic_enrollments', (e: StudentAcademicEnrollment) => {
      return e.student_user_id === uAarav.id && e.academic_session_id === sessA2.id;
    }) as StudentAcademicEnrollment[];
    enrollAarav = enrollments[0];
  });

  // ----------------------------------------------------------------------
  // 1. Fee Heads Master
  // ----------------------------------------------------------------------
  test('1. Fee Heads - List, Create, Duplicate Code Prevention, Update, Delete', async () => {
    const heads = await feesService.getHeads(schoolA.id);
    assert.ok(heads.length >= 5, 'Should have seeded fee heads');

    // Create a new fee head
    const newHead = await feesService.createHead(
      schoolA.id,
      {
        code: 'TRANS-BUS',
        name: 'Transport Bus Route 1',
        category: 'TRANSPORT',
        is_taxable: false,
        tax_rate: 0,
        display_order: 10,
        status: 'ACTIVE',
      },
      uSuperA.id
    );
    assert.strictEqual(newHead.code, 'TRANS-BUS');

    // Reject duplicate code
    await assert.rejects(
      async () => {
        await feesService.createHead(
          schoolA.id,
          {
            code: 'TRANS-BUS',
            name: 'Another Bus',
            category: 'TRANSPORT',
          },
          uSuperA.id
        );
      },
      /already exists in this school/
    );

    // Update fee head
    const updated = await feesService.updateHead(
      schoolA.id,
      newHead.id,
      { name: 'Transport AC Bus Route 1' },
      uSuperA.id
    );
    assert.strictEqual(updated.name, 'Transport AC Bus Route 1');

    // Delete fee head
    const deleted = await feesService.deleteHead(schoolA.id, newHead.id);
    assert.strictEqual(deleted, true);

    const check = await feesRepository.findHeadById(schoolA.id, newHead.id);
    assert.strictEqual(check, null);
  });

  // ----------------------------------------------------------------------
  // 2. Fee Structures Master
  // ----------------------------------------------------------------------
  test('2. Fee Structures - Create, Query, and Prevent Negative Amounts', async () => {
    const structures = await feesService.getStructures(schoolA.id, {
      academicSessionId: sessA2.id,
      classId: cls10.id,
    });
    assert.ok(structures.length >= 4, 'Should have seeded fee structures for Class 10');

    // Hydrated references
    assert.ok(structures[0].fee_head, 'Should hydrate fee head');
    assert.ok(structures[0].class, 'Should hydrate class');

    // Reject negative amount
    await assert.rejects(
      async () => {
        await feesService.createStructure(
          schoolA.id,
          {
            academic_session_id: sessA2.id,
            class_id: cls10.id,
            fee_head_id: structures[0].fee_head_id,
            amount: -100,
          },
          uSuperA.id
        );
      },
      /Valid non-negative fee amount is required/
    );
  });

  // ----------------------------------------------------------------------
  // 3. Demand Generation & Duplicate Prevention
  // ----------------------------------------------------------------------
  test('3. Student Fee Demand Generation - Authoritative Placement & Duplicate Skipping', async () => {
    // Generate demands for a new period 'June 2026'
    const result = await feesService.generateDemands(
      schoolA.id,
      {
        academic_session_id: sessA2.id,
        location_id: locA1.id,
        class_id: cls10.id,
        section_id: secA.id,
        billing_period: 'June 2026',
        issue_date: '2026-06-01',
        due_date: '2026-06-10',
      },
      uSuperA.id
    );

    assert.ok(result.generated_count > 0, 'Should generate demands for enrolled students in Class 10A');
    assert.strictEqual(result.skipped_count, 0, 'First run should have 0 skipped');

    // Verify first generated demand properties
    const firstDemand = result.demands[0];
    assert.strictEqual(firstDemand.student_user_id, uAarav.id);
    assert.strictEqual(firstDemand.billing_period, 'June 2026');
    assert.strictEqual(firstDemand.paid_amount, 0);
    assert.strictEqual(firstDemand.status, 'UNPAID');
    assert.strictEqual(firstDemand.net_amount, firstDemand.original_amount);

    // Run again with identical criteria - duplicate prevention should skip all
    const secondResult = await feesService.generateDemands(
      schoolA.id,
      {
        academic_session_id: sessA2.id,
        location_id: locA1.id,
        class_id: cls10.id,
        section_id: secA.id,
        billing_period: 'June 2026',
        issue_date: '2026-06-01',
        due_date: '2026-06-10',
      },
      uSuperA.id
    );

    assert.strictEqual(secondResult.generated_count, 0, 'No new demands generated on rerun');
    assert.strictEqual(secondResult.skipped_count, result.generated_count, 'All duplicate demands should be skipped');
  });

  // ----------------------------------------------------------------------
  // 4. Concessions & Waivers
  // ----------------------------------------------------------------------
  test('4. Adjustments - Apply Waiver and Over-Adjustment Rejection', async () => {
    // Seeded demand 4 is for ₹10,000 unpaid
    const demand4 = await feesService.getDemandById(schoolA.id, 'f3000000-0000-0000-0000-000000000004');
    assert.strictEqual(demand4.net_amount, 10000);

    // Apply waiver of ₹1,000
    const { adjustment, updated_demand } = await feesService.applyAdjustment(
      schoolA.id,
      {
        demand_id: demand4.id,
        adjustment_type: 'WAIVER',
        amount: 1000,
        reason: 'Merit scholarship waiver',
      },
      uSuperA.id
    );

    assert.strictEqual(adjustment.amount, 1000);
    assert.strictEqual(updated_demand!.waiver_amount, 1000);
    assert.strictEqual(updated_demand!.net_amount, 9000);
    assert.strictEqual(updated_demand!.outstanding_amount, 9000);

    // Attempting to apply adjustment exceeding remaining ₹9,000 should fail
    await assert.rejects(
      async () => {
        await feesService.applyAdjustment(
          schoolA.id,
          {
            demand_id: demand4.id,
            adjustment_type: 'DISCOUNT',
            amount: 9500,
            reason: 'Excess discount',
          },
          uSuperA.id
        );
      },
      /cannot exceed the current outstanding balance/
    );
  });

  // ----------------------------------------------------------------------
  // 5. Payment Collection & Overpayment Protection
  // ----------------------------------------------------------------------
  test('5. Fee Collection - Partial & Full Payment, Overpayment Protection, Receipt Generation', async () => {
    // Demand 3 is ₹4,500 total with ₹2,000 already paid (outstanding: ₹2,500)
    const demand3 = await feesService.getDemandById(schoolA.id, 'f3000000-0000-0000-0000-000000000003');
    assert.strictEqual(demand3.paid_amount, 2000);
    assert.strictEqual(demand3.net_amount - demand3.paid_amount, 2500);

    // Overpayment check: try to pay ₹3,000 on ₹2,500 outstanding
    await assert.rejects(
      async () => {
        await feesService.collectPayment(
          schoolA.id,
          {
            student_user_id: uAarav.id,
            academic_session_id: sessA2.id,
            location_id: locA1.id,
            payment_date: '2026-05-15',
            payment_mode: 'CASH',
            allocations: [{ demand_id: demand3.id, amount: 3000 }],
          },
          uSuperA.id
        );
      },
      /Overpayment rejected/
    );

    // Valid full payment of remaining ₹2,500
    const collectionResult = await feesService.collectPayment(
      schoolA.id,
      {
        student_user_id: uAarav.id,
        academic_session_id: sessA2.id,
        location_id: locA1.id,
        payment_date: '2026-05-15',
        payment_mode: 'UPI',
        transaction_reference: 'UPI/20260515/998811',
        allocations: [{ demand_id: demand3.id, amount: 2500 }],
      },
      uSuperA.id
    );

    assert.strictEqual(collectionResult.payment.total_amount, 2500);
    assert.strictEqual(collectionResult.receipt.total_amount, 2500);
    assert.ok(collectionResult.receipt.receipt_number.startsWith('REC-'), 'Receipt number should be formatted');

    // Verify demand status is now 'PAID'
    const updatedDemand3 = await feesService.getDemandById(schoolA.id, demand3.id);
    assert.strictEqual(updatedDemand3.paid_amount, 4500);
    assert.strictEqual(updatedDemand3.status, 'PAID');
  });

  // ----------------------------------------------------------------------
  // 6. Refunds & Reversal
  // ----------------------------------------------------------------------
  test('6. Fee Refunds - Partial Refund, Exceeding Limit Rejection, Reversal on Demand', async () => {
    // Payment 1 total is ₹5,300 (allocations: demand1 ₹4,500 + demand2 ₹800)
    const payment1 = await feesService.getPaymentById(schoolA.id, 'f4000000-0000-0000-0000-000000000001');
    assert.strictEqual(payment1.total_amount, 5300);
    assert.strictEqual(payment1.refunded_amount, 0);

    // Reject refund > ₹5,300
    await assert.rejects(
      async () => {
        await feesService.processRefund(
          schoolA.id,
          {
            payment_id: payment1.id,
            refund_amount: 6000,
            refund_mode: 'BANK_TRANSFER',
            reason: 'Excess refund',
          },
          uSuperA.id
        );
      },
      /exceeds remaining refundable balance/
    );

    // Process partial refund of ₹800
    const { refund, updated_payment } = await feesService.processRefund(
      schoolA.id,
      {
        payment_id: payment1.id,
        refund_amount: 800,
        refund_mode: 'BANK_TRANSFER',
        reason: 'Activities opted out',
      },
      uSuperA.id
    );

    assert.strictEqual(refund.refund_amount, 800);
    assert.strictEqual(updated_payment!.refunded_amount, 800);
    assert.strictEqual(updated_payment!.status, 'PARTIALLY_REFUNDED');
  });

  // ----------------------------------------------------------------------
  // 7. Student Ledger & Executive Dashboard
  // ----------------------------------------------------------------------
  test('7. Student Ledger & Dashboard Metrics - Reconciliation and Double-Entry Check', async () => {
    const ledger = await feesService.getStudentLedger(schoolA.id, uAarav.id);
    assert.ok(ledger.length > 0, 'Student should have ledger entries');

    // Verify running balance arithmetic
    let running = 0;
    for (const item of ledger) {
      running += item.debit - item.credit;
      assert.strictEqual(Math.round(item.balance * 100) / 100, Math.round(running * 100) / 100);
    }

    // Dashboard metrics
    const metrics = await feesService.getDashboardMetrics(schoolA.id, sessA2.id);
    assert.ok(metrics.total_demand > 0, 'Total demand should be positive');
    assert.ok(metrics.total_collected > 0, 'Total collected should be positive');
    assert.strictEqual(
      metrics.total_outstanding,
      Math.round(Math.max(0, metrics.total_demand - metrics.total_collected) * 100) / 100
    );
  });

  // ----------------------------------------------------------------------
  // 8. Multi-Tenant Isolation
  // ----------------------------------------------------------------------
  test('8. Multi-Tenant Isolation - School B cannot access School A fees', async () => {
    // School B query for heads should not return School A heads
    const headsB = await feesService.getHeads(schoolB.id);
    const hasAHead = headsB.some((h) => h.school_id === schoolA.id);
    assert.strictEqual(hasAHead, false, 'Tenant isolation violation: School A head visible to School B');

    // School B trying to access School A demand should fail
    await assert.rejects(
      async () => {
        await feesService.getDemandById(schoolB.id, 'f3000000-0000-0000-0000-000000000001');
      },
      /Fee Demand not found/
    );
  });
});
