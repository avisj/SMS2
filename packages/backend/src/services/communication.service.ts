// ========================================================================
// Communication Service
// Business logic for School Communications, Audience Resolution,
// Safe Publishing, IN_APP Delivery, Read Tracking, and Templates
// ========================================================================

import {
  Communication,
  CommunicationRecipient,
  CommunicationTemplate,
  CommunicationDashboardStats,
  DeliveryReportSummary,
  AudienceType,
  AudienceFilters,
  CommunicationType,
  CommunicationPriority,
  DeliveryChannel,
} from '../types/index.js';
import {
  communicationRepository,
  CommunicationFilters,
  ResolvedRecipient,
} from '../repositories/communication.repository.js';
import { communicationGatewayManager } from './gateway/communication.provider.js';

export interface CreateCommunicationInput {
  id?: string;
  location_id?: string | null;
  academic_session_id?: string | null;
  communication_type: CommunicationType;
  title: string;
  message: string;
  priority?: CommunicationPriority;
  delivery_channel?: DeliveryChannel;
  audience_type: AudienceType;
  audience_filters?: AudienceFilters;
  requires_acknowledgement?: boolean;
  attachment_url?: string | null;
  attachment_name?: string | null;
  scheduled_at?: string | null;
}

export class CommunicationService {
  // ======================================================================
  // 1. Dashboard & Queries
  // ======================================================================

  async getDashboardStats(schoolId: string, locationId?: string): Promise<CommunicationDashboardStats> {
    return communicationRepository.getDashboardStats(schoolId, locationId);
  }

  async getCommunications(
    schoolId: string,
    filters?: CommunicationFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ data: Communication[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const limit = Math.max(1, Math.min(100, pageSize));
    const offset = (Math.max(1, page) - 1) * limit;

    const { data, total } = await communicationRepository.findCommunications(schoolId, filters, limit, offset);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      total,
      page,
      pageSize: limit,
      totalPages,
    };
  }

  async getCommunicationById(schoolId: string, id: string): Promise<Communication> {
    const comm = await communicationRepository.findCommunicationById(schoolId, id);
    if (!comm) {
      throw new Error('Communication not found.');
    }
    return comm;
  }

  // ======================================================================
  // 2. Audience Preview & Resolution
  // ======================================================================

  async previewAudience(
    schoolId: string,
    audienceType: AudienceType,
    filters?: AudienceFilters
  ): Promise<{ total: number; sample: ResolvedRecipient[]; audienceSummary: string }> {
    const recipients = await communicationRepository.resolveAudienceRecipients(schoolId, audienceType, filters);
    const sample = recipients.slice(0, 10);

    let audienceSummary = audienceType.replace('_', ' ');
    if (audienceType === 'CLASS' && filters?.class_id) {
      audienceSummary = `Class Students (${recipients.length} resolved)`;
    } else if (audienceType === 'PARENTS') {
      audienceSummary = `Parents / Guardians (${recipients.length} resolved)`;
    } else if (audienceType === 'TEACHERS') {
      audienceSummary = `Teaching Faculty (${recipients.length} resolved)`;
    }

    return {
      total: recipients.length,
      sample,
      audienceSummary,
    };
  }

  // ======================================================================
  // 3. Draft Management
  // ======================================================================

