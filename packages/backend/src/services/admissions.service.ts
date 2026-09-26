// ========================================================================
// Admissions & Enquiry CRM Service
// Lead capture, follow-ups, applications, and conversion to Universal Student
// ========================================================================

import crypto from 'crypto';
import { admissionsRepository } from '../repositories/admissions.repository.js';
import { peopleService } from './people.service.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { academicRepository } from '../repositories/academic.repository.js';
import {
  AdmissionSource,
  AdmissionEnquiry,
  AdmissionFollowup,
  AdmissionApplication,
  UserContext,
} from '../types/index.js';

export class AdmissionsService {
  // ======================================================================
  // 1. Lead Sources
  // ======================================================================
  async listSources(schoolId: string, userContext: UserContext): Promise<AdmissionSource[]> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant sources access');
    }
    return admissionsRepository.getSources(schoolId);
  }

  async createSource(schoolId: string, input: { name: string; code: string }, userContext: UserContext): Promise<AdmissionSource> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant source creation');
    }
    return admissionsRepository.createSource({
      school_id: schoolId,
      name: input.name,
      code: input.code,
    });
  }

  // ======================================================================
  // 2. Enquiries / CRM Leads
  // ======================================================================
  async listEnquiries(
    schoolId: string,
    filters: { status?: string; source_type?: string; sessionId?: string; search?: string },
    userContext: UserContext
  ): Promise<AdmissionEnquiry[]> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant enquiries access');
    }
    return admissionsRepository.getEnquiries(schoolId, filters);
  }

  async getEnquiry(schoolId: string, id: string, userContext: UserContext): Promise<AdmissionEnquiry | null> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant enquiry access');
    }
    return admissionsRepository.getEnquiryById(schoolId, id);
  }

  async createEnquiry(schoolId: string, input: Partial<AdmissionEnquiry>, userContext: UserContext): Promise<AdmissionEnquiry> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant enquiry creation');
    }

    if (!input.student_first_name?.trim()) throw new Error('Student first name is required');
    if (!input.parent_name?.trim()) throw new Error('Parent name is required');
    if (!input.primary_phone?.trim()) throw new Error('Primary contact phone is required');

    const created = await admissionsRepository.createEnquiry({
      ...input,
      school_id: schoolId,
    });

    await auditRepository.log({
      school_id: schoolId,
      user_id: userContext.user_id,
      action: 'CREATE_ENQUIRY',
      module: 'ADMISSIONS',
      entity_name: 'admission_enquiry',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async updateEnquiry(
    schoolId: string,
    id: string,
    updates: Partial<AdmissionEnquiry>,
    userContext: UserContext
  ): Promise<AdmissionEnquiry | null> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant enquiry update');
    }

    const updated = await admissionsRepository.updateEnquiry(schoolId, id, updates);

    await auditRepository.log({
      school_id: schoolId,
      user_id: userContext.user_id,
      action: 'UPDATE_ENQUIRY',
      module: 'ADMISSIONS',
      entity_name: 'admission_enquiry',
      record_id: id,
      new_values: updates,
    });

    return updated;
  }

  // ======================================================================
  // 3. Follow-ups
  // ======================================================================
  async listFollowups(schoolId: string, enquiryId: string, userContext: UserContext): Promise<AdmissionFollowup[]> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant followups access');
    }
    return admissionsRepository.getFollowups(schoolId, enquiryId);
  }

  async addFollowup(
    schoolId: string,
    enquiryId: string,
    input: {
      followup_date?: string;
      next_followup_date?: string;
      contacted_via?: 'PHONE' | 'EMAIL' | 'IN_PERSON' | 'SMS' | 'WHATSAPP';
      response_notes: string;
      status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
      updateEnquiryStatus?: string;
    },
    userContext: UserContext
  ): Promise<AdmissionFollowup> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant followup addition');
    }

    const followup = await admissionsRepository.createFollowup({
      school_id: schoolId,
      enquiry_id: enquiryId,
      followup_date: input.followup_date || new Date().toISOString().split('T')[0],
      next_followup_date: input.next_followup_date,
      contacted_via: input.contacted_via || 'PHONE',
      response_notes: input.response_notes,
      status: input.status || 'COMPLETED',
      handled_by: userContext.user_id,
    });

    if (input.updateEnquiryStatus) {
      await admissionsRepository.updateEnquiry(schoolId, enquiryId, {
        status: input.updateEnquiryStatus as any,
      });
    }

    return followup;
  }

  // ======================================================================
  // 4. Admission Applications
  // ======================================================================
  async listApplications(
    schoolId: string,
    filters: { status?: string; classId?: string; sessionId?: string; search?: string },
    userContext: UserContext
  ): Promise<AdmissionApplication[]> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant applications access');
    }
    return admissionsRepository.getApplications(schoolId, filters);
  }

  async getApplication(schoolId: string, id: string, userContext: UserContext): Promise<AdmissionApplication | null> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant application access');
    }
    return admissionsRepository.getApplicationById(schoolId, id);
  }

  async createApplication(
    schoolId: string,
    input: Partial<AdmissionApplication>,
    userContext: UserContext
  ): Promise<AdmissionApplication> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant application creation');
    }

    if (!input.student_first_name?.trim()) throw new Error('Student first name is required');
    if (!input.primary_contact_name?.trim()) throw new Error('Primary contact parent name is required');
    if (!input.primary_contact_phone?.trim()) throw new Error('Primary contact phone is required');
    if (!input.class_id) throw new Error('Class is required');
    if (!input.academic_session_id) throw new Error('Academic session is required');

    const created = await admissionsRepository.createApplication({
      ...input,
      school_id: schoolId,
    });

    if (created.enquiry_id) {
      await admissionsRepository.updateEnquiry(schoolId, created.enquiry_id, {
        status: 'APPLICATION_SUBMITTED',
      });
    }

    await auditRepository.log({
      school_id: schoolId,
      user_id: userContext.user_id,
      action: 'CREATE_APPLICATION',
      module: 'ADMISSIONS',
      entity_name: 'admission_application',
      record_id: created.id,
      new_values: created,
    });

    return created;
  }

  async updateApplication(
    schoolId: string,
    id: string,
    updates: Partial<AdmissionApplication>,
    userContext: UserContext
  ): Promise<AdmissionApplication | null> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant application update');
    }

    const updated = await admissionsRepository.updateApplication(schoolId, id, updates);

    await auditRepository.log({
      school_id: schoolId,
      user_id: userContext.user_id,
      action: 'UPDATE_APPLICATION',
      module: 'ADMISSIONS',
      entity_name: 'admission_application',
      record_id: id,
      new_values: updates,
    });

    return updated;
  }

  // ======================================================================
  // 5. Formal Conversion Pipeline: Application -> Universal Student
  // ======================================================================
  async convertApplicationToStudent(
    schoolId: string,
    applicationId: string,
    conversionData: {
      admission_number?: string;
      roll_number?: string;
      section_id?: string;
      create_login_access?: boolean;
      location_id?: string;
    },
    userContext: UserContext
  ) {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant conversion attempt');
    }

    const app = await admissionsRepository.getApplicationById(schoolId, applicationId);
    if (!app) throw new Error('Application not found');
    if (app.status === 'ADMITTED') throw new Error('Application has already been converted to an enrolled student');

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const admissionNo =
      conversionData.admission_number ||
      `ADM-${year}-${randomSuffix}`;

    const cleanFirst = app.student_first_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLast = (app.student_last_name || 'std').toLowerCase().replace(/[^a-z0-9]/g, '');
    const username = `${cleanFirst}.${cleanLast}.${randomSuffix}`;
    const email = app.primary_contact_email || `${username}@school.internal`;

    // Retrieve target class & section for display names
    const targetClass = await academicRepository.findClassById(app.class_id, schoolId);
    const targetSectionId = conversionData.section_id || app.section_id;
    let targetSection = null;
    if (targetSectionId) {
      targetSection = await academicRepository.findSectionById(targetSectionId, schoolId);
    }

    const targetLocationId =
      conversionData.location_id ||
      userContext.active_location_id ||
      '00000000-0000-0000-0000-000000000002';

    // Provision Universal User + Student Profile + Academic Enrollment
    const createdStudentUser = await peopleService.createStudent(
      schoolId,
      {
        admission_number: admissionNo,
        roll_number: conversionData.roll_number,
        username,
        email,
        phone: app.primary_contact_phone,
        first_name: app.student_first_name,
        middle_name: app.student_middle_name,
        last_name: app.student_last_name || '',
        academic_session_id: app.academic_session_id,
        class_id: app.class_id,
        class_name: targetClass?.name,
        section_id: targetSectionId || undefined,
        section_name: targetSection?.name,
        date_of_birth: app.date_of_birth,
        gender: (app.gender as any) || 'OTHER',
        blood_group: app.blood_group as any,
        nationality: app.nationality,
        religion: app.religion,
        category_name: app.category,
        create_login_access: !!conversionData.create_login_access,
        location_id: targetLocationId,
      },
      userContext.user_id
    );

    // Update application record
    const updatedApp = await admissionsRepository.updateApplication(schoolId, applicationId, {
      status: 'ADMITTED',
      converted_student_id: createdStudentUser.id,
      converted_at: new Date().toISOString(),
      section_id: targetSectionId || undefined,
    });

    // Update linked enquiry if present
    if (app.enquiry_id) {
      await admissionsRepository.updateEnquiry(schoolId, app.enquiry_id, {
        status: 'ADMITTED',
      });
    }

    await auditRepository.log({
      school_id: schoolId,
      user_id: userContext.user_id,
      action: 'CONVERT_APPLICATION_TO_STUDENT',
      module: 'ADMISSIONS',
      entity_name: 'admission_application',
      record_id: applicationId,
      new_values: {
        converted_student_id: createdStudentUser.id,
        admission_number: admissionNo,
      },
    });

    return {
      application: updatedApp,
      student: createdStudentUser,
      admission_number: admissionNo,
    };
  }

  // ======================================================================
  // 6. Analytics & Dashboard
  // ======================================================================
  async getDashboardMetrics(schoolId: string, sessionId: string | undefined, userContext: UserContext) {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized tenant metrics query');
    }
    return admissionsRepository.getPipelineMetrics(schoolId, sessionId);
  }

  // ======================================================================
  // 7. Public Website Enquiries (Lead Generation with IP rate limiting)
  // ======================================================================
  async createPublicEnquiry(
    schoolId: string,
    input: {
      student_first_name: string;
      student_last_name?: string;
      parent_name: string;
      primary_phone: string;
      email?: string;
      seeking_class_id?: string;
      notes?: string;
    }
  ): Promise<AdmissionEnquiry> {
    if (!schoolId) throw new Error('Target school ID required');
    if (!input.student_first_name?.trim()) throw new Error('Student name is required');
    if (!input.parent_name?.trim()) throw new Error('Parent name is required');
    if (!input.primary_phone?.trim()) throw new Error('Phone number is required');

    // Retrieve 'WEBSITE' source
    const sources = await admissionsRepository.getSources(schoolId);
    const webSource = sources.find(s => s.code === 'WEBSITE');

    return admissionsRepository.createEnquiry({
      school_id: schoolId,
      source_id: webSource?.id || null,
      source_type: 'WEBSITE',
      student_first_name: input.student_first_name.trim(),
      student_last_name: input.student_last_name?.trim(),
      parent_name: input.parent_name.trim(),
      primary_phone: input.primary_phone.trim(),
      email: input.email?.trim(),
      seeking_class_id: input.seeking_class_id || null,
      notes: input.notes?.trim(),
      status: 'NEW',
    });
  }
}

export const admissionsService = new AdmissionsService();
