// ========================================================================
// Communication Module Integration & Unit Tests
// Verifies Drafts, Audience Resolution, Recipient Deduplication,
// Publishing, In-App Delivery, Read State, Acknowledgments, Templates,
// Delivery Reports, and Tenant Isolation
// ========================================================================

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { communicationService } from '../src/services/communication.service.js';
import { getMemoryDbClient } from '../src/db/client.js';

describe('Communication Module — Complete Functional Suite', () => {
  const schoolA = '00000000-0000-0000-0000-000000000001';
  const schoolB = '00000000-0000-0000-0000-000000000002';
  const authorA = '10000000-0000-0000-0000-000000000001';
  const locationA = '20000000-0000-0000-0000-000000000001';
  const sessionA = '40000000-0000-0000-0000-000000000001';

  let draftId: string;
  let publishedId: string;
  let scheduledId: string;
  let templateId: string;
  let testRecipientUserId: string;
  let testRecipientRecordId: string;

  before(async () => {
    const mem = getMemoryDbClient();

    // Create test student user and parent user in memory
    testRecipientUserId = '99990000-0000-0000-0000-000000000001';
    mem.insert('users', {
      id: testRecipientUserId,
      school_id: schoolA,
      username: 'teststudent_comm',
      email: 'student.comm@school.edu',
      first_name: 'Aarav',
      last_name: 'Sharma',
      status: 'ACTIVE',
      user_type_code: 'STUDENT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const parentUserId = '99990000-0000-0000-0000-000000000002';
    mem.insert('users', {
      id: parentUserId,
      school_id: schoolA,
      username: 'testparent_comm',
      email: 'parent.comm@example.com',
      first_name: 'Rajesh',
      last_name: 'Sharma',
      status: 'ACTIVE',
      user_type_code: 'PARENT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Link parent-student
    mem.insert('parent_student_relationships', {
      id: '88880000-0000-0000-0000-000000000001',
      school_id: schoolA,
      parent_user_id: parentUserId,
      student_user_id: testRecipientUserId,
      relationship_type: 'FATHER',
      is_emergency_contact: true,
      created_at: new Date().toISOString(),
    });

    // Create enrollment for student in Class 10 Section A
    mem.insert('student_academic_enrollments', {
      id: '77770000-0000-0000-0000-000000000001',
      school_id: schoolA,
      student_user_id: testRecipientUserId,
      academic_session_id: sessionA,
      location_id: locationA,
      class_id: 'class-10-id',
      section_id: 'section-a-id',
      enrollment_status: 'ENROLLED',
      created_at: new Date().toISOString(),
    });
  });

  it('1. Create & Save Draft Communication', async () => {
    const draft = await communicationService.saveDraft(schoolA, authorA, {
      title: 'Annual Sports Day Notice (Draft)',
      message: 'Drafting the sports day schedule and house events.',
      communication_type: 'NOTICE',
      priority: 'NORMAL',
      audience_type: 'ENTIRE_SCHOOL',
      location_id: locationA,
      academic_session_id: sessionA,
    });

    assert.ok(draft.id);
    assert.equal(draft.status, 'DRAFT');
    assert.equal(draft.title, 'Annual Sports Day Notice (Draft)');
    draftId = draft.id;
  });

  it('2. Update Draft Communication', async () => {
    const updated = await communicationService.saveDraft(schoolA, authorA, {
      id: draftId,
      title: 'Annual Sports Day 2026 Details (Draft Updated)',
      message: 'Updated draft instructions for house captains and participants.',
      communication_type: 'NOTICE',
      priority: 'HIGH',
      audience_type: 'ENTIRE_SCHOOL',
    });

    assert.equal(updated.id, draftId);
    assert.equal(updated.title, 'Annual Sports Day 2026 Details (Draft Updated)');
    assert.equal(updated.priority, 'HIGH');
    assert.equal(updated.status, 'DRAFT');
  });

  it('3. Audience Resolution & Deduplication (Parent Notice for Class 10)', async () => {
    const preview = await communicationService.previewAudience(schoolA, 'PARENTS', {
      academic_session_id: sessionA,
      location_id: locationA,
      class_id: 'class-10-id',
      section_id: 'section-a-id',
    });

    assert.ok(preview.total >= 1);
    assert.ok(preview.sample.some(s => s.userType === 'PARENT'));
  });

  it('4. Publish Communication with IN_APP Delivery and Recipient Snapshot', async () => {
    const result = await communicationService.publishCommunication(schoolA, authorA, {
      title: 'Parent-Teacher Meeting (Term 1)',
      message: 'Dear Parents, please join us this Saturday for the PTM in the main auditorium.',
      communication_type: 'NOTICE',
      priority: 'HIGH',
      audience_type: 'SPECIFIC_USERS',
      audience_filters: {
        user_ids: [testRecipientUserId],
      },
      requires_acknowledgement: true,
      delivery_channel: 'IN_APP',
    });

    assert.ok(result.communication.id);
    assert.equal(result.communication.status, 'DELIVERED');
    assert.equal(result.recipientCount, 1);
    assert.ok(result.communication.published_at);
    publishedId = result.communication.id;
  });

  it('5. Recipient Inbox: Verify IN_APP delivery and Unread state', async () => {
    const inboxResult = await communicationService.getUserInbox(schoolA, testRecipientUserId, {
      readStatus: 'UNREAD',
    });

    assert.ok(inboxResult.inbox.length >= 1);
    const item = inboxResult.inbox.find(i => i.communication_id === publishedId);
    assert.ok(item);
    assert.equal(item.read_status, 'UNREAD');
    assert.equal(item.acknowledgement_status, 'PENDING');
    assert.equal(item.delivery_status, 'DELIVERED');
    testRecipientRecordId = item.id;
  });

  it('6. Recipient Interaction: Mark Read and Verify Read Timestamp', async () => {
    const readItem = await communicationService.markRead(schoolA, testRecipientRecordId, testRecipientUserId);

    assert.equal(readItem.read_status, 'READ');
    assert.ok(readItem.read_at);

    // Verify inbox reflects read state
    const inboxAfter = await communicationService.getUserInbox(schoolA, testRecipientUserId);
    const updatedItem = inboxAfter.inbox.find(i => i.id === testRecipientRecordId);
    assert.equal(updatedItem?.read_status, 'READ');
  });

  it('7. Recipient Interaction: Acknowledge and Verify Timestamp', async () => {
    const ackItem = await communicationService.acknowledge(schoolA, testRecipientRecordId, testRecipientUserId);

    assert.equal(ackItem.acknowledgement_status, 'ACKNOWLEDGED');
    assert.ok(ackItem.acknowledged_at);
  });

  it('8. Delivery Report: Check Total, Delivered, Read, and Acknowledged Counts', async () => {
    const report = await communicationService.getDeliveryReport(schoolA, publishedId);

    assert.equal(report.total_recipients, 1);
    assert.equal(report.delivered_count, 1);
    assert.equal(report.read_count, 1);
    assert.equal(report.acknowledged_count, 1);
    assert.equal(report.read_percentage, 100);
    assert.equal(report.acknowledged_percentage, 100);
    assert.equal(report.recipients.length, 1);
  });

  it('9. Schedule Communication & Cancellation Workflow', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const scheduled = await communicationService.scheduleCommunication(schoolA, authorA, {
      title: 'Upcoming Fee Deadline Advisory',
      message: 'Reminder that term fees are due next week.',
      communication_type: 'FEE',
      priority: 'NORMAL',
      audience_type: 'ENTIRE_SCHOOL',
      scheduled_at: futureDate,
    });

    assert.equal(scheduled.status, 'SCHEDULED');
    assert.equal(scheduled.scheduled_at, futureDate);
    scheduledId = scheduled.id;

    // Cancel the scheduled communication
    const cancelled = await communicationService.cancelCommunication(schoolA, authorA, scheduledId);
    assert.equal(cancelled.status, 'CANCELLED');
    assert.ok(cancelled.cancelled_at);
  });

  it('10. Duplicate Communication as Draft', async () => {
    const duplicate = await communicationService.duplicateCommunication(schoolA, authorA, publishedId);

    assert.notEqual(duplicate.id, publishedId);
    assert.equal(duplicate.status, 'DRAFT');
    assert.ok(duplicate.title.startsWith('Copy of '));
    assert.equal(duplicate.message, 'Dear Parents, please join us this Saturday for the PTM in the main auditorium.');
    assert.equal(duplicate.recipient_count, 0); // Preserves clean recipient state
  });

  it('11. Communication Templates CRUD', async () => {
    // Create template
    const template = await communicationService.createTemplate(schoolA, authorA, {
      template_name: 'Unit Test Exam Timetable Template',
      communication_type: 'EXAM',
      subject: 'Unit Test Examination Timetable',
      message_body: 'Please review the subject-wise unit test examination schedule.',
      priority: 'HIGH',
      requires_acknowledgement: true,
    });

    assert.ok(template.id);
    assert.equal(template.template_name, 'Unit Test Exam Timetable Template');
    templateId = template.id;

    // List templates
    const list = await communicationService.getTemplates(schoolA);
    assert.ok(list.length >= 1);
    assert.ok(list.some(t => t.id === templateId));

    // Update template
    const updated = await communicationService.updateTemplate(schoolA, templateId, authorA, {
      priority: 'URGENT',
    });
    assert.equal(updated.priority, 'URGENT');

    // Delete template
    const deleted = await communicationService.deleteTemplate(schoolA, templateId);
    assert.equal(deleted, true);
  });

  it('12. Tenant Isolation Verification (School B cannot access School A data)', async () => {
    // Attempt to access School A communication using School B
    await assert.rejects(
      async () => {
        await communicationService.getCommunicationById(schoolB, publishedId);
      },
      {
        message: 'Communication not found.',
      }
    );

    // School B dashboard stats should not count School A records
    const statsB = await communicationService.getDashboardStats(schoolB);
    assert.equal(statsB.total_communications, 0);
  });
});
