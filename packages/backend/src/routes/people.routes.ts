// ========================================================================
// People Routes
// Specialized views for Students, Staff, Designations, Taxonomy Masters
// ========================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { peopleService } from '../services/people.service.js';
import { storageService } from '../services/storage.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantIsolationMiddleware } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/authorize.middleware.js';

export const peopleRouter = Router();

peopleRouter.use(authMiddleware);
peopleRouter.use(tenantIsolationMiddleware);

// ----------------------------------------------------------------------
// File & Document Upload (Real Supabase Storage Integration)
// ----------------------------------------------------------------------
peopleRouter.post('/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName, fileType, fileSize, base64Data, category } = req.body;
    const schoolId = req.userContext?.school_id || 'default';

    const result = await storageService.uploadFile({
      schoolId,
      category: category || 'documents',
      fileName: fileName || 'document.pdf',
      mimeType: fileType,
      base64Data,
      fileSize,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.post('/storage/signed-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storagePath, expiresInSeconds } = req.body;
    const schoolId = req.userContext?.school_id;
    if (!schoolId) {
      res.status(400).json({ success: false, error: { message: 'School ID required' } });
      return;
    }
    const signedUrl = await storageService.getSignedUrl(schoolId, storagePath, expiresInSeconds);
    res.json({
      success: true,
      data: { signed_url: signedUrl },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ----------------------------------------------------------------------
// Designations Master
// ----------------------------------------------------------------------
peopleRouter.get('/designations', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.userContext!.school_id!;
    const includeInactive = req.query.include_inactive === 'true';
    const list = await peopleService.listDesignations(schoolId, includeInactive);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.post('/designations', requirePermission('users.create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(2).max(50),
      name: z.string().min(2).max(100),
      description: z.string().optional(),
      display_order: z.number().int().optional(),
    });
    const parsed = schema.parse(req.body);
    const created = await peopleService.createDesignation(req.userContext!.school_id!, parsed, req.userContext!.user_id);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.put('/designations/:id', requirePermission('users.update'), async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await peopleService.updateDesignation(
      req.userContext!.school_id!,
      req.params.id as string,
      req.body,
      req.userContext!.user_id
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.delete('/designations/:id', requirePermission('users.delete'), async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await peopleService.deleteDesignation(
      req.userContext!.school_id!,
      req.params.id as string,
      req.userContext!.user_id
    );
    res.json({ success: true, data: { deleted } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ----------------------------------------------------------------------
// User Categories & Subcategories Master
// ----------------------------------------------------------------------
peopleRouter.get('/categories', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userType = req.query.user_type as string | undefined;
    const list = await peopleService.listCategories(req.userContext!.school_id!, userType);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.post('/categories', requirePermission('users.create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(2).max(50),
      name: z.string().min(2).max(100),
      applicable_user_type: z.string(),
      description: z.string().optional(),
      display_order: z.number().int().optional(),
    });
    const parsed = schema.parse(req.body);
    const created = await peopleService.createCategory(req.userContext!.school_id!, parsed, req.userContext!.user_id);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.put('/categories/:id', requirePermission('users.update'), async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await peopleService.updateCategory(
      req.userContext!.school_id!,
      req.params.id as string,
      req.body,
      req.userContext!.user_id
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.delete('/categories/:id', requirePermission('users.delete'), async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await peopleService.deleteCategory(
      req.userContext!.school_id!,
      req.params.id as string,
      req.userContext!.user_id
    );
    res.json({ success: true, data: { deleted } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.get('/subcategories', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = req.query.category_id as string | undefined;
    const list = await peopleService.listSubcategories(req.userContext!.school_id!, categoryId);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.post('/subcategories', requirePermission('users.create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      category_id: z.string().uuid(),
      code: z.string().min(2).max(50),
      name: z.string().min(2).max(100),
      description: z.string().optional(),
      display_order: z.number().int().optional(),
    });
    const parsed = schema.parse(req.body);
    const created = await peopleService.createSubcategory(req.userContext!.school_id!, parsed, req.userContext!.user_id);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.put('/subcategories/:id', requirePermission('users.update'), async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await peopleService.updateSubcategory(
      req.userContext!.school_id!,
      req.params.id as string,
      req.body,
      req.userContext!.user_id
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.delete('/subcategories/:id', requirePermission('users.delete'), async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await peopleService.deleteSubcategory(
      req.userContext!.school_id!,
      req.params.id as string,
      req.userContext!.user_id
    );
    res.json({ success: true, data: { deleted } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ----------------------------------------------------------------------
// Tags & Labels Master
// ----------------------------------------------------------------------
peopleRouter.get('/tags', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await peopleService.listTags(req.userContext!.school_id!);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.post('/tags', requirePermission('users.create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(2).max(50),
      name: z.string().min(2).max(100),
      color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
      description: z.string().optional(),
    });
    const parsed = schema.parse(req.body);
    const created = await peopleService.createTag(req.userContext!.school_id!, parsed, req.userContext!.user_id);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.put('/tags/:id', requirePermission('users.update'), async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await peopleService.updateTag(
      req.userContext!.school_id!,
      req.params.id as string,
      req.body,
      req.userContext!.user_id
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.delete('/tags/:id', requirePermission('users.delete'), async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await peopleService.deleteTag(
      req.userContext!.school_id!,
      req.params.id as string,
      req.userContext!.user_id
    );
    res.json({ success: true, data: { deleted } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.get('/labels', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await peopleService.listLabels(req.userContext!.school_id!);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.post('/labels', requirePermission('users.create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      code: z.string().min(2).max(50),
      name: z.string().min(2).max(100),
      color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
      description: z.string().optional(),
    });
    const parsed = schema.parse(req.body);
    const created = await peopleService.createLabel(req.userContext!.school_id!, parsed, req.userContext!.user_id);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.put('/labels/:id', requirePermission('users.update'), async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await peopleService.updateLabel(
      req.userContext!.school_id!,
      req.params.id as string,
      req.body,
      req.userContext!.user_id
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.delete('/labels/:id', requirePermission('users.delete'), async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await peopleService.deleteLabel(
      req.userContext!.school_id!,
      req.params.id as string,
      req.userContext!.user_id
    );
    res.json({ success: true, data: { deleted } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ----------------------------------------------------------------------
// Specialized Operational Views: Students Master
// ----------------------------------------------------------------------
peopleRouter.get('/students', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.userContext!.school_id!;
    const filters = {
      schoolId,
      search: req.query.search as string | undefined,
      locationId: req.query.location_id as string | undefined,
      status: req.query.status as string | undefined,
      academicSession: req.query.academic_session as string | undefined,
      className: req.query.class_name as string | undefined,
      sectionName: req.query.section_name as string | undefined,
      house: req.query.house as string | undefined,
      stream: req.query.stream as string | undefined,
      medium: req.query.medium as string | undefined,
      admissionNumber: req.query.admission_number as string | undefined,
      categoryId: req.query.category_id as string | undefined,
      tagId: req.query.tag_id as string | undefined,
      labelId: req.query.label_id as string | undefined,
    };
    const students = await peopleService.listStudents(schoolId, filters);
    res.json({ success: true, data: students });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.post('/students', requirePermission('users.create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      username: z.string().min(3).max(100),
      email: z.string().email(),
      phone: z.string().optional(),
      first_name: z.string().min(1).max(100),
      middle_name: z.string().optional(),
      last_name: z.string().optional(),
      profile_photo_url: z.string().optional(),
      password: z.string().optional(),
      location_id: z.string().uuid(),
      admission_number: z.string().min(1).max(50),
      roll_number: z.string().optional(),
      academic_session: z.string().min(4),
      class_name: z.string().min(1),
      section_name: z.string().optional(),
      stream: z.string().optional(),
      medium: z.string().optional(),
      house: z.string().optional(),
      gender: z.string().optional(),
      date_of_birth: z.string().optional(),
      blood_group: z.string().optional(),
      nationality: z.string().optional(),
      religion: z.string().optional(),
      category_name: z.string().optional(),
      address: z.string().optional(),
      admission_date: z.string().optional(),
      emergency_contact_name: z.string().optional(),
      emergency_contact_phone: z.string().optional(),
      create_login_access: z.boolean().optional(),
      login_password: z.string().optional(),
      login_status: z.enum(['ACTIVE', 'DISABLED']).optional(),
      category_ids: z.array(z.string().uuid()).optional(),
      subcategory_ids: z.array(z.string().uuid()).optional(),
      tag_ids: z.array(z.string().uuid()).optional(),
      label_ids: z.array(z.string().uuid()).optional(),
      previous_academic_records: z.array(z.object({
        academic_year: z.string().optional(),
        previous_school_name: z.string(),
        class_name: z.string().optional(),
        board: z.string().optional(),
        result: z.string().optional(),
        marks_grade: z.string().optional(),
        remarks: z.string().optional(),
        attachment_url: z.string().optional(),
      })).optional(),
      achievements: z.array(z.object({
        achievement_date: z.string().optional(),
        title: z.string(),
        category: z.string().optional(),
        level: z.string().optional(),
        award_position: z.string().optional(),
        description: z.string().optional(),
        attachment_url: z.string().optional(),
      })).optional(),
      documents: z.array(z.object({
        document_type: z.string(),
        document_name: z.string(),
        document_number: z.string().optional(),
        issue_date: z.string().optional(),
        expiry_date: z.string().optional(),
        file_url: z.string(),
        file_name: z.string().optional(),
        file_size: z.number().optional(),
        mime_type: z.string().optional(),
        remarks: z.string().optional(),
      })).optional(),
    }).superRefine((data, ctx) => {
      if (data.create_login_access) {
        const pwd = data.login_password || data.password;
        if (!pwd || pwd.length < 6) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Password must be at least 6 characters when login access is enabled',
            path: ['login_password'],
          });
        }
      }
    });
    const parsed = schema.parse(req.body);
    const created = await peopleService.createStudent(req.userContext!.school_id!, parsed, req.userContext!.user_id);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.put('/students/:id', requirePermission('users.update'), async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await peopleService.updateStudent(
      req.userContext!.school_id!,
      req.params.id as string,
      req.body,
      req.userContext!.user_id
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ----------------------------------------------------------------------
// Specialized Operational Views: Staff Master
// ----------------------------------------------------------------------
peopleRouter.get('/staff', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.userContext!.school_id!;
    const filters = {
      schoolId,
      search: req.query.search as string | undefined,
      locationId: req.query.location_id as string | undefined,
      status: req.query.status as string | undefined,
      designationId: req.query.designation_id as string | undefined,
      department: req.query.department as string | undefined,
      employeeCode: req.query.employee_code as string | undefined,
      categoryId: req.query.category_id as string | undefined,
      tagId: req.query.tag_id as string | undefined,
      labelId: req.query.label_id as string | undefined,
    };
    const staff = await peopleService.listStaff(schoolId, filters);
    res.json({ success: true, data: staff });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.post('/staff', requirePermission('users.create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      username: z.string().min(3).max(100),
      email: z.string().email(),
      phone: z.string().optional(),
      first_name: z.string().min(1).max(100),
      middle_name: z.string().optional(),
      last_name: z.string().optional(),
      profile_photo_url: z.string().optional(),
      password: z.string().optional(),
      create_login_access: z.boolean().optional(),
      login_password: z.string().optional(),
      login_status: z.enum(['ACTIVE', 'DISABLED']).optional(),
      user_type_code: z.enum(['TEACHER', 'STAFF', 'ADMIN']).optional(),
      role_id: z.string().uuid().optional(),
      role_ids: z.array(z.string().uuid()).optional(),
      location_ids: z.array(z.string().uuid()).min(1),
      primary_location_id: z.string().uuid().optional(),
      employee_code: z.string().min(1).max(50),
      designation_id: z.string().uuid().optional(),
      department: z.string().optional(),
      employment_type: z.enum(['PERMANENT', 'PROBATION', 'CONTRACT', 'PART_TIME', 'TEMPORARY']).optional(),
      joining_date: z.string().optional(),
      qualification: z.string().optional(),
      experience_years: z.number().int().optional(),
      gender: z.string().optional(),
      date_of_birth: z.string().optional(),
      address: z.string().optional(),
      confirmation_date: z.string().optional(),
      work_shift: z.string().optional(),
      emergency_contact_name: z.string().optional(),
      emergency_contact_phone: z.string().optional(),
      category_ids: z.array(z.string().uuid()).optional(),
      subcategory_ids: z.array(z.string().uuid()).optional(),
      tag_ids: z.array(z.string().uuid()).optional(),
      label_ids: z.array(z.string().uuid()).optional(),
      qualifications: z.array(z.object({
        education_level: z.string().optional(),
        qualification_name: z.string(),
        institution: z.string(),
        board_university: z.string().optional(),
        passing_year: z.number().optional(),
        marks_grade: z.string().optional(),
        specialization: z.string().optional(),
        certificate_url: z.string().optional(),
        remarks: z.string().optional(),
      })).optional(),
      experiences: z.array(z.object({
        organization: z.string(),
        designation: z.string(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
        duration: z.string().optional(),
        responsibilities: z.string().optional(),
        experience_letter_url: z.string().optional(),
        remarks: z.string().optional(),
      })).optional(),
      certifications: z.array(z.object({
        certification_name: z.string(),
        issuing_organization: z.string(),
        issue_date: z.string().optional(),
        expiry_date: z.string().optional(),
        credential_number: z.string().optional(),
        attachment_url: z.string().optional(),
        remarks: z.string().optional(),
      })).optional(),
      documents: z.array(z.object({
        document_type: z.string(),
        document_name: z.string(),
        document_number: z.string().optional(),
        issue_date: z.string().optional(),
        expiry_date: z.string().optional(),
        file_url: z.string(),
        file_name: z.string().optional(),
        file_size: z.number().optional(),
        mime_type: z.string().optional(),
        remarks: z.string().optional(),
      })).optional(),
    }).superRefine((data, ctx) => {
      if (data.create_login_access) {
        const pwd = data.login_password || data.password;
        if (!pwd || pwd.length < 6) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Password must be at least 6 characters when login access is enabled',
            path: ['login_password'],
          });
        }
      }
    });
    const parsed = schema.parse(req.body);
    const created = await peopleService.createStaff(req.userContext!.school_id!, parsed, req.userContext!.user_id);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.put('/staff/:id', requirePermission('users.update'), async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await peopleService.updateStaff(
      req.userContext!.school_id!,
      req.params.id as string,
      req.body,
      req.userContext!.user_id
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ----------------------------------------------------------------------
// Specialized Operational Views: Parents / Guardians Master
// ----------------------------------------------------------------------
peopleRouter.get('/parents', requirePermission(['users.view', 'parents.view']), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.userContext!.school_id!;
    const filters = {
      search: req.query.search as string | undefined,
      locationId: req.query.location_id as string | undefined,
      status: req.query.status as string | undefined,
    };
    const parents = await peopleService.listParents(schoolId, filters);
    res.json({ success: true, data: parents });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.post('/parents', requirePermission(['users.create', 'parents.manage']), async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      username: z.string().min(3).max(100),
      email: z.string().email(),
      phone: z.string().optional(),
      first_name: z.string().min(1).max(100),
      middle_name: z.string().optional(),
      last_name: z.string().optional(),
      location_id: z.string().uuid().optional(),
      student_ids: z.array(z.string().uuid()).optional(),
      relationship_type: z.string().optional(),
      is_emergency_contact: z.boolean().optional(),
      create_login_access: z.boolean().optional(),
      login_password: z.string().min(6).optional(),
      login_status: z.enum(['ACTIVE', 'DISABLED']).optional(),
      category_ids: z.array(z.string().uuid()).optional(),
      subcategory_ids: z.array(z.string().uuid()).optional(),
      tag_ids: z.array(z.string().uuid()).optional(),
      label_ids: z.array(z.string().uuid()).optional(),
    });
    const parsed = schema.parse(req.body);
    const created = await peopleService.createParent(req.userContext!.school_id!, parsed, req.userContext!.user_id);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.put('/parents/:id', requirePermission(['users.update', 'parents.manage']), async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await peopleService.updateParent(
      req.userContext!.school_id!,
      req.params.id as string,
      req.body,
      req.userContext!.user_id
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.post('/parents/:id/students', requirePermission(['users.update', 'parents.manage']), async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      student_user_id: z.string().uuid(),
      relationship_type: z.string().default('GUARDIAN'),
      is_emergency_contact: z.boolean().default(true),
    });
    const parsed = schema.parse(req.body);
    const result = await peopleService.linkParentStudent(
      req.userContext!.school_id!,
      req.params.id as string,
      parsed.student_user_id,
      parsed.relationship_type,
      parsed.is_emergency_contact,
      req.userContext!.user_id
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.delete('/parents/:id/students/:studentId', requirePermission(['users.update', 'parents.manage']), async (req: Request, res: Response): Promise<void> => {
  try {
    const ok = await peopleService.unlinkParentStudent(
      req.userContext!.school_id!,
      req.params.id as string,
      req.params.studentId as string,
      req.userContext!.user_id
    );
    res.json({ success: true, data: { unlinked: ok } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.get('/students/:id/parents', requirePermission(['users.view', 'parents.view']), async (req: Request, res: Response): Promise<void> => {
  try {
    const parents = await peopleService.getParentsForStudent(req.params.id as string);
    res.json({ success: true, data: parents });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ----------------------------------------------------------------------
// User Detailed Profile & Taxonomy Sync
// ----------------------------------------------------------------------
peopleRouter.get('/users/:id/profile', requirePermission('users.view'), async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await peopleService.getUserDetailedProfile(
      req.userContext!.is_super_admin ? null : req.userContext!.school_id,
      req.params.id as string
    );
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { message: err.message } });
  }
});

peopleRouter.put('/users/:id/taxonomy', requirePermission('users.update'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      category_ids: z.array(z.string().uuid()).optional(),
      subcategory_ids: z.array(z.string().uuid()).optional(),
      tag_ids: z.array(z.string().uuid()).optional(),
      label_ids: z.array(z.string().uuid()).optional(),
    });
    const parsed = schema.parse(req.body);
    await peopleService.syncUserTaxonomy(
      req.userContext!.school_id!,
      req.params.id as string,
      {
        categoryIds: parsed.category_ids,
        subcategoryIds: parsed.subcategory_ids,
        tagIds: parsed.tag_ids,
        labelIds: parsed.label_ids,
      },
      req.userContext!.user_id
    );
    res.json({ success: true, message: 'Taxonomy synced successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});