  async saveDraft(
    schoolId: string,
    userId: string,
    input: CreateCommunicationInput
  ): Promise<Communication> {
    if (!input.title || input.title.trim().length === 0) {
      throw new Error('Communication title is required.');
    }

    if (input.id) {
      const existing = await communicationRepository.findCommunicationById(schoolId, input.id);
      if (!existing) {
        throw new Error('Draft communication not found.');
      }
      if (existing.status !== 'DRAFT') {
        throw new Error('Only draft communications can be updated as draft.');
      }

      const updated = await communicationRepository.updateCommunication(schoolId, input.id, {
        title: input.title.trim(),
        message: input.message || '',
        communication_type: input.communication_type,
        priority: input.priority || 'NORMAL',
        delivery_channel: input.delivery_channel || 'IN_APP',
        audience_type: input.audience_type,
        audience_filters: input.audience_filters || {},
        requires_acknowledgement: input.requires_acknowledgement || false,
        attachment_url: input.attachment_url || null,
        attachment_name: input.attachment_name || null,
        location_id: input.location_id || null,
        academic_session_id: input.academic_session_id || null,
        updated_by: userId,
      });

      if (!updated) throw new Error('Failed to update draft communication.');
      return updated;
    }

    // Create brand new draft
    return communicationRepository.createCommunication({
      school_id: schoolId,
      location_id: input.location_id || null,
      academic_session_id: input.academic_session_id || null,
      communication_type: input.communication_type,
      title: input.title.trim(),
      message: input.message || '',
      priority: input.priority || 'NORMAL',
      status: 'DRAFT',
      delivery_channel: input.delivery_channel || 'IN_APP',
      audience_type: input.audience_type,
      audience_filters: input.audience_filters || {},
      requires_acknowledgement: input.requires_acknowledgement || false,
      attachment_url: input.attachment_url || null,
      attachment_name: input.attachment_name || null,
      scheduled_at: null,
      published_at: null,
      cancelled_at: null,
      created_by: userId,
      updated_by: userId,
      deleted_at: null,
    });
  }

  async deleteDraft(schoolId: string, id: string): Promise<boolean> {
    const success = await communicationRepository.deleteDraft(schoolId, id);
    if (!success) {
      throw new Error('Cannot delete this communication (only drafts can be deleted).');
    }
    return true;
  }

  // ======================================================================
  // 4. Publishing & Delivery
  // ======================================================================

  async publishCommunication(
    schoolId: string,
    userId: string,
    input: CreateCommunicationInput
  ): Promise<{ communication: Communication; recipientCount: number }> {
    if (!input.title || input.title.trim().length === 0) {
      throw new Error('Communication title is required.');
    }
    if (!input.message || input.message.trim().length === 0) {
      throw new Error('Message body is required.');
    }
    if (!input.audience_type) {
      throw new Error('Audience targeting is required.');
    }

    // 1. Resolve recipients
    const recipients = await communicationRepository.resolveAudienceRecipients(
      schoolId,
      input.audience_type,
      input.audience_filters
    );

    if (recipients.length === 0) {
      throw new Error('Communication could not be published because no recipients were found for the selected audience.');
    }

    // 2. Persist communication record
    let communicationRecord: Communication;
    const now = new Date().toISOString();

    if (input.id) {
      const existing = await communicationRepository.findCommunicationById(schoolId, input.id);
      if (!existing) throw new Error('Communication draft not found.');
      if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
        throw new Error('This communication has already been published and cannot be modified.');
      }

      const updated = await communicationRepository.updateCommunication(schoolId, input.id, {
        title: input.title.trim(),
        message: input.message.trim(),
        communication_type: input.communication_type,
        priority: input.priority || 'NORMAL',
        delivery_channel: input.delivery_channel || 'IN_APP',
        audience_type: input.audience_type,
        audience_filters: input.audience_filters || {},
        requires_acknowledgement: input.requires_acknowledgement || false,
        attachment_url: input.attachment_url || null,
        attachment_name: input.attachment_name || null,
        location_id: input.location_id || null,
        academic_session_id: input.academic_session_id || null,
        status: 'DELIVERED',
        published_at: now,
        updated_by: userId,
      });

      if (!updated) throw new Error('Failed to update and publish communication.');
      communicationRecord = updated;
    } else {
      communicationRecord = await communicationRepository.createCommunication({
        school_id: schoolId,
        location_id: input.location_id || null,
        academic_session_id: input.academic_session_id || null,
        communication_type: input.communication_type,
        title: input.title.trim(),
        message: input.message.trim(),
        priority: input.priority || 'NORMAL',
        status: 'DELIVERED',
        delivery_channel: input.delivery_channel || 'IN_APP',
        audience_type: input.audience_type,
        audience_filters: input.audience_filters || {},
        requires_acknowledgement: input.requires_acknowledgement || false,
        attachment_url: input.attachment_url || null,
        attachment_name: input.attachment_name || null,
        scheduled_at: null,
        published_at: now,
        cancelled_at: null,
        created_by: userId,
        updated_by: userId,
        deleted_at: null,
      });
    }

