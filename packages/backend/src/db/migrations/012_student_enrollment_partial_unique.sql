-- ========================================================================
-- 012_student_enrollment_partial_unique.sql
-- Relax unique constraint on student_academic_enrollments to partial unique index
-- This allows historical transfers (status 'TRANSFERRED') while strictly guaranteeing
-- at most one active ('ENROLLED') enrollment per student per academic session.
-- ========================================================================

-- Drop the restrictive static unique constraint if it exists
ALTER TABLE student_academic_enrollments 
    DROP CONSTRAINT IF EXISTS uq_student_academic_session;

-- Create partial unique index guaranteeing exactly ONE active enrollment per session
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_active_session 
    ON student_academic_enrollments (school_id, student_user_id, academic_session_id) 
    WHERE enrollment_status = 'ENROLLED' AND deleted_at IS NULL;
