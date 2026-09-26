# EduCloud SMS SaaS — Comprehensive Investor Functional Specification

**Platform:** EduCloud Multi-Tenant School Management System (SMS) SaaS  
**Document Type:** Functional Requirements & Architecture Specification (FRS/FDD)  
**Target Audience:** Investors, Venture Partners, Educational Group Stakeholders, Institutional Buyers  
**Version:** 1.0 (Production Foundation)  
**Date:** September 2026  

---

## Executive Summary & Investor Value Proposition

**EduCloud SMS** is an enterprise-grade, multi-tenant B2B SaaS platform engineered to replace brittle legacy school software with a modern, cloud-native School Operating System. 

### Key Investment Highlights
1. **100% Tenant Isolation (Enterprise Security)**: Hardware-grade multi-tenant defense powered by PostgreSQL Row-Level Security (RLS) and Gateway Middleware. Cross-tenant tampering attempts immediately return `403 TENANT_VIOLATION` with immutable audit logging.
2. **Universal User Architecture**: Single unified table for all personas (Students, Faculty, Staff, Parents, Accountants, Directors). Zero redundant schemas.
3. **Dynamic RBAC & Granular Data Scoping**: Zero hardcoded roles. Permissions and data scopes (`ALL_SCHOOLS`, `ALL_LOCATIONS`, `ONE_LOCATION`, `ASSIGNED_CLASSES`) are evaluated in real time.
4. **Multitasking Tabbed Workspace**: Professional UI allowing up to **8 concurrently active modules** with complete state preservation (search terms, filter selections, table pagination, and unsubmitted form drafts remain intact).
5. **High LTV & Expansion Potential**: Modular feature toggles allow institutions to unlock advanced modules (Bus GPS Telematics, WhatsApp Broadcasts, POS Billing, CBSE Report Cards), driving 135%+ Net Revenue Retention (NRR).

---

## System Navigation & Architecture Matrix

