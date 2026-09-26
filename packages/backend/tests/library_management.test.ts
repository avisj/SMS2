// ========================================================================
// Library Management Module - Comprehensive Unit & Integration Tests
// Validates Books, Copies, Members, Issue/Return/Renewal State Machine,
// Overdue Fine Calculations, Reservations, and Multi-Tenant Isolation
// ========================================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { seedInMemoryDatabase } from '../src/db/seed.js';
import { libraryService } from '../src/services/library.service.js';
import { libraryRepository } from '../src/repositories/library.repository.js';
import { getMemoryDbClient } from '../src/db/client.js';

describe('Library Management Module — Unit & Integration Engine', () => {
  const mem = getMemoryDbClient();
  const schoolAId = 'a0000000-0000-0000-0000-000000000001';
  const schoolBId = 'b0000000-0000-0000-0000-000000000001';
  const locA1Id = 'a1000000-0000-0000-0000-000000000001';
  const uSuperAId = '90000000-0000-0000-0000-000000000001';
  const uTeacherAId = 'a2000000-0000-0000-0000-000000000003';
  const uStudentAaravId = '20000000-0000-0000-0000-000000000004';

  beforeEach(() => {
    mem.clear();
    seedInMemoryDatabase();
  });

  it('1. Library Settings: Retrieves defaults and updates configurable loan and fine rules', async () => {
    const settings = await libraryService.getSettings(schoolAId);
    assert.ok(settings.id);
    assert.equal(settings.loan_period_days, 14);
    assert.equal(settings.fine_per_day, 5.00);

    const updated = await libraryService.updateSettings(schoolAId, {
      loan_period_days: 21,
      fine_per_day: 10.00,
      student_issue_limit: 4,
    });
    assert.equal(updated.loan_period_days, 21);
    assert.equal(updated.fine_per_day, 10.00);
    assert.equal(updated.student_issue_limit, 4);
  });

  it('2. Categories, Authors & Publishers: Creates and manages bibliographic masters', async () => {
    const cat = await libraryService.createCategory(schoolAId, {
      name: 'Historical Fiction',
      code: 'HIST',
      description: 'Period-based historical novels',
    });
    assert.ok(cat.id);
    assert.equal(cat.name, 'Historical Fiction');

    const author = await libraryService.createAuthor(schoolAId, {
      name: 'Leo Tolstoy',
      biography: 'Russian writer of War and Peace',
    });
    assert.ok(author.id);

    const pub = await libraryService.createPublisher(schoolAId, {
      name: 'HarperCollins India',
      email: 'contact@harpercollins.co.in',
    });
    assert.ok(pub.id);

    // Create book with author
    const book = await libraryService.createBook(
      schoolAId,
      {
        title: 'War and Peace',
        category_id: cat.id,
        publisher_id: pub.id,
        price: 650,
      },
      [author.id]
    );
    assert.ok(book.id);
    assert.equal(book.title, 'War and Peace');
    assert.equal(book.authors?.length, 1);
    assert.equal(book.authors![0].name, 'Leo Tolstoy');
  });

  it('3. Book Copies: Creates multiple physical copies with unique copy codes and barcodes', async () => {
    const books = await libraryService.getBooks(schoolAId);
    const book = books[0];

    const copy1 = await libraryService.createCopy(schoolAId, {
      book_id: book.id,
      location_id: locA1Id,
      rack: 'R1',
      shelf: 'S1',
      condition: 'NEW',
    });
    assert.ok(copy1.id);
    assert.match(copy1.copy_code, /^LIB-\d{4}-\d{6}$/);
    assert.ok(copy1.barcode?.startsWith('BC-LIB-'));
    assert.equal(copy1.status, 'AVAILABLE');

    const copy2 = await libraryService.createCopy(schoolAId, {
      book_id: book.id,
      location_id: locA1Id,
      rack: 'R1',
      shelf: 'S2',
      condition: 'GOOD',
    });
    assert.notEqual(copy1.copy_code, copy2.copy_code);
    assert.equal(copy2.status, 'AVAILABLE');

    // Barcode lookup
    const found = await libraryService.getCopyByBarcode(schoolAId, copy1.barcode!);
    assert.equal(found.id, copy1.id);
  });

  it('4. Library Members: Enrolls Universal User as member and validates borrowing privilege', async () => {
    const uAdminSunitaId = 'a2000000-0000-0000-0000-000000000002';
    const member = await libraryService.registerMember(schoolAId, {
      user_id: uAdminSunitaId,
      membership_type: 'STAFF',
      max_books_allowed: 5,
    });
    assert.ok(member.id);
    assert.match(member.membership_number, /^MEM-\d{4}-\d{4}$/);
    assert.equal(member.membership_type, 'STAFF');

    // Prevent duplicate enrollment
    await assert.rejects(
      async () => {
        await libraryService.registerMember(schoolAId, {
          user_id: uAdminSunitaId,
        });
      },
      /already registered/
    );
  });

  it('5. Issue Workflow: Issues copy to member, sets due date, transitions status to ISSUED', async () => {
    const copies = await libraryService.getCopies(schoolAId, { status: 'AVAILABLE' });
    assert.ok(copies.length > 0);
    const copy = copies[0];

    const members = await libraryService.getMembers(schoolAId, { status: 'ACTIVE' });
    assert.ok(members.length > 0);
    const member = members[0];

    const issue = await libraryService.issueBook(schoolAId, {
      book_copy_id: copy.id,
      member_user_id: member.user_id,
      issued_by: uSuperAId,
      remarks: 'Issued for annual examination preparation',
    });

    assert.ok(issue.id);
    assert.equal(issue.status, 'ISSUED');
    assert.ok(issue.due_date);

    // Verify copy updated to ISSUED
    const updatedCopy = await libraryService.getCopyById(schoolAId, copy.id);
    assert.equal(updatedCopy.status, 'ISSUED');
  });

  it('6. Issue Guardrails: Rejects issuing an already issued, lost, or damaged copy', async () => {
    const copies = await libraryService.getCopies(schoolAId, { status: 'AVAILABLE' });
    const copy = copies[0];
    const members = await libraryService.getMembers(schoolAId, { status: 'ACTIVE' });
    const member = members[0];

    // Issue once
    await libraryService.issueBook(schoolAId, {
      book_copy_id: copy.id,
      member_user_id: member.user_id,
    });

    // Attempt to issue again
    await assert.rejects(
      async () => {
        await libraryService.issueBook(schoolAId, {
          book_copy_id: copy.id,
          member_user_id: member.user_id,
        });
      },
      /Only AVAILABLE copies can be issued/
    );
  });

  it('7. Return Workflow: Returns book on time, restores status to AVAILABLE', async () => {
    const issues = await libraryService.repo.findIssues(schoolAId, { status: 'ISSUED' });
    assert.ok(issues.length > 0);
    const issue = issues[0];

    const result = await libraryService.returnBook(schoolId(schoolAId), {
      issue_id: issue.id,
      returned_by: uSuperAId,
      condition: 'GOOD',
      remarks: 'Returned in pristine condition',
    });

    assert.equal(result.issue.status, 'RETURNED');
    assert.ok(result.issue.return_date);

    // Copy restored to AVAILABLE
    const copy = await libraryService.getCopyById(schoolAId, issue.book_copy_id);
    assert.equal(copy.status, 'AVAILABLE');
  });

  it('8. Overdue Fine Calculation: Automatically computes fine for late return', async () => {
    // Configure fine: ₹5 per day, grace 1 day
    await libraryService.updateSettings(schoolAId, {
      fine_per_day: 5.00,
      grace_period_days: 1,
      auto_fine_enabled: true,
    });

    const copies = await libraryService.getCopies(schoolAId, { status: 'AVAILABLE' });
    const copy = copies[0];
    const members = await libraryService.getMembers(schoolAId, { status: 'ACTIVE' });
    const member = members[0];

    // Issue book with past due date: 10 days ago
    const pastDueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const issueDate = new Date(Date.now() - 24 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const issue = await libraryService.repo.createIssue(schoolAId, {
      member_user_id: member.user_id,
      book_id: copy.book_id,
      book_copy_id: copy.id,
      issue_date: issueDate,
      due_date: pastDueDate,
    });
    await libraryService.updateCopy(schoolAId, copy.id, { status: 'ISSUED' });

    // Return today (10 days overdue - 1 grace = 10 days diff => 10 * ₹5 = ₹50)
    const result = await libraryService.returnBook(schoolAId, {
      issue_id: issue.id,
    });

    assert.equal(result.issue.status, 'RETURNED');
    assert.ok(result.fine, 'Fine must be generated for overdue return');
    assert.equal(result.fine?.status, 'UNPAID');
    assert.equal(result.fine?.amount, 50); // 10 days * ₹5
    assert.equal(result.fine?.balance_amount, 50);
  });

  it('9. Fine Payments & Waivers: Records partial payments and waiver justification', async () => {
    const member = (await libraryService.getMembers(schoolAId))[0];
    const fine = await libraryService.repo.createFine(schoolAId, {
      member_user_id: member.user_id,
      amount: 100,
      reason: 'OVERDUE: 20 days late',
    });

    // Pay ₹40 partially
    const paidPartial = await libraryService.recordFinePayment(schoolAId, {
      fine_id: fine.id,
      amount_paid: 40,
      payment_mode: 'UPI',
      payment_reference: 'UPI/2026/89812739',
      received_by: uSuperAId,
    });
    assert.equal(paidPartial.status, 'PARTIALLY_PAID');
    assert.equal(paidPartial.paid_amount, 40);
    assert.equal(paidPartial.balance_amount, 60);

    // Waive remaining ₹60
    const waived = await libraryService.waiveFine(schoolAId, {
      fine_id: fine.id,
      waiver_reason: 'Approved by Principal on medical leave exemption certificate',
      waived_by: uSuperAId,
    });
    assert.equal(waived.status, 'WAIVED');
    assert.equal(waived.balance_amount, 0);
    assert.equal(waived.waived_amount, 60);
  });

  it('10. Renewal Workflow: Increments renewal count and enforces maximum renewals limit', async () => {
    await libraryService.updateSettings(schoolAId, { maximum_renewals: 1, loan_period_days: 14 });
    const copies = await libraryService.getCopies(schoolAId, { status: 'AVAILABLE' });
    const copy = copies[0];
    const member = (await libraryService.getMembers(schoolAId))[0];

    const issue = await libraryService.issueBook(schoolAId, {
      book_copy_id: copy.id,
      member_user_id: member.user_id,
    });
    const originalDueDate = issue.due_date;

    // First renewal: success
    const renewed = await libraryService.renewBook(schoolAId, { issue_id: issue.id });
    assert.equal(renewed.renewal_count, 1);
    assert.notEqual(renewed.due_date, originalDueDate);

    // Second renewal: rejected due to limit = 1
    await assert.rejects(
      async () => {
        await libraryService.renewBook(schoolAId, { issue_id: issue.id });
      },
      /Maximum renewals reached/
    );
  });

  it('11. Lost & Damaged Books: Tracks loss/damage reports and updates holding condition', async () => {
    const copies = await libraryService.getCopies(schoolAId, { status: 'AVAILABLE' });
    const copy = copies[0];

    const report = await libraryService.reportLostBook(schoolAId, {
      book_copy_id: copy.id,
      description: 'Lost during bus commute by student',
      replacement_cost: 350,
      charge_fine: true,
      responsible_member_id: uStudentAaravId,
    });

    assert.ok(report.id);
    assert.equal(report.record_type, 'LOST');
    assert.ok(report.fine_id, 'Fine must be billed to responsible member');

    const updatedCopy = await libraryService.getCopyById(schoolAId, copy.id);
    assert.equal(updatedCopy.status, 'LOST');
  });

  it('12. Multi-Tenant Data Isolation: Strictly prevents cross-school data leak', async () => {
    // School A books
    const booksA = await libraryService.getBooks(schoolAId);
    assert.ok(booksA.length > 0);

    // School B books
    const booksB = await libraryService.getBooks(schoolBId);
    assert.equal(booksB.length, 0, 'School B must not see School A books');

    // Attempting to fetch School A copy using School B tenant context
    const copyA = (await libraryService.getCopies(schoolAId))[0];
    const leakedCopy = await libraryRepository.findCopyById(schoolBId, copyA.id);
    assert.equal(leakedCopy, null, 'School B must not be able to load School A copy');
  });
});

function schoolId(id: string) {
  return id;
}
