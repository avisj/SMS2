// ========================================================================
// Library Management Routes
// REST API v1 for Books, Copies, Members, Issues, Fines, Reservations,
// Lost/Damaged, Settings, and Dashboard Aggregations
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { libraryService } from '../services/library.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const libraryRouter = Router();

libraryRouter.use(authMiddleware);
libraryRouter.use(tenantIsolationMiddleware);

// Helper for single request param
function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val;
}

// ----------------------------------------------------------------------
// 1. Dashboard Metrics
// ----------------------------------------------------------------------
libraryRouter.get(
  '/dashboard',
  requirePermission(['library.dashboard.view', 'library.books.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const metrics = await libraryService.getDashboardMetrics(schoolId);
      res.json({ success: true, data: metrics });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 2. Settings
// ----------------------------------------------------------------------
libraryRouter.get(
  '/settings',
  requirePermission(['library.settings.manage', 'library.dashboard.view', 'library.books.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const settings = await libraryService.getSettings(schoolId);
      res.json({ success: true, data: settings });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.put(
  '/settings',
  requirePermission(['library.settings.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        loan_period_days: z.number().int().min(1).optional(),
        maximum_books_per_member: z.number().int().min(1).optional(),
        student_issue_limit: z.number().int().min(1).optional(),
        staff_issue_limit: z.number().int().min(1).optional(),
        maximum_renewals: z.number().int().min(0).optional(),
        fine_per_day: z.number().min(0).optional(),
        grace_period_days: z.number().int().min(0).optional(),
        reservation_enabled: z.boolean().optional(),
        reservation_expiry_days: z.number().int().min(1).optional(),
        auto_fine_enabled: z.boolean().optional(),
      });
      const parsed = schema.parse(req.body);
      const settings = await libraryService.updateSettings(schoolId, parsed);
      res.json({ success: true, data: settings });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 3. Categories
// ----------------------------------------------------------------------
libraryRouter.get(
  '/categories',
  requirePermission(['library.books.view', 'library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const categories = await libraryService.getCategories(schoolId);
      res.json({ success: true, data: categories });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/categories',
  requirePermission(['library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        name: z.string().min(1, 'Category name is required'),
        code: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.parse(req.body);
      const category = await libraryService.createCategory(schoolId, parsed);
      res.status(201).json({ success: true, data: category });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.put(
  '/categories/:id',
  requirePermission(['library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const categoryId = getParam(req, 'id');
      const category = await libraryService.updateCategory(schoolId, categoryId, req.body);
      res.json({ success: true, data: category });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.delete(
  '/categories/:id',
  requirePermission(['library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const categoryId = getParam(req, 'id');
      await libraryService.deleteCategory(schoolId, categoryId);
      res.json({ success: true, message: 'Category deleted successfully.' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 4. Authors & Publishers
// ----------------------------------------------------------------------
libraryRouter.get(
  '/authors',
  requirePermission(['library.books.view', 'library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const authors = await libraryService.getAuthors(schoolId);
      res.json({ success: true, data: authors });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/authors',
  requirePermission(['library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const author = await libraryService.createAuthor(schoolId, req.body);
      res.status(201).json({ success: true, data: author });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.put(
  '/authors/:id',
  requirePermission(['library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const authorId = getParam(req, 'id');
      const author = await libraryService.updateAuthor(schoolId, authorId, req.body);
      res.json({ success: true, data: author });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.get(
  '/publishers',
  requirePermission(['library.books.view', 'library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const publishers = await libraryService.getPublishers(schoolId);
      res.json({ success: true, data: publishers });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/publishers',
  requirePermission(['library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const publisher = await libraryService.createPublisher(schoolId, req.body);
      res.status(201).json({ success: true, data: publisher });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.put(
  '/publishers/:id',
  requirePermission(['library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const publisherId = getParam(req, 'id');
      const publisher = await libraryService.updatePublisher(schoolId, publisherId, req.body);
      res.json({ success: true, data: publisher });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 5. Books
// ----------------------------------------------------------------------
libraryRouter.get(
  '/books',
  requirePermission(['library.books.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        search: (req.query.search as string)?.trim() || undefined,
        category_id: (req.query.category_id as string)?.trim() || undefined,
        author_id: (req.query.author_id as string)?.trim() || undefined,
        publisher_id: (req.query.publisher_id as string)?.trim() || undefined,
        status: (req.query.status as string)?.trim() || undefined,
      };
      const books = await libraryService.getBooks(schoolId, filters);
      res.json({ success: true, data: books });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.get(
  '/books/:id',
  requirePermission(['library.books.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const bookId = getParam(req, 'id');
      const book = await libraryService.getBookById(schoolId, bookId);
      res.json({ success: true, data: book });
    } catch (err: any) {
      res.status(404).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/books',
  requirePermission(['library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        title: z.string().min(1, 'Title is required'),
        subtitle: z.string().optional(),
        category_id: z.string().uuid(),
        publisher_id: z.string().uuid().optional(),
        publication_year: z.number().int().optional(),
        edition: z.string().optional(),
        language: z.string().optional(),
        pages: z.number().int().optional(),
        isbn: z.string().optional(),
        accession_reference: z.string().optional(),
        description: z.string().optional(),
        subject: z.string().optional(),
        class_level: z.string().optional(),
        price: z.number().min(0).optional(),
        author_ids: z.array(z.string()).optional(),
      });
      const parsed = schema.parse(req.body);
      const book = await libraryService.createBook(
        schoolId,
        {
          ...parsed,
          created_by: req.userContext!.user_id,
        },
        parsed.author_ids || []
      );
      res.status(201).json({ success: true, data: book });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.put(
  '/books/:id',
  requirePermission(['library.books.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const bookId = getParam(req, 'id');
      const { author_ids, ...rest } = req.body;
      const book = await libraryService.updateBook(schoolId, bookId, rest, author_ids);
      res.json({ success: true, data: book });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 6. Book Copies
// ----------------------------------------------------------------------
libraryRouter.get(
  '/copies',
  requirePermission(['library.books.view', 'library.copies.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        book_id: (req.query.book_id as string)?.trim() || undefined,
        location_id: (req.query.location_id as string)?.trim() || undefined,
        status: (req.query.status as string)?.trim() || undefined,
        search: (req.query.search as string)?.trim() || undefined,
      };
      const copies = await libraryService.getCopies(schoolId, filters);
      res.json({ success: true, data: copies });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.get(
  '/copies/barcode/:code',
  requirePermission(['library.books.view', 'library.copies.manage', 'library.issue.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const code = getParam(req, 'code');
      const copy = await libraryService.getCopyByBarcode(schoolId, code);
      res.json({ success: true, data: copy });
    } catch (err: any) {
      res.status(404).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.get(
  '/copies/:id',
  requirePermission(['library.books.view', 'library.copies.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const copyId = getParam(req, 'id');
      const copy = await libraryService.getCopyById(schoolId, copyId);
      res.json({ success: true, data: copy });
    } catch (err: any) {
      res.status(404).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/copies',
  requirePermission(['library.copies.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        book_id: z.string().uuid('Book ID is required'),
        location_id: z.string().uuid('Branch / Location is required'),
        copy_code: z.string().optional(),
        accession_number: z.string().optional(),
        barcode: z.string().optional(),
        purchase_date: z.string().optional(),
        purchase_price: z.number().min(0).optional(),
        room: z.string().optional(),
        shelf: z.string().optional(),
        rack: z.string().optional(),
        condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'POOR']).optional(),
        status: z.enum(['AVAILABLE', 'ISSUED', 'RESERVED', 'LOST', 'DAMAGED', 'UNDER_REPAIR', 'DISPOSED']).optional(),
        remarks: z.string().optional(),
        count: z.number().int().min(1).max(50).optional(), // Batch creation support
      });
      const parsed = schema.parse(req.body);
      const count = parsed.count || 1;

      const createdCopies = [];
      for (let i = 0; i < count; i++) {
        const copy = await libraryService.createCopy(schoolId, {
          ...parsed,
          copy_code: count > 1 ? undefined : parsed.copy_code,
          barcode: count > 1 ? undefined : parsed.barcode,
          created_by: req.userContext!.user_id,
        });
        createdCopies.push(copy);
      }

      res.status(201).json({
        success: true,
        data: count === 1 ? createdCopies[0] : createdCopies,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.put(
  '/copies/:id',
  requirePermission(['library.copies.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const copyId = getParam(req, 'id');
      const copy = await libraryService.updateCopy(schoolId, copyId, {
        ...req.body,
        updated_by: req.userContext!.user_id,
      });
      res.json({ success: true, data: copy });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 7. Members
// ----------------------------------------------------------------------
libraryRouter.get(
  '/members',
  requirePermission(['library.members.manage', 'library.issue.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        search: (req.query.search as string)?.trim() || undefined,
        type: (req.query.type as string)?.trim() || undefined,
        status: (req.query.status as string)?.trim() || undefined,
      };
      const members = await libraryService.getMembers(schoolId, filters);
      res.json({ success: true, data: members });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.get(
  '/members/user/:userId',
  requirePermission(['library.members.manage', 'library.issue.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const userId = getParam(req, 'userId');
      const member = await libraryService.getMemberByUserId(schoolId, userId);
      res.json({ success: true, data: member });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.get(
  '/members/:id',
  requirePermission(['library.members.manage', 'library.issue.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const memberId = getParam(req, 'id');
      const member = await libraryService.getMemberById(schoolId, memberId);
      res.json({ success: true, data: member });
    } catch (err: any) {
      res.status(404).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/members',
  requirePermission(['library.members.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        user_id: z.string().uuid('Valid user ID required'),
        membership_type: z.enum(['STUDENT', 'TEACHER', 'STAFF']).optional(),
        membership_number: z.string().optional(),
        max_books_allowed: z.number().int().min(1).optional(),
        joined_date: z.string().optional(),
        expiry_date: z.string().optional(),
        remarks: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const member = await libraryService.registerMember(schoolId, parsed);
      res.status(201).json({ success: true, data: member });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.put(
  '/members/:id',
  requirePermission(['library.members.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const memberId = getParam(req, 'id');
      const member = await libraryService.updateMember(schoolId, memberId, req.body);
      res.json({ success: true, data: member });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 8. Circulation: Issues, Returns, Renewals
// ----------------------------------------------------------------------
libraryRouter.get(
  '/issues',
  requirePermission(['library.issue.manage', 'library.dashboard.view', 'library.reports.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        member_user_id: (req.query.member_user_id as string)?.trim() || undefined,
        book_id: (req.query.book_id as string)?.trim() || undefined,
        book_copy_id: (req.query.book_copy_id as string)?.trim() || undefined,
        status: (req.query.status as string)?.trim() || undefined,
      };
      const issues = await libraryService.getIssues(schoolId, filters);
      res.json({ success: true, data: issues });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/issues',
  requirePermission(['library.issue.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        book_copy_id: z.string().uuid('Book copy ID is required'),
        member_user_id: z.string().uuid('Member user ID is required'),
        due_date: z.string().optional(),
        remarks: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const issue = await libraryService.issueBook(schoolId, {
        ...parsed,
        issued_by: req.userContext!.user_id,
      });
      res.status(201).json({ success: true, data: issue });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/issues/:id/return',
  requirePermission(['library.issue.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const issueId = getParam(req, 'id');
      const schema = z.object({
        return_date: z.string().optional(),
        condition: z.enum(['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'POOR']).optional(),
        remarks: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const result = await libraryService.returnBook(schoolId, {
        issue_id: issueId,
        ...parsed,
        returned_by: req.userContext!.user_id,
      });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/issues/:id/renew',
  requirePermission(['library.issue.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const issueId = getParam(req, 'id');
      const renewed = await libraryService.renewBook(schoolId, {
        issue_id: issueId,
        renewed_by: req.userContext!.user_id,
      });
      res.json({ success: true, data: renewed });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 9. Reservations
// ----------------------------------------------------------------------
libraryRouter.get(
  '/reservations',
  requirePermission(['library.reservation.manage', 'library.issue.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        book_id: (req.query.book_id as string)?.trim() || undefined,
        member_user_id: (req.query.member_user_id as string)?.trim() || undefined,
        status: (req.query.status as string)?.trim() || undefined,
      };
      const reservations = await libraryService.getReservations(schoolId, filters);
      res.json({ success: true, data: reservations });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/reservations',
  requirePermission(['library.reservation.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        book_id: z.string().uuid(),
        member_user_id: z.string().uuid(),
        remarks: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const resv = await libraryService.reserveBook(schoolId, parsed);
      res.status(201).json({ success: true, data: resv });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/reservations/:id/cancel',
  requirePermission(['library.reservation.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const reservationId = getParam(req, 'id');
      const resv = await libraryService.cancelReservation(schoolId, reservationId);
      res.json({ success: true, data: resv });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 10. Fines & Payments
// ----------------------------------------------------------------------
libraryRouter.get(
  '/fines',
  requirePermission(['library.fines.manage', 'library.dashboard.view', 'library.reports.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const filters = {
        member_user_id: (req.query.member_user_id as string)?.trim() || undefined,
        status: (req.query.status as string)?.trim() || undefined,
      };
      const fines = await libraryService.getFines(schoolId, filters);
      res.json({ success: true, data: fines });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/fines/:id/pay',
  requirePermission(['library.fines.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const fineId = getParam(req, 'id');
      const schema = z.object({
        amount_paid: z.number().min(0.01, 'Payment amount must be greater than zero'),
        payment_mode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']),
        payment_reference: z.string().optional(),
      });
      const parsed = schema.parse(req.body);
      const fine = await libraryService.recordFinePayment(schoolId, {
        fine_id: fineId,
        ...parsed,
        received_by: req.userContext!.user_id,
      });
      res.json({ success: true, data: fine });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/fines/:id/waive',
  requirePermission(['library.fines.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const fineId = getParam(req, 'id');
      const schema = z.object({
        waiver_reason: z.string().min(3, 'Waiver justification reason is required'),
      });
      const parsed = schema.parse(req.body);
      const fine = await libraryService.waiveFine(schoolId, {
        fine_id: fineId,
        waiver_reason: parsed.waiver_reason,
        waived_by: req.userContext!.user_id,
      });
      res.json({ success: true, data: fine });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

// ----------------------------------------------------------------------
// 11. Lost / Damaged / Disposals
// ----------------------------------------------------------------------
libraryRouter.get(
  '/lost-damaged',
  requirePermission(['library.books.manage', 'library.copies.manage', 'library.reports.view']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const records = await libraryService.getLostDamaged(schoolId);
      res.json({ success: true, data: records });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/lost-damaged/lost',
  requirePermission(['library.copies.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        book_copy_id: z.string().uuid(),
        issue_id: z.string().uuid().optional(),
        responsible_member_id: z.string().uuid().optional(),
        description: z.string().min(1, 'Description is required'),
        replacement_cost: z.number().min(0).optional(),
        charge_fine: z.boolean().optional(),
      });
      const parsed = schema.parse(req.body);
      const record = await libraryService.reportLostBook(schoolId, {
        ...parsed,
        reported_by: req.userContext!.user_id,
      });
      res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/lost-damaged/damaged',
  requirePermission(['library.copies.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        book_copy_id: z.string().uuid(),
        responsible_member_id: z.string().uuid().optional(),
        description: z.string().min(1, 'Description is required'),
        repair_cost: z.number().min(0).optional(),
        charge_fine: z.boolean().optional(),
      });
      const parsed = schema.parse(req.body);
      const record = await libraryService.reportDamagedBook(schoolId, {
        ...parsed,
        reported_by: req.userContext!.user_id,
      });
      res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);

libraryRouter.post(
  '/lost-damaged/dispose',
  requirePermission(['library.copies.manage']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const schoolId = req.userContext!.school_id!;
      const schema = z.object({
        book_copy_id: z.string().uuid(),
        reason: z.string().min(1, 'Disposal reason is required'),
      });
      const parsed = schema.parse(req.body);
      const record = await libraryService.disposeCopy(schoolId, {
        ...parsed,
        reported_by: req.userContext!.user_id,
      });
      res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message } });
    }
  }
);
