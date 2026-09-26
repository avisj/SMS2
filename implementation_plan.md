# Implementation Plan: People / User Management & Masters

Building the comprehensive **People / User Management & Masters** module for the multi-tenant School Management System SaaS. This layer builds directly on top of the established universal `users` foundation, strict tenant isolation, dynamic RBAC, and multitasking workspace.

## User Review Required

> [!IMPORTANT]
> **Universal User Model Preservation**:
> In strict accordance with the system architecture:
> - **There is ONLY ONE `users` table**. Students, Teachers, Staff, Admins, Directors, and Parents all live in `users`.
> - `Students Master` and `Staff Master` are **specialized operational views** querying `users` filtered by user classification, hydrated with academic details (`student_profiles`) or employment details (`staff_profiles`).
> - No student identity data or staff identity data is duplicated.
> - `user_type` remains purely a categorization/filtering tag; authorization continues to use dynamic `User -> Roles -> Permissions -> Data Scope`.

> [!IMPORTANT]
> **Zero Hardcoded Business Configuration**:
> - Designations, Categories, Subcategories, Tags, Labels, Classes, Sections, Houses, Streams, and Mediums are 100% database-driven.
> - Default demonstration taxonomies are seeded via database migration, never hardcoded in application logic.

---

## Proposed Database Schema Extensions (`005_people_masters.sql`)

### 1. Master Entities (School Tenant Scoped)
- **`designations`**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE`
  - `code VARCHAR(50) NOT NULL`
  - `name VARCHAR(100) NOT NULL`
  - `description TEXT`
  - `display_order INT DEFAULT 0`
  - `status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `deleted_at TIMESTAMPTZ NULL`
  - `CONSTRAINT uq_school_designation UNIQUE(school_id, code)`

- **`user_categories` & `user_subcategories`**:
  - `user_categories`: `id`, `school_id`, `code`, `name`, `description`, `status`, `created_at`, `updated_at`, `deleted_at`
  - `user_subcategories`: `id`, `school_id`, `category_id REFERENCES user_categories(id)`, `code`, `name`, `description`, `status`, `created_at`, `updated_at`, `deleted_at`

- **`user_tags` & `user_labels`**:
  - `user_tags`: `id`, `school_id`, `name`, `code`, `color VARCHAR(20) DEFAULT '#0d9488'`, `status`, `created_at`, `updated_at`
  - `user_labels`: `id`, `school_id`, `name`, `code`, `color VARCHAR(20) DEFAULT '#4f46e5'`, `status`, `created_at`, `updated_at`

### 2. Many-to-Many Taxonomy Mappings
- `user_category_assignments` (`id`, `user_id`, `category_id`, `assigned_at`)
- `user_subcategory_assignments` (`id`, `user_id`, `subcategory_id`, `assigned_at`)
- `user_tag_assignments` (`id`, `user_id`, `tag_id`, `assigned_at`)
- `user_label_assignments` (`id`, `user_id`, `label_id`, `assigned_at`)

### 3. Specialized Domain Extension Tables (Linked to `users.id`)
- **`student_profiles`**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE`
  - `admission_number VARCHAR(50) NOT NULL`
  - `admission_date DATE`
  - `roll_number VARCHAR(30)`
  - `academic_session VARCHAR(50)`
  - `class_name VARCHAR(50)`
  - `section_name VARCHAR(50)`
  - `house VARCHAR(50)`
  - `stream VARCHAR(50)`
  - `medium VARCHAR(50)`
  - `blood_group VARCHAR(10)`
  - `emergency_contact_name VARCHAR(100)`
  - `emergency_contact_phone VARCHAR(50)`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - `CONSTRAINT uq_school_admission_number UNIQUE(school_id, admission_number)`

- **`staff_profiles`**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE`
  - `employee_code VARCHAR(50) NOT NULL`
  - `designation_id UUID REFERENCES designations(id)`
  - `department VARCHAR(100)`
  - `joining_date DATE`
  - `qualification VARCHAR(150)`
  - `experience_years INT DEFAULT 0`
  - `emergency_contact_name VARCHAR(100)`
  - `emergency_contact_phone VARCHAR(50)`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - `CONSTRAINT uq_school_employee_code UNIQUE(school_id, employee_code)`

- **`parent_student_relationships`**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE`
  - `parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `relationship_type VARCHAR(50) NOT NULL` -- e.g. FATHER, MOTHER, GUARDIAN
  - `is_emergency_contact BOOLEAN DEFAULT TRUE`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `CONSTRAINT uq_parent_student UNIQUE(parent_user_id, student_user_id)`

