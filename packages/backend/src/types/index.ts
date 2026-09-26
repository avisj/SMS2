// ========================================================================
// Domain Types & Interfaces
// Production-Oriented Multi-Tenant School Management System SaaS
// ========================================================================

export interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  data_type: 'STRING' | 'BOOLEAN' | 'NUMBER' | 'JSON';
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformFeature {
  id: string;
  feature_key: string;
  name: string;
  description?: string;
  category: string;
  is_enabled: boolean;
  plan_tier: string;
  created_at: string;
  updated_at: string;
}

export interface School {
  id: string;
  school_code: string;
  school_name: string;
  legal_name?: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country: string;
  timezone: string;
  currency: string;
  currency_symbol?: string;
  currency_position?: 'BEFORE' | 'AFTER';
  decimal_places?: number;
  date_format?: string;
  time_format?: string;
  locale?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Location {
  id: string;
  school_id: string;
  location_code: string;
  location_name: string;
  school_id_code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface UserType {
  id: string;
  school_id?: string | null;
  code: string;
  name: string;
  description?: string;
  numeric_id?: number | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserTypeMaster {
  id: number;
  type_code: string;
  type_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  auth_user_id?: string | null;
  school_id?: string | null;
  user_type_id: string;
  username: string;
  email: string;
  phone?: string;
  first_name: string;
  middle_name?: string;
  last_name?: string;
  profile_photo_url?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  password_hash?: string;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  
  // Expanded relation properties
  user_type?: UserType;
  school?: School;
  roles?: Role[];
  locations?: Location[];
  designation?: Designation;
  categories?: UserCategory[];
  subcategories?: UserSubcategory[];
  tags?: UserTag[];
  labels?: UserLabel[];
  student_profile?: StudentProfile;
  staff_profile?: StaffProfile;
  parents?: Array<{ user: User; parent?: User; relationship_type: string; is_emergency_contact: boolean }>;
  login_access?: UserLoginAccess;
  children?: Array<{ user: User; child?: User; relationship_type: string; is_emergency_contact?: boolean }>;
}

// ------------------------------------------------------------------------
// People & Taxonomy Masters
// ------------------------------------------------------------------------

export interface Designation {
  id: string;
  school_id: string;
  code: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface UserCategory {
  id: string;
  school_id: string;
  code: string;
  name: string;
  applicable_user_type?: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  subcategories?: UserSubcategory[];
}

export interface UserSubcategory {
  id: string;
  school_id: string;
  category_id: string;
  code: string;
  name: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  category_name?: string;
}

export interface UserTag {
  id: string;
  school_id: string;
  name: string;
  code: string;
  color: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserLabel {
  id: string;
  school_id: string;
  name: string;
  code: string;
  color: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  school_id: string;
  admission_number: string;
  admission_date?: string;
  roll_number?: string;
  academic_session?: string;
  class_name?: string;
  section_name?: string;
  house?: string;
  stream?: string;
  medium?: string;
  gender?: string;
  date_of_birth?: string;
  blood_group?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at: string;
  updated_at: string;
  current_enrollment?: StudentAcademicEnrollment;
  previous_academic_records?: StudentPreviousAcademicRecord[];
  achievements?: StudentAchievement[];
  documents?: UserDocument[];
}

export interface StaffProfile {
  id: string;
  user_id: string;
  school_id: string;
  employee_code: string;
  designation_id?: string | null;
  department?: string;
  employment_type?: string;
  joining_date?: string;
  qualification?: string;
  experience_years?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at: string;
  updated_at: string;
  designation?: Designation;
  qualifications?: StaffQualification[];
  experiences?: StaffProfessionalExperience[];
  certifications?: StaffCertification[];
  documents?: UserDocument[];
}

export interface ParentStudentRelationship {
  id: string;
  school_id: string;
  parent_user_id: string;
  student_user_id: string;
  relationship_type: 'FATHER' | 'MOTHER' | 'GUARDIAN' | string;
  is_emergency_contact: boolean;
  created_at: string;
  parent?: User;
  student?: User;
}

export interface DataScope {
  id: string;
  code: string; // ALL_SCHOOLS, ALL_LOCATIONS, SELECTED_LOCATIONS, ONE_LOCATION, ALL_CLASSES, SELECTED_CLASSES, ASSIGNED_CLASSES, OWN_RECORD, OWN_CHILDREN
  name: string;
  description?: string;
  hierarchy_level: number;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  code: string;
  name: string;
  description?: string;
  default_scope_id?: string;
  is_system: boolean;
  created_at: string;
}

export interface Role {
  id: string;
  school_id?: string | null;
  code: string;
  name: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  permissions?: (Permission & { scope: DataScope })[];
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  data_scope_id: string;
  school_id?: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  school_id?: string | null;
  assigned_at: string;
  assigned_by?: string;
}

export interface UserLocationAccess {
  id: string;
  user_id: string;
  location_id: string;
  school_id: string;
  is_primary: boolean;
  assigned_at: string;
  assigned_by?: string;
}

export interface SchoolFeature {
  id: string;
  school_id: string;
  feature_key: string;
  is_enabled: boolean;
  configuration: Record<string, any>;
  updated_at: string;
}

export interface SchoolSetting {
  id: string;
  school_id: string;
  setting_key: string;
  setting_value: string;
  category: string;
  data_type: 'STRING' | 'BOOLEAN' | 'NUMBER' | 'JSON';
  updated_at: string;
}

export interface AuditLog {
  id: string;
  school_id?: string | null;
  location_id?: string | null;
  user_id?: string | null;
  action: string;
  module: string;
  entity_name: string;
  record_id?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  username?: string;
}

// ------------------------------------------------------------------------
// Authenticated Session Context
// ------------------------------------------------------------------------

export interface EffectivePermission {
  code: string;
  module: string;
  action: string;
  scope_code: string;
  hierarchy_level: number;
}

export interface UserContext {
  user_id: string;
  school_id: string | null;
  school_id_code?: string;
  school_name?: string;
  school_code?: string;
  username: string;
  email: string;
  user_type_code: string;
  is_super_admin: boolean;
  is_school_super_admin?: boolean;
  roles: Array<{ id: string; code: string; name: string }>;
  permissions: EffectivePermission[];
  permitted_location_ids: string[];
  active_location_id?: string | null;
  currency?: string;
  currency_symbol?: string;
  currency_position?: 'BEFORE' | 'AFTER';
  decimal_places?: number;
  timezone?: string;
  date_format?: string;
  time_format?: string;
  locale?: string;
  brand_color?: string;
}

export interface UserCredential {
  id: string;
  user_id: string;
  school_id: string;
  location_id: string;
  school_id_code: string;
  username: string;
  password_hash: string;
  login_status: 'ACTIVE' | 'DISABLED';
  is_super_admin: boolean;
  failed_login_attempts: number;
  locked_until?: string | null;
  last_login_at?: string | null;
  password_changed_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserLoginAccess {
  user_id: string;
  username?: string;
  school_id_code?: string;
  location_name?: string;
  status: 'ENABLED' | 'DISABLED' | 'NOT_CREATED';
  has_login?: boolean;
  is_super_admin?: boolean;
  last_login_at?: string | null;
}

// ------------------------------------------------------------------------
// Academic Structure & Assignments Types
// ------------------------------------------------------------------------

export interface AcademicSession {
  id: string;
  school_id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';
  is_current: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ClassItem {
  id: string;
  school_id: string;
  name: string;
  code: string;
  display_name: string;
  numeric_order: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface SectionItem {
  id: string;
  school_id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface AcademicClassSection {
  id: string;
  school_id: string;
  academic_session_id: string;
  class_id: string;
  section_id: string;
  capacity?: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated properties
  class?: ClassItem;
  section?: SectionItem;
  session?: AcademicSession;
  section_name?: string;
}

export interface SubjectItem {
  id: string;
  school_id: string;
  name: string;
  code: string;
  short_name?: string | null;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export type Subject = SubjectItem;

export interface SubjectGroup {
  id: string;
  school_id: string;
  name: string;
  code: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated relation
  subjects?: SubjectItem[];
}

export interface SubjectGroupItem {
  id: string;
  school_id: string;
  subject_group_id: string;
  subject_id: string;
  created_at: string;
}

export interface AcademicClassSubject {
  id: string;
  school_id: string;
  academic_session_id: string;
  class_id: string;
  subject_group_id?: string | null;
  subject_id: string;
  is_required: boolean;
  subject_type: 'THEORY' | 'PRACTICAL' | 'BOTH';
  status: 'ACTIVE' | 'INACTIVE';
  credits?: number | null;
  max_marks?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated relation
  subject?: SubjectItem;
  subject_group?: SubjectGroup;
  class?: ClassItem;
  session?: AcademicSession;
}

// ------------------------------------------------------------------------
// Rights Master & Role-Right Relational Types
// ------------------------------------------------------------------------
export interface RightMaster {
  id: string;
  code: string;
  name: string;
  description?: string;
  module: string;
  action: string;
  default_scope_id?: string;
  is_system: boolean;
  created_at: string;
}

export interface RoleRight {
  id: string;
  role_id: string;
  right_id: string;
  data_scope_id: string;
  school_id?: string | null;
  created_at: string;
  right?: RightMaster;
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  created_at: string;
  role?: Role;
}

export interface AcademicSessionSetting {
  start_month: number; // 1-12
  end_month: number;   // 1-12
  calculated_session_code: string;
  calculated_session_name: string;
  start_date: string;
  end_date: string;
}

export interface StudentAcademicEnrollment {
  id: string;
  school_id: string;
  student_user_id: string;
  academic_session_id: string;
  location_id: string;
  class_id: string;
  section_id: string;
  academic_class_section_id?: string | null;
  admission_number: string;
  roll_number?: string | null;
  enrollment_status: 'ENROLLED' | 'PROMOTED' | 'DETAINED' | 'TRANSFERRED' | 'WITHDRAWN' | 'ALUMNI';
  start_date: string;
  end_date?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated fields
  student?: User;
  session?: AcademicSession;
  location?: Location;
  class?: ClassItem;
  section?: SectionItem;
}

export interface TeacherSubjectAssignment {
  id: string;
  school_id: string;
  teacher_user_id: string;
  academic_session_id: string;
  location_id: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  academic_class_section_id?: string | null;
  academic_class_subject_id?: string | null;
  is_primary_teacher: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  effective_date: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated fields
  teacher?: User;
  session?: AcademicSession;
  location?: Location;
  class?: ClassItem;
  section?: SectionItem;
  subject?: SubjectItem;
}

export interface TeacherResponsibility {
  assignment_id: string;
  session_id: string;
  session_name: string;
  location_id: string;
  location_name: string;
  class_id: string;
  class_name: string;
  section_id: string;
  section_name: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  is_primary_teacher: boolean;
  effective_date: string;
  status: string;
}

export interface StudentPreviousAcademicRecord {
  id: string;
  school_id: string;
  student_user_id: string;
  academic_year?: string;
  previous_school_name: string;
  class_name?: string;
  board?: string;
  result?: string;
  marks_grade?: string;
  remarks?: string;
  attachment_url?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentAchievement {
  id: string;
  school_id: string;
  student_user_id: string;
  achievement_date?: string;
  title: string;
  category?: string;
  level?: string;
  award_position?: string;
  description?: string;
  attachment_url?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffQualification {
  id: string;
  school_id: string;
  staff_user_id: string;
  education_level?: string;
  qualification_name: string;
  institution: string;
  board_university?: string;
  passing_year?: number;
  marks_grade?: string;
  specialization?: string;
  certificate_url?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffProfessionalExperience {
  id: string;
  school_id: string;
  staff_user_id: string;
  organization: string;
  designation: string;
  from_date?: string;
  to_date?: string;
  duration?: string;
  responsibilities?: string;
  experience_letter_url?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffCertification {
  id: string;
  school_id: string;
  staff_user_id: string;
  certification_name: string;
  issuing_organization: string;
  issue_date?: string;
  expiry_date?: string;
  credential_number?: string;
  attachment_url?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface UserDocument {
  id: string;
  school_id: string;
  user_id: string;
  document_type: string;
  document_name: string;
  document_number?: string;
  issue_date?: string;
  expiry_date?: string;
  file_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------
// Timetable Module Types
// ------------------------------------------------------------------------

export type TimetableStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface TimetableMaster {
  id: string;
  timetable_id: string;
  school_id: string;
  academic_session_id: string;
  location_id: string;
  version_no: number;
  working_days: string[];
  first_period_start_time: string;
  last_period_end_time: string;
  period_duration_minutes: number;
  lunch_start_time: string;
  lunch_end_time: string;
  status: TimetableStatus;
  effective_from?: string | null;
  effective_to?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  // Enriched
  session_name?: string;
  location_name?: string;
  created_by_name?: string;
}

export interface TimetableDetail {
  id: string;
  timetable_detail_id: string;
  timetable_master_id: string;
  timetable_id: string;
  school_id: string;
  academic_session_id: string;
  location_id: string;
  day_of_week: string;
  period_no: number;
  start_time: string;
  end_time: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  room_id?: string | null;
  is_free_period: boolean;
  is_lunch: boolean;
  remarks?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  // Enriched names for UI rendering
  class_name?: string;
  section_name?: string;
  subject_name?: string;
  subject_code?: string;
  teacher_name?: string;
}

export interface GeneratedPeriod {
  period_no: number;
  start_time: string;
  end_time: string;
  is_lunch: boolean;
  label: string;
}

export interface TimetableConfigInput {
  academic_session_id: string;
  location_id: string;
  working_days: string[];
  first_period_start_time: string;
  last_period_end_time: string;
  period_duration_minutes: number;
  lunch_start_time: string;
  lunch_end_time: string;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface TimetableCellAssignmentInput {
  day_of_week: string;
  period_no: number;
  class_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  room_id?: string | null;
  remarks?: string | null;
}

export interface TimetableCellRemoveInput {
  day_of_week: string;
  period_no: number;
  class_id: string;
  section_id: string;
}

// ------------------------------------------------------------------------
// Universal Attendance Module Interfaces
// ------------------------------------------------------------------------

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'LEAVE'
  | 'EXCUSED';

export type AttendanceType = 'STUDENT' | 'STAFF';

export interface AttendanceStatusMaster {
  id: string;
  school_id: string;
  status_code: AttendanceStatus | string;
  status_name: string;
  attendance_type: 'ALL' | 'STUDENT' | 'STAFF';
  counts_as_present: boolean;
  counts_as_absent: boolean;
  counts_as_leave: boolean;
  color_code?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface UserAttendance {
  id: string;
  attendance_id: string;
  school_id: string;
  user_id: string;
  attendance_date: string; // YYYY-MM-DD
  attendance_type: AttendanceType;
  academic_session_id?: string | null;
  location_id: string;

  // Student Context
  student_enrollment_id?: string | null;
  class_id?: string | null;
  section_id?: string | null;

  // Staff Context
  staff_assignment_id?: string | null;
  department?: string | null;

  // Status & Details
  status: AttendanceStatus | string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  late_minutes: number;
  early_departure_minutes: number;
  remarks?: string | null;

  // Audit & Metadata
  marked_by?: string | null;
  marked_at: string;
  updated_by?: string | null;
  source: string;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated relational fields for view presentations
  user_name?: string;
  admission_number?: string;
  roll_number?: string;
  class_name?: string;
  section_name?: string;
  employee_code?: string;
  designation_name?: string;
}

export interface AttendanceAuditLog {
  id: string;
  school_id: string;
  attendance_id: string;
  user_id: string;
  old_status?: string | null;
  new_status: string;
  old_check_in?: string | null;
  new_check_in?: string | null;
  old_check_out?: string | null;
  new_check_out?: string | null;
  changed_by?: string | null;
  changed_at: string;
  reason?: string | null;
  created_at: string;
}

export interface MarkStudentAttendanceItem {
  user_id: string;
  student_enrollment_id: string;
  status: AttendanceStatus | string;
  remarks?: string;
}

export interface MarkStudentAttendancePayload {
  academic_session_id: string;
  location_id: string;
  class_id: string;
  section_id: string;
  attendance_date: string; // YYYY-MM-DD
  records: MarkStudentAttendanceItem[];
}

export interface MarkStaffAttendanceItem {
  user_id: string;
  status: AttendanceStatus | string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  late_minutes?: number;
  early_departure_minutes?: number;
  remarks?: string;
}

export interface MarkStaffAttendancePayload {
  location_id: string;
  attendance_date: string; // YYYY-MM-DD
  department?: string;
  records: MarkStaffAttendanceItem[];
}

export interface EnrolledStudentAttendanceItem {
  user_id: string;
  student_enrollment_id: string;
  admission_number: string;
  roll_number: string;
  first_name: string;
  last_name?: string;
  display_name: string;
  gender?: string;
  status: AttendanceStatus | 'NOT_MARKED';
  attendance_id?: string;
  remarks?: string;
  is_locked?: boolean;
}

export interface StaffAttendanceItem {
  user_id: string;
  employee_code: string;
  first_name: string;
  last_name?: string;
  display_name: string;
  email?: string;
  department?: string;
  designation_name?: string;
  status: AttendanceStatus | 'NOT_MARKED';
  attendance_id?: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  late_minutes?: number;
  early_departure_minutes?: number;
  remarks?: string;
  is_locked?: boolean;
}

export interface AttendanceSummaryMetrics {
  total?: number;
  present?: number;
  absent?: number;
  late?: number;
  half_day?: number;
  leave?: number;
  excused?: number;
  not_marked?: number;
  total_enrolled?: number;
  total_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  half_day_count: number;
  leave_count: number;
  excused_count: number;
  not_marked_count: number;
  attendance_percentage: number;
}

export interface AvailableStudentForEnrollment {
  student_user_id: string;
  admission_number: string;
  first_name: string;
  last_name?: string;
  full_name: string;
  username: string;
  current_status: string;
  is_enrolled_other: boolean;
  current_enrollment_id?: string;
  current_class_name?: string;
  current_section_name?: string;
}

// ========================================================================
// Fees Management Module Types
// ========================================================================

export type FeeHeadCategory = 'ACADEMIC' | 'FACILITY' | 'OPTIONAL' | 'ONE_TIME' | 'TRANSPORT' | 'MISC';
export type FeeHeadStatus = 'ACTIVE' | 'INACTIVE';

export interface FeeHead {
  id: string;
  school_id: string;
  code: string;
  name: string;
  description?: string | null;
  category: FeeHeadCategory;
  is_taxable: boolean;
  tax_rate: number;
  display_order: number;
  status: FeeHeadStatus;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export type FeeFrequency = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

export interface FeeStructure {
  id: string;
  school_id: string;
  academic_session_id: string;
  location_id?: string | null;
  class_id: string;
  section_id?: string | null;
  fee_head_id: string;
  frequency: FeeFrequency;
  amount: number;
  due_day_of_month: number;
  notes?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated properties
  fee_head?: FeeHead;
  class?: ClassItem;
  section?: SectionItem;
  session?: AcademicSession;
  location?: Location;
}

export type FeeDemandStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'WAIVED' | 'CANCELLED';

export interface StudentFeeDemand {
  id: string;
  demand_number: string;
  school_id: string;
  student_user_id: string;
  student_enrollment_id?: string | null;
  academic_session_id: string;
  location_id: string;
  class_id: string;
  section_id: string;
  fee_structure_id?: string | null;
  fee_head_id: string;
  billing_period: string;
  issue_date: string;
  due_date: string;
  original_amount: number;
  discount_amount: number;
  waiver_amount: number;
  late_fee_amount: number;
  net_amount: number;
  paid_amount: number;
  outstanding_amount?: number; // helper net_amount - paid_amount
  status: FeeDemandStatus;
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated properties
  student?: User;
  admission_number?: string;
  roll_number?: string;
  fee_head?: FeeHead;
  fee_structure?: FeeStructure;
  class?: ClassItem;
  section?: SectionItem;
  session?: AcademicSession;
  location?: Location;
  adjustments?: FeeDemandAdjustment[];
}

export type AdjustmentType = 'DISCOUNT' | 'WAIVER' | 'LATE_FEE_OVERRIDE';

export interface FeeDemandAdjustment {
  id: string;
  school_id: string;
  student_fee_demand_id: string;
  student_user_id: string;
  adjustment_type: AdjustmentType;
  discount_name?: string | null;
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string | null;
  approved_at?: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE' | 'OTHER';
export type PaymentStatus = 'SUCCESS' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'REVERSED';

export interface FeePayment {
  id: string;
  payment_number: string;
  school_id: string;
  student_user_id: string;
  academic_session_id: string;
  location_id: string;
  payment_date: string;
  total_amount: number;
  refunded_amount: number;
  payment_mode: PaymentMode;
  transaction_reference?: string | null;
  remarks?: string | null;
  status: PaymentStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated properties
  student?: User;
  collector?: User;
  session?: AcademicSession;
  location?: Location;
  allocations?: FeePaymentAllocation[];
  receipt?: FeeReceipt;
}

export interface FeePaymentAllocation {
  id: string;
  school_id: string;
  payment_id: string;
  student_fee_demand_id: string;
  allocated_amount: number;
  created_at: string;

  // Hydrated
  demand?: StudentFeeDemand;
}

export interface FeeReceipt {
  id: string;
  receipt_number: string;
  school_id: string;
  payment_id: string;
  student_user_id: string;
  academic_session_id: string;
  location_id: string;
  receipt_date: string;
  total_amount: number;
  status: 'ACTIVE' | 'CANCELLED';
  created_by?: string | null;
  created_at: string;

  // Hydrated properties
  payment?: FeePayment;
  student?: User;
  collector?: User;
  session?: AcademicSession;
  location?: Location;
  school?: School;
  class_name?: string;
  section_name?: string;
  admission_number?: string;
  roll_number?: string;
}

export interface FeeRefund {
  id: string;
  refund_number: string;
  school_id: string;
  payment_id: string;
  student_user_id: string;
  refund_amount: number;
  refund_date: string;
  refund_mode: string;
  reason: string;
  reference_no?: string | null;
  approved_by?: string | null;
  approved_at?: string;
  status: 'COMPLETED';
  created_by?: string | null;
  created_at: string;

  // Hydrated
  payment?: FeePayment;
  student?: User;
  approver?: User;
}

export interface StudentFeeLedgerItem {
  id: string;
  date: string;
  type: 'DEMAND' | 'PAYMENT' | 'DISCOUNT' | 'WAIVER' | 'REFUND';
  reference_no: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface FeeDashboardMetrics {
  total_demand: number;
  total_collected: number;
  total_outstanding: number;
  total_overdue: number;
  today_collection: number;
  month_collection: number;
  students_with_dues_count: number;
  students_fully_paid_count: number;
  students_partially_paid_count: number;
  students_overdue_count: number;
}

// ------------------------------------------------------------------------
// Exams & Results Module Types
// ------------------------------------------------------------------------

export interface ExamMaster {
  id: string;
  school_id: string;
  academic_session_id: string;
  exam_name: string;
  exam_code: string;
  exam_type: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  status: 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'RESULTS_READY' | 'PUBLISHED' | 'CANCELLED';
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  session?: AcademicSession;
}

export interface ExamStructureSubject {
  id: string;
  school_id: string;
  exam_structure_id: string;
  subject_id: string;
  maximum_marks: number;
  passing_marks: number;
  grade_applicable: boolean;
  weightage: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  subject?: Subject;
}

export interface ExamStructure {
  id: string;
  school_id: string;
  exam_id: string;
  academic_session_id: string;
  location_id?: string | null;
  class_id: string;
  section_id?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  exam?: ExamMaster;
  session?: AcademicSession;
  location?: Location;
  class?: ClassItem;
  section?: SectionItem;
  subjects?: ExamStructureSubject[];
}

export interface ExamSchedule {
  id: string;
  school_id: string;
  exam_id: string;
  academic_session_id: string;
  location_id: string;
  class_id: string;
  section_id?: string | null;
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue?: string | null;
  maximum_marks: number;
  instructions?: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  exam?: ExamMaster;
  session?: AcademicSession;
  location?: Location;
  class?: ClassItem;
  section?: SectionItem;
  subject?: Subject;
}

export interface GradeRule {
  id: string;
  school_id: string;
  grade_name: string;
  min_percentage: number;
  max_percentage: number;
  grade_point?: number | null;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface ExamMark {
  id: string;
  school_id: string;
  exam_id: string;
  academic_session_id: string;
  location_id: string;
  class_id: string;
  section_id: string;
  student_user_id: string;
  subject_id: string;
  maximum_marks: number;
  passing_marks: number;
  obtained_marks?: number | null;
  attendance_status: 'PRESENT' | 'ABSENT' | 'EXEMPT';
  remarks?: string | null;
  status: 'ENTERED' | 'VERIFIED' | 'PUBLISHED';
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  student?: User;
  subject?: Subject;
  class?: ClassItem;
  section?: SectionItem;
}

export interface ExamResultDetail {
  id: string;
  school_id: string;
  exam_result_id: string;
  subject_id: string;
  subject_name: string;
  maximum_marks: number;
  passing_marks: number;
  obtained_marks?: number | null;
  attendance_status: 'PRESENT' | 'ABSENT' | 'EXEMPT';
  grade: string;
  is_pass: boolean;
  created_at: string;
}

export interface ExamResult {
  id: string;
  school_id: string;
  exam_id: string;
  academic_session_id: string;
  location_id: string;
  class_id: string;
  section_id: string;
  student_user_id: string;
  total_obtained_marks: number;
  total_maximum_marks: number;
  percentage: number;
  grade: string;
  result_status: 'PASS' | 'FAIL' | 'ABSENT' | 'WITHHELD';
  status: 'DRAFT' | 'PUBLISHED';
  published_at?: string | null;
  published_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  student?: User;
  exam?: ExamMaster;
  session?: AcademicSession;
  location?: Location;
  class?: ClassItem;
  section?: SectionItem;
  details?: ExamResultDetail[];
  admission_number?: string;
  roll_number?: string;
}

export interface ExamDashboardStats {
  total_exams: number;
  draft_exams?: number;
  scheduled_exams: number;
  ongoing_exams: number;
  completed_exams: number;
  results_ready_exams?: number;
  published_exams?: number;
  students_pending_marks: number;
  results_published: number;
  average_percentage: number;
}

// ========================================================================
// Communication Module Types
// ========================================================================

export type CommunicationType =
  | 'ANNOUNCEMENT'
  | 'NOTICE'
  | 'GENERAL_MESSAGE'
  | 'ACADEMIC'
  | 'FEE'
  | 'ATTENDANCE'
  | 'EXAM'
  | 'EVENT'
  | 'URGENT'
  | 'OTHER';

export type CommunicationPriority = 'NORMAL' | 'HIGH' | 'URGENT';

export type CommunicationStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'SENT'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export type DeliveryChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';

export type AudienceType =
  | 'ENTIRE_SCHOOL'
  | 'BRANCH'
  | 'CLASS'
  | 'SECTION'
  | 'STUDENTS'
  | 'PARENTS'
  | 'TEACHERS'
  | 'STAFF'
  | 'SPECIFIC_USERS';

export type RecipientDeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';

export type RecipientReadStatus = 'UNREAD' | 'READ';

export type RecipientAcknowledgementStatus = 'NOT_REQUIRED' | 'PENDING' | 'ACKNOWLEDGED';

export interface AudienceFilters {
  location_id?: string;
  academic_session_id?: string;
  class_id?: string;
  section_id?: string;
  user_ids?: string[];
  [key: string]: any;
}

export interface Communication {
  id: string;
  school_id: string;
  location_id?: string | null;
  academic_session_id?: string | null;
  communication_type: CommunicationType;
  title: string;
  message: string;
  priority: CommunicationPriority;
  status: CommunicationStatus;
  delivery_channel: DeliveryChannel;
  audience_type: AudienceType;
  audience_filters?: AudienceFilters;
  requires_acknowledgement: boolean;
  attachment_url?: string | null;
  attachment_name?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  cancelled_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  location?: Location;
  session?: AcademicSession;
  creator?: User;
  recipient_count?: number;
  delivered_count?: number;
  read_count?: number;
  acknowledged_count?: number;
}

export interface CommunicationRecipient {
  id: string;
  communication_id: string;
  school_id: string;
  recipient_user_id: string;
  recipient_type: string;
  delivery_channel: DeliveryChannel;
  delivery_status: RecipientDeliveryStatus;
  read_status: RecipientReadStatus;
  acknowledgement_status: RecipientAcknowledgementStatus;
  sent_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
  acknowledged_at?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;

  // Hydrated
  recipient?: User;
  communication?: Communication;
}

export interface CommunicationTemplate {
  id: string;
  school_id: string;
  template_name: string;
  communication_type: CommunicationType;
  subject: string;
  message_body: string;
  priority: CommunicationPriority;
  requires_acknowledgement: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CommunicationDashboardStats {
  total_communications: number;
  draft_count: number;
  scheduled_count: number;
  published_count: number;
  failed_count: number;
  total_recipients: number;
  unread_count: number;
  unacknowledged_count: number;
  delivery_rate: number;
}

export interface DeliveryReportSummary {
  communication: Communication;
  total_recipients: number;
  delivered_count: number;
  pending_count: number;
  failed_count: number;
  read_count: number;
  acknowledged_count: number;
  read_percentage: number;
  acknowledged_percentage: number;
  recipients: CommunicationRecipient[];
}

// ========================================================================
// Transport Management Types
// ========================================================================

export type VehicleType = 'SCHOOL_BUS' | 'VAN' | 'MINI_BUS' | 'OTHER';
export type VehicleStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'RETIRED';
export type TransportRouteType = 'PICKUP' | 'DROP' | 'BOTH';
export type TransportRouteStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type TransportAssignmentStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'COMPLETED';
export type TripType = 'PICKUP' | 'DROP' | 'OTHER';
export type TripStatus = 'SCHEDULED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
export type MaintenanceStatus = 'OK' | 'DUE_SOON' | 'DUE' | 'OVERDUE';
export type GpsDeviceStatus = 'ONLINE' | 'OFFLINE' | 'NOT_CONFIGURED';

export interface Vehicle {
  id: string;
  school_id: string;
  location_id?: string | null;
  vehicle_number: string;
  registration_number: string;
  vehicle_type: VehicleType;
  make?: string | null;
  model?: string | null;
  capacity: number;
  fuel_type?: string | null;
  purchase_date?: string | null;
  insurance_expiry?: string | null;
  fitness_expiry?: string | null;
  permit_expiry?: string | null;
  puc_expiry?: string | null;
  gps_device_id?: string | null;
  status: VehicleStatus;
  last_service_date?: string | null;
  next_service_due?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  location?: Location;
  current_driver?: User;
  current_driver_assignment?: VehicleDriverAssignment;
  current_route?: TransportRoute;
  assigned_student_count?: number;
  available_seats?: number;
  utilization_percentage?: number;
  maintenance_status?: MaintenanceStatus;
}

export interface VehicleDriverAssignment {
  id: string;
  school_id: string;
  vehicle_id: string;
  driver_user_id: string;
  license_number?: string | null;
  license_expiry?: string | null;
  start_date: string;
  end_date?: string | null;
  is_primary: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  driver?: User;
  vehicle?: Vehicle;
}

export interface TransportDriverProfile {
  id: string;
  school_id: string;
  user_id: string;
  driver_eligible: boolean;
  license_number?: string | null;
  license_type: string;
  license_expiry?: string | null;
  contact_phone?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  user?: User;
}

export interface TransportRoute {
  id: string;
  school_id: string;
  location_id?: string | null;
  route_name: string;
  route_code: string;
  route_type: TransportRouteType;
  start_point: string;
  end_point: string;
  estimated_duration_mins?: number | null;
  distance_km?: number | null;
  assigned_vehicle_id?: string | null;
  primary_driver_user_id?: string | null;
  status: TransportRouteStatus;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  location?: Location;
  assigned_vehicle?: Vehicle;
  primary_driver?: User;
  stops?: TransportRouteStop[];
  stops_count?: number;
  assigned_student_count?: number;
  capacity?: number;
  available_seats?: number;
  utilization_percentage?: number;
}

export interface TransportRouteStop {
  id: string;
  school_id: string;
  route_id: string;
  stop_name: string;
  stop_code?: string | null;
  address_landmark?: string | null;
  sequence_number: number;
  pickup_time?: string | null;
  drop_time?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface StudentTransportAssignment {
  id: string;
  school_id: string;
  academic_session_id: string;
  location_id: string;
  student_user_id: string;
  route_id: string;
  pickup_stop_id?: string | null;
  drop_stop_id?: string | null;
  vehicle_id?: string | null;
  start_date: string;
  end_date?: string | null;
  status: TransportAssignmentStatus;
  remarks?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  student?: User;
  session?: AcademicSession;
  location?: Location;
  route?: TransportRoute;
  pickup_stop?: TransportRouteStop;
  drop_stop?: TransportRouteStop;
  vehicle?: Vehicle;
  class_name?: string;
  section_name?: string;
  admission_number?: string;
  roll_number?: string;
}

export interface TransportTrip {
  id: string;
  school_id: string;
  location_id?: string | null;
  trip_date: string;
  route_id: string;
  vehicle_id: string;
  driver_user_id: string;
  trip_type: TripType;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  status: TripStatus;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;

  // Hydrated
  route?: TransportRoute;
  vehicle?: Vehicle;
  driver?: User;
  location?: Location;
  student_count?: number;
}

export interface VehicleLocationHistory {
  id: string;
  school_id: string;
  vehicle_id: string;
  trip_id?: string | null;
  latitude: number;
  longitude: number;
  speed_kmh?: number | null;
  heading_degrees?: number | null;
  recorded_at: string;
}

export interface TransportDashboardStats {
  total_vehicles: number;
  active_vehicles: number;
  inactive_vehicles: number;
  maintenance_vehicles: number;
  total_routes: number;
  active_routes: number;
  students_using_transport: number;
  today_trips_count: number;
  active_trips_count: number;
  total_capacity: number;
  available_seats: number;
  maintenance_due_count: number;
  document_alerts: {
    expired_count: number;
    expiring_soon_count: number;
    valid_count: number;
  };
  gps_status_counts: {
    online: number;
    offline: number;
    not_configured: number;
  };
}

export interface TransportCapacityReportItem {
  vehicle_id: string;
  vehicle_number: string;
  registration_number: string;
  route_name?: string;
  route_code?: string;
  capacity: number;
  assigned_students: number;
  available_seats: number;
  utilization_percentage: number;
  status: VehicleStatus;
}

// ------------------------------------------------------------------------
// INVENTORY & ORDER MANAGEMENT TYPES
// ------------------------------------------------------------------------

export interface InventoryCategory {
  id: string;
  school_id: string;
  code: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface InventorySubcategory {
  id: string;
  school_id: string;
  category_id: string;
  code: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  category?: InventoryCategory;
}

export interface InventoryUOM {
  id: string;
  school_id: string;
  code: string;
  name: string;
  symbol: string;
  is_fractional: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface InventoryBrand {
  id: string;
  school_id: string;
  code: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface InventoryVendor {
  id: string;
  school_id: string;
  code: string;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_id?: string | null;
  payment_terms?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Product {
  id: string;
  school_id: string;
  code: string;
  name: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  uom_id?: string | null;
  brand_id?: string | null;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  category?: InventoryCategory;
  subcategory?: InventorySubcategory;
  uom?: InventoryUOM;
  brand?: InventoryBrand;
  skus_count?: number;
}

export interface SKU {
  id: string;
  school_id: string;
  product_id?: string | null;
  sku_code: string;
  sku_name?: string;
  barcode?: string | null;
  alternate_barcode?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  uom_id?: string | null;
  brand_id?: string | null;
  description?: string | null;
  reorder_level: number;
  min_order_qty: number;
  max_stock?: number | null;
  cost_price: number;
  selling_price: number;
  attributes?: Record<string, any>;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  category?: InventoryCategory;
  subcategory?: InventorySubcategory;
  uom?: InventoryUOM;
  brand?: InventoryBrand;
  product?: Product;
  total_stock?: number;
}

export interface InventoryStock {
  id: string;
  school_id: string;
  location_id: string;
  sku_id: string;
  quantity: number;
  reserved_quantity: number;
  min_quantity: number;
  reorder_point: number;
  created_at: string;
  updated_at: string;

  // Hydrated
  sku?: SKU;
  location?: Location;
}

export type StockMovementType =
  | 'OPENING'
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'PURCHASE_RECEIPT'
  | 'SALES_FULFILLMENT'
  | 'RETURN';

export type StockReferenceType =
  | 'OPENING_STOCK'
  | 'PURCHASE_ORDER'
  | 'SALES_ORDER'
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'ADJUSTMENT';

export interface InventoryStockLedger {
  id: string;
  school_id: string;
  location_id: string;
  sku_id: string;
  movement_type: StockMovementType;
  reference_type: StockReferenceType;
  reference_id?: string | null;
  quantity: number;
  previous_balance: number;
  new_balance: number;
  unit_cost: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;

  // Hydrated
  sku?: SKU;
  location?: Location;
  created_by_user?: User;
}

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  sku_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  tax_rate: number;
  total_price: number;
  created_at: string;

  // Hydrated
  sku?: SKU;
}

export interface PurchaseOrder {
  id: string;
  school_id: string;
  location_id: string;
  po_number: string;
  vendor_id: string;
  order_date: string;
  expected_date?: string | null;
  status: PurchaseOrderStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  vendor?: InventoryVendor;
  location?: Location;
  created_by_user?: User;
  items?: PurchaseOrderItem[];
}

export type SalesOrderStatus = 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED';
export type SalesOrderPaymentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'WAIVED';
export type SalesOrderCustomerType = 'STUDENT' | 'STAFF' | 'PARENT' | 'EXTERNAL';

export interface SalesOrderItem {
  id: string;
  so_id: string;
  sku_id: string;
  quantity_ordered: number;
  quantity_fulfilled: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
  created_at: string;

  // Hydrated
  sku?: SKU;
}

export interface SalesOrder {
  id: string;
  school_id: string;
  location_id: string;
  so_number: string;
  customer_type: SalesOrderCustomerType;
  customer_id?: string | null;
  customer_name: string;
  order_date: string;
  status: SalesOrderStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_status: SalesOrderPaymentStatus;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  location?: Location;
  customer_user?: User;
  created_by_user?: User;
  items?: SalesOrderItem[];
}

export interface InventoryStockInDetail {
  id: string;
  stock_in_id: string;
  sku_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  remarks?: string | null;

  // Hydrated
  sku?: SKU;
}

export interface InventoryStockIn {
  id: string;
  school_id: string;
  location_id: string;
  receipt_number: string;
  vendor_id?: string | null;
  po_id?: string | null;
  receipt_date: string;
  total_amount: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;

  // Hydrated
  vendor?: InventoryVendor;
  po?: PurchaseOrder;
  location?: Location;
  items?: InventoryStockInDetail[];
}

export interface InventoryStockOutDetail {
  id: string;
  stock_out_id: string;
  sku_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  remarks?: string | null;

  // Hydrated
  sku?: SKU;
}

export interface InventoryStockOut {
  id: string;
  school_id: string;
  location_id: string;
  issue_number: string;
  so_id?: string | null;
  issue_date: string;
  issued_to_type?: string | null;
  issued_to_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;

  // Hydrated
  so?: SalesOrder;
  issued_to_user?: User;
  location?: Location;
  items?: InventoryStockOutDetail[];
}

export interface InventoryAdjustmentDetail {
  id: string;
  adjustment_id: string;
  sku_id: string;
  adjustment_type: 'INCREASE' | 'DECREASE';
  quantity: number;
  unit_cost: number;
  remarks?: string | null;

  // Hydrated
  sku?: SKU;
}

export interface InventoryAdjustment {
  id: string;
  school_id: string;
  location_id: string;
  adjustment_number: string;
  adjustment_date: string;
  reason: string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;

  // Hydrated
  location?: Location;
  items?: InventoryAdjustmentDetail[];
}

export interface InventoryDashboardStats {
  total_products: number;
  total_skus: number;
  total_stock_units: number;
  total_stock_valuation: number;
  low_stock_count: number;
  out_of_stock_count: number;
  pending_pos_count: number;
  pending_sos_count: number;
  today_movements_count: number;
  top_categories: { name: string; count: number }[];
  recent_activities: InventoryStockLedger[];
}

export interface StockValuationReportItem {
  sku_id: string;
  sku_code: string;
  barcode?: string;
  product_name: string;
  category_name?: string;
  location_id: string;
  location_name: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  total_cost_valuation: number;
  total_selling_valuation: number;
  reorder_level: number;
  stock_status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface LowStockAlertItem {
  sku_id: string;
  sku_code: string;
  product_name: string;
  location_id: string;
  location_name: string;
  current_quantity: number;
  reorder_level: number;
  reorder_point: number;
  min_order_qty: number;
  cost_price: number;
  suggested_order_qty: number;
}

// ========================================================================
// Asset Management Types
// ========================================================================

export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'CRITICAL';
export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'UNDER_MAINTENANCE' | 'DAMAGED' | 'LOST' | 'DISPOSED' | 'RETIRED';
export type AssetMaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface AssetCategory {
  id: string;
  school_id: string;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  subcategories?: AssetSubcategory[];
  asset_count?: number;
}

export interface AssetSubcategory {
  id: string;
  school_id: string;
  category_id: string;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  category?: AssetCategory;
  asset_count?: number;
}

export interface Asset {
  id: string;
  school_id: string;
  asset_code: string;
  asset_name: string;
  category_id: string;
  subcategory_id?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  barcode?: string | null;
  asset_tag?: string | null;
  description?: string | null;
  purchase_date?: string | null;
  purchase_price: number;
  vendor_id?: string | null;
  purchase_order_id?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  warranty_start_date?: string | null;
  warranty_end_date?: string | null;
  current_location_id: string;
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  room_number?: string | null;
  area?: string | null;
  rack?: string | null;
  seat_desk?: string | null;
  current_custodian_user_id?: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  remarks?: string | null;
  useful_life_years?: number | null;
  salvage_value?: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;

  // Hydrated
  category?: AssetCategory;
  subcategory?: AssetSubcategory;
  location?: Location;
  custodian?: User;
  vendor?: InventoryVendor;
  purchase_order?: PurchaseOrder;
  created_by_user?: User;
  active_assignment?: AssetAssignment;
  assignments?: AssetAssignment[];
  movements?: AssetMovement[];
  maintenance_records?: AssetMaintenance[];
  disposal?: AssetDisposal;
  documents?: AssetDocument[];
}

export interface AssetAssignment {
  id: string;
  school_id: string;
  asset_id: string;
  assigned_to_user_id: string;
  location_id?: string | null;
  assignment_date: string;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  condition_at_assignment: AssetCondition;
  condition_at_return?: AssetCondition | null;
  remarks?: string | null;
  assigned_by?: string | null;
  returned_by?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Hydrated
  asset?: Asset;
  assigned_to_user?: User;
  assigned_by_user?: User;
  returned_by_user?: User;
  location?: Location;
}

export interface AssetMovement {
  id: string;
  school_id: string;
  asset_id: string;
  from_location_id?: string | null;
  to_location_id: string;
  from_building?: string | null;
  to_building?: string | null;
  from_room?: string | null;
  to_room?: string | null;
  from_user_id?: string | null;
  to_user_id?: string | null;
  movement_date: string;
  reason?: string | null;
  condition?: AssetCondition | null;
  remarks?: string | null;
  moved_by?: string | null;
  created_at: string;

  // Hydrated
  asset?: Asset;
  from_location?: Location;
  to_location?: Location;
  from_user?: User;
  to_user?: User;
  moved_by_user?: User;
}

export interface AssetMaintenance {
  id: string;
  school_id: string;
  asset_id: string;
  maintenance_type: string;
  service_date: string;
  vendor_id?: string | null;
  service_provider?: string | null;
  issue_description: string;
  work_performed?: string | null;
  cost: number;
  next_service_date?: string | null;
  warranty_claim: boolean;
  status: AssetMaintenanceStatus;
  previous_asset_status?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Hydrated
  asset?: Asset;
  vendor?: InventoryVendor;
  created_by_user?: User;
}

export interface AssetDisposal {
  id: string;
  school_id: string;
  asset_id: string;
  disposal_date: string;
  disposal_reason: string;
  disposal_method: string;
  disposal_value: number;
  approved_by?: string | null;
  document_url?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_at: string;

  // Hydrated
  asset?: Asset;
  approved_by_user?: User;
  created_by_user?: User;
}

export interface AssetDocument {
  id: string;
  school_id: string;
  asset_id: string;
  document_type: string;
  document_name: string;
  document_url: string;
  file_size?: number | null;
  mime_type?: string | null;
  uploaded_by?: string | null;
  created_at: string;

  // Hydrated
  uploaded_by_user?: User;
}

export interface AssetDashboardMetrics {
  total_assets: number;
  active_assets: number;
  assigned_assets: number;
  available_assets: number;
  under_maintenance: number;
  damaged_assets: number;
  lost_assets: number;
  disposed_assets: number;
  warranty_expiring_soon: number;
  maintenance_due: number;
  total_acquisition_value: number;
  by_category: Array<{ category_id: string; category_name: string; count: number; value: number }>;
  by_location: Array<{ location_id: string; location_name: string; count: number; value: number }>;
  by_status: Array<{ status: AssetStatus; count: number }>;
  by_condition: Array<{ condition: AssetCondition; count: number }>;
}

// ========================================================================
// Library Management Module Domain Types
// ========================================================================

export type BookCopyCondition = 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'POOR';
export type BookCopyStatus = 'AVAILABLE' | 'ISSUED' | 'RESERVED' | 'LOST' | 'DAMAGED' | 'UNDER_REPAIR' | 'DISPOSED';
export type LibraryIssueStatus = 'ISSUED' | 'RETURNED' | 'OVERDUE' | 'LOST';
export type LibraryReservationStatus = 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
export type LibraryFineStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED';

export interface LibrarySettings {
  id: string;
  school_id: string;
  loan_period_days: number;
  maximum_books_per_member: number;
  student_issue_limit: number;
  staff_issue_limit: number;
  maximum_renewals: number;
  fine_per_day: number;
  grace_period_days: number;
  reservation_enabled: boolean;
  reservation_expiry_days: number;
  auto_fine_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface LibraryCategory {
  id: string;
  school_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  book_count?: number;
}

export interface LibraryAuthor {
  id: string;
  school_id: string;
  name: string;
  biography?: string | null;
  remarks?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface LibraryPublisher {
  id: string;
  school_id: string;
  name: string;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  remarks?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface LibraryBookAuthor {
  id: string;
  school_id: string;
  book_id: string;
  author_id: string;
  is_primary: boolean;
  created_at: string;
  author?: LibraryAuthor;
}

export interface LibraryBook {
  id: string;
  school_id: string;
  accession_reference?: string | null;
  isbn?: string | null;
  title: string;
  subtitle?: string | null;
  category_id: string;
  publisher_id?: string | null;
  publication_year?: number | null;
  edition?: string | null;
  language: string;
  pages?: number | null;
  description?: string | null;
  subject?: string | null;
  class_level?: string | null;
  cover_image?: string | null;
  price: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;

  // Hydrated
  category?: LibraryCategory;
  publisher?: LibraryPublisher;
  authors?: LibraryAuthor[];
  copies?: LibraryBookCopy[];
  total_copies_count?: number;
  available_copies_count?: number;
  total_copies?: number;
  available_copies?: number;
}

export interface LibraryBookCopy {
  id: string;
  school_id: string;
  book_id: string;
  copy_code: string;
  accession_number?: string | null;
  barcode?: string | null;
  purchase_date?: string | null;
  purchase_price: number;
  vendor_id?: string | null;
  purchase_order_id?: string | null;
  location_id: string;
  room?: string | null;
  shelf?: string | null;
  rack?: string | null;
  shelf_location?: string | null;
  condition: BookCopyCondition;
  status: BookCopyStatus;
  remarks?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;

  // Hydrated
  book?: LibraryBook;
  location?: Location;
  vendor?: InventoryVendor;
  current_issue?: LibraryIssue;
}

export interface LibraryMember {
  id: string;
  school_id: string;
  user_id: string;
  membership_number: string;
  membership_type: 'STUDENT' | 'TEACHER' | 'STAFF';
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  max_books_allowed?: number | null;
  joined_date: string;
  expiry_date?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;

  // Hydrated
  user?: User;
  active_issues_count?: number;
  overdue_issues_count?: number;
  total_fines_unpaid?: number;
  student_enrollment?: StudentAcademicEnrollment;
}

export interface LibraryIssue {
  id: string;
  school_id: string;
  member_user_id: string;
  book_id: string;
  book_copy_id: string;
  issue_date: string;
  due_date: string;
  return_date?: string | null;
  renewal_count: number;
  status: LibraryIssueStatus;
  issued_by?: string | null;
  returned_by?: string | null;
  remarks?: string | null;
  is_overdue?: boolean;
  overdue_days?: number;
  created_at: string;
  updated_at: string;

  // Hydrated
  member_user?: User;
  book?: LibraryBook;
  book_copy?: LibraryBookCopy;
  issued_by_user?: User;
  returned_by_user?: User;
  fine?: LibraryFine;
}

export interface LibraryReservation {
  id: string;
  school_id: string;
  book_id: string;
  member_user_id: string;
  reservation_date: string;
  expiry_date: string;
  queue_position: number;
  status: LibraryReservationStatus;
  fulfilled_copy_id?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;

  // Hydrated
  book?: LibraryBook;
  member_user?: User;
  fulfilled_copy?: LibraryBookCopy;
}

export interface LibraryFine {
  id: string;
  school_id: string;
  issue_id?: string | null;
  member_user_id: string;
  fine_date: string;
  amount: number;
  reason: string;
  status: LibraryFineStatus;
  paid_amount: number;
  balance_amount: number;
  paid_date?: string | null;
  payment_mode?: string | null;
  payment_reference?: string | null;
  received_by?: string | null;
  waived_amount?: number;
  waived_by?: string | null;
  waiver_reason?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Hydrated
  member_user?: User;
  issue?: LibraryIssue;
  received_by_user?: User;
  waived_by_user?: User;
}

export interface LibraryLostDamaged {
  id: string;
  school_id: string;
  book_copy_id: string;
  issue_id?: string | null;
  record_type: 'LOST' | 'DAMAGED' | 'DISPOSED';
  record_date: string;
  reported_by?: string | null;
  responsible_member_id?: string | null;
  description: string;
  cost_charged?: number;
  fine_id?: string | null;
  remarks?: string | null;
  created_at: string;

  // Hydrated
  book_copy?: LibraryBookCopy;
  responsible_member?: User;
  reported_by_user?: User;
  fine?: LibraryFine;
}

export interface LibraryDashboardMetrics {
  total_books: number;
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  overdue_books: number;
  reserved_books: number;
  lost_books: number;
  damaged_books: number;
  active_members: number;
  outstanding_fines: number;
  total_fine_collected: number;
  by_category: Array<{ category_id: string; category_name: string; count: number }>;
  by_status: Array<{ status: BookCopyStatus; count: number }>;
  most_issued_books: Array<{ book_id: string; title: string; issue_count: number }>;
  recent_issues: LibraryIssue[];
  recent_returns: LibraryIssue[];
  overdue_issues: LibraryIssue[];
  pending_reservations: LibraryReservation[];
}

// ------------------------------------------------------------------------
// Admissions & Enquiry CRM Types
// ------------------------------------------------------------------------
export interface AdmissionSource {
  id: string;
  school_id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdmissionEnquiry {
  id: string;
  school_id: string;
  academic_session_id?: string | null;
  enquiry_number: string;
  enquiry_date: string;
  source_id?: string | null;
  source_type: 'WALK_IN' | 'WEBSITE' | 'REFERRAL' | 'PHONE' | 'SOCIAL';
  student_first_name: string;
  student_last_name?: string;
  date_of_birth?: string;
  gender?: string;
  seeking_class_id?: string | null;
  previous_school?: string;
  parent_name: string;
  parent_relation: 'FATHER' | 'MOTHER' | 'GUARDIAN';
  primary_phone: string;
  alternate_phone?: string;
  email?: string;
  address?: string;
  status: 'NEW' | 'CONTACTED' | 'APPOINTMENT_SCHEDULED' | 'APPLICATION_SUBMITTED' | 'ADMITTED' | 'REJECTED' | 'CLOSED';
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  source?: AdmissionSource;
  seeking_class?: { id: string; name: string };
  followups?: AdmissionFollowup[];
}

export interface AdmissionFollowup {
  id: string;
  school_id: string;
  enquiry_id: string;
  followup_date: string;
  next_followup_date?: string;
  contacted_via: 'PHONE' | 'EMAIL' | 'IN_PERSON' | 'SMS' | 'WHATSAPP';
  response_notes: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  handled_by?: string;
  created_at: string;
  updated_at: string;
  handler_name?: string;
}

export interface AdmissionApplication {
  id: string;
  school_id: string;
  enquiry_id?: string | null;
  academic_session_id: string;
  application_number: string;
  application_date: string;
  class_id: string;
  section_id?: string | null;
  student_first_name: string;
  student_middle_name?: string;
  student_last_name?: string;
  date_of_birth: string;
  gender: string;
  blood_group?: string;
  nationality?: string;
  religion?: string;
  category?: string;
  primary_contact_name: string;
  primary_contact_phone: string;
  primary_contact_email?: string;
  primary_contact_relation: 'FATHER' | 'MOTHER' | 'GUARDIAN';
  address?: string;
  documents: Array<{ storage_path: string; file_url?: string; file_name: string; file_size?: number; mime_type?: string }>;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'ADMITTED' | 'REJECTED';
  converted_student_id?: string | null;
  converted_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  class_name?: string;
  section_name?: string;
}