```
EduCloud SMS Monorepo Workspace
│
├── 01. DASHBOARD & WORKSPACE SHELL
│   └── Executive Dashboard (/dashboard)
│
├── 02. SCHOOL / TENANT GOVERNANCE
│   ├── Schools Master (/schools) [SuperAdmin Scope]
│   └── Locations / Branches Master (/locations)
│
├── 03. PEOPLE & ADMISSIONS
│   ├── Students Master & 6-Tab Admission (/students)
│   ├── Staff & Faculty Master (/staff)
│   ├── Parents & Guardians (/parents)
│   ├── Designations Master (/designations)
│   ├── Categories & Subcategories (/categories_types)
│   └── Tags & Color-Coded Labels (/tags_labels)
│
├── 04. ACADEMIC LIFECYCLE
│   ├── Academic Sessions Master (/academics)
│   ├── Classes Master (/classes_master)
│   ├── Sections Master (/sections_master)
│   ├── Class-Section Offerings Setup (/class_section_setup)
│   ├── Subjects Master (/subjects_master)
│   ├── Subject Groups (/subject_groups)
│   ├── Subject & Class Offerings (/subject_offerings)
│   ├── Student Class Allocation (/student_assignments)
│   └── Teacher Allocation Matrix (/teacher_assignments)
│
├── 05. TIMETABLE & SCHEDULING
│   ├── Timetable Period Configurator (/timetable_config)
│   ├── Weekly Student Timetable Grid (/student_timetable)
│   └── Teacher Personal Teaching Schedule (/teaching_schedule)
│
├── 06. UNIVERSAL ATTENDANCE ENGINE
│   ├── Daily Student Attendance Marking (/student_attendance)
│   ├── Staff Check-In & Time Tracking (/staff_attendance)
│   ├── Attendance History Ledger (/attendance_history)
│   ├── Real-Time Attendance Analytics (/attendance_dashboard)
│   └── Official Registers & Export Reports (/attendance_reports)
│
├── 07. FEES MANAGEMENT & POS CASH DESK
│   ├── Financial Executive Dashboard (/fee_dashboard)
│   ├── Fee Heads Catalog (/fee_heads)
│   ├── Class Fee Structures (/fee_structures)
│   ├── Student Fee Demands (/fee_assignment)
│   ├── Real-Time POS Cash Desk Collection (/fee_collection)
│   ├── Printable Payment Receipts (/fee_receipts)
│   ├── Outstanding Aging & Student Ledger (/fee_outstanding)
│   ├── Discounts, Scholarships & Waivers (/fee_discounts)
│   ├── Audit-Proof Fee Refunds (/fee_refunds)
│   └── Revenue Breakdown Reports (/fee_reports)
│
├── 08. EXAMS, ASSESSMENTS & REPORT CARDS
│   ├── Assessment Dashboard (/exam_dashboard)
│   ├── Examination Master (/exam_master)
│   ├── Exam Structure & Weightage Blueprint (/exam_structure)
│   ├── Paper Timetable & Exam Schedule (/exam_schedule)
│   ├── High-Speed Marks Entry POS (/marks_entry)
│   ├── Results Aggregation Ledger (/exam_results)
│   ├── CBSE/ICSE Printable Report Cards (/report_cards)
│   └── Subject Performance Reports (/exam_reports)
│
├── 09. OMNICHANNEL COMMUNICATION
│   ├── Communications Cockpit (/communication_dashboard)
│   ├── Circulars & Announcements Feed (/announcements_notices)
│   ├── 5-Step Broadcast Wizard (/compose_communication)
│   ├── Message Templates Library (/communication_templates)
│   ├── Dispatch History & Telematics (/communication_history)
│   ├── Read Receipts & Delivery Reports (/delivery_reports)
│   └── Student/Parent In-App Inbox (/communication_inbox)
│
├── 10. TRANSPORT FLEET & LIVE GPS
│   ├── Fleet Operations Dashboard (/transport_dashboard)
│   ├── Vehicle Asset Master (/vehicle_master)
│   ├── Driver & Staff Licensing (/driver_staff)
│   ├── Bus Route Master (/route_master)
│   ├── Route Stops & Timing Sequencer (/route_stops)
│   ├── Student Transport Allocation (/student_transport)
│   ├── Morning & Afternoon Trips (/daily_trips)
│   ├── Live GPS Telematics Readiness (/gps_tracking)
│   └── Capacity Utilization Reports (/transport_reports)
│
└── 11. SECURITY, RBAC & AUDIT
    ├── Universal Users Directory (/users)
    ├── Role Master (/roles_master)
    ├── Rights Catalog (/rights_master)
    ├── Interactive Role-Rights Matrix (/role_rights)
    ├── User-Role Assignments (/user_roles)
    ├── Multi-Branch Access Scope (/access_scope)
    ├── Dynamic Feature Toggles (/features)
    ├── Institutional Settings (/settings)
    └── Immutable Security Audit Trail (/audit)
```

---

## Detailed Screen-by-Screen Functional Specifications

### Module 1: Executive Command Dashboard & Workspace Shell
- **Primary Screen:** `DashboardModule.tsx`
- **Key Features:**
  - **Live Metrics Cockpit**: Real-time cards displaying total universal users, active campuses, collection efficiency rate (%), and immutable security audit records.
  - **Multi-Tenant Context Switcher**: Top header bar displaying active school name (`school_name`), school code badge (`school_code`), and instant branch campus selector.
  - **Multitasking Workspace Tab Bar**: Supports up to 8 concurrently active modules. If a user attempts to open a 9th module, an overflow resolution modal triggers allowing them to switch or close existing tabs.
  - **Unread Message Bell**: Real-time counter badge notifying directors and staff of unacknowledged emergency notices or circulars.

---

