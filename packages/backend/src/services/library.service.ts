// ========================================================================
// Library Service
// Business Logic Layer: Circulation State Machine, Fine Calculation,
// Reservation Queue Management, Loss/Damage Tracking, and Validation Rules
// ========================================================================

import {
  LibraryRepository,
  libraryRepository,
} from '../repositories/library.repository.js';
import {
  LibrarySettings,
  LibraryCategory,
  LibraryAuthor,
  LibraryPublisher,
  LibraryBook,
  LibraryBookCopy,
  LibraryMember,
  LibraryIssue,
  LibraryReservation,
  LibraryFine,
  LibraryLostDamaged,
  LibraryDashboardMetrics,
  BookCopyCondition,
} from '../types/index.js';

export class LibraryService {
  constructor(public repo: LibraryRepository = libraryRepository) {}

  async getIssues(
    schoolId: string,
    filters?: { member_user_id?: string; book_id?: string; book_copy_id?: string; status?: string }
  ): Promise<LibraryIssue[]> {
    return this.repo.findIssues(schoolId, filters);
  }

  // ======================================================================
  // 1. Settings
  // ======================================================================

  async getSettings(schoolId: string): Promise<LibrarySettings> {
    return this.repo.getSettings(schoolId);
  }

  async updateSettings(schoolId: string, payload: Partial<LibrarySettings>): Promise<LibrarySettings> {
    return this.repo.upsertSettings(schoolId, payload);
  }

  // ======================================================================
  // 2. Categories
  // ======================================================================

  async getCategories(schoolId: string): Promise<LibraryCategory[]> {
    return this.repo.findCategories(schoolId);
  }

  async createCategory(schoolId: string, payload: Partial<LibraryCategory>): Promise<LibraryCategory> {
    if (!payload.name || !payload.name.trim()) {
      throw new Error('Category name is required.');
    }
    return this.repo.createCategory(schoolId, payload);
  }

  async updateCategory(schoolId: string, id: string, payload: Partial<LibraryCategory>): Promise<LibraryCategory> {
    return this.repo.updateCategory(schoolId, id, payload);
  }

  async deleteCategory(schoolId: string, id: string): Promise<void> {
    return this.repo.deleteCategory(schoolId, id);
  }

  // ======================================================================
  // 3. Authors & Publishers
  // ======================================================================

  async getAuthors(schoolId: string): Promise<LibraryAuthor[]> {
    return this.repo.findAuthors(schoolId);
  }

  async createAuthor(schoolId: string, payload: Partial<LibraryAuthor>): Promise<LibraryAuthor> {
    if (!payload.name || !payload.name.trim()) {
      throw new Error('Author name is required.');
    }
    return this.repo.createAuthor(schoolId, payload);
  }

  async updateAuthor(schoolId: string, id: string, payload: Partial<LibraryAuthor>): Promise<LibraryAuthor> {
    return this.repo.updateAuthor(schoolId, id, payload);
  }

  async getPublishers(schoolId: string): Promise<LibraryPublisher[]> {
    return this.repo.findPublishers(schoolId);
  }

  async createPublisher(schoolId: string, payload: Partial<LibraryPublisher>): Promise<LibraryPublisher> {
    if (!payload.name || !payload.name.trim()) {
      throw new Error('Publisher name is required.');
    }
    return this.repo.createPublisher(schoolId, payload);
  }

  async updatePublisher(schoolId: string, id: string, payload: Partial<LibraryPublisher>): Promise<LibraryPublisher> {
    return this.repo.updatePublisher(schoolId, id, payload);
  }

  // ======================================================================
  // 4. Books
  // ======================================================================

  async getBooks(
    schoolId: string,
    filters?: { search?: string; category_id?: string; author_id?: string; publisher_id?: string; status?: string }
  ): Promise<LibraryBook[]> {
    return this.repo.findBooks(schoolId, filters);
  }

  async getBookById(schoolId: string, id: string): Promise<LibraryBook> {
    const book = await this.repo.findBookById(schoolId, id);
    if (!book) throw new Error('Book not found.');
    return book;
  }

  async createBook(schoolId: string, payload: Partial<LibraryBook>, authorIds: string[] = []): Promise<LibraryBook> {
    if (!payload.title || !payload.title.trim()) {
      throw new Error('Book title is required.');
    }
    if (!payload.category_id) {
      throw new Error('Book category is required.');
    }
    return this.repo.createBook(schoolId, payload, authorIds);
  }

