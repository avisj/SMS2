// ========================================================================
// Communication Repository
// Multi-Tenant PostgREST (Supabase) + In-Memory Fallback Data Access Layer
// Complete Persistence for Communications, Recipients, Interactions & Templates
// ========================================================================

import crypto from 'crypto';
import {
  Communication,
  CommunicationRecipient,
  CommunicationTemplate,
  CommunicationDashboardStats,
  DeliveryReportSummary,
  AudienceType,
  AudienceFilters,
  User,
  Location,
  AcademicSession,
} from '../types/index.js';
import {
  getMemoryDbClient,
  getSupabaseClient,
  isSupabaseDatabaseActive,
} from '../db/client.js';
import { academicRepository } from './academic.repository.js';
import { locationRepository } from './location.repository.js';

export interface CommunicationFilters {
  academicSessionId?: string;
  locationId?: string;
  communicationType?: string;
  status?: string;
  audienceType?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface ResolvedRecipient {
  userId: string;
  name: string;
  userType: string;
  email?: string;
  phone?: string;
  details?: string;
}

export class CommunicationRepository {
  private mem = getMemoryDbClient();

  // ======================================================================
  // 1. Communications CRUD & Query
  // ======================================================================

  async findCommunications(
    schoolId: string,
    filters?: CommunicationFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Communication[]; total: number }> {
    let rawList: Communication[] = [];
    let totalCount = 0;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('communications')
          .select('*', { count: 'exact' })
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.academicSessionId) {
          q = q.eq('academic_session_id', filters.academicSessionId);
        }
        if (filters?.locationId) {
          q = q.eq('location_id', filters.locationId);
        }
        if (filters?.communicationType) {
          q = q.eq('communication_type', filters.communicationType);
        }
        if (filters?.status) {
          q = q.eq('status', filters.status);
        }
        if (filters?.audienceType) {
          q = q.eq('audience_type', filters.audienceType);
        }
        if (filters?.search) {
          q = q.or(`title.ilike.%${filters.search}%,message.ilike.%${filters.search}%`);
        }
        if (filters?.startDate) {
          q = q.gte('created_at', filters.startDate);
        }
        if (filters?.endDate) {
          q = q.lte('created_at', filters.endDate);
        }

