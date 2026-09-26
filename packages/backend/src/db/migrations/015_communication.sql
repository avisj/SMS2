-- ========================================================================
-- 015_communication.sql
-- Communication Module Schema
-- Supports Communications, Recipient Delivery Snapshots, Read Tracking,
-- Acknowledgments, and Reusable Communication Templates
-- ========================================================================

-- 1. COMMUNICATIONS MASTER TABLE
CREATE TABLE IF NOT EXISTS communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    location_id UUID NULL REFERENCES locations(id) ON DELETE SET NULL, -- NULL = School-wide / All branches
    academic_session_id UUID NULL REFERENCES academic_sessions(id) ON DELETE SET NULL,
    communication_type VARCHAR(50) NOT NULL DEFAULT 'ANNOUNCEMENT', -- 'ANNOUNCEMENT', 'NOTICE', 'GENERAL_MESSAGE', 'ACADEMIC', 'FEE', 'ATTENDANCE', 'EXAM', 'EVENT', 'URGENT', 'OTHER'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL', -- 'NORMAL', 'HIGH', 'URGENT'
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SCHEDULED', 'SENT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', 'FAILED'
    delivery_channel VARCHAR(50) NOT NULL DEFAULT 'IN_APP', -- 'IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'
    audience_type VARCHAR(50) NOT NULL DEFAULT 'ENTIRE_SCHOOL', -- 'ENTIRE_SCHOOL', 'BRANCH', 'CLASS', 'SECTION', 'STUDENTS', 'PARENTS', 'TEACHERS', 'STAFF', 'SPECIFIC_USERS'
    audience_filters JSONB NULL DEFAULT '{}'::jsonb, -- e.g. {"class_id": "...", "section_id": "...", "user_ids": [...]}
    requires_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE,
    attachment_url TEXT NULL,
    attachment_name VARCHAR(255) NULL,
    scheduled_at TIMESTAMPTZ NULL,
    published_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_communications_school ON communications(school_id);
CREATE INDEX IF NOT EXISTS idx_communications_session ON communications(school_id, academic_session_id);
CREATE INDEX IF NOT EXISTS idx_communications_location ON communications(school_id, location_id);
CREATE INDEX IF NOT EXISTS idx_communications_status ON communications(school_id, status);
CREATE INDEX IF NOT EXISTS idx_communications_type ON communications(school_id, communication_type);
CREATE INDEX IF NOT EXISTS idx_communications_created ON communications(school_id, created_at DESC);

