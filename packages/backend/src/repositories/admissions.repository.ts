// ========================================================================
// Admissions Repository
// Multi-Tenant PostgREST (Supabase) + In-Memory Fallback Data Access Layer
// Complete Persistence for Lead Sources, Enquiries, Follow-ups, and Applications
// ========================================================================

import crypto from 'crypto';
import {
  AdmissionSource,
  AdmissionEnquiry,
  AdmissionFollowup,
  AdmissionApplication,
} from '../types/index.js';
import {
  getMemoryDbClient,
  getSupabaseClient,
  isSupabaseDatabaseActive,
} from '../db/client.js';

export class AdmissionsRepository {
  private mem = getMemoryDbClient();

  // ======================================================================
  // 1. Admission Lead Sources
  // ======================================================================
  async getSources(schoolId: string): Promise<AdmissionSource[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('admission_sources')
          .select('*')
          .eq('school_id', schoolId)
          .order('name');
        if (!error && data && data.length > 0) return data as AdmissionSource[];
      } catch (err) {
        console.warn('[AdmissionsRepository.getSources] Supabase fallback:', err);
      }
    }

    return this.mem.findAll('admission_sources', (r: AdmissionSource) => r.school_id === schoolId);
  }

  async createSource(source: Partial<AdmissionSource>): Promise<AdmissionSource> {
    const id = source.id || crypto.randomUUID();
    const record: AdmissionSource = {
      id,
      school_id: source.school_id!,
      name: source.name!,
      code: source.code!.toUpperCase(),
      is_active: source.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('admission_sources')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as AdmissionSource;
      } catch (err) {
        console.warn('[AdmissionsRepository.createSource] Supabase fallback:', err);
      }
    }

    return this.mem.insert('admission_sources', record) as AdmissionSource;
  }

  // ======================================================================
  // 2. Admission Enquiries
  // ======================================================================
  async getEnquiries(
    schoolId: string,
    filters?: {
      status?: string;
      source_type?: string;
      sessionId?: string;
      search?: string;
    }
  ): Promise<AdmissionEnquiry[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('admission_enquiries')
          .select('*, seeking_class:classes(id, name), source:admission_sources(id, name, code)')
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'ALL') query = query.eq('status', filters.status);
        if (filters?.source_type) query = query.eq('source_type', filters.source_type);
        if (filters?.sessionId) query = query.eq('academic_session_id', filters.sessionId);

        const { data, error } = await query;
        if (!error && data) {
          let list = data as AdmissionEnquiry[];
          if (filters?.search) {
            const q = filters.search.toLowerCase();
            list = list.filter(
              e =>
                e.enquiry_number.toLowerCase().includes(q) ||
                e.student_first_name.toLowerCase().includes(q) ||
                (e.student_last_name || '').toLowerCase().includes(q) ||
                e.parent_name.toLowerCase().includes(q) ||
                e.primary_phone.includes(q)
            );
          }
          return list;
        }
      } catch (err) {
        console.warn('[AdmissionsRepository.getEnquiries] Supabase fallback:', err);
      }
    }

    return this.mem.findAll('admission_enquiries', (e: AdmissionEnquiry) => {
      if (e.school_id !== schoolId || e.deleted_at) return false;
      if (filters?.status && filters.status !== 'ALL' && e.status !== filters.status) return false;
      if (filters?.source_type && e.source_type !== filters.source_type) return false;
      if (filters?.sessionId && e.academic_session_id !== filters.sessionId) return false;
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matches =
          e.enquiry_number.toLowerCase().includes(q) ||
          e.student_first_name.toLowerCase().includes(q) ||
          (e.student_last_name || '').toLowerCase().includes(q) ||
          e.parent_name.toLowerCase().includes(q) ||
          e.primary_phone.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }

  async getEnquiryById(schoolId: string, id: string): Promise<AdmissionEnquiry | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('admission_enquiries')
          .select('*, seeking_class:classes(id, name), source:admission_sources(id, name, code)')
          .eq('school_id', schoolId)
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();
        if (!error && data) return data as AdmissionEnquiry;
      } catch (err) {
        console.warn('[AdmissionsRepository.getEnquiryById] Supabase fallback:', err);
      }
    }

    const item = this.mem.findById('admission_enquiries', id) as AdmissionEnquiry | null;
    if (item && item.school_id === schoolId && !item.deleted_at) return item;
    return null;
  }

  async createEnquiry(enquiry: Partial<AdmissionEnquiry>): Promise<AdmissionEnquiry> {
    const id = enquiry.id || crypto.randomUUID();
    const year = new Date().getFullYear();
    const count = this.mem.findAll('admission_enquiries', () => true).length + 1;
    const enquiryNumber =
      enquiry.enquiry_number ||
      `ENQ-${year}-${String(count).padStart(4, '0')}`;

    const record: AdmissionEnquiry = {
      id,
      school_id: enquiry.school_id!,
      academic_session_id: enquiry.academic_session_id || null,
      enquiry_number: enquiryNumber,
      enquiry_date: enquiry.enquiry_date && enquiry.enquiry_date.trim() ? enquiry.enquiry_date : new Date().toISOString().split('T')[0],
      source_id: enquiry.source_id || null,
      source_type: enquiry.source_type || 'WALK_IN',
      student_first_name: enquiry.student_first_name!,
      student_last_name: enquiry.student_last_name,
      date_of_birth: enquiry.date_of_birth && enquiry.date_of_birth.trim() ? enquiry.date_of_birth : undefined,
      gender: enquiry.gender,
      seeking_class_id: enquiry.seeking_class_id || null,
      previous_school: enquiry.previous_school,
      parent_name: enquiry.parent_name!,
      parent_relation: enquiry.parent_relation || 'FATHER',
      primary_phone: enquiry.primary_phone!,
      alternate_phone: enquiry.alternate_phone,
      email: enquiry.email,
      address: enquiry.address,
      status: enquiry.status || 'NEW',
      notes: enquiry.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('admission_enquiries')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as AdmissionEnquiry;
      } catch (err) {
        console.warn('[AdmissionsRepository.createEnquiry] Supabase fallback:', err);
      }
    }

    return this.mem.insert('admission_enquiries', record) as AdmissionEnquiry;
  }

  async updateEnquiry(
    schoolId: string,
    id: string,
    updates: Partial<AdmissionEnquiry>
  ): Promise<AdmissionEnquiry | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('admission_enquiries')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('school_id', schoolId)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (!error && data) return data as AdmissionEnquiry;
      } catch (err) {
        console.warn('[AdmissionsRepository.updateEnquiry] Supabase fallback:', err);
      }
    }

    const current = await this.getEnquiryById(schoolId, id);
    if (!current) return null;
    return this.mem.update('admission_enquiries', id, { ...updates, updated_at: new Date().toISOString() }) as AdmissionEnquiry;
  }

  // ======================================================================
  // 3. Follow-ups
  // ======================================================================
  async getFollowups(schoolId: string, enquiryId: string): Promise<AdmissionFollowup[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('admission_followups')
          .select('*, handled_by_user:users(first_name, last_name)')
          .eq('school_id', schoolId)
          .eq('enquiry_id', enquiryId)
          .order('followup_date', { ascending: false });
        if (!error && data) return data as AdmissionFollowup[];
      } catch (err) {
        console.warn('[AdmissionsRepository.getFollowups] Supabase fallback:', err);
      }
    }

    return this.mem.findAll('admission_followups', (f: AdmissionFollowup) => f.school_id === schoolId && f.enquiry_id === enquiryId);
  }

  async createFollowup(followup: Partial<AdmissionFollowup>): Promise<AdmissionFollowup> {
    const id = followup.id || crypto.randomUUID();
    const record: AdmissionFollowup = {
      id,
      school_id: followup.school_id!,
      enquiry_id: followup.enquiry_id!,
      followup_date: followup.followup_date && followup.followup_date.trim() ? followup.followup_date : new Date().toISOString().split('T')[0],
      next_followup_date: followup.next_followup_date && followup.next_followup_date.trim() ? followup.next_followup_date : undefined,
      contacted_via: followup.contacted_via || 'PHONE',
      response_notes: followup.response_notes!,
      status: followup.status || 'COMPLETED',
      handled_by: followup.handled_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('admission_followups')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as AdmissionFollowup;
      } catch (err) {
        console.warn('[AdmissionsRepository.createFollowup] Supabase fallback:', err);
      }
    }

    return this.mem.insert('admission_followups', record) as AdmissionFollowup;
  }

  // ======================================================================
  // 4. Admission Applications
  // ======================================================================
  async getApplications(
    schoolId: string,
    filters?: {
      status?: string;
      classId?: string;
      sessionId?: string;
      search?: string;
    }
  ): Promise<AdmissionApplication[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('admission_applications')
          .select('*, class:classes(id, name), section:sections(id, name)')
          .eq('school_id', schoolId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'ALL') query = query.eq('status', filters.status);
        if (filters?.classId) query = query.eq('class_id', filters.classId);
        if (filters?.sessionId) query = query.eq('academic_session_id', filters.sessionId);

        const { data, error } = await query;
        if (!error && data) {
          let list = data as AdmissionApplication[];
          if (filters?.search) {
            const q = filters.search.toLowerCase();
            list = list.filter(
              a =>
                a.application_number.toLowerCase().includes(q) ||
                a.student_first_name.toLowerCase().includes(q) ||
                (a.student_last_name || '').toLowerCase().includes(q) ||
                a.primary_contact_name.toLowerCase().includes(q) ||
                a.primary_contact_phone.includes(q)
            );
          }
          return list;
        }
      } catch (err) {
        console.warn('[AdmissionsRepository.getApplications] Supabase fallback:', err);
      }
    }

    return this.mem.findAll('admission_applications', (a: AdmissionApplication) => {
      if (a.school_id !== schoolId || a.deleted_at) return false;
      if (filters?.status && filters.status !== 'ALL' && a.status !== filters.status) return false;
      if (filters?.classId && a.class_id !== filters.classId) return false;
      if (filters?.sessionId && a.academic_session_id !== filters.sessionId) return false;
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matches =
          a.application_number.toLowerCase().includes(q) ||
          a.student_first_name.toLowerCase().includes(q) ||
          (a.student_last_name || '').toLowerCase().includes(q) ||
          a.primary_contact_name.toLowerCase().includes(q) ||
          a.primary_contact_phone.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }

  async getApplicationById(schoolId: string, id: string): Promise<AdmissionApplication | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('admission_applications')
          .select('*, class:classes(id, name), section:sections(id, name)')
          .eq('school_id', schoolId)
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();
        if (!error && data) return data as AdmissionApplication;
      } catch (err) {
        console.warn('[AdmissionsRepository.getApplicationById] Supabase fallback:', err);
      }
    }

    const item = this.mem.findById('admission_applications', id) as AdmissionApplication | null;
    if (item && item.school_id === schoolId && !item.deleted_at) return item;
    return null;
  }

  async createApplication(app: Partial<AdmissionApplication>): Promise<AdmissionApplication> {
    const id = app.id || crypto.randomUUID();
    const year = new Date().getFullYear();
    const count = this.mem.findAll('admission_applications', () => true).length + 1;
    const appNumber =
      app.application_number ||
      `APP-${year}-${String(count).padStart(4, '0')}`;

    const record: AdmissionApplication = {
      id,
      school_id: app.school_id!,
      enquiry_id: app.enquiry_id || null,
      academic_session_id: app.academic_session_id!,
      application_number: appNumber,
      application_date: app.application_date && app.application_date.trim() ? app.application_date : new Date().toISOString().split('T')[0],
      class_id: app.class_id!,
      section_id: app.section_id || null,
      student_first_name: app.student_first_name!,
      student_middle_name: app.student_middle_name,
      student_last_name: app.student_last_name,
      date_of_birth: app.date_of_birth && app.date_of_birth.trim() ? app.date_of_birth : '2015-01-01',
      gender: app.gender || 'OTHER',
      blood_group: app.blood_group,
      nationality: app.nationality || 'Indian',
      religion: app.religion,
      category: app.category,
      primary_contact_name: app.primary_contact_name!,
      primary_contact_phone: app.primary_contact_phone!,
      primary_contact_email: app.primary_contact_email,
      primary_contact_relation: app.primary_contact_relation || 'FATHER',
      address: app.address,
      documents: app.documents || [],
      status: app.status || 'SUBMITTED',
      converted_student_id: null,
      converted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('admission_applications')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as AdmissionApplication;
      } catch (err) {
        console.warn('[AdmissionsRepository.createApplication] Supabase fallback:', err);
      }
    }

    return this.mem.insert('admission_applications', record) as AdmissionApplication;
  }

  async updateApplication(
    schoolId: string,
    id: string,
    updates: Partial<AdmissionApplication>
  ): Promise<AdmissionApplication | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('admission_applications')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('school_id', schoolId)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (!error && data) return data as AdmissionApplication;
      } catch (err) {
        console.warn('[AdmissionsRepository.updateApplication] Supabase fallback:', err);
      }
    }

    const current = await this.getApplicationById(schoolId, id);
    if (!current) return null;
    return this.mem.update('admission_applications', id, { ...updates, updated_at: new Date().toISOString() }) as AdmissionApplication;
  }

  // ======================================================================
  // 5. CRM Analytics Metrics
  // ======================================================================
  async getPipelineMetrics(schoolId: string, sessionId?: string) {
    const enquiries = await this.getEnquiries(schoolId, { sessionId });
    const applications = await this.getApplications(schoolId, { sessionId });

    const totalEnquiries = enquiries.length;
    const newEnquiries = enquiries.filter(e => e.status === 'NEW').length;
    const contacted = enquiries.filter(e => e.status === 'CONTACTED').length;
    const appointmentScheduled = enquiries.filter(e => e.status === 'APPOINTMENT_SCHEDULED').length;
    
    const totalApplications = applications.length;
    const approvedApplications = applications.filter(a => a.status === 'APPROVED').length;
    const admittedCount = applications.filter(a => a.status === 'ADMITTED').length;
    const conversionRate = totalEnquiries > 0 ? Math.round((admittedCount / totalEnquiries) * 100) : 0;

    return {
      total_enquiries: totalEnquiries,
      new_enquiries: newEnquiries,
      contacted,
      appointment_scheduled: appointmentScheduled,
      total_applications: totalApplications,
      approved_applications: approvedApplications,
      admitted_count: admittedCount,
      conversion_rate_percentage: conversionRate,
    };
  }
}

export const admissionsRepository = new AdmissionsRepository();