    // 3. Create transactional snapshot in communication_recipients (Deduplicated) with real gateway dispatch
    const channel = input.delivery_channel || ('IN_APP' as DeliveryChannel);
    let successCount = 0;
    let failureCount = 0;

    const recipientRecords = await Promise.all(
      recipients.map(async r => {
        let deliveryStatus: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' = 'DELIVERED';
        let failureReason: string | null = null;
        let deliveredAt: string | null = now;

        if (channel === 'SMS') {
          if (!r.phone) {
            deliveryStatus = 'FAILED';
            deliveredAt = null;
            failureReason = 'Recipient mobile number not registered';
            failureCount++;
          } else {
            const smsRes = await communicationGatewayManager.sendSms(schoolId, {
              to: r.phone,
              message: input.message,
            });
            if (smsRes.success) {
              deliveryStatus = 'SENT';
              successCount++;
            } else {
              deliveryStatus = 'FAILED';
              deliveredAt = null;
              failureReason = smsRes.error || 'SMS dispatch failure';
              failureCount++;
            }
          }
        } else if (channel === 'EMAIL') {
          if (!r.email) {
            deliveryStatus = 'FAILED';
            deliveredAt = null;
            failureReason = 'Recipient email address not registered';
            failureCount++;
          } else {
            const emailRes = await communicationGatewayManager.sendEmail(schoolId, {
              to: r.email,
              subject: input.title,
              body: input.message,
            });
            if (emailRes.success) {
              deliveryStatus = 'SENT';
              successCount++;
            } else {
              deliveryStatus = 'FAILED';
              deliveredAt = null;
              failureReason = emailRes.error || 'Email dispatch failure';
              failureCount++;
            }
          }
        } else {
          // IN_APP or others: instantly delivered
          successCount++;
        }

        return {
          communication_id: communicationRecord.id,
          school_id: schoolId,
          recipient_user_id: r.userId,
          recipient_type: r.userType,
          delivery_channel: channel,
          delivery_status: deliveryStatus,
          read_status: 'UNREAD' as const,
          acknowledgement_status: input.requires_acknowledgement ? ('PENDING' as const) : ('NOT_REQUIRED' as const),
          sent_at: now,
          delivered_at: deliveredAt,
          read_at: null,
          acknowledged_at: null,
          failure_reason: failureReason,
        };
      })
    );

    await communicationRepository.createRecipientsBatch(recipientRecords);

    // Update communication record status if not all delivered
    let overallStatus: 'DELIVERED' | 'SENT' | 'PARTIALLY_DELIVERED' | 'FAILED' = 'DELIVERED';
    if (channel === 'SMS' || channel === 'EMAIL') {
      if (successCount > 0 && failureCount === 0) {
        overallStatus = 'SENT';
      } else if (successCount > 0 && failureCount > 0) {
        overallStatus = 'PARTIALLY_DELIVERED';
      } else if (failureCount > 0 && successCount === 0) {
        overallStatus = 'FAILED';
      }
      await communicationRepository.updateCommunication(schoolId, communicationRecord.id, {
        status: overallStatus,
      });
    }

    // Re-fetch hydrated
    const finalComm = await communicationRepository.findCommunicationById(schoolId, communicationRecord.id);