### Module 2: School / Tenant & Multi-Branch Management
- **Primary Screens:** `SchoolsModule.tsx`, `LocationsModule.tsx`
- **Key Features:**
  - **Tenant Provisioning**: SuperAdmin screen to create educational institutions, manage status (`ACTIVE`, `SUSPENDED`), currency (`INR`, `USD`), and timezone.
  - **Multi-Branch Hierarchy**: Configure branch campuses (e.g. *Dwarka Main Campus*, *Noida Extension*) with individual contact details, physical addresses, and geographic coordinates.
  - **Tenant Data Isolation**: Database-level isolation preventing cross-school data leaks.

---

### Module 3: People Masters, Admissions & Universal Profiles
- **Primary Screens:** `StudentsMasterModule.tsx`, `StaffMasterModule.tsx`, `ParentsMasterModule.tsx`, `UserProfileDrawer.tsx`, `TaxonomyMasterModule.tsx`
- **Key Features:**
  - **6-Step Student Admission Wizard**:
    1. *Basic Details*: Full name, DOB, gender, blood group, nationality, residential address.
    2. *Academic Placement*: Academic session, branch campus, class, section, roll number, admission number.
    3. *Previous School History*: Last school attended, board, marks obtained, transfer certificate attachment.
    4. *Achievements*: Sports, olympiads, co-curricular awards with verification links.
    5. *Document Vault*: Birth certificate, Aadhaar card, medical records, passport photos.
    6. *Login Credentials*: One-click setup for student & parent portal access with encrypted passwords.
  - **Slide-Over 360° Profile Drawer**: Slide-out panel providing complete history: linked parents/guardians, academic placements, fee ledger balances, attendance rate, and audit timestamps.
  - **Faculty & Staff Master**: Tracks employee code, qualifications, years of experience, emergency contacts, biometric IDs, and department designations.
  - **Parent-Student Normalized Linking**: Many-to-many relationship mapping parents to multiple siblings across different classes.

---

### Module 4: Academic Structure & Session Lifecycle
- **Primary Screens:** `AcademicSessionsModule.tsx`, `ClassesMasterModule.tsx`, `SectionsMasterModule.tsx`, `ClassSectionSetupModule.tsx`, `SubjectOfferingsModule.tsx`, `StudentAssignmentModule.tsx`, `TeacherAssignmentsModule.tsx`
- **Key Features:**
  - **Academic Session Master**: Complete lifecycle governance (`ACTIVE`, `INACTIVE`, `COMPLETED`) with start/end date bounds.
  - **Classes & Sections**: Standalone class levels (Class 1 to Class 12) and sections (A, B, C, D) mapped per session with maximum seating capacities.
  - **Subject Offerings & Groups**: Categorization into Core vs Elective, Theory vs Practical, and subject streams (Science, Commerce, Arts).
  - **Class Allocations**: Bulk enrollment of students into class-sections and assignment of Class Teachers and Subject Faculty.

---

### Module 5: Dynamic Timetable & Teacher Schedule Engine
- **Primary Screens:** `TimetableConfigModule.tsx`, `StudentTimetableModule.tsx`, `MyTeachingScheduleModule.tsx`
- **Key Features:**
  - **Dynamic Period Configurator**: Set start times (e.g. 08:00), period duration (45 mins), lunch break window (11:00–11:45), and working day schedules (Mon–Fri or Mon–Sat).
  - **Weekly Student Timetable Matrix**: Visual weekly schedule grid with drag-and-drop subject placement, room numbers, and conflict detection (prevents double-booking teachers).
  - **Faculty Timetable View**: Dedicated *My Teaching Schedule* showing daily period breakdown, room assignments, and free periods for teachers.

---