  async updateBook(schoolId: string, id: string, payload: Partial<LibraryBook>, authorIds?: string[]): Promise<LibraryBook> {
    return this.repo.updateBook(schoolId, id, payload, authorIds);
  }

  // ======================================================================
  // 5. Copies
  // ======================================================================

  async getCopies(
    schoolId: string,
    filters?: { book_id?: string; location_id?: string; status?: string; search?: string }
  ): Promise<LibraryBookCopy[]> {
    return this.repo.findCopies(schoolId, filters);
  }

  async getCopyById(schoolId: string, id: string): Promise<LibraryBookCopy> {
    const copy = await this.repo.findCopyById(schoolId, id);
    if (!copy) throw new Error('Book copy not found.');
    return copy;
  }

  async getCopyByBarcode(schoolId: string, term: string): Promise<LibraryBookCopy> {
    const copy = await this.repo.findCopyByCodeOrBarcode(schoolId, term);
    if (!copy) throw new Error(`No copy found matching code or barcode "${term}".`);
    return copy;
  }

  async createCopy(schoolId: string, payload: Partial<LibraryBookCopy>): Promise<LibraryBookCopy> {
    if (!payload.book_id) throw new Error('Book reference is required.');
    if (!payload.location_id) throw new Error('Branch / Location is required.');
    return this.repo.createCopy(schoolId, payload);
  }

  async updateCopy(schoolId: string, id: string, payload: Partial<LibraryBookCopy>): Promise<LibraryBookCopy> {
    return this.repo.updateCopy(schoolId, id, payload);
  }

  // ======================================================================
  // 6. Members
  // ======================================================================

  async getMembers(
    schoolId: string,
    filters?: { search?: string; type?: string; status?: string }
  ): Promise<LibraryMember[]> {
    return this.repo.findMembers(schoolId, filters);
  }

  async getMemberById(schoolId: string, id: string): Promise<LibraryMember> {
    const member = await this.repo.findMemberById(schoolId, id);
    if (!member) throw new Error('Library member not found.');
    return member;
  }

  async getMemberByUserId(schoolId: string, userId: string): Promise<LibraryMember | null> {
    return this.repo.findMemberByUserId(schoolId, userId);
  }

  async registerMember(schoolId: string, payload: Partial<LibraryMember>): Promise<LibraryMember> {
    if (!payload.user_id) throw new Error('User selection is required.');
    return this.repo.createMember(schoolId, payload);
  }

  async updateMember(schoolId: string, id: string, payload: Partial<LibraryMember>): Promise<LibraryMember> {
    return this.repo.updateMember(schoolId, id, payload);
  }

  // ======================================================================
  // 7. Circulation: Issue Book
  // ======================================================================

  async issueBook(
    schoolId: string,
    params: {
      book_copy_id: string;
      member_user_id: string;
      issued_by?: string;
      due_date?: string;
      remarks?: string;
    }
  ): Promise<LibraryIssue> {
    // 1. Verify copy
    const copy = await this.repo.findCopyById(schoolId, params.book_copy_id);
    if (!copy) throw new Error('Book copy not found.');
    if (copy.status !== 'AVAILABLE') {
      throw new Error(`Cannot issue book copy: current status is ${copy.status}. Only AVAILABLE copies can be issued.`);
    }

    // 2. Verify member
    const member = await this.repo.findMemberByUserId(schoolId, params.member_user_id);
    if (!member) {
      throw new Error('User is not enrolled as an active library member.');
    }
    if (member.status !== 'ACTIVE') {
      throw new Error(`Cannot issue book: Member account status is ${member.status}.`);
    }

    // 3. Verify borrowing limit
    const settings = await this.repo.getSettings(schoolId);
    const maxAllowed =
      member.max_books_allowed ||
      (member.membership_type === 'TEACHER' || member.membership_type === 'STAFF'
        ? settings.staff_issue_limit
        : settings.student_issue_limit);

    const activeIssuesCount = await this.repo.countActiveIssuesForMember(schoolId, member.user_id);
    if (activeIssuesCount >= maxAllowed) {
      throw new Error(
        `Borrowing limit reached: Member already has ${activeIssuesCount} active book(s) issued (maximum allowed: ${maxAllowed}).`
      );
    }

    // 4. Calculate due date
    let dueDate = params.due_date;
    if (!dueDate) {
      const loanDays = settings.loan_period_days || 14;
      const due = new Date();
      due.setDate(due.getDate() + loanDays);
      dueDate = due.toISOString().split('T')[0];
    }

    // 5. Transaction: create issue and update copy status
    const issue = await this.repo.createIssue(schoolId, {
      member_user_id: member.user_id,
      book_id: copy.book_id,
      book_copy_id: copy.id,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate,
      issued_by: params.issued_by,
      remarks: params.remarks,
    });

    await this.repo.updateCopy(schoolId, copy.id, {
      status: 'ISSUED',
    });

    return issue;
  }