-- 2. COMMUNICATION RECIPIENTS TABLE (Delivery Snapshot & Interaction State)
CREATE TABLE IF NOT EXISTS communication_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(50) NOT NULL DEFAULT 'STUDENT', -- 'STUDENT', 'PARENT', 'TEACHER', 'STAFF', 'OTHER'
    delivery_channel VARCHAR(50) NOT NULL DEFAULT 'IN_APP',
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'DELIVERED', -- 'PENDING', 'SENT', 'DELIVERED', 'FAILED'
    read_status VARCHAR(30) NOT NULL DEFAULT 'UNREAD', -- 'UNREAD', 'READ'
    acknowledgement_status VARCHAR(30) NOT NULL DEFAULT 'NOT_REQUIRED', -- 'NOT_REQUIRED', 'PENDING', 'ACKNOWLEDGED'
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ NULL,
    acknowledged_at TIMESTAMPTZ NULL,
    failure_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comm_recipient UNIQUE(communication_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_recipients_comm ON communication_recipients(communication_id);
CREATE INDEX IF NOT EXISTS idx_comm_recipients_school ON communication_recipients(school_id);
CREATE INDEX IF NOT EXISTS idx_comm_recipients_user ON communication_recipients(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_comm_recipients_user_read ON communication_recipients(recipient_user_id, read_status);
CREATE INDEX IF NOT EXISTS idx_comm_recipients_status ON communication_recipients(communication_id, delivery_status);

-- 3. COMMUNICATION TEMPLATES MASTER
CREATE TABLE IF NOT EXISTS communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    template_name VARCHAR(150) NOT NULL,
    communication_type VARCHAR(50) NOT NULL DEFAULT 'NOTICE',
    subject VARCHAR(255) NOT NULL,
    message_body TEXT NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    requires_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE'
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_school_template_name UNIQUE(school_id, template_name)
);

CREATE INDEX IF NOT EXISTS idx_comm_templates_school ON communication_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_comm_templates_type ON communication_templates(school_id, communication_type);

-- 4. ENABLE ROW LEVEL SECURITY
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_communications_isolation ON communications FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_comm_recipients_isolation ON communication_recipients FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

CREATE POLICY p_comm_templates_isolation ON communication_templates FOR ALL
    USING (is_platform_super_admin() = TRUE OR school_id = current_school_id())
    WITH CHECK (is_platform_super_admin() = TRUE OR school_id = current_school_id());

-- 5. SEED INITIAL STANDARD TEMPLATES FOR DEFAULT SCHOOLS
INSERT INTO communication_templates (
    school_id, template_name, communication_type, subject, message_body, priority, requires_acknowledgement, status
)
SELECT 
    s.id,
    t.name,
    t.comm_type,
    t.subj,
    t.body,
    t.prio,
    t.ack,
    'ACTIVE'
FROM schools s
CROSS JOIN (
    VALUES
    (
        'Parent-Teacher Meeting (PTM)',
        'NOTICE',
        'Invitation to Upcoming Parent-Teacher Meeting (PTM)',
        'Dear Parents/Guardians,\n\nYou are cordially invited to attend the Parent-Teacher Meeting scheduled for upcoming Saturday. The session will provide an opportunity to discuss your ward''s academic progress, attendance, and overall development with class teachers and subject faculty.\n\nPlease ensure your presence during your designated time slot.\n\nWarm regards,\nSchool Administration',
        'HIGH',
        TRUE
    ),
    (
        'Fee Payment Due Reminder',
        'FEE',
        'Urgent: Term Fee Payment Due Notice',
        'Dear Parents/Guardians,\n\nThis is a gentle reminder that the school term fees for the current quarter are due. To avoid late fee penalties and ensure uninterrupted access to academic resources, kindly clear the outstanding balance at the earliest via the online fee payment portal or school fee counter.\n\nIf you have already paid, please ignore this notice.\n\nRegards,\nAccounts Department',
        'HIGH',
        FALSE
    ),
    (
        'Annual Examination Schedule Notice',
        'EXAM',
        'Announcement: Upcoming Term Examination Timetable',
        'Dear Students & Parents,\n\nThe official schedule for the upcoming Term Examinations has been finalized and published. Students are advised to review the subject-wise dates, exam timings, and room allocations carefully.\n\nPlease refer to the examination syllabus guidelines. Hall tickets will be issued shortly.\n\nBest of luck,\nExamination Committee',
        'HIGH',
        TRUE
    ),
    (
        'Official Holiday Notification',
        'ANNOUNCEMENT',
        'Notice: School Closure on Account of Public Holiday',
        'Dear Students, Parents, and Staff Members,\n\nPlease take note that the school will remain closed on the upcoming declared holiday. Regular academic and administrative operations will resume promptly on the next working day.\n\nHappy Holidays!\nPrincipal''s Office',
        'NORMAL',
        FALSE
    ),
    (
        'Daily Attendance & Absence Advisory',
        'ATTENDANCE',
        'Student Absence Alert & Regular Attendance Notice',
        'Dear Parents,\n\nRegular and punctual school attendance is vital for academic excellence. If your ward is absent today or requires leave for medical reasons, kindly submit an official leave application signed by the parent through the portal.\n\nThank you for your cooperation.\nAcademic Office',
        'NORMAL',
        FALSE
    )
) AS t(name, comm_type, subj, body, prio, ack)
ON CONFLICT (school_id, template_name) DO NOTHING;