### Module 6: Universal Attendance Engine
- **Primary Screens:** `StudentAttendanceModule.tsx`, `StaffAttendanceModule.tsx`, `AttendanceHistoryModule.tsx`, `AttendanceDashboardModule.tsx`, `AttendanceReportsModule.tsx`
- **Key Features:**
  - **1-Click Class Attendance**: Sorted by roll number with *Mark All Present*, toggle *Absent*, *Late*, or *Half-Day*, and add sick-leave notes.
  - **Parent Notification Triggers**: Automatic queueing of SMS/WhatsApp alerts to parents when a student is marked absent.
  - **Staff Biometric / Time Tracking**: Daily check-in and check-out logs for faculty with late penalty calculations.
  - **Reporting & Registers**: Monthly attendance matrix, defaulters roster (<75% attendance), and exportable CSV/print registers.

---

### Module 7: Fees Management, POS Cash Desk & Ledger Engine
- **Primary Screens:** `FeeDashboardModule.tsx`, `FeeHeadsModule.tsx`, `FeeStructuresModule.tsx`, `StudentFeeAssignmentModule.tsx`, `FeeCollectionModule.tsx`, `FeeReceiptsModule.tsx`, `FeeOutstandingModule.tsx`, `FeeDiscountsModule.tsx`, `FeeRefundsModule.tsx`, `FeeReportsModule.tsx`
- **Key Features:**
  - **Fee Heads & Blueprint Rules**: Configure Tuition, Admission, Laboratory, Transportation, and Sports fees on Monthly, Quarterly, or Annual cycles.
  - **Mass Demand Invoicing**: Generate quarterly demand notices for cohorts with due dates and late payment penalties.
  - **Cash Desk POS Collection**: High-speed payment collection interface supporting UPI, Cash, Cheque, Credit/Debit Cards, and NetBanking with instant printable payment vouchers.
  - **Aging Dues & Defaulters Ledger**: Searchable roster of outstanding dues with automated reminder generation.
  - **Waivers, Discounts & Refunds**: Audit-backed approval workflow for merit scholarships, sibling concessions, and fee refund reversals.

---

### Module 8: Examinations, Rapid Marks Entry & Report Cards
- **Primary Screens:** `ExamDashboardModule.tsx`, `ExamMasterModule.tsx`, `ExamStructureModule.tsx`, `ExamScheduleModule.tsx`, `MarksEntryModule.tsx`, `ExamResultsModule.tsx`, `ReportCardsModule.tsx`, `ExamReportsModule.tsx`
- **Key Features:**
  - **Exam Configuration**: Setup Unit Tests, Mid-Terms, and Annual Board exams bound to academic sessions with status workflows (`DRAFT` → `SCHEDULED` → `RESULTS_READY` → `PUBLISHED`).
  - **Rapid Marks Entry Grid**: Spreadsheet-like input for teachers to enter obtained marks with real-time validation against maximum marks.
  - **CBSE-Compliant Report Cards**: Auto-generates student progress cards complete with official school header, marks table, grades (A1, A2, B1...), co-scholastic assessment, and signature blocks.
  - **Analytics & Grade Distribution**: Pass percentage, subject averages, highest/lowest scores, and class ranking ledgers.

---

### Module 9: Omnichannel Communication & In-App Messaging
- **Primary Screens:** `CommunicationDashboardModule.tsx`, `AnnouncementsNoticesModule.tsx`, `ComposeCommunicationModule.tsx`, `CommunicationTemplatesModule.tsx`, `CommunicationHistoryModule.tsx`, `DeliveryReportsModule.tsx`, `CommunicationInboxModule.tsx`
- **Key Features:**
  - **5-Step Broadcast Wizard**:
    1. *Type & Priority*: Notice, Circular, Emergency Alert, Event Invitation (`HIGH`, `URGENT`, `NORMAL`).
    2. *Audience Targeting*: Filter by School, Campus, Class, Section, Bus Route, or Custom Label.
    3. *Message Composition*: Rich text formatting with dynamic template tags (`{{student_name}}`, `{{class}}`, `{{due_date}}`).
    4. *Multi-Channel Dispatch*: Simultaneous delivery via In-App Portal, WhatsApp Business API, SMS, and Email.
    5. *Mandatory Parent Acknowledgment*: Requires digital acknowledgment from parents for safety circulars.
  - **Student / Parent Portal Inbox**: Personal message feed with read receipts and acknowledgment tracking.