  // ======================================================================
  // 8. Circulation: Return Book
  // ======================================================================

  async returnBook(
    schoolId: string,
    params: {
      issue_id: string;
      return_date?: string;
      returned_by?: string;
      condition?: BookCopyCondition;
      remarks?: string;
    }
  ): Promise<{ issue: LibraryIssue; fine?: LibraryFine }> {
    const issue = await this.repo.findIssueById(schoolId, params.issue_id);
    if (!issue) throw new Error('Issue record not found.');
    if (issue.status !== 'ISSUED') {
      throw new Error(`Book is already marked as ${issue.status}.`);
    }

    const returnDate = params.return_date || new Date().toISOString().split('T')[0];
    const settings = await this.repo.getSettings(schoolId);

    // Calculate overdue fine
    let fineRecord: LibraryFine | undefined;
    const dueDate = new Date(issue.due_date);
    const actualReturnDate = new Date(returnDate);

    const diffTime = actualReturnDate.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const graceDays = settings.grace_period_days || 0;
    const overdueDays = diffDays > graceDays ? diffDays : 0;

    if (overdueDays > 0 && settings.auto_fine_enabled) {
      const finePerDay = Number(settings.fine_per_day || 5);
      const fineAmount = overdueDays * finePerDay;

      fineRecord = await this.repo.createFine(schoolId, {
        issue_id: issue.id,
        member_user_id: issue.member_user_id,
        fine_date: returnDate,
        amount: fineAmount,
        reason: `OVERDUE: ${overdueDays} day(s) past due date (${issue.due_date})`,
        status: 'UNPAID',
        paid_amount: 0,
        balance_amount: fineAmount,
        created_by: params.returned_by,
      });
    }

    // Check reservation queue for this book
    const reservations = await this.repo.findReservations(schoolId, {
      book_id: issue.book_id,
      status: 'ACTIVE',
    });

    let newCopyStatus: LibraryBookCopy['status'] = 'AVAILABLE';
    if (params.condition === 'DAMAGED' || params.condition === 'POOR') {
      newCopyStatus = 'DAMAGED';
    } else if (reservations.length > 0) {
      // Fulfill earliest in queue
      const earliestReservation = reservations[0];
      await this.repo.updateReservation(schoolId, earliestReservation.id, {
        status: 'FULFILLED',
        fulfilled_copy_id: issue.book_copy_id,
      });
      newCopyStatus = 'RESERVED';
    }

    // Update copy condition and status
    await this.repo.updateCopy(schoolId, issue.book_copy_id, {
      status: newCopyStatus,
      condition: params.condition || issue.book_copy?.condition || 'GOOD',
    });

    // Update issue record
    const updatedIssue = await this.repo.updateIssue(schoolId, issue.id, {
      return_date: returnDate,
      returned_by: params.returned_by,
      status: 'RETURNED',
      remarks: params.remarks,
    });

    return {
      issue: updatedIssue,
      fine: fineRecord,
    };
  }

  // ======================================================================
  // 9. Circulation: Renew Book
  // ======================================================================

  async renewBook(
    schoolId: string,
    params: {
      issue_id: string;
      renewed_by?: string;
    }
  ): Promise<LibraryIssue> {
    const issue = await this.repo.findIssueById(schoolId, params.issue_id);
    if (!issue) throw new Error('Issue record not found.');
    if (issue.status !== 'ISSUED') {
      throw new Error(`Cannot renew: book status is ${issue.status}.`);
    }

    const settings = await this.repo.getSettings(schoolId);
    if (issue.renewal_count >= settings.maximum_renewals) {
      throw new Error(
        `Maximum renewals reached: Book has already been renewed ${issue.renewal_count} time(s) (limit: ${settings.maximum_renewals}).`
      );
    }

    // Check if another member has reserved this book
    const reservations = await this.repo.findReservations(schoolId, {
      book_id: issue.book_id,
      status: 'ACTIVE',
    });
    if (reservations.length > 0) {
      throw new Error('Cannot renew: Another member has an active reservation for this book.');
    }

    // Calculate new due date
    const currentDue = new Date(issue.due_date);
    currentDue.setDate(currentDue.getDate() + (settings.loan_period_days || 14));
    const newDueDate = currentDue.toISOString().split('T')[0];

    return this.repo.updateIssue(schoolId, issue.id, {
      due_date: newDueDate,
      renewal_count: issue.renewal_count + 1,
    });
  }