---

## Backend Architecture & API Contracts

### 1. Repositories
- **`taxonomy.repository.ts`**: Handles CRUD for designations, categories, subcategories, tags, labels, and their user assignments.
- **`user.repository.ts`**: Enhanced to hydrate taxonomy tags, labels, categories, designation, student profile, staff profile, and parent relationships.
- **`people.repository.ts`**: Specialized query methods for `findStudents` and `findStaff` querying the universal `users` collection.

### 2. Services
- **`people.service.ts`**:
  - User management with taxonomy assignments (categories, tags, labels).
  - Student specialized queries, admission creation, and academic updates.
  - Staff specialized queries, employee onboarding, and designation updates.
  - Comprehensive user profile aggregation (basic info, contact, roles, branch access, taxonomy, academic/staff extensions, audit history).

### 3. REST API Routes (`/api/v1/people/...`)
- `/api/v1/people/designations` (GET, POST, PUT, DELETE)
- `/api/v1/people/categories` (GET, POST, PUT, DELETE)
- `/api/v1/people/subcategories` (GET, POST, PUT, DELETE)
- `/api/v1/people/tags` (GET, POST, PUT, DELETE)
- `/api/v1/people/labels` (GET, POST, PUT, DELETE)
- `/api/v1/people/students` (GET with academic filters, POST to create student)
- `/api/v1/people/staff` (GET with staff/designation filters, POST to create staff)
- `/api/v1/people/users/:id/profile` (GET comprehensive multi-dimension profile)
- `/api/v1/people/users/:id/taxonomy` (PUT assign/update categories, tags, labels)

---

## Frontend UI Architecture & Screens

### 1. Navigation & Workspace Integration
- Update `Sidebar.tsx` to include an organized **"People & Directory"** section:
  - **Users Master** (`users`) - Full universal directory with tags/labels/categories
  - **Students Master** (`students`) - Specialized student view with academic filters (Class, Section, House, Stream, Medium, Roll No)
  - **Staff Master** (`staff`) - Specialized staff view with designation & department filters
  - **Designation Master** (`designations`) - School designation management
  - **Taxonomy Masters** (`taxonomy`) - Management of Categories, Subcategories, Tags, and Labels
- All screens open within the **Multitasking Workspace** (up to 8 open tabs) with state preservation (filters, search, pagination).

### 2. User Profile Drawer (`UserProfileDrawer.tsx`)
- Slide-over drawer accessible from any user card or row across Users, Students, and Staff masters:
  - **Header**: Profile photo/initials, full name, username, dynamic user type badge, status indicator.
  - **Tabs/Sections**:
    1. **Overview & Contact**: Email, phone, address, gender, blood group, emergency contact.
    2. **Roles & Security**: Assigned roles, effective permissions count, primary & permitted branch locations.
    3. **Taxonomy & Tags**: Assigned categories, subcategories, custom tags, and color-coded labels with inline assignment editor.
    4. **Academic Profile** (active if student): Admission number, date, roll number, academic session, class, section, house, stream, medium.
    5. **Employment Profile** (active if staff/teacher): Employee code, designation, department, qualification, experience, joining date.
    6. **Family & Relations** (if parent or student): Linked children or linked parents.
    7. **Audit Log**: Chronological trail of user mutations.

---

## Verification Plan

### Automated Backend Tests
- Create `tests/people-management.test.ts`:
  1. Verify universal `users` table integrity: creating a student creates a row in `users` with an attached `student_profiles` row.
  2. Verify `Students Master` query returns only students with academic data, and `Staff Master` query returns only staff with designation data.
  3. Verify Designations, Categories, Subcategories, Tags, and Labels are tenant-scoped and isolated.
  4. Verify Cross-Tenant Access: School A cannot see or assign School B's designations or categories.
  5. Verify many-to-many tag and category assignments to users.
  6. Verify audit logging captures designation, category, and profile mutations.

### Manual & Interactive Verification
- Launch both servers via `./start.sh`.
- Test Users Master: Search, filter by category/tag/branch, create user, open profile drawer.
- Test Students Master: Filter by class/section, add student with admission details, view academic card.
- Test Staff Master: Filter by designation, add teacher/staff, view employment card.
- Test Designation Master: Create custom school designation, assign to staff member.
- Test Taxonomy Masters: Create custom category, subcategory, tag, label, and tag a user.
- Test Multitasking Workspace: Open Users, Students, Staff, and Designations as separate tabs; verify search/filter states are preserved when switching tabs.