    return {
      communication: finalComm || communicationRecord,
      recipientCount: recipients.length,
    };
  }

  // ======================================================================
  // 5. Scheduling & Cancellation
  // ======================================================================

  async scheduleCommunication(
    schoolId: string,
    userId: string,
    input: CreateCommunicationInput
  ): Promise<Communication> {
    if (!input.title || input.title.trim().length === 0) {
      throw new Error('Communication title is required.');
    }
    if (!input.message || input.message.trim().length === 0) {
      throw new Error('Message body is required.');
    }
    if (!input.scheduled_at) {
      throw new Error('A scheduled date and time is required for scheduled communication.');
    }

    const scheduledDate = new Date(input.scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('Invalid scheduled date/time format.');
    }

    if (input.id) {
      const existing = await communicationRepository.findCommunicationById(schoolId, input.id);
      if (!existing) throw new Error('Communication not found.');
      if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
        throw new Error('Only draft or scheduled communications can be scheduled.');
      }

      const updated = await communicationRepository.updateCommunication(schoolId, input.id, {
        title: input.title.trim(),
        message: input.message.trim(),
        communication_type: input.communication_type,
        priority: input.priority || 'NORMAL',
        delivery_channel: input.delivery_channel || 'IN_APP',
        audience_type: input.audience_type,
        audience_filters: input.audience_filters || {},
        requires_acknowledgement: input.requires_acknowledgement || false,
        attachment_url: input.attachment_url || null,
        attachment_name: input.attachment_name || null,
        scheduled_at: scheduledDate.toISOString(),
        status: 'SCHEDULED',
        updated_by: userId,
      });

      if (!updated) throw new Error('Failed to schedule communication.');
      return updated;
    }

    return communicationRepository.createCommunication({
      school_id: schoolId,
      location_id: input.location_id || null,
      academic_session_id: input.academic_session_id || null,
      communication_type: input.communication_type,
      title: input.title.trim(),
      message: input.message.trim(),
      priority: input.priority || 'NORMAL',
      status: 'SCHEDULED',
      delivery_channel: input.delivery_channel || 'IN_APP',
      audience_type: input.audience_type,
      audience_filters: input.audience_filters || {},
      requires_acknowledgement: input.requires_acknowledgement || false,
      attachment_url: input.attachment_url || null,
      attachment_name: input.attachment_name || null,
      scheduled_at: scheduledDate.toISOString(),
      published_at: null,
      cancelled_at: null,
      created_by: userId,
      updated_by: userId,
      deleted_at: null,
    });
  }

  async cancelCommunication(schoolId: string, userId: string, id: string): Promise<Communication> {
    const comm = await communicationRepository.findCommunicationById(schoolId, id);
    if (!comm) throw new Error('Communication not found.');
    if (comm.status !== 'SCHEDULED') {
      throw new Error('Only scheduled communications can be cancelled.');
    }

    const updated = await communicationRepository.updateCommunication(schoolId, id, {
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      updated_by: userId,
    });

    if (!updated) throw new Error('Failed to cancel communication.');
    return updated;
  }

  async duplicateCommunication(schoolId: string, userId: string, id: string): Promise<Communication> {
    const existing = await communicationRepository.findCommunicationById(schoolId, id);
    if (!existing) throw new Error('Source communication not found.');

    return communicationRepository.createCommunication({
      school_id: schoolId,
      location_id: existing.location_id,
      academic_session_id: existing.academic_session_id,
      communication_type: existing.communication_type,
      title: `Copy of ${existing.title}`,
      message: existing.message,
      priority: existing.priority,
      status: 'DRAFT',
      delivery_channel: existing.delivery_channel,
      audience_type: existing.audience_type,
      audience_filters: existing.audience_filters || {},
      requires_acknowledgement: existing.requires_acknowledgement,
      attachment_url: existing.attachment_url,
      attachment_name: existing.attachment_name,
      scheduled_at: null,
      published_at: null,
      cancelled_at: null,
      created_by: userId,
      updated_by: userId,
      deleted_at: null,
    });
  }

  // ======================================================================
  // 6. Delivery Reports & Recipient Interactions
  // ======================================================================

  async getDeliveryReport(schoolId: string, communicationId: string): Promise<DeliveryReportSummary> {
    const report = await communicationRepository.getDeliveryReport(schoolId, communicationId);
    if (!report) {
      throw new Error('Delivery report not found.');
    }
    return report;
  }

  async getUserInbox(
    schoolId: string,
    userId: string,
    filters?: { readStatus?: string; acknowledgementStatus?: string; page?: number; pageSize?: number }
  ): Promise<{ inbox: CommunicationRecipient[]; total: number; unreadCount: number }> {
    const limit = filters?.pageSize || 20;
    const offset = ((filters?.page || 1) - 1) * limit;

    return communicationRepository.findUserInbox(schoolId, userId, {
      readStatus: filters?.readStatus,
      acknowledgementStatus: filters?.acknowledgementStatus,
      limit,
      offset,
    });
  }

  async markRead(schoolId: string, recipientRecordId: string, userId: string): Promise<CommunicationRecipient> {
    const updated = await communicationRepository.markRecipientRead(schoolId, recipientRecordId, userId);
    if (!updated) {
      throw new Error('Failed to update read status.');
    }
    return updated;
  }

  async acknowledge(schoolId: string, recipientRecordId: string, userId: string): Promise<CommunicationRecipient> {
    const updated = await communicationRepository.markRecipientAcknowledged(schoolId, recipientRecordId, userId);
    if (!updated) {
      throw new Error('Failed to record acknowledgment.');
    }
    return updated;
  }

  // ======================================================================
  // 7. Templates
  // ======================================================================

  async getTemplates(
    schoolId: string,
    filters?: { communicationType?: string; status?: string; search?: string }
  ): Promise<CommunicationTemplate[]> {
    return communicationRepository.findTemplates(schoolId, filters);
  }

  async createTemplate(
    schoolId: string,
    userId: string,
    data: {
      template_name: string;
      communication_type: CommunicationType;
      subject: string;
      message_body: string;
      priority?: CommunicationPriority;
      requires_acknowledgement?: boolean;
    }
  ): Promise<CommunicationTemplate> {
    if (!data.template_name || data.template_name.trim().length === 0) {
      throw new Error('Template name is required.');
    }
    if (!data.subject || data.subject.trim().length === 0) {
      throw new Error('Template subject is required.');
    }
    if (!data.message_body || data.message_body.trim().length === 0) {
      throw new Error('Template message body is required.');
    }

    return communicationRepository.createTemplate({
      school_id: schoolId,
      template_name: data.template_name.trim(),
      communication_type: data.communication_type || 'NOTICE',
      subject: data.subject.trim(),
      message_body: data.message_body.trim(),
      priority: data.priority || 'NORMAL',
      requires_acknowledgement: data.requires_acknowledgement || false,
      status: 'ACTIVE',
      created_by: userId,
      updated_by: userId,
      deleted_at: null,
    });
  }

  async updateTemplate(
    schoolId: string,
    id: string,
    userId: string,
    updates: Partial<CommunicationTemplate>
  ): Promise<CommunicationTemplate> {
    const existing = await communicationRepository.findTemplateById(schoolId, id);
    if (!existing) throw new Error('Template not found.');

    const updated = await communicationRepository.updateTemplate(schoolId, id, {
      ...updates,
      updated_by: userId,
    });

    if (!updated) throw new Error('Failed to update template.');
    return updated;
  }

  async deleteTemplate(schoolId: string, id: string): Promise<boolean> {
    return communicationRepository.deleteTemplate(schoolId, id);
  }

  // ======================================================================
  // 9. Gateway Management & Verification
  // ======================================================================

  getGatewayStatus(schoolId: string) {
    return communicationGatewayManager.getGatewayStatus(schoolId);
  }

  configureGateway(schoolId: string, config: any) {
    communicationGatewayManager.setTenantConfig(schoolId, config);
    return communicationGatewayManager.getGatewayStatus(schoolId);
  }

  async testGateway(
    schoolId: string,
    payload: { channel: 'SMS' | 'EMAIL'; recipient: string; message?: string; subject?: string }
  ) {
    if (payload.channel === 'SMS') {
      return communicationGatewayManager.sendSms(schoolId, {
        to: payload.recipient,
        message: payload.message || 'Test SMS message from School Management SaaS',
      });
    } else {
      return communicationGatewayManager.sendEmail(schoolId, {
        to: payload.recipient,
        subject: payload.subject || 'Test Email from School Management SaaS',
        body: payload.message || 'This is a test notification verifying your email gateway configuration.',
      });
    }
  }
}

export const communicationService = new CommunicationService();