  // ======================================================================
  // 10. Reservations
  // ======================================================================

  async getReservations(
    schoolId: string,
    filters?: { book_id?: string; member_user_id?: string; status?: string }
  ): Promise<LibraryReservation[]> {
    return this.repo.findReservations(schoolId, filters);
  }

  async reserveBook(
    schoolId: string,
    params: {
      book_id: string;
      member_user_id: string;
      remarks?: string;
    }
  ): Promise<LibraryReservation> {
    const settings = await this.repo.getSettings(schoolId);
    if (!settings.reservation_enabled) {
      throw new Error('Book reservations are currently disabled by library administration.');
    }

    const member = await this.repo.findMemberByUserId(schoolId, params.member_user_id);
    if (!member || member.status !== 'ACTIVE') {
      throw new Error('Only active library members can place reservations.');
    }

    // Verify existing active reservation
    const existing = await this.repo.findReservations(schoolId, {
      book_id: params.book_id,
      member_user_id: params.member_user_id,
      status: 'ACTIVE',
    });
    if (existing.length > 0) {
      throw new Error('Member already has an active reservation queue entry for this book.');
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (settings.reservation_expiry_days || 7));

    return this.repo.createReservation(schoolId, {
      book_id: params.book_id,
      member_user_id: params.member_user_id,
      expiry_date: expiryDate.toISOString().split('T')[0],
      remarks: params.remarks,
    });
  }

  async cancelReservation(schoolId: string, id: string): Promise<LibraryReservation> {
    return this.repo.updateReservation(schoolId, id, {
      status: 'CANCELLED',
    });
  }

  // ======================================================================
  // 11. Fines & Payments
  // ======================================================================

  async getFines(
    schoolId: string,
    filters?: { member_user_id?: string; status?: string }
  ): Promise<LibraryFine[]> {
    return this.repo.findFines(schoolId, filters);
  }