        q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, error, count } = await q;
        if (!error && data) {
          rawList = data as Communication[];
          totalCount = count || data.length;
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase findCommunications error:', err);
      }
    }

    if (rawList.length === 0) {
      const allMem = this.mem.findAll('communications', (row: Communication) => {
        if (row.school_id !== schoolId) return false;
        if (row.deleted_at) return false;
        if (filters?.academicSessionId && row.academic_session_id !== filters.academicSessionId) return false;
        if (filters?.locationId && row.location_id !== filters.locationId) return false;
        if (filters?.communicationType && row.communication_type !== filters.communicationType) return false;
        if (filters?.status && row.status !== filters.status) return false;
        if (filters?.audienceType && row.audience_type !== filters.audienceType) return false;
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          const matchTitle = (row.title || '').toLowerCase().includes(s);
          const matchMsg = (row.message || '').toLowerCase().includes(s);
          if (!matchTitle && !matchMsg) return false;
        }
        if (filters?.startDate && new Date(row.created_at) < new Date(filters.startDate)) return false;
        if (filters?.endDate && new Date(row.created_at) > new Date(filters.endDate)) return false;
        return true;
      });

      totalCount = allMem.length;
      rawList = allMem
        .sort((a: Communication, b: Communication) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(offset, offset + limit);
    }

    // Hydrate counts and references
    const hydrated = await Promise.all(
      rawList.map(async (comm) => this.hydrateCommunication(schoolId, comm))
    );

    return { data: hydrated, total: totalCount };
  }

  async findCommunicationById(schoolId: string, id: string): Promise<Communication | null> {
    let comm: Communication | null = null;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('communications')
          .select('*')
          .eq('school_id', schoolId)
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();

        if (!error && data) {
          comm = data as Communication;
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase findCommunicationById error:', err);
      }
    }

    if (!comm) {
      comm = this.mem.findById('communications', id) as Communication | null;
      if (comm && (comm.school_id !== schoolId || comm.deleted_at)) {
        comm = null;
      }
    }

    if (!comm) return null;
    return this.hydrateCommunication(schoolId, comm);
  }

  async createCommunication(data: Omit<Communication, 'id' | 'created_at' | 'updated_at'>): Promise<Communication> {
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: Communication = {
      ...data,
      id: newId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: inserted, error } = await getSupabaseClient()!
          .from('communications')
          .insert({
            id: record.id,
            school_id: record.school_id,
            location_id: record.location_id || null,
            academic_session_id: record.academic_session_id || null,
            communication_type: record.communication_type,
            title: record.title,
            message: record.message,
            priority: record.priority,
            status: record.status,
            delivery_channel: record.delivery_channel,
            audience_type: record.audience_type,
            audience_filters: record.audience_filters || {},
            requires_acknowledgement: record.requires_acknowledgement || false,
            attachment_url: record.attachment_url || null,
            attachment_name: record.attachment_name || null,
            scheduled_at: record.scheduled_at || null,
            published_at: record.published_at || null,
            cancelled_at: record.cancelled_at || null,
            created_by: record.created_by || null,
            updated_by: record.updated_by || null,
            created_at: record.created_at,
            updated_at: record.updated_at,
          })
          .select()
          .single();

        if (!error && inserted) {
          this.mem.insert('communications', inserted);
          return this.hydrateCommunication(record.school_id, inserted as Communication);
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase createCommunication error:', err);
      }
    }

    this.mem.insert('communications', record);
    return this.hydrateCommunication(record.school_id, record);
  }

  async updateCommunication(
    schoolId: string,
    id: string,
    updates: Partial<Communication>
  ): Promise<Communication | null> {
    const now = new Date().toISOString();
    const updatePayload = { ...updates, updated_at: now };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: updated, error } = await getSupabaseClient()!
          .from('communications')
          .update(updatePayload)
          .eq('school_id', schoolId)
          .eq('id', id)
          .select()
          .single();

        if (!error && updated) {
          this.mem.update('communications', id, updated);
          return this.hydrateCommunication(schoolId, updated as Communication);
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase updateCommunication error:', err);
      }
    }

    const updatedMem = this.mem.update('communications', id, updatePayload) as Communication | null;
    if (!updatedMem) return null;
    return this.hydrateCommunication(schoolId, updatedMem);
  }

  async deleteDraft(schoolId: string, id: string): Promise<boolean> {
    const existing = await this.findCommunicationById(schoolId, id);
    if (!existing || existing.status !== 'DRAFT') {
      return false;
    }

    const now = new Date().toISOString();
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('communications')
          .update({ deleted_at: now, updated_at: now })
          .eq('school_id', schoolId)
          .eq('id', id);
      } catch (err) {
        console.error('[CommunicationRepository] Supabase deleteDraft error:', err);
      }
    }

    this.mem.update('communications', id, { deleted_at: now, updated_at: now });
    return true;
  }

  // ======================================================================
  // 2. Audience Resolution (Deduplicated, Multi-Tenant Safe)
  // ======================================================================

  async resolveAudienceRecipients(
    schoolId: string,
    audienceType: AudienceType,
    filters?: AudienceFilters
  ): Promise<ResolvedRecipient[]> {
    const recipientMap = new Map<string, ResolvedRecipient>();

    // Helper: Add user deduplicating by ID
    const addRecipient = (user: { id: string; name?: string; first_name?: string; last_name?: string; email?: string; phone?: string }, type: string, details?: string) => {
      if (!user || !user.id || recipientMap.has(user.id)) return;
      const fullName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
      recipientMap.set(user.id, {
        userId: user.id,
        name: fullName,
        userType: type,
        email: user.email,
        phone: user.phone,
        details,
      });
    };

    if (audienceType === 'SPECIFIC_USERS' && filters?.user_ids && filters.user_ids.length > 0) {
      const users = await this.fetchUsersByIds(schoolId, filters.user_ids);
      for (const u of users) {
        addRecipient(u, 'USER', 'Direct Recipient');
      }
      return Array.from(recipientMap.values());
    }

    if (audienceType === 'STUDENTS' || audienceType === 'CLASS' || audienceType === 'SECTION') {
      // Resolve active enrolled students
      const enrollments = await academicRepository.findEnrollments(schoolId, {
        sessionId: filters?.academic_session_id,
        locationId: filters?.location_id,
        classId: filters?.class_id,
        sectionId: filters?.section_id,
        status: 'ENROLLED',
      });

      for (const enr of enrollments) {
        if (enr.student) {
          const classInfo = enr.class?.name ? `Class: ${enr.class.name}` : '';
          const secInfo = enr.section?.name ? `Sec: ${enr.section.name}` : '';
          const detailStr = [classInfo, secInfo].filter(Boolean).join(' - ');
          addRecipient(enr.student, 'STUDENT', detailStr || 'Enrolled Student');
        }
      }
    } else if (audienceType === 'PARENTS') {
      // First resolve enrolled students
      const enrollments = await academicRepository.findEnrollments(schoolId, {
        sessionId: filters?.academic_session_id,
        locationId: filters?.location_id,
        classId: filters?.class_id,
        sectionId: filters?.section_id,
        status: 'ENROLLED',
      });

      const studentIds = enrollments.map(e => e.student_user_id).filter(Boolean);

      if (studentIds.length > 0) {
        // Find parents from parent_student_relationships
        const parentRelations = await this.fetchParentRelationships(schoolId, studentIds);
        for (const rel of parentRelations) {
          if (rel.parent) {
            addRecipient(rel.parent, 'PARENT', `Parent of ${rel.student_name || 'Student'}`);
          }
        }
      }
    } else if (audienceType === 'TEACHERS' || audienceType === 'STAFF') {
      // Query users with staff/teacher roles
      const staffUsers = await this.fetchStaffUsers(schoolId, filters?.location_id, audienceType === 'TEACHERS');
      for (const st of staffUsers) {
        addRecipient(st, audienceType === 'TEACHERS' ? 'TEACHER' : 'STAFF', st.designation || 'Staff Member');
      }
    } else if (audienceType === 'ENTIRE_SCHOOL' || audienceType === 'BRANCH') {
      // Query all users belonging to school / branch
      const allUsers = await this.fetchAllSchoolUsers(schoolId, filters?.location_id);
      for (const u of allUsers) {
        addRecipient(u, u.user_type_code || 'MEMBER', u.email || 'School Member');
      }
    }

    return Array.from(recipientMap.values());
  }

  // ======================================================================
  // 3. Recipient Delivery Records & Inbox
  // ======================================================================

  async createRecipientsBatch(recipients: Omit<CommunicationRecipient, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
    if (recipients.length === 0) return 0;
    const now = new Date().toISOString();

    const prepared = recipients.map(r => ({
      ...r,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    }));

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { error } = await getSupabaseClient()!
          .from('communication_recipients')
          .insert(prepared.map(p => ({
            id: p.id,
            communication_id: p.communication_id,
            school_id: p.school_id,
            recipient_user_id: p.recipient_user_id,
            recipient_type: p.recipient_type,
            delivery_channel: p.delivery_channel,
            delivery_status: p.delivery_status,
            read_status: p.read_status,
            acknowledgement_status: p.acknowledgement_status,
            sent_at: p.sent_at,
            delivered_at: p.delivered_at || now,
            read_at: p.read_at || null,
            acknowledged_at: p.acknowledged_at || null,
            failure_reason: p.failure_reason || null,
            created_at: p.created_at,
            updated_at: p.updated_at,
          })));

        if (!error) {
          for (const item of prepared) {
            this.mem.insert('communication_recipients', item);
          }
          return prepared.length;
        }
        console.error('[CommunicationRepository] createRecipientsBatch Supabase error:', error);
      } catch (err) {
        console.error('[CommunicationRepository] createRecipientsBatch exception:', err);
      }
    }

    // Fallback to in-memory
    for (const item of prepared) {
      this.mem.insert('communication_recipients', item);
    }
    return prepared.length;
  }

  async findRecipients(
    schoolId: string,
    communicationId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ recipients: CommunicationRecipient[]; total: number }> {
    let list: CommunicationRecipient[] = [];
    let total = 0;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error, count } = await getSupabaseClient()!
          .from('communication_recipients')
          .select('*', { count: 'exact' })
          .eq('school_id', schoolId)
          .eq('communication_id', communicationId)
          .order('created_at', { ascending: true })
          .range(offset, offset + limit - 1);

        if (!error && data) {
          list = data as CommunicationRecipient[];
          total = count || data.length;
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase findRecipients error:', err);
      }
    }

    if (list.length === 0) {
      const allMem = this.mem.findAll('communication_recipients', (r: CommunicationRecipient) => {
        return r.school_id === schoolId && r.communication_id === communicationId;
      });
      total = allMem.length;
      list = allMem.slice(offset, offset + limit);
    }

    // Hydrate recipient user
    const userIds = list.map(r => r.recipient_user_id);
    const usersMap = await this.fetchUsersMap(schoolId, userIds);

    const hydrated = list.map(r => ({
      ...r,
      recipient: usersMap.get(r.recipient_user_id),
    }));

    return { recipients: hydrated, total };
  }

  async findUserInbox(
    schoolId: string,
    userId: string,
    filters?: { readStatus?: string; acknowledgementStatus?: string; limit?: number; offset?: number }
  ): Promise<{ inbox: CommunicationRecipient[]; total: number; unreadCount: number }> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    let list: CommunicationRecipient[] = [];
    let total = 0;
    let unreadCount = 0;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('communication_recipients')
          .select('*', { count: 'exact' })
          .eq('school_id', schoolId)
          .eq('recipient_user_id', userId);

        if (filters?.readStatus) {
          q = q.eq('read_status', filters.readStatus);
        }
        if (filters?.acknowledgementStatus) {
          q = q.eq('acknowledgement_status', filters.acknowledgementStatus);
        }

        q = q.order('sent_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, error, count } = await q;
        if (!error && data) {
          list = data as CommunicationRecipient[];
          total = count || data.length;
        }

        // Count unread
        const { count: unread } = await getSupabaseClient()!
          .from('communication_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('recipient_user_id', userId)
          .eq('read_status', 'UNREAD');

        unreadCount = unread || 0;
      } catch (err) {
        console.error('[CommunicationRepository] Supabase findUserInbox error:', err);
      }
    }

    if (list.length === 0) {
      const allMem = this.mem.findAll('communication_recipients', (r: CommunicationRecipient) => {
        if (r.school_id !== schoolId || r.recipient_user_id !== userId) return false;
        if (filters?.readStatus && r.read_status !== filters.readStatus) return false;
        if (filters?.acknowledgementStatus && r.acknowledgement_status !== filters.acknowledgementStatus) return false;
        return true;
      });

      total = allMem.length;
      unreadCount = allMem.filter((r: CommunicationRecipient) => r.read_status === 'UNREAD').length;
      list = allMem
        .sort((a: CommunicationRecipient, b: CommunicationRecipient) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
        .slice(offset, offset + limit);
    }

    // Hydrate communication details
    const commIds = list.map(r => r.communication_id);
    const commMap = new Map<string, Communication>();
    for (const cId of commIds) {
      const comm = await this.findCommunicationById(schoolId, cId);
      if (comm) commMap.set(cId, comm);
    }

    const hydrated = list.map(r => ({
      ...r,
      communication: commMap.get(r.communication_id),
    }));

    return { inbox: hydrated, total, unreadCount };
  }

  async markRecipientRead(schoolId: string, recipientRecordId: string, userId: string): Promise<CommunicationRecipient | null> {
    const now = new Date().toISOString();

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('communication_recipients')
          .update({
            read_status: 'READ',
            read_at: now,
            updated_at: now,
          })
          .eq('school_id', schoolId)
          .eq('id', recipientRecordId)
          .eq('recipient_user_id', userId)
          .select()
          .single();

        if (!error && data) {
          this.mem.update('communication_recipients', recipientRecordId, data);
          return data as CommunicationRecipient;
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase markRecipientRead error:', err);
      }
    }

    const updated = this.mem.update('communication_recipients', recipientRecordId, {
      read_status: 'READ',
      read_at: now,
      updated_at: now,
    }) as CommunicationRecipient | null;

    return updated;
  }

  async markRecipientAcknowledged(schoolId: string, recipientRecordId: string, userId: string): Promise<CommunicationRecipient | null> {
    const now = new Date().toISOString();

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('communication_recipients')
          .update({
            acknowledgement_status: 'ACKNOWLEDGED',
            acknowledged_at: now,
            updated_at: now,
          })
          .eq('school_id', schoolId)
          .eq('id', recipientRecordId)
          .eq('recipient_user_id', userId)
          .select()
          .single();

        if (!error && data) {
          this.mem.update('communication_recipients', recipientRecordId, data);
          return data as CommunicationRecipient;
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase markRecipientAcknowledged error:', err);
      }
    }

    const updated = this.mem.update('communication_recipients', recipientRecordId, {
      acknowledgement_status: 'ACKNOWLEDGED',
      acknowledged_at: now,
      updated_at: now,
    }) as CommunicationRecipient | null;

    return updated;
  }

  // ======================================================================
  // 4. Delivery Reports & Stats
  // ======================================================================

  async getDashboardStats(schoolId: string, locationId?: string): Promise<CommunicationDashboardStats> {
    const defaultStats: CommunicationDashboardStats = {
      total_communications: 0,
      draft_count: 0,
      scheduled_count: 0,
      published_count: 0,
      failed_count: 0,
      total_recipients: 0,
      unread_count: 0,
      unacknowledged_count: 0,
      delivery_rate: 100,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('communications')
          .select('id, status, location_id')
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (locationId) {
          q = q.eq('location_id', locationId);
        }

        const { data: comms } = await q;

        if (comms) {
          defaultStats.total_communications = comms.length;
          defaultStats.draft_count = comms.filter(c => c.status === 'DRAFT').length;
          defaultStats.scheduled_count = comms.filter(c => c.status === 'SCHEDULED').length;
          defaultStats.published_count = comms.filter(c => c.status === 'DELIVERED' || c.status === 'SENT' || c.status === 'PARTIALLY_DELIVERED').length;
          defaultStats.failed_count = comms.filter(c => c.status === 'FAILED').length;
        }

        // Recipients stats
        const { data: recs } = await getSupabaseClient()!
          .from('communication_recipients')
          .select('id, delivery_status, read_status, acknowledgement_status')
          .eq('school_id', schoolId);

        if (recs) {
          defaultStats.total_recipients = recs.length;
          defaultStats.unread_count = recs.filter(r => r.read_status === 'UNREAD').length;
          defaultStats.unacknowledged_count = recs.filter(r => r.acknowledgement_status === 'PENDING').length;
          const delivered = recs.filter(r => r.delivery_status === 'DELIVERED').length;
          defaultStats.delivery_rate = recs.length > 0 ? Math.round((delivered / recs.length) * 100) : 100;
        }

        return defaultStats;
      } catch (err) {
        console.error('[CommunicationRepository] Supabase getDashboardStats error:', err);
      }
    }

    // Memory fallback
    const memComms = this.mem.findAll('communications', (c: Communication) => {
      if (c.school_id !== schoolId || c.deleted_at) return false;
      if (locationId && c.location_id !== locationId) return false;
      return true;
    });

    defaultStats.total_communications = memComms.length;
    defaultStats.draft_count = memComms.filter((c: Communication) => c.status === 'DRAFT').length;
    defaultStats.scheduled_count = memComms.filter((c: Communication) => c.status === 'SCHEDULED').length;
    defaultStats.published_count = memComms.filter((c: Communication) => c.status === 'DELIVERED' || c.status === 'SENT').length;
    defaultStats.failed_count = memComms.filter((c: Communication) => c.status === 'FAILED').length;

    const memRecs = this.mem.findAll('communication_recipients', (r: CommunicationRecipient) => r.school_id === schoolId);
    defaultStats.total_recipients = memRecs.length;
    defaultStats.unread_count = memRecs.filter((r: CommunicationRecipient) => r.read_status === 'UNREAD').length;
    defaultStats.unacknowledged_count = memRecs.filter((r: CommunicationRecipient) => r.acknowledgement_status === 'PENDING').length;
    const deliveredMem = memRecs.filter((r: CommunicationRecipient) => r.delivery_status === 'DELIVERED').length;
    defaultStats.delivery_rate = memRecs.length > 0 ? Math.round((deliveredMem / memRecs.length) * 100) : 100;

    return defaultStats;
  }

  async getDeliveryReport(schoolId: string, communicationId: string): Promise<DeliveryReportSummary | null> {
    const communication = await this.findCommunicationById(schoolId, communicationId);
    if (!communication) return null;

    const { recipients, total } = await this.findRecipients(schoolId, communicationId, 1000, 0);

    const deliveredCount = recipients.filter(r => r.delivery_status === 'DELIVERED').length;
    const pendingCount = recipients.filter(r => r.delivery_status === 'PENDING').length;
    const failedCount = recipients.filter(r => r.delivery_status === 'FAILED').length;
    const readCount = recipients.filter(r => r.read_status === 'READ').length;
    const acknowledgedCount = recipients.filter(r => r.acknowledgement_status === 'ACKNOWLEDGED').length;

    const readPercentage = total > 0 ? Math.round((readCount / total) * 100) : 0;
    const acknowledgedPercentage = total > 0 ? Math.round((acknowledgedCount / total) * 100) : 0;

    return {
      communication,
      total_recipients: total,
      delivered_count: deliveredCount,
      pending_count: pendingCount,
      failed_count: failedCount,
      read_count: readCount,
      acknowledged_count: acknowledgedCount,
      read_percentage: readPercentage,
      acknowledged_percentage: acknowledgedPercentage,
      recipients,
    };
  }

  // ======================================================================
  // 5. Communication Templates CRUD
  // ======================================================================

  async findTemplates(
    schoolId: string,
    filters?: { communicationType?: string; status?: string; search?: string }
  ): Promise<CommunicationTemplate[]> {
    let list: CommunicationTemplate[] = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('communication_templates')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters?.communicationType) {
          q = q.eq('communication_type', filters.communicationType);
        }
        if (filters?.status) {
          q = q.eq('status', filters.status);
        }
        if (filters?.search) {
          q = q.or(`template_name.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);
        }

        q = q.order('template_name', { ascending: true });

        const { data, error } = await q;
        if (!error && data) {
          list = data as CommunicationTemplate[];
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase findTemplates error:', err);
      }
    }

    if (list.length === 0) {
      list = this.mem.findAll('communication_templates', (t: CommunicationTemplate) => {
        if (t.school_id !== schoolId || t.deleted_at) return false;
        if (filters?.communicationType && t.communication_type !== filters.communicationType) return false;
        if (filters?.status && t.status !== filters.status) return false;
        if (filters?.search) {
          const s = filters.search.toLowerCase();
          const matchName = (t.template_name || '').toLowerCase().includes(s);
          const matchSubj = (t.subject || '').toLowerCase().includes(s);
          if (!matchName && !matchSubj) return false;
        }
        return true;
      });
    }

    return list;
  }

  async findTemplateById(schoolId: string, id: string): Promise<CommunicationTemplate | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('communication_templates')
          .select('*')
          .eq('school_id', schoolId)
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();

        if (!error && data) {
          return data as CommunicationTemplate;
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase findTemplateById error:', err);
      }
    }

    const item = this.mem.findById('communication_templates', id) as CommunicationTemplate | null;
    if (item && item.school_id === schoolId && !item.deleted_at) {
      return item;
    }
    return null;
  }

  async createTemplate(data: Omit<CommunicationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<CommunicationTemplate> {
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: CommunicationTemplate = {
      ...data,
      id: newId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: inserted, error } = await getSupabaseClient()!
          .from('communication_templates')
          .insert(record)
          .select()
          .single();

        if (!error && inserted) {
          this.mem.insert('communication_templates', inserted);
          return inserted as CommunicationTemplate;
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase createTemplate error:', err);
      }
    }

    this.mem.insert('communication_templates', record);
    return record;
  }

  async updateTemplate(
    schoolId: string,
    id: string,
    updates: Partial<CommunicationTemplate>
  ): Promise<CommunicationTemplate | null> {
    const now = new Date().toISOString();
    const payload = { ...updates, updated_at: now };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: updated, error } = await getSupabaseClient()!
          .from('communication_templates')
          .update(payload)
          .eq('school_id', schoolId)
          .eq('id', id)
          .select()
          .single();

        if (!error && updated) {
          this.mem.update('communication_templates', id, updated);
          return updated as CommunicationTemplate;
        }
      } catch (err) {
        console.error('[CommunicationRepository] Supabase updateTemplate error:', err);
      }
    }

    return this.mem.update('communication_templates', id, payload) as CommunicationTemplate | null;
  }

  async deleteTemplate(schoolId: string, id: string): Promise<boolean> {
    const now = new Date().toISOString();

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('communication_templates')
          .update({ deleted_at: now, updated_at: now })
          .eq('school_id', schoolId)
          .eq('id', id);
      } catch (err) {
        console.error('[CommunicationRepository] Supabase deleteTemplate error:', err);
      }
    }

    this.mem.update('communication_templates', id, { deleted_at: now, updated_at: now });
    return true;
  }

  // ======================================================================
  // 6. Internal Helpers
  // ======================================================================

  private async hydrateCommunication(schoolId: string, comm: Communication): Promise<Communication> {
    // Location
    let loc: Location | undefined = undefined;
    if (comm.location_id) {
      loc = (await locationRepository.findById(comm.location_id)) || undefined;
    }

    // Session
    let sess: AcademicSession | undefined = undefined;
    if (comm.academic_session_id) {
      sess = (await academicRepository.findSessionById(comm.academic_session_id)) || undefined;
    }

    // Creator
    let creatorUser: User | undefined = undefined;
    if (comm.created_by) {
      creatorUser = (await this.fetchUsersByIds(schoolId, [comm.created_by]))[0] || undefined;
    }

    // Recipient counts
    let recipientCount = 0;
    let deliveredCount = 0;
    let readCount = 0;
    let acknowledgedCount = 0;

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: recs } = await getSupabaseClient()!
          .from('communication_recipients')
          .select('id, delivery_status, read_status, acknowledgement_status')
          .eq('communication_id', comm.id);

        if (recs) {
          recipientCount = recs.length;
          deliveredCount = recs.filter(r => r.delivery_status === 'DELIVERED').length;
          readCount = recs.filter(r => r.read_status === 'READ').length;
          acknowledgedCount = recs.filter(r => r.acknowledgement_status === 'ACKNOWLEDGED').length;
        }
      } catch (err) {
        // quiet fallback
      }
    }

    if (recipientCount === 0) {
      const memRecs = this.mem.findAll('communication_recipients', (r: CommunicationRecipient) => r.communication_id === comm.id);
      recipientCount = memRecs.length;
      deliveredCount = memRecs.filter((r: CommunicationRecipient) => r.delivery_status === 'DELIVERED').length;
      readCount = memRecs.filter((r: CommunicationRecipient) => r.read_status === 'READ').length;
      acknowledgedCount = memRecs.filter((r: CommunicationRecipient) => r.acknowledgement_status === 'ACKNOWLEDGED').length;
    }

    return {
      ...comm,
      location: loc,
      session: sess,
      creator: creatorUser,
      recipient_count: recipientCount,
      delivered_count: deliveredCount,
      read_count: readCount,
      acknowledged_count: acknowledgedCount,
    };
  }

  private async fetchUsersByIds(schoolId: string, userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('users')
          .select('*')
          .eq('school_id', schoolId)
          .in('id', userIds)
          .is('deleted_at', null);

        if (!error && data) {
          return data as User[];
        }
      } catch (err) {
        console.error('[CommunicationRepository] fetchUsersByIds error:', err);
      }
    }

    return this.mem.findAll('users', (u: User) => {
      return u.school_id === schoolId && userIds.includes(u.id) && !u.deleted_at;
    });
  }

  private async fetchUsersMap(schoolId: string, userIds: string[]): Promise<Map<string, User>> {
    const users = await this.fetchUsersByIds(schoolId, userIds);
    const map = new Map<string, User>();
    for (const u of users) {
      map.set(u.id, u);
    }
    return map;
  }

  private async fetchParentRelationships(
    schoolId: string,
    studentIds: string[]
  ): Promise<Array<{ parent: User; student_name?: string }>> {
    const results: Array<{ parent: User; student_name?: string }> = [];

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('parent_student_relationships')
          .select(`
            parent_user_id,
            student_user_id,
            parent:users!parent_student_relationships_parent_user_id_fkey(*),
            student:users!parent_student_relationships_student_user_id_fkey(*)
          `)
          .eq('school_id', schoolId)
          .in('student_user_id', studentIds);

        if (!error && data) {
          for (const row of data as any[]) {
            if (row.parent) {
              const studentName = row.student
                ? `${row.student.first_name || ''} ${row.student.last_name || ''}`.trim()
                : undefined;
              results.push({ parent: row.parent, student_name: studentName });
            }
          }
          return results;
        }
      } catch (err) {
        console.error('[CommunicationRepository] fetchParentRelationships Supabase error:', err);
      }
    }

    // In-memory fallback
    const relations = this.mem.findAll('parent_student_relationships', (r: any) => {
      return r.school_id === schoolId && studentIds.includes(r.student_user_id);
    });

    for (const r of relations) {
      const parentUser = this.mem.findById('users', r.parent_user_id) as User | null;
      const studentUser = this.mem.findById('users', r.student_user_id) as User | null;
      if (parentUser && !parentUser.deleted_at) {
        const sName = studentUser ? `${studentUser.first_name || ''} ${studentUser.last_name || ''}`.trim() : undefined;
        results.push({ parent: parentUser, student_name: sName });
      }
    }

    return results;
  }

  private async fetchStaffUsers(schoolId: string, locationId?: string, onlyTeachers?: boolean): Promise<any[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('users')
          .select(`
            id,
            first_name,
            last_name,
            email,
            phone,
            user_type:user_types(code, name)
          `)
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        const { data, error } = await q;
        if (!error && data) {
          return (data as any[]).filter(u => {
            const code = (u.user_type?.code || '').toUpperCase();
            if (onlyTeachers) {
              return code === 'TEACHER' || code === 'FACULTY';
            }
            return ['STAFF', 'TEACHER', 'FACULTY', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT'].includes(code);
          });
        }
      } catch (err) {
        console.error('[CommunicationRepository] fetchStaffUsers error:', err);
      }
    }

    // In memory fallback
    return this.mem.findAll('users', (u: any) => {
      if (u.school_id !== schoolId || u.deleted_at) return false;
      const typeCode = (u.user_type_code || '').toUpperCase();
      if (onlyTeachers) {
        return typeCode === 'TEACHER' || typeCode === 'FACULTY';
      }
      return ['STAFF', 'TEACHER', 'FACULTY', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT'].includes(typeCode);
    });
  }

  private async fetchAllSchoolUsers(schoolId: string, locationId?: string): Promise<any[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('users')
          .select('id, first_name, last_name, email, phone')
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.error('[CommunicationRepository] fetchAllSchoolUsers error:', err);
      }
    }

    return this.mem.findAll('users', (u: User) => u.school_id === schoolId && !u.deleted_at);
  }
}

export const communicationRepository = new CommunicationRepository();