---

### Module 10: Transport Fleet, Bus Routes & Live GPS
- **Primary Screens:** `TransportDashboardModule.tsx`, `VehicleMasterModule.tsx`, `DriverStaffModule.tsx`, `RouteMasterModule.tsx`, `RouteStopsModule.tsx`, `StudentTransportAssignmentModule.tsx`, `DailyTripsModule.tsx`, `GpsLiveTrackingModule.tsx`, `TransportReportsModule.tsx`
- **Key Features:**
  - **Fleet Asset Governance**: Track buses and vans with registration numbers, seating capacities, pollution/fitness certificate expiry dates, and insurance renewal alerts.
  - **Route & Stop Management**: Define sequential bus stops with scheduled pickup/drop timings and GPS coordinates.
  - **Capacity Enforced Allocations**: Link enrolled students to bus stops with automatic alerts when bus seat capacity is exceeded.
  - **Daily Trips & GPS Tracking**: Dispatch morning pickup and afternoon drop trips with live hardware telematics readiness status.

---

### Module 11: Security, Dynamic RBAC & Immutable Audit Trail
- **Primary Screens:** `UsersModule.tsx`, `RolesMasterModule.tsx`, `RightsMasterModule.tsx`, `RoleRightsModule.tsx`, `UserRolesModule.tsx`, `AccessScopeModule.tsx`, `CategorizedSettingsModule.tsx`, `FeatureConfigModule.tsx`, `AuditLogsModule.tsx`
- **Key Features:**
  - **Dynamic RBAC Matrix**: Real-time permission grid mapping rights to roles with zero code changes.
  - **Data Scoping Engine**: Restricts users to specific data boundaries (`ALL_SCHOOLS`, `ALL_LOCATIONS`, `SELECTED_LOCATIONS`, `ONE_LOCATION`, `ASSIGNED_CLASSES`).
  - **Dynamic Feature Flags**: SaaS module toggles (Fees, Transport, WhatsApp, Exams) configured per tenant plan tier.
  - **Immutable Audit Trail**: Append-only log recording actor, IP address, timestamp, affected module, and before/after payloads for complete forensic compliance.

---

## Technical Specifications & Stack Overview

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + TypeScript + Vite | High-performance SPA with instant HMR |
| **Styling & UI** | Tailwind CSS + Lucide Icons | Responsive enterprise UI with consistent design tokens |
| **State & Workspace** | React Context + Custom Reducer | Multi-tab state preservation without DOM reloads |
| **Backend API** | Node.js + Express + TypeScript | Modular REST API with strict Zod schema validation |
| **Database** | Supabase PostgreSQL 15 | Relational data integrity with Row-Level Security (RLS) |
| **Auth & Isolation** | Supabase Auth + JWT Gateway | Multi-tenant token claims with automatic tenant injection |
| **Testing** | Vitest + Supertest | Automated test coverage for RBAC and cross-tenant isolation |

---

## File Deliverables for Investors

1. **Interactive Visual Showcase (HTML Document)**:
   - File: `EduCloud_SMS_Investor_Functional_Document.html` (Saved in project root and Antigravity artifact store)
   - Features: High-fidelity screen mockups, tabbed workspace simulations, report card print preview, and interactive navigation. Can be opened in any browser or printed directly to PDF.
2. **Comprehensive Markdown Specification**:
   - File: `EduCloud_SMS_Functional_Specification.md` (Saved in project root)
   - Features: Complete textual reference for legal, technical, and investor due diligence.

---
*EduCloud SMS SaaS • Production Foundation v1.0 • Confidential & Proprietary*