  async recordFinePayment(
    schoolId: string,
    params: {
      fine_id: string;
      amount_paid: number;
      payment_mode: string;
      payment_reference?: string;
      received_by?: string;
    }
  ): Promise<LibraryFine> {
    const fines = await this.repo.findFines(schoolId);
    const fine = fines.find((f) => f.id === params.fine_id);
    if (!fine) throw new Error('Fine record not found.');
    if (fine.status === 'PAID' || fine.status === 'WAIVED') {
      throw new Error(`Cannot collect payment: Fine is already ${fine.status}.`);
    }

    const payAmount = Number(params.amount_paid);
    if (isNaN(payAmount) || payAmount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const newPaidAmount = Number(fine.paid_amount || 0) + payAmount;
    const newBalance = Math.max(0, Number(fine.amount) - newPaidAmount);
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    return this.repo.updateFine(schoolId, fine.id, {
      paid_amount: newPaidAmount,
      balance_amount: newBalance,
      status: newStatus,
      paid_date: new Date().toISOString().split('T')[0],
      payment_mode: params.payment_mode,
      payment_reference: params.payment_reference,
      received_by: params.received_by,
    });
  }

  async waiveFine(
    schoolId: string,
    params: {
      fine_id: string;
      waived_by?: string;
      waiver_reason: string;
    }
  ): Promise<LibraryFine> {
    const fines = await this.repo.findFines(schoolId);
    const fine = fines.find((f) => f.id === params.fine_id);
    if (!fine) throw new Error('Fine record not found.');
    if (!params.waiver_reason || !params.waiver_reason.trim()) {
      throw new Error('Waiver justification reason is mandatory.');
    }

    return this.repo.updateFine(schoolId, fine.id, {
      status: 'WAIVED',
      waived_amount: fine.balance_amount,
      balance_amount: 0,
      waived_by: params.waived_by,
      waiver_reason: params.waiver_reason.trim(),
    });
  }

  // ======================================================================
  // 12. Lost / Damaged / Disposals
  // ======================================================================

  async getLostDamaged(schoolId: string): Promise<LibraryLostDamaged[]> {
    return this.repo.findLostDamaged(schoolId);
  }

  async reportLostBook(
    schoolId: string,
    params: {
      book_copy_id: string;
      issue_id?: string;
      reported_by?: string;
      responsible_member_id?: string;
      description: string;
      replacement_cost?: number;
      charge_fine?: boolean;
    }
  ): Promise<LibraryLostDamaged> {
    const copy = await this.repo.findCopyById(schoolId, params.book_copy_id);
    if (!copy) throw new Error('Book copy not found.');

    let fineId: string | undefined;
    if (params.charge_fine && params.replacement_cost && params.responsible_member_id) {
      const fine = await this.repo.createFine(schoolId, {
        member_user_id: params.responsible_member_id,
        issue_id: params.issue_id,
        amount: params.replacement_cost,
        reason: `LOST BOOK REPLACEMENT: Copy ${copy.copy_code} (${copy.book?.title})`,
        status: 'UNPAID',
        paid_amount: 0,
        balance_amount: params.replacement_cost,
        created_by: params.reported_by,
      });
      fineId = fine.id;
    }

    // Mark copy as LOST
    await this.repo.updateCopy(schoolId, copy.id, {
      status: 'LOST',
    });

    // If active issue exists, mark issue as LOST
    if (params.issue_id) {
      await this.repo.updateIssue(schoolId, params.issue_id, {
        status: 'LOST',
        remarks: `Reported lost on ${new Date().toISOString().split('T')[0]}: ${params.description}`,
      });
    }

    return this.repo.createLostDamaged(schoolId, {
      book_copy_id: copy.id,
      issue_id: params.issue_id,
      record_type: 'LOST',
      reported_by: params.reported_by,
      responsible_member_id: params.responsible_member_id,
      description: params.description,
      cost_charged: params.replacement_cost,
      fine_id: fineId,
    });
  }

  async reportDamagedBook(
    schoolId: string,
    params: {
      book_copy_id: string;
      reported_by?: string;
      responsible_member_id?: string;
      description: string;
      repair_cost?: number;
      charge_fine?: boolean;
    }
  ): Promise<LibraryLostDamaged> {
    const copy = await this.repo.findCopyById(schoolId, params.book_copy_id);
    if (!copy) throw new Error('Book copy not found.');

    let fineId: string | undefined;
    if (params.charge_fine && params.repair_cost && params.responsible_member_id) {
      const fine = await this.repo.createFine(schoolId, {
        member_user_id: params.responsible_member_id,
        amount: params.repair_cost,
        reason: `DAMAGED BOOK REPAIR: Copy ${copy.copy_code} (${copy.book?.title})`,
        status: 'UNPAID',
        paid_amount: 0,
        balance_amount: params.repair_cost,
        created_by: params.reported_by,
      });
      fineId = fine.id;
    }

    // Mark copy as DAMAGED
    await this.repo.updateCopy(schoolId, copy.id, {
      status: 'DAMAGED',
      condition: 'DAMAGED',
    });

    return this.repo.createLostDamaged(schoolId, {
      book_copy_id: copy.id,
      record_type: 'DAMAGED',
      reported_by: params.reported_by,
      responsible_member_id: params.responsible_member_id,
      description: params.description,
      cost_charged: params.repair_cost,
      fine_id: fineId,
    });
  }

  async disposeCopy(
    schoolId: string,
    params: {
      book_copy_id: string;
      reported_by?: string;
      reason: string;
    }
  ): Promise<LibraryLostDamaged> {
    const copy = await this.repo.findCopyById(schoolId, params.book_copy_id);
    if (!copy) throw new Error('Book copy not found.');
    if (copy.status === 'ISSUED') {
      throw new Error('Cannot dispose copy while currently issued to a member.');
    }

    await this.repo.updateCopy(schoolId, copy.id, {
      status: 'DISPOSED',
      condition: 'POOR',
    });

    return this.repo.createLostDamaged(schoolId, {
      book_copy_id: copy.id,
      record_type: 'DISPOSED',
      reported_by: params.reported_by,
      description: params.reason,
    });
  }

  // ======================================================================
  // 13. Dashboard Metrics
  // ======================================================================

  async getDashboardMetrics(schoolId: string): Promise<LibraryDashboardMetrics> {
    return this.repo.getDashboardMetrics(schoolId);
  }
}

export const libraryService = new LibraryService();
