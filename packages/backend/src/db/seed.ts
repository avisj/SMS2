// ========================================================================
// Seed Engine
// Loads default data scopes, permissions, system roles, and demo tenants
// ZERO hardcoded business logic - all loaded into DB relational tables
// ========================================================================

import { getMemoryDbClient } from './client.js';
import { hashPassword } from '../utils/password.js';

export function seedInMemoryDatabase() {
  const mem = getMemoryDbClient();

  // 1. Data Scopes
  const scopes = [
    { id: '10000000-0000-0000-0000-000000000001', code: 'ALL_SCHOOLS', name: 'All Schools', description: 'Platform-wide access', hierarchy_level: 100 },
    { id: '10000000-0000-0000-0000-000000000002', code: 'ALL_LOCATIONS', name: 'All Locations', description: 'All branches within school', hierarchy_level: 80 },
    { id: '10000000-0000-0000-0000-000000000003', code: 'SELECTED_LOCATIONS', name: 'Selected Locations', description: 'Assigned branches only', hierarchy_level: 60 },
    { id: '10000000-0000-0000-0000-000000000004', code: 'ONE_LOCATION', name: 'Primary Location Only', description: 'Single primary branch only', hierarchy_level: 40 },
    { id: '10000000-0000-0000-0000-000000000005', code: 'ALL_CLASSES', name: 'All Classes', description: 'All academic classes', hierarchy_level: 30 },
    { id: '10000000-0000-0000-0000-000000000006', code: 'SELECTED_CLASSES', name: 'Selected Classes', description: 'Assigned academic classes', hierarchy_level: 20 },
    { id: '10000000-0000-0000-0000-000000000007', code: 'ASSIGNED_CLASSES', name: 'Assigned Classes', description: 'Classes where user is assigned teacher', hierarchy_level: 15 },
    { id: '10000000-0000-0000-0000-000000000008', code: 'OWN_RECORD', name: 'Own Record', description: 'Own record only', hierarchy_level: 5 },
    { id: '10000000-0000-0000-0000-000000000009', code: 'OWN_CHILDREN', name: 'Own Children', description: 'Linked children only', hierarchy_level: 5 },
  ];
  for (const s of scopes) mem.insert('data_scopes', s);

  // 2. User Types (System defaults)
  const userTypes = [
    { id: '20000000-0000-0000-0000-000000000001', school_id: null, code: 'SUPER_ADMIN', name: 'SaaS Super Admin', description: 'Platform operator administrator', numeric_id: 2, is_system: true, is_active: true },
    { id: '20000000-0000-0000-0000-000000000002', school_id: null, code: 'DIRECTOR', name: 'School Director', description: 'Executive leadership of school tenant', numeric_id: 2, is_system: true, is_active: true },
    { id: '20000000-0000-0000-0000-000000000003', school_id: null, code: 'ADMIN', name: 'Administrator', description: 'School/branch operations administrator', numeric_id: 2, is_system: true, is_active: true },
    { id: '20000000-0000-0000-0000-000000000004', school_id: null, code: 'TEACHER', name: 'Teacher / Faculty', description: 'Academic teaching staff', numeric_id: 2, is_system: true, is_active: true },
    { id: '20000000-0000-0000-0000-000000000005', school_id: null, code: 'STAFF', name: 'Non-Teaching Staff', description: 'Operational support staff', numeric_id: 2, is_system: true, is_active: true },
    { id: '20000000-0000-0000-0000-000000000006', school_id: null, code: 'STUDENT', name: 'Student', description: 'Enrolled student learner', numeric_id: 1, is_system: true, is_active: true },
    { id: '20000000-0000-0000-0000-000000000007', school_id: null, code: 'PARENT', name: 'Parent / Guardian', description: 'Parent or guardian of student', numeric_id: 3, is_system: true, is_active: true },
    { id: '20000000-0000-0000-0000-000000000008', school_id: null, code: 'OTHER', name: 'Other / External', description: 'External auditors/guests', numeric_id: 4, is_system: true, is_active: true },
  ];
  for (const ut of userTypes) mem.insert('user_types', ut);

  // 2b. Numeric User Type Master (Stable Numeric Classification for Filtering & Population)
  const userTypeMaster = [
    { id: 1, type_code: 'STUDENT', type_name: 'Student', description: 'Enrolled learner in academic sessions', is_active: true },
    { id: 2, type_code: 'STAFF', type_name: 'Staff', description: 'Academic faculty, administrative, and operational staff', is_active: true },
    { id: 3, type_code: 'PARENT', type_name: 'Parent / Guardian', description: 'Parent or guardian of enrolled students', is_active: true },
    { id: 4, type_code: 'OTHER', type_name: 'Other / External', description: 'External affiliates, drivers, and guests', is_active: true },
  ];
  for (const utm of userTypeMaster) mem.insert('user_type_master', utm);

  // 3. Permissions
  const permissions = [
    { id: '30000000-0000-0000-0000-000000000001', module: 'schools', action: 'view', code: 'schools.view', name: 'View Schools', description: 'View schools list and profiles', default_scope_id: scopes[0].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000002', module: 'schools', action: 'manage', code: 'schools.manage', name: 'Manage Schools', description: 'Create and edit schools', default_scope_id: scopes[0].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000003', module: 'locations', action: 'view', code: 'locations.view', name: 'View Locations', description: 'View branch locations', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000004', module: 'locations', action: 'manage', code: 'locations.manage', name: 'Manage Locations', description: 'Create and edit branch locations', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000005', module: 'users', action: 'view', code: 'users.view', name: 'View Users', description: 'View user directory', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000006', module: 'users', action: 'create', code: 'users.create', name: 'Create Users', description: 'Add new users', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000007', module: 'users', action: 'update', code: 'users.update', name: 'Update Users', description: 'Edit user profile and status', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000008', module: 'users', action: 'delete', code: 'users.delete', name: 'Archive Users', description: 'Soft-delete users', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000009', module: 'users', action: 'assign_roles', code: 'users.assign_roles', name: 'Assign Roles', description: 'Assign roles to user', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000010', module: 'users', action: 'assign_locations', code: 'users.assign_locations', name: 'Assign Locations', description: 'Assign branches to user', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000011', module: 'roles', action: 'view', code: 'roles.view', name: 'View Roles', description: 'View roles and permissions', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000012', module: 'roles', action: 'manage', code: 'roles.manage', name: 'Manage Roles', description: 'Create and configure roles', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000013', module: 'settings', action: 'view', code: 'settings.view', name: 'View Settings', description: 'View school settings', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000014', module: 'settings', action: 'manage', code: 'settings.manage', name: 'Manage Settings', description: 'Update school settings', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000015', module: 'features', action: 'view', code: 'features.view', name: 'View Features', description: 'View enabled features', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000016', module: 'features', action: 'manage', code: 'features.manage', name: 'Manage Features', description: 'Configure school features', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000017', module: 'audit', action: 'view', code: 'audit.view', name: 'View Audit Logs', description: 'View audit logs', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000018', module: 'audit', action: 'export', code: 'audit.export', name: 'Export Audit Logs', description: 'Export audit logs', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000019', module: 'academics', action: 'view', code: 'academics.view', name: 'View Academics', description: 'View classes and sessions', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000020', module: 'academics', action: 'manage', code: 'academics.manage', name: 'Manage Academics', description: 'Configure classes and sessions', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000021', module: 'academic_sessions', action: 'view', code: 'academic_sessions.view', name: 'View Academic Sessions', description: 'View academic session cycles', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000022', module: 'academic_sessions', action: 'manage', code: 'academic_sessions.manage', name: 'Manage Academic Sessions', description: 'Create and configure academic sessions', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000023', module: 'classes', action: 'view', code: 'classes.view', name: 'View Classes', description: 'View school classes', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000024', module: 'classes', action: 'manage', code: 'classes.manage', name: 'Manage Classes', description: 'Create and configure classes', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000025', module: 'sections', action: 'view', code: 'sections.view', name: 'View Sections', description: 'View school sections', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000026', module: 'sections', action: 'manage', code: 'sections.manage', name: 'Manage Sections', description: 'Create and configure sections', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000027', module: 'subjects', action: 'view', code: 'subjects.view', name: 'View Subjects', description: 'View subjects catalogue', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000028', module: 'subjects', action: 'manage', code: 'subjects.manage', name: 'Manage Subjects', description: 'Create and configure subjects', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000029', module: 'subject_groups', action: 'view', code: 'subject_groups.view', name: 'View Subject Groups', description: 'View subject groups', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000030', module: 'subject_groups', action: 'manage', code: 'subject_groups.manage', name: 'Manage Subject Groups', description: 'Create and configure subject groups', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000031', module: 'class_subjects', action: 'manage', code: 'class_subjects.manage', name: 'Manage Class Subjects', description: 'Configure class subject offerings', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000032', module: 'students', action: 'class_assign', code: 'students.class_assign', name: 'Student Class Assignment', description: 'Assign students to class and sections', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000033', module: 'teacher_assignments', action: 'view', code: 'teacher_assignments.view', name: 'View Teacher Assignments', description: 'View teaching allocation', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000034', module: 'teacher_assignments', action: 'manage', code: 'teacher_assignments.manage', name: 'Manage Teacher Assignments', description: 'Assign teachers to classes and subjects', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000035', module: 'users', action: 'manage_login', code: 'users.manage_login', name: 'Manage User Login Access', description: 'Create, enable, disable login credentials and reset passwords', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000036', module: 'rights', action: 'view', code: 'rights.view', name: 'View Rights Catalog', description: 'View system permissions and rights', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000037', module: 'rights', action: 'manage', code: 'rights.manage', name: 'Manage Rights', description: 'Assign rights to roles', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000038', module: 'user_roles', action: 'view', code: 'user_roles.view', name: 'View User Roles', description: 'View user role assignments', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000039', module: 'user_roles', action: 'manage', code: 'user_roles.manage', name: 'Manage User Roles', description: 'Assign roles to users', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000040', module: 'access_scope', action: 'view', code: 'access_scope.view', name: 'View Access Scope', description: 'View location access scopes', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000041', module: 'access_scope', action: 'manage', code: 'access_scope.manage', name: 'Manage Access Scope', description: 'Configure location access scopes', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000042', module: 'parents', action: 'view', code: 'parents.view', name: 'View Parents', description: 'View parents and guardian records', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000043', module: 'parents', action: 'manage', code: 'parents.manage', name: 'Manage Parents', description: 'Create parents and link students', default_scope_id: scopes[1].id, is_system: true },

    // Transport Rights Master (Section 3: Dedicated Transport Capabilities)
    { id: '30000000-0000-0000-0000-000000000060', module: 'transport', action: 'view', code: 'transport.dashboard.view', name: 'View Transport Dashboard', description: 'View fleet KPIs, vehicle metrics and compliance alerts', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000061', module: 'transport', action: 'view', code: 'transport.vehicle.view', name: 'View Vehicles', description: 'View school fleet vehicles list and details', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000062', module: 'transport', action: 'create', code: 'transport.vehicle.create', name: 'Register Vehicle', description: 'Register new transport fleet vehicles', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000063', module: 'transport', action: 'update', code: 'transport.vehicle.update', name: 'Update Vehicle', description: 'Modify vehicle information and maintenance status', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000064', module: 'transport', action: 'delete', code: 'transport.vehicle.delete', name: 'Delete Vehicle', description: 'Retire or delete fleet vehicles', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000065', module: 'transport', action: 'view', code: 'transport.driver.view', name: 'View Drivers', description: 'View eligible transport drivers and staff', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000066', module: 'transport', action: 'assign', code: 'transport.driver.assign', name: 'Assign Driver', description: 'Assign primary/secondary drivers to vehicles', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000067', module: 'transport', action: 'view', code: 'transport.route.view', name: 'View Routes', description: 'View transport routes and itineraries', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000068', module: 'transport', action: 'create', code: 'transport.route.create', name: 'Create Route', description: 'Create new transport routes', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000069', module: 'transport', action: 'update', code: 'transport.route.update', name: 'Update Route', description: 'Edit existing transport routes and parameters', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000070', module: 'transport', action: 'delete', code: 'transport.route.delete', name: 'Delete Route', description: 'Deactivate or delete transport routes', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000071', module: 'transport', action: 'view', code: 'transport.route_stops.view', name: 'View Route Stops', description: 'View route pickup and drop stop itineraries', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000072', module: 'transport', action: 'manage', code: 'transport.route_stops.manage', name: 'Manage Route Stops', description: 'Add, edit, reorder, and remove route stops', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000073', module: 'transport', action: 'view', code: 'transport.student_assignment.view', name: 'View Student Transport', description: 'View student route assignments and manifests', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000074', module: 'transport', action: 'create', code: 'transport.student_assignment.create', name: 'Assign Student Transport', description: 'Assign enrolled students to transport routes and stops', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000075', module: 'transport', action: 'update', code: 'transport.student_assignment.update', name: 'Update Student Transport', description: 'Transfer or end student transport assignments', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000076', module: 'transport', action: 'delete', code: 'transport.student_assignment.delete', name: 'Delete Student Transport', description: 'Remove student transport assignments', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000077', module: 'transport', action: 'view', code: 'transport.trip.view', name: 'View Daily Trips', description: 'View daily scheduled and completed transport trips', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000078', module: 'transport', action: 'manage', code: 'transport.trip.manage', name: 'Manage Daily Trips', description: 'Dispatch, start, complete, and cancel transport trips', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000079', module: 'transport', action: 'view', code: 'transport.gps.view', name: 'View GPS Tracking', description: 'View vehicle telemetry and real-time GPS tracking', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000080', module: 'transport', action: 'view', code: 'transport.reports.view', name: 'View Transport Reports', description: 'View and export fleet utilization, manifests, and audit reports', default_scope_id: scopes[1].id, is_system: true },
    // Inventory Module Rights
    { id: '30000000-0000-0000-0000-000000000090', module: 'inventory', action: 'view', code: 'inventory.dashboard.view', name: 'View Inventory Dashboard', description: 'View stock KPIs, valuation, and reorder metrics', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000091', module: 'inventory', action: 'view', code: 'inventory.product.view', name: 'View Products', description: 'View master product catalog', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000092', module: 'inventory', action: 'create', code: 'inventory.product.create', name: 'Create Product', description: 'Add new master product catalog definitions', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000093', module: 'inventory', action: 'update', code: 'inventory.product.update', name: 'Update Product', description: 'Edit product specifications and categories', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000094', module: 'inventory', action: 'delete', code: 'inventory.product.delete', name: 'Delete Product', description: 'Retire or delete products', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000095', module: 'inventory', action: 'view', code: 'inventory.sku.view', name: 'View SKUs', description: 'View inventory SKUs, barcodes and price points', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000096', module: 'inventory', action: 'create', code: 'inventory.sku.create', name: 'Create SKU', description: 'Define new stock keeping units', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000097', module: 'inventory', action: 'update', code: 'inventory.sku.update', name: 'Update SKU', description: 'Modify SKU pricing, barcode and parameters', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000098', module: 'inventory', action: 'delete', code: 'inventory.sku.delete', name: 'Delete SKU', description: 'Remove inventory SKUs', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000099', module: 'inventory', action: 'manage', code: 'inventory.taxonomy.manage', name: 'Manage Inventory Taxonomy', description: 'Manage Categories, Subcategories, UOMs, and Brands', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000100', module: 'inventory', action: 'manage', code: 'inventory.vendor.manage', name: 'Manage Vendors', description: 'Add, update and deactivate suppliers and vendors', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000101', module: 'inventory', action: 'view', code: 'inventory.stock.view', name: 'View Stock Balances', description: 'View real-time stock levels across branches', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000102', module: 'inventory', action: 'manage', code: 'inventory.stock.manage', name: 'Manage Stock Movements', description: 'Manage Opening Stock, Stock In, Stock Out, and Adjustments', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000103', module: 'inventory', action: 'view', code: 'inventory.ledger.view', name: 'View Stock Ledger', description: 'Inspect immutable audit trail of stock movements', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000104', module: 'inventory', action: 'view', code: 'inventory.purchase_order.view', name: 'View Purchase Orders', description: 'View POs, line items, and fulfillment history', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000105', module: 'inventory', action: 'manage', code: 'inventory.purchase_order.manage', name: 'Manage Purchase Orders', description: 'Create, approve, and receive PO shipments', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000106', module: 'inventory', action: 'view', code: 'inventory.sales_order.view', name: 'View Sales Orders', description: 'View SOs, requisitions, and fulfillment history', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000107', module: 'inventory', action: 'manage', code: 'inventory.sales_order.manage', name: 'Manage Sales Orders', description: 'Create, confirm, and fulfill student/staff sales orders', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000108', module: 'inventory', action: 'view', code: 'inventory.reports.view', name: 'View Inventory Reports', description: 'Generate stock valuation, movement and reorder reports', default_scope_id: scopes[1].id, is_system: true },
    // Asset Management Module Rights
    { id: '30000000-0000-0000-0000-000000000120', module: 'assets', action: 'view', code: 'assets.dashboard.view', name: 'View Asset Dashboard', description: 'View physical asset metrics and KPI breakdowns', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000121', module: 'assets', action: 'view', code: 'assets.master.view', name: 'View Asset Master', description: 'View physical asset register, codes, barcodes and tags', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000122', module: 'assets', action: 'manage', code: 'assets.master.manage', name: 'Manage Assets', description: 'Create and update school-owned physical assets', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000123', module: 'assets', action: 'manage', code: 'assets.category.manage', name: 'Manage Asset Categories', description: 'Create and manage asset categories and subcategories', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000124', module: 'assets', action: 'manage', code: 'assets.assignment.manage', name: 'Manage Asset Assignment', description: 'Assign assets to teachers, students, staff and log returns', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000125', module: 'assets', action: 'manage', code: 'assets.movement.manage', name: 'Manage Asset Movement', description: 'Transfer assets across campus branches and rooms', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000126', module: 'assets', action: 'manage', code: 'assets.maintenance.manage', name: 'Manage Asset Maintenance', description: 'Log repairs, servicing, and warranty claims', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000127', module: 'assets', action: 'manage', code: 'assets.disposal.manage', name: 'Manage Asset Disposal', description: 'Authorize and execute asset write-offs and disposals', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000128', module: 'assets', action: 'view', code: 'assets.reports.view', name: 'View Asset Reports', description: 'Generate asset register, valuation, and warranty reports', default_scope_id: scopes[1].id, is_system: true },
    // Library Management Module Rights
    { id: '30000000-0000-0000-0000-000000000140', module: 'library', action: 'view', code: 'library.dashboard.view', name: 'View Library Dashboard', description: 'View library metrics, circulation, and overdue stats', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000141', module: 'library', action: 'view', code: 'library.books.view', name: 'View Books and Catalog', description: 'Browse and search library books and physical copies', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000142', module: 'library', action: 'manage', code: 'library.books.manage', name: 'Manage Books and Authors', description: 'Create and update books, authors, publishers, categories', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000143', module: 'library', action: 'manage', code: 'library.copies.manage', name: 'Manage Book Copies', description: 'Add, edit, barcode physical book copies and manage status', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000144', module: 'library', action: 'manage', code: 'library.members.manage', name: 'Manage Library Members', description: 'Enroll members and configure borrowing privileges', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000145', module: 'library', action: 'manage', code: 'library.issue.manage', name: 'Issue and Return Books', description: 'Check-out books, process returns and renew loans', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000146', module: 'library', action: 'manage', code: 'library.reservation.manage', name: 'Manage Reservations', description: 'Queue and fulfill book reservations', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000147', module: 'library', action: 'manage', code: 'library.fines.manage', name: 'Manage Fines and Payments', description: 'Collect, adjust, and waive overdue fines', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000148', module: 'library', action: 'view', code: 'library.reports.view', name: 'View Library Reports', description: 'View circulation registers, overdue lists, and inventory reports', default_scope_id: scopes[1].id, is_system: true },
    { id: '30000000-0000-0000-0000-000000000149', module: 'library', action: 'manage', code: 'library.settings.manage', name: 'Manage Library Settings', description: 'Configure loan rules, fines, and issue limits', default_scope_id: scopes[1].id, is_system: true },
  ];
  for (const p of permissions) mem.insert('permissions', p);

  // 4. System Roles
  const roles = [
    { id: '40000000-0000-0000-0000-000000000001', school_id: null, code: 'SUPER_ADMIN', name: 'Platform Super Admin', description: 'Full platform SaaS governance', is_system: true, is_active: true },
    { id: '40000000-0000-0000-0000-000000000002', school_id: null, code: 'SCHOOL_DIRECTOR', name: 'School Director', description: 'Director authority across all branches', is_system: true, is_active: true },
    { id: '40000000-0000-0000-0000-000000000003', school_id: null, code: 'SCHOOL_ADMIN', name: 'School Administrator', description: 'Operational administration across branches', is_system: true, is_active: true },
    { id: '40000000-0000-0000-0000-000000000004', school_id: null, code: 'BRANCH_ADMIN', name: 'Branch Administrator', description: 'Management of single branch', is_system: true, is_active: true },
    { id: '40000000-0000-0000-0000-000000000005', school_id: null, code: 'TEACHER', name: 'Teacher', description: 'Faculty classroom access', is_system: true, is_active: true },
    { id: '40000000-0000-0000-0000-000000000006', school_id: null, code: 'STAFF', name: 'Staff Member', description: 'Operational staff', is_system: true, is_active: true },
    { id: '40000000-0000-0000-0000-000000000007', school_id: null, code: 'STUDENT', name: 'Student', description: 'Student self access', is_system: true, is_active: true },
    { id: '40000000-0000-0000-0000-000000000008', school_id: null, code: 'PARENT', name: 'Parent / Guardian', description: 'Parent child access', is_system: true, is_active: true },
  ];
  for (const r of roles) mem.insert('roles', r);

  // 5. Role Permissions
  // Super Admin gets all permissions with ALL_SCHOOLS scope
  for (const p of permissions) {
    mem.insert('role_permissions', {
      role_id: roles[0].id,
      permission_id: p.id,
      data_scope_id: scopes[0].id,
      school_id: null,
    });
  }

  // School Director gets all except schools.manage with ALL_LOCATIONS scope
  for (const p of permissions) {
    if (p.code !== 'schools.manage') {
      mem.insert('role_permissions', {
        role_id: roles[1].id,
        permission_id: p.id,
        data_scope_id: scopes[1].id,
        school_id: null,
      });
    }
  }

  // School Admin gets operational and academic permissions with ALL_LOCATIONS scope
  const schoolAdminPermCodes = [
    'locations.view', 'users.view', 'users.create', 'users.update', 'users.assign_roles', 'users.manage_login',
    'roles.view', 'rights.view', 'user_roles.view', 'user_roles.manage', 'access_scope.view', 'access_scope.manage',
    'settings.view', 'features.view', 'audit.view', 'academics.view', 'academics.manage',
    'academic_sessions.view', 'academic_sessions.manage', 'classes.view', 'classes.manage',
    'sections.view', 'sections.manage', 'subjects.view', 'subjects.manage',
    'subject_groups.view', 'subject_groups.manage', 'class_subjects.manage',
    'students.class_assign', 'teacher_assignments.view', 'teacher_assignments.manage',
    // Transport Module Rights
    'transport.dashboard.view', 'transport.vehicle.view', 'transport.vehicle.create', 'transport.vehicle.update',
    'transport.driver.view', 'transport.driver.assign', 'transport.route.view', 'transport.route.create',
    'transport.route.update', 'transport.route_stops.view', 'transport.route_stops.manage',
    'transport.student_assignment.view', 'transport.student_assignment.create', 'transport.student_assignment.update',
    'transport.trip.view', 'transport.trip.manage', 'transport.gps.view', 'transport.reports.view',
    // Inventory Module Rights
    'inventory.dashboard.view', 'inventory.product.view', 'inventory.product.create', 'inventory.product.update', 'inventory.product.delete',
    'inventory.sku.view', 'inventory.sku.create', 'inventory.sku.update', 'inventory.sku.delete',
    'inventory.taxonomy.manage', 'inventory.vendor.manage', 'inventory.stock.view', 'inventory.stock.manage',
    'inventory.ledger.view', 'inventory.purchase_order.view', 'inventory.purchase_order.manage',
    'inventory.sales_order.view', 'inventory.sales_order.manage', 'inventory.reports.view',
    // Asset Management Module Rights
    'assets.dashboard.view', 'assets.master.view', 'assets.master.manage', 'assets.category.manage',
    'assets.assignment.manage', 'assets.movement.manage', 'assets.maintenance.manage',
    'assets.disposal.manage', 'assets.reports.view',
    // Library Management Module Rights
    'library.dashboard.view', 'library.books.view', 'library.books.manage', 'library.copies.manage',
    'library.members.manage', 'library.issue.manage', 'library.reservation.manage',
    'library.fines.manage', 'library.reports.view', 'library.settings.manage'
  ];
  for (const p of permissions.filter(x => schoolAdminPermCodes.includes(x.code))) {
    mem.insert('role_permissions', {
      role_id: roles[2].id,
      permission_id: p.id,
      data_scope_id: scopes[1].id,
      school_id: null,
    });
  }

  // Branch Admin gets branch-scoped permissions with ONE_LOCATION scope
  const branchAdminPermCodes = [
    'locations.view', 'users.view', 'users.create', 'users.update', 'users.assign_roles',
    'roles.view', 'audit.view', 'academics.view',
    'academic_sessions.view', 'classes.view', 'sections.view', 'subjects.view', 'subject_groups.view',
    'students.class_assign', 'teacher_assignments.view', 'teacher_assignments.manage',
    // Asset Module Rights for Branch Admin
    'assets.dashboard.view', 'assets.master.view', 'assets.master.manage',
    'assets.assignment.manage', 'assets.movement.manage', 'assets.maintenance.manage', 'assets.reports.view',
    // Library Module Rights for Branch Admin
    'library.dashboard.view', 'library.books.view', 'library.books.manage', 'library.copies.manage',
    'library.members.manage', 'library.issue.manage', 'library.reservation.manage',
    'library.fines.manage', 'library.reports.view'
  ];
  for (const p of permissions.filter(x => branchAdminPermCodes.includes(x.code))) {
    mem.insert('role_permissions', {
      role_id: roles[3].id,
      permission_id: p.id,
      data_scope_id: scopes[3].id,
      school_id: null,
    });
  }

  // Teacher gets classroom scoped permissions with ASSIGNED_CLASSES scope (view only)
  const teacherPermCodes = [
    'users.view', 'academics.view', 'classes.view', 'sections.view', 'subjects.view',
    'teacher_assignments.view'
  ];
  for (const p of permissions.filter(x => teacherPermCodes.includes(x.code))) {
    mem.insert('role_permissions', {
      role_id: roles[4].id,
      permission_id: p.id,
      data_scope_id: scopes[6].id,
      school_id: null,
    });
  }

  // 6. Platform Settings & Platform Features
  const platformSettings = [
    { id: crypto.randomUUID(), key: 'platform_name', value: 'EduCloud SMS SaaS', data_type: 'STRING', description: 'Platform brand name', is_public: true },
    { id: crypto.randomUUID(), key: 'support_email', value: 'support@educloud.io', data_type: 'STRING', description: 'Primary support email', is_public: true },
    { id: crypto.randomUUID(), key: 'maintenance_mode', value: 'false', data_type: 'BOOLEAN', description: 'Maintenance mode toggle', is_public: true },
  ];
  for (const ps of platformSettings) mem.insert('platform_settings', ps);

  const platformFeatures = [
    { id: crypto.randomUUID(), feature_key: 'online_admissions', name: 'Online Admissions', category: 'ACADEMIC', is_enabled: true, plan_tier: 'STANDARD' },
    { id: crypto.randomUUID(), feature_key: 'fee_management', name: 'Fee Management & Online Pay', category: 'FINANCE', is_enabled: true, plan_tier: 'STANDARD' },
    { id: crypto.randomUUID(), feature_key: 'attendance', name: 'Attendance Management', category: 'OPERATIONS', is_enabled: true, plan_tier: 'STANDARD' },
    { id: crypto.randomUUID(), feature_key: 'homework', name: 'Homework Module', category: 'ACADEMIC', is_enabled: true, plan_tier: 'STANDARD' },
    { id: crypto.randomUUID(), feature_key: 'assignments', name: 'Graded Assignments', category: 'ACADEMIC', is_enabled: true, plan_tier: 'STANDARD' },
    { id: crypto.randomUUID(), feature_key: 'examinations', name: 'Examinations & Marks', category: 'ACADEMIC', is_enabled: true, plan_tier: 'PREMIUM' },
    { id: crypto.randomUUID(), feature_key: 'library', name: 'Library Management', category: 'OPERATIONS', is_enabled: true, plan_tier: 'PREMIUM' },
    { id: crypto.randomUUID(), feature_key: 'transport', name: 'Transport & Fleet', category: 'OPERATIONS', is_enabled: true, plan_tier: 'PREMIUM' },
    { id: crypto.randomUUID(), feature_key: 'notifications_whatsapp', name: 'WhatsApp Notifications', category: 'COMMUNICATION', is_enabled: true, plan_tier: 'ENTERPRISE' },
    { id: crypto.randomUUID(), feature_key: 'notifications_sms', name: 'SMS Gateway', category: 'COMMUNICATION', is_enabled: true, plan_tier: 'STANDARD' },
  ];
  for (const pf of platformFeatures) mem.insert('platform_features', pf);

  // 7. Demo Tenants (School A and School B)
  const schoolA = {
    id: 'a0000000-0000-0000-0000-000000000001',
    school_code: 'DPA',
    school_name: 'Delhi Public Academy',
    legal_name: 'Delhi Public Academy Educational Trust',
    email: 'contact@dpa.edu',
    phone: '+91 11 2899 4321',
    website: 'https://dpa.edu',
    address: 'Sector 14, Dwarka',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    status: 'ACTIVE',
  };
  mem.insert('schools', schoolA);

  const schoolB = {
    id: 'b0000000-0000-0000-0000-000000000001',
    school_code: 'GWI',
    school_name: 'Greenwood International School',
    legal_name: 'Greenwood Educational Foundation Ltd.',
    email: 'info@greenwood.edu',
    phone: '+91 22 4788 1200',
    website: 'https://greenwood.edu',
    address: 'Bandra Kurla Complex',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    status: 'ACTIVE',
  };
  mem.insert('schools', schoolB);

  // Locations for School A
  const locA1 = {
    id: 'a1000000-0000-0000-0000-000000000001',
    school_id: schoolA.id,
    location_code: 'DEL-MAIN',
    location_name: 'Dwarka Main Campus',
    school_id_code: 'DPA-DEL-001',
    address: 'Plot 4, Institutional Area, Sector 14, Dwarka',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110078',
    phone: '+91 11 2899 4321',
    email: 'dwarka@dpa.edu',
    status: 'ACTIVE',
  };
  const locA2 = {
    id: 'a1000000-0000-0000-0000-000000000002',
    school_id: schoolA.id,
    location_code: 'NOI-EXT',
    location_name: 'Noida Extension Campus',
    school_id_code: 'DPA-NOI-002',
    address: 'Knowledge Park V, Greater Noida West',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pincode: '201306',
    phone: '+91 120 6554 990',
    email: 'noida@dpa.edu',
    status: 'ACTIVE',
  };
  mem.insert('locations', locA1);
  mem.insert('locations', locA2);

  // Locations for School B
  const locB1 = {
    id: 'b1000000-0000-0000-0000-000000000001',
    school_id: schoolB.id,
    location_code: 'MUM-CEN',
    location_name: 'Bandra Central Campus',
    school_id_code: 'GWI-MUM-001',
    address: 'BKC Tech Enclave, G Block',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400051',
    phone: '+91 22 4788 1200',
    email: 'bkc@greenwood.edu',
    status: 'ACTIVE',
  };
  mem.insert('locations', locB1);

  // 8. Universal Users (Zero plaintext passwords in users table)
  // Super Admin for School A - Delhi Main Campus
  const uSuperA = {
    id: '90000000-0000-0000-0000-000000000001',
    auth_user_id: '90000000-0000-0000-0000-000000000001',
    school_id: schoolA.id,
    user_type_id: userTypes[0].id, // SUPER_ADMIN
    username: 'superadmin',
    email: 'superadmin.delhi@dpa.edu',
    phone: '+91 99999 00001',
    first_name: 'Delhi Campus',
    last_name: 'SuperAdmin',
    status: 'ACTIVE',
  };
  mem.insert('users', uSuperA);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uSuperA.id, role_id: roles[0].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uSuperA.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });

  // Super Admin for School B - Mumbai Central Campus
  const uSuperB = {
    id: '90000000-0000-0000-0000-000000000002',
    auth_user_id: '90000000-0000-0000-0000-000000000002',
    school_id: schoolB.id,
    user_type_id: userTypes[0].id, // SUPER_ADMIN
    username: 'superadmin',
    email: 'superadmin@greenwood.edu',
    phone: '+91 99999 00002',
    first_name: 'Mumbai Campus',
    last_name: 'SuperAdmin',
    status: 'ACTIVE',
  };
  mem.insert('users', uSuperB);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uSuperB.id, role_id: roles[0].id, school_id: schoolB.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uSuperB.id, location_id: locB1.id, school_id: schoolB.id, is_primary: true });

  // School A Director (Rajesh Sharma) - Multi-branch access: Delhi + Noida
  const uRajesh = {
    id: 'a2000000-0000-0000-0000-000000000001',
    auth_user_id: 'a2000000-0000-0000-0000-000000000001',
    school_id: schoolA.id,
    user_type_id: userTypes[1].id, // DIRECTOR
    username: 'rajesh.sharma',
    email: 'director@dpa.edu',
    phone: '+91 98100 12345',
    first_name: 'Rajesh',
    last_name: 'Sharma',
    status: 'ACTIVE',
  };
  mem.insert('users', uRajesh);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uRajesh.id, role_id: roles[1].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uRajesh.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uRajesh.id, location_id: locA2.id, school_id: schoolA.id, is_primary: false });

  // School A Branch Admin (Sunita Rao) - Delhi Main ONLY
  const uSunita = {
    id: 'a2000000-0000-0000-0000-000000000002',
    auth_user_id: 'a2000000-0000-0000-0000-000000000002',
    school_id: schoolA.id,
    user_type_id: userTypes[2].id, // ADMIN
    username: 'sunita.rao',
    email: 'admin.delhi@dpa.edu',
    phone: '+91 98100 23456',
    first_name: 'Sunita',
    last_name: 'Rao',
    status: 'ACTIVE',
  };
  mem.insert('users', uSunita);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uSunita.id, role_id: roles[3].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uSunita.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });

  // School A Teacher (Vikram Verma) - Teaches in both Delhi and Noida
  const uVikram = {
    id: 'a2000000-0000-0000-0000-000000000003',
    auth_user_id: 'a2000000-0000-0000-0000-000000000003',
    school_id: schoolA.id,
    user_type_id: userTypes[3].id, // TEACHER
    username: 'vikram.verma',
    email: 'vikram.verma@dpa.edu',
    phone: '+91 98100 34567',
    first_name: 'Vikram',
    last_name: 'Verma',
    status: 'ACTIVE',
  };
  mem.insert('users', uVikram);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uVikram.id, role_id: roles[4].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uVikram.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uVikram.id, location_id: locA2.id, school_id: schoolA.id, is_primary: false });

  // School A Dedicated Transport Driver (Ramesh Chandra)
  const uRameshDriver = {
    id: 'a2000000-0000-0000-0000-000000000099',
    auth_user_id: 'a2000000-0000-0000-0000-000000000099',
    school_id: schoolA.id,
    user_type_id: userTypes[4].id, // STAFF
    username: 'ramesh.driver',
    email: 'ramesh.driver@dpa.edu',
    phone: '+91 98101 23456',
    first_name: 'Ramesh',
    last_name: 'Chandra (Driver)',
    status: 'ACTIVE' as const,
  };
  mem.insert('users', uRameshDriver);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uRameshDriver.id, role_id: roles[5].id, school_id: schoolA.id }); // STAFF
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uRameshDriver.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });

  // Transport Driver Profile for Ramesh Chandra
  mem.insert('transport_driver_profiles', {
    id: 'ad000000-0000-0000-0000-000000000001',
    school_id: schoolA.id,
    user_id: uRameshDriver.id,
    driver_eligible: true,
    license_number: 'DL-04-2021-0091823',
    license_type: 'COMMERCIAL_HEAVY',
    license_expiry: '2030-05-31',
    contact_phone: '+91 98101 23456',
    status: 'ACTIVE',
    remarks: 'Certified heavy passenger vehicle driver for DPA fleet',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // School B Director (Anita Desai) - Greenwood International (Mumbai)
  const uAnita = {
    id: 'b2000000-0000-0000-0000-000000000001',
    auth_user_id: 'b2000000-0000-0000-0000-000000000001',
    school_id: schoolB.id,
    user_type_id: userTypes[1].id, // DIRECTOR
    username: 'anita.desai',
    email: 'director@greenwood.edu',
    phone: '+91 98200 45678',
    first_name: 'Anita',
    last_name: 'Desai',
    status: 'ACTIVE',
  };
  mem.insert('users', uAnita);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uAnita.id, role_id: roles[1].id, school_id: schoolB.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uAnita.id, location_id: locB1.id, school_id: schoolB.id, is_primary: true });

  // 9. Dedicated User Credentials (Secure Scrypt Hashes, School ID Scoped)
  const defaultPassHash = hashPassword('password123');

  // Super Admin for School ID: DPA-DEL-001
  mem.insert('user_credentials', {
    id: crypto.randomUUID(),
    user_id: uSuperA.id,
    school_id: schoolA.id,
    location_id: locA1.id,
    school_id_code: 'DPA-DEL-001',
    username: 'superadmin',
    password_hash: defaultPassHash,
    login_status: 'ACTIVE',
    is_super_admin: true,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Super Admin for School ID: DPA-NOI-002
  mem.insert('user_credentials', {
    id: crypto.randomUUID(),
    user_id: uSuperA.id,
    school_id: schoolA.id,
    location_id: locA2.id,
    school_id_code: 'DPA-NOI-002',
    username: 'superadmin',
    password_hash: defaultPassHash,
    login_status: 'ACTIVE',
    is_super_admin: true,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Super Admin for School ID: GWI-MUM-001
  mem.insert('user_credentials', {
    id: crypto.randomUUID(),
    user_id: uSuperB.id,
    school_id: schoolB.id,
    location_id: locB1.id,
    school_id_code: 'GWI-MUM-001',
    username: 'superadmin',
    password_hash: defaultPassHash,
    login_status: 'ACTIVE',
    is_super_admin: true,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Rajesh Sharma: Login credentials in both DPA-DEL-001 and DPA-NOI-002
  mem.insert('user_credentials', {
    id: crypto.randomUUID(),
    user_id: uRajesh.id,
    school_id: schoolA.id,
    location_id: locA1.id,
    school_id_code: 'DPA-DEL-001',
    username: 'rajesh.sharma',
    password_hash: defaultPassHash,
    login_status: 'ACTIVE',
    is_super_admin: false,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  mem.insert('user_credentials', {
    id: crypto.randomUUID(),
    user_id: uRajesh.id,
    school_id: schoolA.id,
    location_id: locA2.id,
    school_id_code: 'DPA-NOI-002',
    username: 'rajesh.sharma',
    password_hash: defaultPassHash,
    login_status: 'ACTIVE',
    is_super_admin: false,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Sunita Rao: Login credential in DPA-DEL-001 ONLY
  mem.insert('user_credentials', {
    id: crypto.randomUUID(),
    user_id: uSunita.id,
    school_id: schoolA.id,
    location_id: locA1.id,
    school_id_code: 'DPA-DEL-001',
    username: 'sunita.rao',
    password_hash: defaultPassHash,
    login_status: 'ACTIVE',
    is_super_admin: false,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Vikram Verma: Login credential in DPA-DEL-001
  mem.insert('user_credentials', {
    id: crypto.randomUUID(),
    user_id: uVikram.id,
    school_id: schoolA.id,
    location_id: locA1.id,
    school_id_code: 'DPA-DEL-001',
    username: 'vikram.verma',
    password_hash: defaultPassHash,
    login_status: 'ACTIVE',
    is_super_admin: false,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Anita Desai: Login credential in GWI-MUM-001 ONLY
  mem.insert('user_credentials', {
    id: crypto.randomUUID(),
    user_id: uAnita.id,
    school_id: schoolB.id,
    location_id: locB1.id,
    school_id_code: 'GWI-MUM-001',
    username: 'anita.desai',
    password_hash: defaultPassHash,
    login_status: 'ACTIVE',
    is_super_admin: false,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Features for School A
  mem.insert('school_features', { id: crypto.randomUUID(), school_id: schoolA.id, feature_key: 'online_admissions', is_enabled: true, configuration: { form_fee: 500 } });
  mem.insert('school_features', { id: crypto.randomUUID(), school_id: schoolA.id, feature_key: 'fee_management', is_enabled: true, configuration: { currency: 'INR', allow_online_partial: true } });
  mem.insert('school_features', { id: crypto.randomUUID(), school_id: schoolA.id, feature_key: 'attendance', is_enabled: true, configuration: { mode: 'DAILY_SUBJECT' } });
  mem.insert('school_features', { id: crypto.randomUUID(), school_id: schoolA.id, feature_key: 'homework', is_enabled: true, configuration: { max_file_size_mb: 15 } });
  mem.insert('school_features', { id: crypto.randomUUID(), school_id: schoolA.id, feature_key: 'examinations', is_enabled: true, configuration: { grading_system: 'CBSE_10_POINT' } });

  // Settings for School A
  mem.insert('school_settings', { id: crypto.randomUUID(), school_id: schoolA.id, setting_key: 'brand_color', setting_value: '#0d9488', category: 'BRANDING', data_type: 'STRING' });
  mem.insert('school_settings', { id: crypto.randomUUID(), school_id: schoolA.id, setting_key: 'academic_session_current', setting_value: '2026-2027', category: 'ACADEMIC', data_type: 'STRING' });
  mem.insert('school_settings', { id: crypto.randomUUID(), school_id: schoolA.id, setting_key: 'academic_session_start_month', setting_value: '4', category: 'ACADEMIC', data_type: 'NUMBER' });
  mem.insert('school_settings', { id: crypto.randomUUID(), school_id: schoolA.id, setting_key: 'academic_session_end_month', setting_value: '3', category: 'ACADEMIC', data_type: 'NUMBER' });
  mem.insert('school_settings', { id: crypto.randomUUID(), school_id: schoolB.id, setting_key: 'academic_session_start_month', setting_value: '4', category: 'ACADEMIC', data_type: 'NUMBER' });
  mem.insert('school_settings', { id: crypto.randomUUID(), school_id: schoolB.id, setting_key: 'academic_session_end_month', setting_value: '3', category: 'ACADEMIC', data_type: 'NUMBER' });
  mem.insert('school_settings', { id: crypto.randomUUID(), school_id: schoolA.id, setting_key: 'date_format', imperial: false, setting_value: 'DD/MM/YYYY', category: 'GENERAL', data_type: 'STRING' });
  mem.insert('school_settings', { id: crypto.randomUUID(), school_id: schoolA.id, setting_key: 'attendance_cutoff_time', setting_value: '08:30', category: 'OPERATIONS', data_type: 'STRING' });

  // 9. People Taxonomy Masters (School A & B)
  // 9.1 Designations
  const desigPrinA = { id: 'd0000000-0000-0000-0000-000000000001', school_id: schoolA.id, code: 'DES-PRIN', name: 'Principal / Academic Head', description: 'Head of institution and academics', status: 'ACTIVE' };
  const desigVpA = { id: 'd0000000-0000-0000-0000-000000000002', school_id: schoolA.id, code: 'DES-VP', name: 'Vice Principal', description: 'Academic administration & secondary wing lead', status: 'ACTIVE' };
  const desigPgtA = { id: 'd0000000-0000-0000-0000-000000000003', school_id: schoolA.id, code: 'DES-PGT', name: 'PGT Teacher (Senior Secondary)', description: 'Post Graduate Teacher for grades 11-12', status: 'ACTIVE' };
  const desigTgtA = { id: 'd0000000-0000-0000-0000-000000000004', school_id: schoolA.id, code: 'DES-TGT', name: 'TGT Teacher (Secondary)', description: 'Trained Graduate Teacher for grades 6-10', status: 'ACTIVE' };
  const desigPrtA = { id: 'd0000000-0000-0000-0000-000000000005', school_id: schoolA.id, code: 'DES-PRT', name: 'PRT Teacher (Primary)', description: 'Primary Teacher for grades 1-5', status: 'ACTIVE' };
  const desigAccA = { id: 'd0000000-0000-0000-0000-000000000006', school_id: schoolA.id, code: 'DES-ACC', name: 'Senior Accountant', description: 'Financial accounting and fee collection supervisor', status: 'ACTIVE' };
  const desigLibA = { id: 'd0000000-0000-0000-0000-000000000007', school_id: schoolA.id, code: 'DES-LIB', name: 'Chief Librarian', description: 'Central library and learning resource lead', status: 'ACTIVE' };
  const desigLabA = { id: 'd0000000-0000-0000-0000-000000000008', school_id: schoolA.id, code: 'DES-LAB', name: 'Senior Lab Assistant', description: 'Physics, Chemistry & Biology lab superintendent', status: 'ACTIVE' };
  const desigTrnA = { id: 'd0000000-0000-0000-0000-000000000009', school_id: schoolA.id, code: 'DES-TRN', name: 'Transport Supervisor', description: 'Fleet and bus logistics coordinator', status: 'ACTIVE' };
  const designationsA = [desigPrinA, desigVpA, desigPgtA, desigTgtA, desigPrtA, desigAccA, desigLibA, desigLabA, desigTrnA];
  for (const d of designationsA) mem.insert('designations', d);

  // School B Designations (Proves Tenant Isolation)
  const desigPrinB = { id: 'd1000000-0000-0000-0000-000000000001', school_id: schoolB.id, code: 'DES-PRIN', name: 'Principal / Head of School', description: 'Head of institution', status: 'ACTIVE' };
  const desigVpB = { id: 'd1000000-0000-0000-0000-000000000002', school_id: schoolB.id, code: 'DES-VP', name: 'Deputy Head of School', description: 'Academic deputy', status: 'ACTIVE' };
  mem.insert('designations', desigPrinB);
  mem.insert('designations', desigVpB);

  // 9.2 User Categories (School A)
  const catTeachA = { id: 'c0000000-0000-0000-0000-000000000001', school_id: schoolA.id, code: 'CAT-TEACH', name: 'Teaching Faculty', applicable_user_type: 'STAFF', description: 'Academic and instructional teaching staff', is_active: true };
  const catNonTeachA = { id: 'c0000000-0000-0000-0000-000000000002', school_id: schoolA.id, code: 'CAT-NONTEACH', name: 'Non-Teaching Staff', applicable_user_type: 'STAFF', description: 'Administration, finance, and operational staff', is_active: true };
  const catStudentA = { id: 'c0000000-0000-0000-0000-000000000003', school_id: schoolA.id, code: 'CAT-STUDENT', name: 'Enrolled Students', applicable_user_type: 'STUDENT', description: 'Regular enrolled student learners', is_active: true };
  const catParentA = { id: 'c0000000-0000-0000-0000-000000000004', school_id: schoolA.id, code: 'CAT-PARENT', name: 'Parents & Guardians', applicable_user_type: 'PARENT', description: 'Primary and secondary guardians', is_active: true };
  const categoriesA = [catTeachA, catNonTeachA, catStudentA, catParentA];
  for (const c of categoriesA) mem.insert('user_categories', c);

  // 9.3 User Subcategories (School A)
  const subcatsA = [
    { id: 'c1000000-0000-0000-0000-000000000001', school_id: schoolA.id, category_id: catTeachA.id, code: 'SUB-SR', name: 'Senior Secondary Faculty', description: 'Teachers for classes 11 and 12', is_active: true },
    { id: 'c1000000-0000-0000-0000-000000000002', school_id: schoolA.id, category_id: catTeachA.id, code: 'SUB-MID', name: 'Middle Wing Faculty', description: 'Teachers for classes 6 to 10', is_active: true },
    { id: 'c1000000-0000-0000-0000-000000000003', school_id: schoolA.id, category_id: catTeachA.id, code: 'SUB-PRI', name: 'Primary Wing Faculty', description: 'Teachers for classes 1 to 5', is_active: true },
    { id: 'c1000000-0000-0000-0000-000000000004', school_id: schoolA.id, category_id: catNonTeachA.id, code: 'SUB-ADM', name: 'Administration & Accounts', description: 'Secretariat, HR and finance team', is_active: true },
    { id: 'c1000000-0000-0000-0000-000000000005', school_id: schoolA.id, category_id: catNonTeachA.id, code: 'SUB-OPS', name: 'Operations & Transport', description: 'Maintenance, security and bus logistics', is_active: true },
    { id: 'c1000000-0000-0000-0000-000000000006', school_id: schoolA.id, category_id: catStudentA.id, code: 'SUB-STU-SR', name: 'Senior Wing Students', description: 'Classes 11 & 12', is_active: true },
    { id: 'c1000000-0000-0000-0000-000000000007', school_id: schoolA.id, category_id: catStudentA.id, code: 'SUB-STU-MID', name: 'Middle Wing Students', description: 'Classes 6 to 10', is_active: true },
    { id: 'c1000000-0000-0000-0000-000000000008', school_id: schoolA.id, category_id: catStudentA.id, code: 'SUB-STU-PRI', name: 'Primary Wing Students', description: 'Classes 1 to 5', is_active: true },
  ];
  for (const sc of subcatsA) mem.insert('user_subcategories', sc);

  // 9.4 User Tags (School A)
  const tagCt = { id: 't0000000-0000-0000-0000-000000000001', school_id: schoolA.id, code: 'TAG-CT', name: 'Class Teacher', color: '#3b82f6', description: 'Designated class homeroom teacher', is_active: true };
  const tagBus = { id: 't0000000-0000-0000-0000-000000000002', school_id: schoolA.id, code: 'TAG-BUS', name: 'Bus Incharge', color: '#f59e0b', description: 'Staff responsible for bus route discipline', is_active: true };
  const tagHostel = { id: 't0000000-0000-0000-0000-000000000003', school_id: schoolA.id, code: 'TAG-HOSTEL', name: 'Hosteler', color: '#8b5cf6', description: 'Boarding school resident student', is_active: true };
  const tagDay = { id: 't0000000-0000-0000-0000-000000000004', school_id: schoolA.id, code: 'TAG-DAY', name: 'Day Scholar', color: '#10b981', description: 'Non-boarding daily commuting student', is_active: true };
  const tagSports = { id: 't0000000-0000-0000-0000-000000000005', school_id: schoolA.id, code: 'TAG-SPORTS', name: 'Sports Team', color: '#ef4444', description: 'School athletic team member', is_active: true };
  const tagOlymp = { id: 't0000000-0000-0000-0000-000000000006', school_id: schoolA.id, code: 'TAG-OLYMP', name: 'Olympiad Squad', color: '#6366f1', description: 'National and international academic olympiad participant', is_active: true };
  const tagsA = [tagCt, tagBus, tagHostel, tagDay, tagSports, tagOlymp];
  for (const t of tagsA) mem.insert('user_tags', t);

  // 9.5 User Labels (School A)
  const lblMerit = { id: 'l0000000-0000-0000-0000-000000000001', school_id: schoolA.id, code: 'LBL-MERIT', name: 'Merit Scholar', color: '#10b981', description: 'Awarded academic distinction scholarship', is_active: true };
  const lblDue = { id: 'l0000000-0000-0000-0000-000000000002', school_id: schoolA.id, code: 'LBL-DEFAULTER', name: 'Fee Due Alert', color: '#ef4444', description: 'Outstanding fee instalment overdue', is_active: true };
  const lblDocs = { id: 'l0000000-0000-0000-0000-000000000003', school_id: schoolA.id, code: 'LBL-DOCS', name: 'Document Pending', color: '#f59e0b', description: 'Transfer certificate or medical record missing', is_active: true };
  const lblNew = { id: 'l0000000-0000-0000-0000-000000000004', school_id: schoolA.id, code: 'LBL-NEW', name: 'New Admission 2026', color: '#0ea5e9', description: 'Admitted in 2026-2027 academic session', is_active: true };
  const lblPriority = { id: 'l0000000-0000-0000-0000-000000000005', school_id: schoolA.id, code: 'LBL-PRIORITY', name: 'High Priority Attention', color: '#8b5cf6', description: 'Flagged for special counselor / administrative review', is_active: true };
  const labelsA = [lblMerit, lblDue, lblDocs, lblNew, lblPriority];
  for (const l of labelsA) mem.insert('user_labels', l);

  // 10. Staff Profiles for Seeded Staff
  // Rajesh Sharma (Director)
  mem.insert('staff_profiles', {
    id: crypto.randomUUID(),
    user_id: uRajesh.id,
    school_id: schoolA.id,
    employee_code: 'EMP-001',
    designation_id: desigPrinA.id,
    department: 'Executive Management',
    employment_type: 'PERMANENT',
    joining_date: '2015-04-01',
    qualification: 'Ph.D. in Educational Leadership',
    experience_years: 22,
    emergency_contact_name: 'Meenakshi Sharma',
    emergency_contact_phone: '+91 98100 99887',
  });

  // Sunita Rao (Admin / VP)
  mem.insert('staff_profiles', {
    id: crypto.randomUUID(),
    user_id: uSunita.id,
    school_id: schoolA.id,
    employee_code: 'EMP-002',
    designation_id: desigVpA.id,
    department: 'Academic Administration',
    employment_type: 'PERMANENT',
    joining_date: '2018-06-15',
    qualification: 'M.A., M.Ed.',
    experience_years: 15,
    emergency_contact_name: 'Kishore Rao',
    emergency_contact_phone: '+91 98100 88776',
  });

  // Vikram Verma (Teacher - PGT Physics)
  mem.insert('staff_profiles', {
    id: crypto.randomUUID(),
    user_id: uVikram.id,
    school_id: schoolA.id,
    employee_code: 'EMP-003',
    designation_id: desigPgtA.id,
    department: 'Physics & Science',
    employment_type: 'PERMANENT',
    joining_date: '2020-07-01',
    qualification: 'M.Sc. Physics, B.Ed.',
    experience_years: 10,
    emergency_contact_name: 'Neha Verma',
    emergency_contact_phone: '+91 98100 77665',
  });

  // Add Additional Staff Members for School A
  // 1. Priya Nair (TGT Mathematics Teacher)
  const uPriya = {
    id: 'a2000000-0000-0000-0000-000000000004',
    auth_user_id: 'a2000000-0000-0000-0000-000000000004',
    school_id: schoolA.id,
    user_type_id: userTypes[3].id, // TEACHER
    username: 'priya.nair',
    email: 'priya.nair@dpa.edu',
    phone: '+91 98100 45678',
    first_name: 'Priya',
    last_name: 'Nair',
    status: 'ACTIVE',
  };
  mem.insert('users', uPriya);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uPriya.id, role_id: roles[4].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uPriya.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });
  mem.insert('staff_profiles', {
    id: crypto.randomUUID(),
    user_id: uPriya.id,
    school_id: schoolA.id,
    employee_code: 'EMP-004',
    designation_id: desigTgtA.id,
    department: 'Mathematics',
    employment_type: 'PERMANENT',
    joining_date: '2021-08-01',
    qualification: 'M.Sc. Mathematics, B.Ed.',
    experience_years: 7,
  });

  // 2. Ramesh Kumar (Senior Accountant - Staff)
  const uRamesh = {
    id: 'a2000000-0000-0000-0000-000000000005',
    auth_user_id: 'a2000000-0000-0000-0000-000000000005',
    school_id: schoolA.id,
    user_type_id: userTypes[4].id, // STAFF
    username: 'ramesh.kumar',
    email: 'ramesh.kumar@dpa.edu',
    phone: '+91 98100 56789',
    first_name: 'Ramesh',
    last_name: 'Kumar',
    status: 'ACTIVE',
  };
  mem.insert('users', uRamesh);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uRamesh.id, role_id: roles[5].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uRamesh.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });
  mem.insert('staff_profiles', {
    id: crypto.randomUUID(),
    user_id: uRamesh.id,
    school_id: schoolA.id,
    employee_code: 'EMP-005',
    designation_id: desigAccA.id,
    department: 'Finance & Accounts',
    employment_type: 'PERMANENT',
    joining_date: '2019-02-10',
    qualification: 'M.Com, CA Inter',
    experience_years: 12,
  });

  // 11. Sample Students (Universal users table + student_profiles)
  // Student 1: Aarav Sharma (Class 10-A, Day Scholar, Merit Scholar)
  const uAarav = {
    id: 'a3000000-0000-0000-0000-000000000001',
    auth_user_id: 'a3000000-0000-0000-0000-000000000001',
    school_id: schoolA.id,
    user_type_id: userTypes[5].id, // STUDENT
    username: 'aarav.sharma',
    email: 'aarav.sharma@student.dpa.edu',
    phone: '+91 98111 22334',
    first_name: 'Aarav',
    last_name: 'Sharma',
    status: 'ACTIVE',
  };
  mem.insert('users', uAarav);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uAarav.id, role_id: roles[6].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uAarav.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });
  mem.insert('student_profiles', {
    id: crypto.randomUUID(),
    user_id: uAarav.id,
    school_id: schoolA.id,
    admission_number: 'ADM-2024-001',
    roll_number: '101',
    academic_session: '2026-2027',
    class_name: 'Class 10',
    section_name: 'Section A',
    house: 'Red',
    stream: 'General',
    medium: 'English',
    gender: 'MALE',
    date_of_birth: '2011-05-14',
    blood_group: 'B+',
    admission_date: '2024-04-01',
    emergency_contact_name: 'Suresh Sharma (Father)',
    emergency_contact_phone: '+91 98111 22334',
  });

  // Student 2: Diya Patel (Class 10-A, Hosteler, Olympiad Squad)
  const uDiya = {
    id: 'a3000000-0000-0000-0000-000000000002',
    auth_user_id: 'a3000000-0000-0000-0000-000000000002',
    school_id: schoolA.id,
    user_type_id: userTypes[5].id, // STUDENT
    username: 'diya.patel',
    email: 'diya.patel@student.dpa.edu',
    phone: '+91 98111 33445',
    first_name: 'Diya',
    last_name: 'Patel',
    status: 'ACTIVE',
  };
  mem.insert('users', uDiya);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uDiya.id, role_id: roles[6].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uDiya.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });
  mem.insert('student_profiles', {
    id: crypto.randomUUID(),
    user_id: uDiya.id,
    school_id: schoolA.id,
    admission_number: 'ADM-2024-002',
    roll_number: '102',
    academic_session: '2026-2027',
    class_name: 'Class 10',
    section_name: 'Section A',
    house: 'Blue',
    stream: 'General',
    medium: 'English',
    gender: 'FEMALE',
    date_of_birth: '2011-09-22',
    blood_group: 'O+',
    admission_date: '2024-04-01',
    emergency_contact_name: 'Bhavesh Patel (Father)',
    emergency_contact_phone: '+91 98111 33445',
  });

  // Student 3: Rohan Gupta (Class 11-B, Science Stream, Noida Campus)
  const uRohan = {
    id: 'a3000000-0000-0000-0000-000000000003',
    auth_user_id: 'a3000000-0000-0000-0000-000000000003',
    school_id: schoolA.id,
    user_type_id: userTypes[5].id, // STUDENT
    username: 'rohan.gupta',
    email: 'rohan.gupta@student.dpa.edu',
    phone: '+91 98111 44556',
    first_name: 'Rohan',
    last_name: 'Gupta',
    status: 'ACTIVE',
  };
  mem.insert('users', uRohan);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uRohan.id, role_id: roles[6].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uRohan.id, location_id: locA2.id, school_id: schoolA.id, is_primary: true });
  mem.insert('student_profiles', {
    id: crypto.randomUUID(),
    user_id: uRohan.id,
    school_id: schoolA.id,
    admission_number: 'ADM-2025-045',
    roll_number: '201',
    academic_session: '2026-2027',
    class_name: 'Class 11',
    section_name: 'Section B',
    house: 'Green',
    stream: 'Science',
    medium: 'English',
    gender: 'MALE',
    date_of_birth: '2010-02-18',
    blood_group: 'A+',
    admission_date: '2025-04-01',
    emergency_contact_name: 'Sanjay Gupta (Father)',
    emergency_contact_phone: '+91 98111 44556',
  });

  // Student 4: Ananya Iyer (Class 12-A, Commerce Stream, Merit Scholar)
  const uAnanya = {
    id: 'a3000000-0000-0000-0000-000000000004',
    auth_user_id: 'a3000000-0000-0000-0000-000000000004',
    school_id: schoolA.id,
    user_type_id: userTypes[5].id, // STUDENT
    username: 'ananya.iyer',
    email: 'ananya.iyer@student.dpa.edu',
    phone: '+91 98111 55667',
    first_name: 'Ananya',
    last_name: 'Iyer',
    status: 'ACTIVE',
  };
  mem.insert('users', uAnanya);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uAnanya.id, role_id: roles[6].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uAnanya.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });
  mem.insert('student_profiles', {
    id: crypto.randomUUID(),
    user_id: uAnanya.id,
    school_id: schoolA.id,
    admission_number: 'ADM-2025-090',
    roll_number: '301',
    academic_session: '2026-2027',
    class_name: 'Class 12',
    section_name: 'Section A',
    house: 'Yellow',
    stream: 'Commerce',
    medium: 'English',
    gender: 'FEMALE',
    date_of_birth: '2009-11-30',
    blood_group: 'AB+',
    admission_date: '2025-04-01',
    emergency_contact_name: 'Venkat Iyer (Father)',
    emergency_contact_phone: '+91 98111 55667',
  });

  // 11.1 Sample Parents / Guardians (Universal users table + parent_student_relationships)
  // Parent 1: Mahesh Sharma (Father of Aarav Sharma)
  const uMahesh = {
    id: 'a4000000-0000-0000-0000-000000000001',
    auth_user_id: 'a4000000-0000-0000-0000-000000000001',
    school_id: schoolA.id,
    user_type_id: userTypes[6].id, // PARENT
    username: 'mahesh.sharma',
    email: 'mahesh.sharma@parent.dpa.edu',
    phone: '+91 98111 88990',
    first_name: 'Mahesh',
    last_name: 'Sharma',
    status: 'ACTIVE',
  };
  mem.insert('users', uMahesh);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uMahesh.id, role_id: roles[7].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uMahesh.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });
  mem.insert('parent_student_relationships', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    parent_user_id: uMahesh.id,
    student_user_id: uAarav.id,
    relationship_type: 'FATHER',
    is_emergency_contact: true,
    created_at: new Date().toISOString(),
  });
  mem.insert('user_credentials', {
    id: crypto.randomUUID(),
    user_id: uMahesh.id,
    school_id: schoolA.id,
    location_id: locA1.id,
    school_id_code: 'DPA-DEL-001',
    username: 'mahesh.sharma',
    password_hash: defaultPassHash,
    login_status: 'ACTIVE',
    is_super_admin: false,
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Parent 2: Sunita Sharma (Mother of Aarav Sharma) - Profile only, no login access
  const uSunitaParent = {
    id: 'a4000000-0000-0000-0000-000000000002',
    auth_user_id: 'a4000000-0000-0000-0000-000000000002',
    school_id: schoolA.id,
    user_type_id: userTypes[6].id, // PARENT
    username: 'sunita.sharma',
    email: 'sunita.sharma@parent.dpa.edu',
    phone: '+91 98111 88991',
    first_name: 'Sunita',
    last_name: 'Sharma',
    status: 'ACTIVE',
  };
  mem.insert('users', uSunitaParent);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uSunitaParent.id, role_id: roles[7].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uSunitaParent.id, location_id: locA1.id, school_id: schoolA.id, is_primary: true });
  mem.insert('parent_student_relationships', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    parent_user_id: uSunitaParent.id,
    student_user_id: uAarav.id,
    relationship_type: 'MOTHER',
    is_emergency_contact: true,
    created_at: new Date().toISOString(),
  });

  // Parent 3: Sanjay Gupta (Father of Rohan Gupta)
  const uSanjay = {
    id: 'a4000000-0000-0000-0000-000000000003',
    auth_user_id: 'a4000000-0000-0000-0000-000000000003',
    school_id: schoolA.id,
    user_type_id: userTypes[6].id, // PARENT
    username: 'sanjay.gupta',
    email: 'sanjay.gupta@parent.dpa.edu',
    phone: '+91 98111 44556',
    first_name: 'Sanjay',
    last_name: 'Gupta',
    status: 'ACTIVE',
  };
  mem.insert('users', uSanjay);
  mem.insert('user_roles', { id: crypto.randomUUID(), user_id: uSanjay.id, role_id: roles[7].id, school_id: schoolA.id });
  mem.insert('user_location_access', { id: crypto.randomUUID(), user_id: uSanjay.id, location_id: locA2.id, school_id: schoolA.id, is_primary: true });
  mem.insert('parent_student_relationships', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    parent_user_id: uSanjay.id,
    student_user_id: uRohan.id,
    relationship_type: 'FATHER',
    is_emergency_contact: true,
    created_at: new Date().toISOString(),
  });

  // 12. Taxonomy Assignments (Categories, Subcategories, Tags, Labels)
  // Vikram Verma: Teaching Faculty -> Senior Secondary -> Class Teacher tag
  mem.insert('user_category_assignments', { id: crypto.randomUUID(), user_id: uVikram.id, category_id: catTeachA.id });
  mem.insert('user_subcategory_assignments', { id: crypto.randomUUID(), user_id: uVikram.id, subcategory_id: subcatsA[0].id });
  mem.insert('user_tag_assignments', { id: crypto.randomUUID(), user_id: uVikram.id, tag_id: tagCt.id });

  // Priya Nair: Teaching Faculty -> Middle Wing -> Class Teacher
  mem.insert('user_category_assignments', { id: crypto.randomUUID(), user_id: uPriya.id, category_id: catTeachA.id });
  mem.insert('user_subcategory_assignments', { id: crypto.randomUUID(), user_id: uPriya.id, subcategory_id: subcatsA[1].id });
  mem.insert('user_tag_assignments', { id: crypto.randomUUID(), user_id: uPriya.id, tag_id: tagCt.id });

  // Ramesh Kumar: Non-Teaching Staff -> Administration & Accounts
  mem.insert('user_category_assignments', { id: crypto.randomUUID(), user_id: uRamesh.id, category_id: catNonTeachA.id });
  mem.insert('user_subcategory_assignments', { id: crypto.randomUUID(), user_id: uRamesh.id, subcategory_id: subcatsA[3].id });

  // Aarav Sharma: Student -> Middle Wing -> Day Scholar -> Merit Scholar
  mem.insert('user_category_assignments', { id: crypto.randomUUID(), user_id: uAarav.id, category_id: catStudentA.id });
  mem.insert('user_subcategory_assignments', { id: crypto.randomUUID(), user_id: uAarav.id, subcategory_id: subcatsA[6].id });
  mem.insert('user_tag_assignments', { id: crypto.randomUUID(), user_id: uAarav.id, tag_id: tagDay.id });
  mem.insert('user_label_assignments', { id: crypto.randomUUID(), user_id: uAarav.id, label_id: lblMerit.id });

  // Diya Patel: Student -> Middle Wing -> Hosteler -> Olympiad Squad
  mem.insert('user_category_assignments', { id: crypto.randomUUID(), user_id: uDiya.id, category_id: catStudentA.id });
  mem.insert('user_subcategory_assignments', { id: crypto.randomUUID(), user_id: uDiya.id, subcategory_id: subcatsA[6].id });
  mem.insert('user_tag_assignments', { id: crypto.randomUUID(), user_id: uDiya.id, tag_id: tagHostel.id });
  mem.insert('user_tag_assignments', { id: crypto.randomUUID(), user_id: uDiya.id, tag_id: tagOlymp.id });

  // Rohan Gupta: Student -> Senior Wing -> Day Scholar -> Document Pending
  mem.insert('user_category_assignments', { id: crypto.randomUUID(), user_id: uRohan.id, category_id: catStudentA.id });
  mem.insert('user_subcategory_assignments', { id: crypto.randomUUID(), user_id: uRohan.id, subcategory_id: subcatsA[5].id });
  mem.insert('user_tag_assignments', { id: crypto.randomUUID(), user_id: uRohan.id, tag_id: tagDay.id });
  mem.insert('user_label_assignments', { id: crypto.randomUUID(), user_id: uRohan.id, label_id: lblDocs.id });

  // Ananya Iyer: Student -> Senior Wing -> Day Scholar -> Merit Scholar
  mem.insert('user_category_assignments', { id: crypto.randomUUID(), user_id: uAnanya.id, category_id: catStudentA.id });
  mem.insert('user_subcategory_assignments', { id: crypto.randomUUID(), user_id: uAnanya.id, subcategory_id: subcatsA[5].id });
  mem.insert('user_tag_assignments', { id: crypto.randomUUID(), user_id: uAnanya.id, tag_id: tagDay.id });
  mem.insert('user_label_assignments', { id: crypto.randomUUID(), user_id: uAnanya.id, label_id: lblMerit.id });

  // 13. Academic Structure & Assignments (Configurable sessions, classes, sections, subjects, offerings, enrollments, teacher assignments)
  // Academic Sessions
  const sessA1 = {
    id: 'a1000000-0000-0000-0000-000000000001',
    school_id: schoolA.id,
    name: '2025-26',
    code: 'AY2025-26',
    start_date: '2025-04-01',
    end_date: '2026-03-31',
    status: 'COMPLETED',
    is_current: false,
    created_at: '2025-03-01T00:00:00Z',
    updated_at: '2026-03-31T00:00:00Z',
  };
  const sessA2 = {
    id: 'a1000000-0000-0000-0000-000000000002',
    school_id: schoolA.id,
    name: '2026-27',
    code: 'AY2026-27',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
    status: 'ACTIVE',
    is_current: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mem.insert('academic_sessions', sessA1);
  mem.insert('academic_sessions', sessA2);

  const sessB1 = {
    id: 'b1000000-0000-0000-0000-000000000001',
    school_id: schoolB.id,
    name: '2026-27',
    code: 'AY2026-27',
    start_date: '2026-04-01',
    end_date: '2027-03-31',
    status: 'ACTIVE',
    is_current: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mem.insert('academic_sessions', sessB1);

  // Classes for School A
  const classesAData = [
    { name: 'Nursery', code: 'CLS-NUR', display_name: 'Nursery', numeric_order: 0 },
    { name: 'LKG', code: 'CLS-LKG', display_name: 'Lower KG', numeric_order: 1 },
    { name: 'UKG', code: 'CLS-UKG', display_name: 'Upper KG', numeric_order: 2 },
    { name: '1', code: 'CLS-1', display_name: 'Class 1', numeric_order: 3 },
    { name: '9', code: 'CLS-9', display_name: 'Class 9', numeric_order: 11 },
    { name: '10', code: 'CLS-10', display_name: 'Class 10', numeric_order: 12 },
    { name: '11', code: 'CLS-11', display_name: 'Class 11', numeric_order: 13 },
    { name: '12', code: 'CLS-12', display_name: 'Class 12', numeric_order: 14 },
  ];
  const classesA: any[] = [];
  classesAData.forEach((c) => {
    const row = {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      name: c.name,
      code: c.code,
      display_name: c.display_name,
      numeric_order: c.numeric_order,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    classesA.push(row);
    mem.insert('classes', row);
  });

  // Classes for School B (Different taxonomy to verify zero hardcoding)
  const classesBData = [
    { name: 'Grade 9', code: 'CLS-G9', display_name: 'Grade 9', numeric_order: 9 },
    { name: 'Grade 10', code: 'CLS-G10', display_name: 'Grade 10', numeric_order: 10 },
  ];
  classesBData.forEach((c) => {
    mem.insert('classes', {
      id: crypto.randomUUID(),
      school_id: schoolB.id,
      name: c.name,
      code: c.code,
      display_name: c.display_name,
      numeric_order: c.numeric_order,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  // Sections for School A
  const sectionsAData = ['A', 'B', 'C', 'D'];
  const sectionsA: any[] = [];
  sectionsAData.forEach((secName) => {
    const row = {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      name: secName,
      code: `SEC-${secName}`,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    sectionsA.push(row);
    mem.insert('sections', row);
  });

  // Sections for School B
  ['Alpha', 'Beta'].forEach((secName) => {
    mem.insert('sections', {
      id: crypto.randomUUID(),
      school_id: schoolB.id,
      name: secName,
      code: `SEC-${secName.toUpperCase()}`,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  // Academic Class-Section Offerings
  // In School A current session (2026-27):
  // Class 10 -> Sections A, B, C
  // Class 11 -> Sections A, B
  // Class 9 -> Sections A, B
  const cls9 = classesA.find(c => c.code === 'CLS-9')!;
  const cls10 = classesA.find(c => c.code === 'CLS-10')!;
  const cls11 = classesA.find(c => c.code === 'CLS-11')!;
  const secA = sectionsA.find(s => s.name === 'A')!;
  const secB = sectionsA.find(s => s.name === 'B')!;
  const secC = sectionsA.find(s => s.name === 'C')!;

  const acs10A = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls10.id, section_id: secA.id, capacity: 40, status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const acs10B = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls10.id, section_id: secB.id, capacity: 40, status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const acs10C = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls10.id, section_id: secC.id, capacity: 35, status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const acs11A = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls11.id, section_id: secA.id, capacity: 45, status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const acs11B = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls11.id, section_id: secB.id, capacity: 45, status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const acs9A = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls9.id, section_id: secA.id, capacity: 40, status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  // Historical 2025-26 offering: Class 9 -> Section B
  const acs9B_hist = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA1.id, class_id: cls9.id, section_id: secB.id, capacity: 40, status: 'ACTIVE', created_at: '2025-04-01T00:00:00Z', updated_at: '2025-04-01T00:00:00Z' };

  mem.insert('academic_class_sections', acs10A);
  mem.insert('academic_class_sections', acs10B);
  mem.insert('academic_class_sections', acs10C);
  mem.insert('academic_class_sections', acs11A);
  mem.insert('academic_class_sections', acs11B);
  mem.insert('academic_class_sections', acs9A);
  mem.insert('academic_class_sections', acs9B_hist);

  // Subjects for School A
  const subjectsAData = [
    { name: 'Mathematics', code: 'SUB-MATH', short_name: 'MATH', description: 'Core Mathematics' },
    { name: 'English Core', code: 'SUB-ENG', short_name: 'ENG', description: 'English Language & Literature' },
    { name: 'Physics', code: 'SUB-PHY', short_name: 'PHY', description: 'Secondary & Higher Secondary Physics' },
    { name: 'Chemistry', code: 'SUB-CHEM', short_name: 'CHEM', description: 'Secondary & Higher Secondary Chemistry' },
    { name: 'Biology', code: 'SUB-BIO', short_name: 'BIO', description: 'Life Sciences & Biology' },
    { name: 'Social Science', code: 'SUB-SST', short_name: 'SST', description: 'History, Civics, Geography' },
    { name: 'Computer Science', code: 'SUB-CS', short_name: 'CS', description: 'Programming and CS Fundamentals' },
  ];
  const subjectsA: any[] = [];
  subjectsAData.forEach((s) => {
    const row = {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      name: s.name,
      code: s.code,
      short_name: s.short_name,
      description: s.description,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    subjectsA.push(row);
    mem.insert('subjects', row);
  });

  // Subjects for School B
  [
    { name: 'Advanced Mathematics', code: 'SUB-B-AMATH', short_name: 'AMATH' },
    { name: 'World Literature', code: 'SUB-B-LIT', short_name: 'WLIT' },
  ].forEach((s) => {
    mem.insert('subjects', {
      id: crypto.randomUUID(),
      school_id: schoolB.id,
      name: s.name,
      code: s.code,
      short_name: s.short_name,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  // Subject Groups for School A
  const grpCore = { id: crypto.randomUUID(), school_id: schoolA.id, name: 'Core Subjects', code: 'GRP-CORE', description: 'Compulsory foundation subjects', status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const grpStem = { id: crypto.randomUUID(), school_id: schoolA.id, name: 'STEM Electives', code: 'GRP-STEM', description: 'Science, Technology & Engineering electives', status: 'ACTIVE', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  mem.insert('subject_groups', grpCore);
  mem.insert('subject_groups', grpStem);

  const subMath = subjectsA.find(s => s.code === 'SUB-MATH')!;
  const subEng = subjectsA.find(s => s.code === 'SUB-ENG')!;
  const subPhy = subjectsA.find(s => s.code === 'SUB-PHY')!;
  const subChem = subjectsA.find(s => s.code === 'SUB-CHEM')!;
  const subBio = subjectsA.find(s => s.code === 'SUB-BIO')!;
  const subSst = subjectsA.find(s => s.code === 'SUB-SST')!;
  const subCs = subjectsA.find(s => s.code === 'SUB-CS')!;

  // Relational Subject Group Items (Zero comma-separated strings)
  mem.insert('subject_group_items', { id: crypto.randomUUID(), school_id: schoolA.id, subject_group_id: grpCore.id, subject_id: subMath.id, created_at: new Date().toISOString() });
  mem.insert('subject_group_items', { id: crypto.randomUUID(), school_id: schoolA.id, subject_group_id: grpCore.id, subject_id: subEng.id, created_at: new Date().toISOString() });
  mem.insert('subject_group_items', { id: crypto.randomUUID(), school_id: schoolA.id, subject_group_id: grpCore.id, subject_id: subSst.id, created_at: new Date().toISOString() });
  mem.insert('subject_group_items', { id: crypto.randomUUID(), school_id: schoolA.id, subject_group_id: grpStem.id, subject_id: subPhy.id, created_at: new Date().toISOString() });
  mem.insert('subject_group_items', { id: crypto.randomUUID(), school_id: schoolA.id, subject_group_id: grpStem.id, subject_id: subChem.id, created_at: new Date().toISOString() });
  mem.insert('subject_group_items', { id: crypto.randomUUID(), school_id: schoolA.id, subject_group_id: grpStem.id, subject_id: subBio.id, created_at: new Date().toISOString() });
  mem.insert('subject_group_items', { id: crypto.randomUUID(), school_id: schoolA.id, subject_group_id: grpStem.id, subject_id: subCs.id, created_at: new Date().toISOString() });

  // Class Subject Offerings (academic_class_subjects)
  // Class 10 offerings in 2026-27:
  const acs10_Math = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls10.id, subject_group_id: grpCore.id, subject_id: subMath.id, is_required: true, subject_type: 'THEORY', status: 'ACTIVE', credits: 4, max_marks: 100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const acs10_Eng = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls10.id, subject_group_id: grpCore.id, subject_id: subEng.id, is_required: true, subject_type: 'THEORY', status: 'ACTIVE', credits: 4, max_marks: 100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const acs10_Sst = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls10.id, subject_group_id: grpCore.id, subject_id: subSst.id, is_required: true, subject_type: 'THEORY', status: 'ACTIVE', credits: 4, max_marks: 100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const acs10_Cs = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls10.id, subject_group_id: grpStem.id, subject_id: subCs.id, is_required: false, subject_type: 'BOTH', status: 'ACTIVE', credits: 2, max_marks: 100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  mem.insert('academic_class_subjects', acs10_Math);
  mem.insert('academic_class_subjects', acs10_Eng);
  mem.insert('academic_class_subjects', acs10_Sst);
  mem.insert('academic_class_subjects', acs10_Cs);

  // Class 11 offerings in 2026-27:
  const acs11_Math = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls11.id, subject_group_id: grpStem.id, subject_id: subMath.id, is_required: true, subject_type: 'THEORY', status: 'ACTIVE', credits: 4, max_marks: 100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const acs11_Phy = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls11.id, subject_group_id: grpStem.id, subject_id: subPhy.id, is_required: true, subject_type: 'BOTH', status: 'ACTIVE', credits: 4, max_marks: 100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const acs11_Chem = { id: crypto.randomUUID(), school_id: schoolA.id, academic_session_id: sessA2.id, class_id: cls11.id, subject_group_id: grpStem.id, subject_id: subChem.id, is_required: true, subject_type: 'BOTH', status: 'ACTIVE', credits: 4, max_marks: 100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  mem.insert('academic_class_subjects', acs11_Math);
  mem.insert('academic_class_subjects', acs11_Phy);
  mem.insert('academic_class_subjects', acs11_Chem);

  // Student Academic Enrollments (Connecting users.id to academic sessions, classes, and sections)
  // Aarav Sharma: Multi-session historical progression
  // 2025-26: Class 9 Section B (Promoted)
  mem.insert('student_academic_enrollments', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    student_user_id: uAarav.id,
    academic_session_id: sessA1.id,
    location_id: locA1.id,
    class_id: cls9.id,
    section_id: secB.id,
    academic_class_section_id: acs9B_hist.id,
    admission_number: 'DPA-2026-0001',
    roll_number: '9045',
    enrollment_status: 'PROMOTED',
    start_date: '2025-04-01',
    end_date: '2026-03-31',
    created_by: uSuperA.id,
    created_at: '2025-04-01T00:00:00Z',
    updated_at: '2026-03-31T00:00:00Z',
  });
  // 2026-27: Class 10 Section A (Active Enrolled)
  const enrollAarav = {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    student_user_id: uAarav.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: secA.id,
    academic_class_section_id: acs10A.id,
    admission_number: 'DPA-2026-0001',
    roll_number: '1001',
    enrollment_status: 'ENROLLED' as const,
    start_date: '2026-04-01',
    created_by: uSuperA.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mem.insert('student_academic_enrollments', enrollAarav);

  // Diya Patel: Class 10 Section A (Active Enrolled)
  const enrollDiya = {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    student_user_id: uDiya.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: secA.id,
    academic_class_section_id: acs10A.id,
    admission_number: 'DPA-2026-0002',
    roll_number: '1002',
    enrollment_status: 'ENROLLED' as const,
    start_date: '2026-04-01',
    created_by: uSuperA.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mem.insert('student_academic_enrollments', enrollDiya);

  // Rohan Gupta: Class 11 Section A (Active Enrolled at Noida Branch)
  mem.insert('student_academic_enrollments', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    student_user_id: uRohan.id,
    academic_session_id: sessA2.id,
    location_id: locA2.id,
    class_id: cls11.id,
    section_id: secA.id,
    academic_class_section_id: acs11A.id,
    admission_number: 'DPA-2026-0003',
    roll_number: '1101',
    enrollment_status: 'ENROLLED',
    start_date: '2026-04-01',
    created_by: uSuperA.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Ananya Iyer: Class 11 Section B (Active Enrolled at Dwarka Main)
  mem.insert('student_academic_enrollments', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    student_user_id: uAnanya.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls11.id,
    section_id: secB.id,
    academic_class_section_id: acs11B.id,
    admission_number: 'DPA-2026-0004',
    roll_number: '1102',
    enrollment_status: 'ENROLLED',
    start_date: '2026-04-01',
    created_by: uSuperA.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Teacher Subject Assignments (Teaching Allocation)
  // Teacher Vikram Verma (uVikram.id) teaches Mathematics in:
  // 1. Class 10 Section A (Dwarka Main)
  mem.insert('teacher_subject_assignments', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    teacher_user_id: uVikram.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: secA.id,
    subject_id: subMath.id,
    academic_class_section_id: acs10A.id,
    academic_class_subject_id: acs10_Math.id,
    is_primary_teacher: true,
    status: 'ACTIVE',
    effective_date: '2026-04-01',
    created_by: uSuperA.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  // 2. Class 11 Section A (Dwarka Main)
  mem.insert('teacher_subject_assignments', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    teacher_user_id: uVikram.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls11.id,
    section_id: secA.id,
    subject_id: subMath.id,
    academic_class_section_id: acs11A.id,
    academic_class_subject_id: acs11_Math.id,
    is_primary_teacher: true,
    status: 'ACTIVE',
    effective_date: '2026-04-01',
    created_by: uSuperA.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // ------------------------------------------------------------------------
  // Attendance Status Masters
  // ------------------------------------------------------------------------
  const attendanceStatuses = [
    { code: 'PRESENT', name: 'Present', type: 'ALL', pres: true, abs: false, lve: false, color: '#10B981' },
    { code: 'ABSENT', name: 'Absent', type: 'ALL', pres: false, abs: true, lve: false, color: '#EF4444' },
    { code: 'LATE', name: 'Late', type: 'ALL', pres: true, abs: false, lve: false, color: '#F59E0B' },
    { code: 'HALF_DAY', name: 'Half Day', type: 'ALL', pres: true, abs: false, lve: false, color: '#8B5CF6' },
    { code: 'LEAVE', name: 'Leave', type: 'ALL', pres: false, abs: false, lve: true, color: '#3B82F6' },
    { code: 'EXCUSED', name: 'Excused', type: 'ALL', pres: true, abs: false, lve: false, color: '#6B7280' },
  ];

  for (const s of [schoolA, schoolB]) {
    attendanceStatuses.forEach(st => {
      mem.insert('attendance_status_master', {
        id: crypto.randomUUID(),
        school_id: s.id,
        status_code: st.code,
        status_name: st.name,
        attendance_type: st.type,
        counts_as_present: st.pres,
        counts_as_absent: st.abs,
        counts_as_leave: st.lve,
        color_code: st.color,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
  }

  // Sample Student Attendance: 09 Sep 2026 for Class 10-A (enrollAarav, enrollDiya)
  if (enrollAarav && enrollDiya) {
    mem.insert('user_attendance', {
      id: crypto.randomUUID(),
      attendance_id: 'ATT-20260909-0001',
      school_id: schoolA.id,
      user_id: uAarav.id,
      attendance_date: '2026-09-09',
      attendance_type: 'STUDENT',
      academic_session_id: sessA2.id,
      location_id: locA1.id,
      student_enrollment_id: enrollAarav.id,
      class_id: cls10.id,
      section_id: secA.id,
      status: 'PRESENT',
      late_minutes: 0,
      early_departure_minutes: 0,
      remarks: 'On time',
      marked_by: uRajesh.id,
      marked_at: '2026-09-09T08:35:00Z',
      source: 'MANUAL',
      is_locked: false,
      created_at: '2026-09-09T08:35:00Z',
      updated_at: '2026-09-09T08:35:00Z',
    });

    mem.insert('user_attendance', {
      id: crypto.randomUUID(),
      attendance_id: 'ATT-20260909-0002',
      school_id: schoolA.id,
      user_id: uDiya.id,
      attendance_date: '2026-09-09',
      attendance_type: 'STUDENT',
      academic_session_id: sessA2.id,
      location_id: locA1.id,
      student_enrollment_id: enrollDiya.id,
      class_id: cls10.id,
      section_id: secA.id,
      status: 'LATE',
      late_minutes: 15,
      early_departure_minutes: 0,
      remarks: 'Bus delay',
      marked_by: uRajesh.id,
      marked_at: '2026-09-09T08:45:00Z',
      source: 'MANUAL',
      is_locked: false,
      created_at: '2026-09-09T08:45:00Z',
      updated_at: '2026-09-09T08:45:00Z',
    });
  }

  // Sample Staff Attendance: 09 Sep 2026 for Rajesh and Vikram in locA1
  mem.insert('user_attendance', {
    id: crypto.randomUUID(),
    attendance_id: 'ATT-20260909-1001',
    school_id: schoolA.id,
    user_id: uRajesh.id,
    attendance_date: '2026-09-09',
    attendance_type: 'STAFF',
    location_id: locA1.id,
    department: 'Academics',
    status: 'PRESENT',
    check_in_time: '08:42',
    check_out_time: '16:35',
    late_minutes: 12,
    early_departure_minutes: 0,
    remarks: 'Regular schedule',
    marked_by: uSuperA.id,
    marked_at: '2026-09-09T08:42:00Z',
    source: 'MANUAL',
    is_locked: false,
    created_at: '2026-09-09T08:42:00Z',
    updated_at: '2026-09-09T08:42:00Z',
  });

  mem.insert('user_attendance', {
    id: crypto.randomUUID(),
    attendance_id: 'ATT-20260909-1002',
    school_id: schoolA.id,
    user_id: uVikram.id,
    attendance_date: '2026-09-09',
    attendance_type: 'STAFF',
    location_id: locA1.id,
    department: 'Academics',
    status: 'PRESENT',
    check_in_time: '08:25',
    check_out_time: '16:30',
    late_minutes: 0,
    early_departure_minutes: 0,
    remarks: 'Early arrival',
    marked_by: uSuperA.id,
    marked_at: '2026-09-09T08:25:00Z',
    source: 'MANUAL',
    is_locked: false,
    created_at: '2026-09-09T08:25:00Z',
    updated_at: '2026-09-09T08:25:00Z',
  });

  // ======================================================================
  // Fees Management Seed Data (School A)
  // ======================================================================
  const feeHeadTuition = {
    id: 'f1000000-0000-0000-0000-000000000001',
    school_id: schoolA.id,
    code: 'TUI-FEE',
    name: 'Tuition Fee',
    description: 'Core instructional and academic curriculum fees',
    category: 'ACADEMIC',
    is_taxable: false,
    tax_rate: 0,
    display_order: 1,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const feeHeadLab = {
    id: 'f1000000-0000-0000-0000-000000000002',
    school_id: schoolA.id,
    code: 'LAB-FEE',
    name: 'Science & Computer Lab Fee',
    description: 'Access to physics, chemistry, biology and computer laboratories',
    category: 'ACADEMIC',
    is_taxable: false,
    tax_rate: 0,
    display_order: 2,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const feeHeadDev = {
    id: 'f1000000-0000-0000-0000-000000000003',
    school_id: schoolA.id,
    code: 'DEV-CHG',
    name: 'Annual Development Charges',
    description: 'Campus infrastructure upkeep, smart classrooms and facilities',
    category: 'FACILITY',
    is_taxable: false,
    tax_rate: 0,
    display_order: 3,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const feeHeadSports = {
    id: 'f1000000-0000-0000-0000-000000000004',
    school_id: schoolA.id,
    code: 'SPT-FEE',
    name: 'Sports & Co-Curricular Fee',
    description: 'Sports equipment, coaching and co-curricular club materials',
    category: 'FACILITY',
    is_taxable: false,
    tax_rate: 0,
    display_order: 4,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const feeHeadAdm = {
    id: 'f1000000-0000-0000-0000-000000000005',
    school_id: schoolA.id,
    code: 'ADM-FEE',
    name: 'Admission Processing Fee',
    description: 'One-time registration and enrollment verification fee',
    category: 'ONE_TIME',
    is_taxable: false,
    tax_rate: 0,
    display_order: 5,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mem.insert('fee_heads', feeHeadTuition);
  mem.insert('fee_heads', feeHeadLab);
  mem.insert('fee_heads', feeHeadDev);
  mem.insert('fee_heads', feeHeadSports);
  mem.insert('fee_heads', feeHeadAdm);

  // Fee Structures for Class 10 (2026-27)
  const structTuition10 = {
    id: 'f2000000-0000-0000-0000-000000000001',
    school_id: schoolA.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: null,
    fee_head_id: feeHeadTuition.id,
    frequency: 'MONTHLY',
    amount: 4500,
    due_day_of_month: 10,
    notes: 'Monthly tuition for Class 10',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const structLab10 = {
    id: 'f2000000-0000-0000-0000-000000000002',
    school_id: schoolA.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: null,
    fee_head_id: feeHeadLab.id,
    frequency: 'QUARTERLY',
    amount: 1200,
    due_day_of_month: 10,
    notes: 'Quarterly laboratory maintenance',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const structDev10 = {
    id: 'f2000000-0000-0000-0000-000000000003',
    school_id: schoolA.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: null,
    fee_head_id: feeHeadDev.id,
    frequency: 'YEARLY',
    amount: 10000,
    due_day_of_month: 15,
    notes: 'Annual development fee',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const structSports10 = {
    id: 'f2000000-0000-0000-0000-000000000004',
    school_id: schoolA.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: null,
    fee_head_id: feeHeadSports.id,
    frequency: 'MONTHLY',
    amount: 800,
    due_day_of_month: 10,
    notes: 'Monthly sports & co-curricular activities fee',
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mem.insert('fee_structures', structTuition10);
  mem.insert('fee_structures', structLab10);
  mem.insert('fee_structures', structDev10);
  mem.insert('fee_structures', structSports10);

  // Sample Generated Demands for Aarav Sharma
  const demand1 = {
    id: 'f3000000-0000-0000-0000-000000000001',
    demand_number: 'DEM-2026-00001',
    school_id: schoolA.id,
    student_user_id: uAarav.id,
    student_enrollment_id: enrollAarav.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: secA.id,
    fee_structure_id: structTuition10.id,
    fee_head_id: feeHeadTuition.id,
    billing_period: 'April 2026',
    issue_date: '2026-04-01',
    due_date: '2026-04-10',
    original_amount: 4500,
    discount_amount: 0,
    waiver_amount: 0,
    late_fee_amount: 0,
    net_amount: 4500,
    paid_amount: 4500,
    status: 'PAID',
    created_by: uSuperA.id,
    created_at: '2026-04-01T09:00:00Z',
    updated_at: '2026-04-08T11:30:00Z',
  };

  const demand2 = {
    id: 'f3000000-0000-0000-0000-000000000002',
    demand_number: 'DEM-2026-00002',
    school_id: schoolA.id,
    student_user_id: uAarav.id,
    student_enrollment_id: enrollAarav.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: secA.id,
    fee_structure_id: structSports10.id,
    fee_head_id: feeHeadSports.id,
    billing_period: 'April 2026',
    issue_date: '2026-04-01',
    due_date: '2026-04-10',
    original_amount: 800,
    discount_amount: 0,
    waiver_amount: 0,
    late_fee_amount: 0,
    net_amount: 800,
    paid_amount: 800,
    status: 'PAID',
    created_by: uSuperA.id,
    created_at: '2026-04-01T09:00:00Z',
    updated_at: '2026-04-08T11:30:00Z',
  };

  const demand3 = {
    id: 'f3000000-0000-0000-0000-000000000003',
    demand_number: 'DEM-2026-00003',
    school_id: schoolA.id,
    student_user_id: uAarav.id,
    student_enrollment_id: enrollAarav.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: secA.id,
    fee_structure_id: structTuition10.id,
    fee_head_id: feeHeadTuition.id,
    billing_period: 'May 2026',
    issue_date: '2026-05-01',
    due_date: '2026-05-10',
    original_amount: 4500,
    discount_amount: 0,
    waiver_amount: 0,
    late_fee_amount: 0,
    net_amount: 4500,
    paid_amount: 2000,
    status: 'PARTIALLY_PAID',
    created_by: uSuperA.id,
    created_at: '2026-05-01T09:00:00Z',
    updated_at: '2026-05-10T14:20:00Z',
  };

  const demand4 = {
    id: 'f3000000-0000-0000-0000-000000000004',
    demand_number: 'DEM-2026-00004',
    school_id: schoolA.id,
    student_user_id: uAarav.id,
    student_enrollment_id: enrollAarav.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    class_id: cls10.id,
    section_id: secA.id,
    fee_structure_id: structDev10.id,
    fee_head_id: feeHeadDev.id,
    billing_period: 'AY 2026-27',
    issue_date: '2026-04-01',
    due_date: '2026-06-30',
    original_amount: 10000,
    discount_amount: 0,
    waiver_amount: 0,
    late_fee_amount: 0,
    net_amount: 10000,
    paid_amount: 0,
    status: 'OVERDUE',
    created_by: uSuperA.id,
    created_at: '2026-04-01T09:00:00Z',
    updated_at: '2026-04-01T09:00:00Z',
  };

  mem.insert('student_fee_demands', demand1);
  mem.insert('student_fee_demands', demand2);
  mem.insert('student_fee_demands', demand3);
  mem.insert('student_fee_demands', demand4);

  // Sample Payment 1: April Fees (₹5,300)
  const payment1 = {
    id: 'f4000000-0000-0000-0000-000000000001',
    payment_number: 'PAY-2026-00001',
    school_id: schoolA.id,
    student_user_id: uAarav.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    payment_date: '2026-04-08',
    total_amount: 5300,
    refunded_amount: 0,
    payment_mode: 'UPI',
    transaction_reference: 'UPI/20260408/889912',
    remarks: 'April tuition and sports fee paid online',
    status: 'SUCCESS',
    created_by: uSuperA.id,
    created_at: '2026-04-08T11:30:00Z',
    updated_at: '2026-04-08T11:30:00Z',
  };
  mem.insert('fee_payments', payment1);

  mem.insert('fee_payment_allocations', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    payment_id: payment1.id,
    student_fee_demand_id: demand1.id,
    allocated_amount: 4500,
    created_at: '2026-04-08T11:30:00Z',
  });
  mem.insert('fee_payment_allocations', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    payment_id: payment1.id,
    student_fee_demand_id: demand2.id,
    allocated_amount: 800,
    created_at: '2026-04-08T11:30:00Z',
  });

  const receipt1 = {
    id: 'f5000000-0000-0000-0000-000000000001',
    receipt_number: 'REC-2026-00001',
    school_id: schoolA.id,
    payment_id: payment1.id,
    student_user_id: uAarav.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    receipt_date: '2026-04-08',
    total_amount: 5300,
    status: 'ACTIVE',
    created_by: uSuperA.id,
    created_at: '2026-04-08T11:30:00Z',
  };
  mem.insert('fee_receipts', receipt1);

  // Sample Payment 2: May Partial Payment (₹2,000)
  const payment2 = {
    id: 'f4000000-0000-0000-0000-000000000002',
    payment_number: 'PAY-2026-00002',
    school_id: schoolA.id,
    student_user_id: uAarav.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    payment_date: '2026-05-10',
    total_amount: 2000,
    refunded_amount: 0,
    payment_mode: 'BANK_TRANSFER',
    transaction_reference: 'NEFT/AXIS/44129',
    remarks: 'Partial tuition payment for May 2026',
    status: 'SUCCESS',
    created_by: uSuperA.id,
    created_at: '2026-05-10T14:20:00Z',
    updated_at: '2026-05-10T14:20:00Z',
  };
  mem.insert('fee_payments', payment2);

  mem.insert('fee_payment_allocations', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    payment_id: payment2.id,
    student_fee_demand_id: demand3.id,
    allocated_amount: 2000,
    created_at: '2026-05-10T14:20:00Z',
  });

  const receipt2 = {
    id: 'f5000000-0000-0000-0000-000000000002',
    receipt_number: 'REC-2026-00002',
    school_id: schoolA.id,
    payment_id: payment2.id,
    student_user_id: uAarav.id,
    academic_session_id: sessA2.id,
    location_id: locA1.id,
    receipt_date: '2026-05-10',
    total_amount: 2000,
    status: 'ACTIVE',
    created_by: uSuperA.id,
    created_at: '2026-05-10T14:20:00Z',
  };
  mem.insert('fee_receipts', receipt2);

  // Default Grade Rules Seed
  const defaultGrades = [
    { grade_name: 'A+', min_percentage: 90.00, max_percentage: 100.00, grade_point: 10.0, description: 'Outstanding', status: 'ACTIVE' },
    { grade_name: 'A',  min_percentage: 80.00, max_percentage: 89.99,  grade_point: 9.0,  description: 'Excellent', status: 'ACTIVE' },
    { grade_name: 'B+', min_percentage: 70.00, max_percentage: 79.99,  grade_point: 8.0,  description: 'Very Good', status: 'ACTIVE' },
    { grade_name: 'B',  min_percentage: 60.00, max_percentage: 69.99,  grade_point: 7.0,  description: 'Good', status: 'ACTIVE' },
    { grade_name: 'C+', min_percentage: 50.00, max_percentage: 59.99,  grade_point: 6.0,  description: 'Above Average', status: 'ACTIVE' },
    { grade_name: 'C',  min_percentage: 40.00, max_percentage: 49.99,  grade_point: 5.0,  description: 'Average', status: 'ACTIVE' },
    { grade_name: 'D',  min_percentage: 33.00, max_percentage: 39.99,  grade_point: 4.0,  description: 'Pass', status: 'ACTIVE' },
    { grade_name: 'F',  min_percentage: 0.00,  max_percentage: 32.99,  grade_point: 0.0,  description: 'Needs Improvement', status: 'ACTIVE' },
  ];

  for (const sId of [schoolA.id, schoolB.id]) {
    for (const g of defaultGrades) {
      mem.insert('grade_rules', {
        id: crypto.randomUUID(),
        school_id: sId,
        ...g,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  // ----------------------------------------------------------------------
  // 21. Demo Transport Fleet, Route, Stops & Assignment (Development & Live Mode)
  // ----------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'test') {
    const demoVehicleId = 'b1000000-0000-0000-0000-000000000001';
    mem.insert('vehicles', {
      id: demoVehicleId,
      school_id: schoolA.id,
      location_id: locA1.id,
      vehicle_number: '1091',
      registration_number: 'UP65FK0264',
      vehicle_type: 'SCHOOL_BUS',
      make: 'Tata Motors',
      model: 'Starbus Ultra 40',
      capacity: 40,
      fuel_type: 'DIESEL',
      purchase_date: '2021-03-15',
      insurance_expiry: '2027-03-15',
      fitness_expiry: '2027-03-15',
      permit_expiry: '2027-03-15',
      puc_expiry: '2026-12-31',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mem.insert('vehicle_driver_assignments', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      vehicle_id: demoVehicleId,
      driver_user_id: uRameshDriver.id,
      license_number: 'DL-04-2021-0091823',
      license_expiry: '2030-05-31',
      start_date: '2026-04-01',
      is_primary: true,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const demoRouteId = 'b2000000-0000-0000-0000-000000000001';
    mem.insert('transport_routes', {
      id: demoRouteId,
      school_id: schoolA.id,
      location_id: locA1.id,
      route_name: 'Route 1 - Dwarka North Loop',
      route_code: 'RT-DWK-01',
      route_type: 'BOTH',
      start_point: 'Sector 6 Central Market',
      end_point: 'Dwarka Main Campus',
      estimated_duration_mins: 35,
      distance_km: 12.5,
      assigned_vehicle_id: demoVehicleId,
      primary_driver_user_id: uRameshDriver.id,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const stop1Id = 'b3000000-0000-0000-0000-000000000001';
    const stop2Id = 'b3000000-0000-0000-0000-000000000002';
    const stop3Id = 'b3000000-0000-0000-0000-000000000003';
    mem.insert('transport_route_stops', {
      id: stop1Id,
      school_id: schoolA.id,
      route_id: demoRouteId,
      stop_name: 'Sector 6 Central Market',
      stop_sequence: 1,
      pickup_time: '07:15',
      drop_time: '14:45',
      landmark: 'Opposite State Bank',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('transport_route_stops', {
      id: stop2Id,
      school_id: schoolA.id,
      route_id: demoRouteId,
      stop_name: 'Sector 10 Metro Station',
      stop_sequence: 2,
      pickup_time: '07:30',
      drop_time: '14:30',
      landmark: 'Gate No. 2 Bus Stand',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('transport_route_stops', {
      id: stop3Id,
      school_id: schoolA.id,
      route_id: demoRouteId,
      stop_name: 'Dwarka Main Campus Gate 1',
      stop_sequence: 3,
      pickup_time: '07:50',
      drop_time: '14:10',
      landmark: 'Main School Entrance',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mem.insert('student_transport_assignments', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      academic_session_id: sessA2.id,
      location_id: locA1.id,
      student_user_id: uAarav.id,
      route_id: demoRouteId,
      vehicle_id: demoVehicleId,
      pickup_stop_id: stop1Id,
      drop_stop_id: stop3Id,
      seat_number: '12',
      start_date: '2026-04-01',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // ------------------------------------------------------------------------
  // 22. Demo Inventory Seed (Always Seeded for Local Dev & Test Suites)
  // ------------------------------------------------------------------------
  const catStationeryId = crypto.randomUUID();
    const catUniformId = crypto.randomUUID();
    mem.insert('inventory_categories', {
      id: catStationeryId,
      school_id: schoolA.id,
      code: 'CAT-STAT',
      name: 'Stationery & Books',
      description: 'Notebooks, writing materials and course literature',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('inventory_categories', {
      id: catUniformId,
      school_id: schoolA.id,
      code: 'CAT-UNIF',
      name: 'School Uniforms',
      description: 'Official student dress code and sportswear',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const subcatNotebooksId = crypto.randomUUID();
    mem.insert('inventory_subcategories', {
      id: subcatNotebooksId,
      school_id: schoolA.id,
      category_id: catStationeryId,
      code: 'SUBCAT-NB',
      name: 'Notebooks & Registers',
      description: 'Ruled, unruled, and grid notebooks',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const uomPcsId = crypto.randomUUID();
    const uomPktId = crypto.randomUUID();
    mem.insert('inventory_uoms', {
      id: uomPcsId,
      school_id: schoolA.id,
      code: 'UOM-PCS',
      name: 'Pieces',
      symbol: 'pcs',
      is_fractional: false,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('inventory_uoms', {
      id: uomPktId,
      school_id: schoolA.id,
      code: 'UOM-PKT',
      name: 'Packet / Pack',
      symbol: 'pkt',
      is_fractional: false,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const brandClassmateId = crypto.randomUUID();
    mem.insert('inventory_brands', {
      id: brandClassmateId,
      school_id: schoolA.id,
      code: 'BR-CLASS',
      name: 'Classmate ITC',
      description: 'Premium stationery products',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const vendorAbcId = crypto.randomUUID();
    mem.insert('inventory_vendors', {
      id: vendorAbcId,
      school_id: schoolA.id,
      code: 'VEND-ABC',
      name: 'ABC Educational Supplies Ltd.',
      contact_person: 'Virendra Sachdeva',
      email: 'sales@abcsupplies.com',
      phone: '+91 98110 54321',
      address: 'Plot 45, Okhla Industrial Area Phase 2, New Delhi',
      tax_id: '07AAAAA0000A1Z5',
      payment_terms: 'Net 30',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const prodNotebookId = crypto.randomUUID();
    mem.insert('products', {
      id: prodNotebookId,
      school_id: schoolA.id,
      code: 'PROD-NB-A4',
      name: 'Classmate A4 Ruled Notebook (200 Pgs)',
      category_id: catStationeryId,
      subcategory_id: subcatNotebooksId,
      uom_id: uomPcsId,
      brand_id: brandClassmateId,
      description: 'Single ruled notebook for secondary students',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const skuNotebookId = crypto.randomUUID();
    mem.insert('skus', {
      id: skuNotebookId,
      school_id: schoolA.id,
      product_id: prodNotebookId,
      sku_code: 'NOTE-A4-200',
      sku_name: 'Classmate A4 Ruled Notebook (200 Pgs)',
      barcode: '8901234000101',
      category_id: catStationeryId,
      subcategory_id: subcatNotebooksId,
      uom_id: uomPcsId,
      brand_id: brandClassmateId,
      description: 'Single ruled notebook for secondary students',
      reorder_level: 25,
      min_order_qty: 10,
      cost_price: 55.0,
      selling_price: 75.0,
      attributes: { pages: '200', ruling: 'Single Ruled', size: 'A4' },
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Materialized stock balance
    const stockId = crypto.randomUUID();
    mem.insert('inventory_stock', {
      id: stockId,
      school_id: schoolA.id,
      location_id: locA1.id,
      sku_id: skuNotebookId,
      quantity: 150,
      reserved_quantity: 0,
      min_quantity: 10,
      reorder_point: 25,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Opening stock ledger entry
    mem.insert('inventory_stock_ledger', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      location_id: locA1.id,
      sku_id: skuNotebookId,
      movement_type: 'OPENING',
      reference_type: 'OPENING_STOCK',
      reference_id: stockId,
      quantity: 150,
      previous_balance: 0,
      new_balance: 150,
      unit_cost: 55.0,
      notes: 'Initial inventory baseline initialization',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
    });

    // Sample Purchase Order (ORDERED)
    const demoPoId = crypto.randomUUID();
    mem.insert('purchase_orders', {
      id: demoPoId,
      school_id: schoolA.id,
      location_id: locA1.id,
      po_number: 'PO-2026-100045',
      vendor_id: vendorAbcId,
      order_date: '2026-04-10',
      expected_date: '2026-04-20',
      status: 'ORDERED',
      subtotal: 5500.0,
      tax_amount: 275.0,
      total_amount: 5775.0,
      notes: 'Semester 1 replenishment of Classmate notebooks',
      created_by: uSuperA.id,
      updated_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('purchase_order_items', {
      id: crypto.randomUUID(),
      po_id: demoPoId,
      sku_id: skuNotebookId,
      quantity_ordered: 100,
      quantity_received: 0,
      unit_price: 55.0,
      tax_rate: 5.0,
      total_price: 5775.0,
      created_at: new Date().toISOString(),
    });

    // ========================================================================
    // ASSET MANAGEMENT DEMO SEED (Delhi Public Academy - School A)
    // ========================================================================
    const catITId = 'ac100000-0000-0000-0000-000000000001';
    const catFurnId = 'ac100000-0000-0000-0000-000000000002';
    const catElecId = 'ac100000-0000-0000-0000-000000000003';
    const catLabId = 'ac100000-0000-0000-0000-000000000004';
    const catAVId = 'ac100000-0000-0000-0000-000000000005';

    mem.insert('asset_categories', {
      id: catITId,
      school_id: schoolA.id,
      code: 'CAT-IT',
      name: 'IT Equipment & Hardware',
      description: 'Computers, servers, laptops, printers, and network switches',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('asset_categories', {
      id: catFurnId,
      school_id: schoolA.id,
      code: 'CAT-FURN',
      name: 'Classroom & Office Furniture',
      description: 'Desks, ergonomic chairs, almirahs, and library storage racks',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('asset_categories', {
      id: catElecId,
      school_id: schoolA.id,
      code: 'CAT-ELEC',
      name: 'Electrical & Climate Control',
      description: 'Air conditioners, commercial UPS inverters, and backup generators',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('asset_categories', {
      id: catLabId,
      school_id: schoolA.id,
      code: 'CAT-LAB',
      name: 'Science & Lab Apparatus',
      description: 'High-precision microscopes, analytical balances, and lab hardware',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('asset_categories', {
      id: catAVId,
      school_id: schoolA.id,
      code: 'CAT-AV',
      name: 'Audio Visual & Smart Class',
      description: 'Interactive smart touchscreens, laser projectors, and PA systems',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Subcategories
    const subcatLaptops = 'as100000-0000-0000-0000-000000000001';
    const subcatProjectors = 'as100000-0000-0000-0000-000000000002';
    const subcatAC = 'as100000-0000-0000-0000-000000000003';
    const subcatPrinters = 'as100000-0000-0000-0000-000000000004';
    const subcatMicroscopes = 'as100000-0000-0000-0000-000000000005';
    const subcatAlmirah = 'as100000-0000-0000-0000-000000000006';

    mem.insert('asset_subcategories', {
      id: subcatLaptops,
      school_id: schoolA.id,
      category_id: catITId,
      code: 'SUB-LAP',
      name: 'Staff & Lab Laptops',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('asset_subcategories', {
      id: subcatProjectors,
      school_id: schoolA.id,
      category_id: catAVId,
      code: 'SUB-PROJ',
      name: 'Digital Projectors',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('asset_subcategories', {
      id: subcatAC,
      school_id: schoolA.id,
      category_id: catElecId,
      code: 'SUB-AC',
      name: 'Split & Cassette ACs',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('asset_subcategories', {
      id: subcatPrinters,
      school_id: schoolA.id,
      category_id: catITId,
      code: 'SUB-PRN',
      name: 'Multifunction Printers',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('asset_subcategories', {
      id: subcatMicroscopes,
      school_id: schoolA.id,
      category_id: catLabId,
      code: 'SUB-MIC',
      name: 'Binocular Microscopes',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('asset_subcategories', {
      id: subcatAlmirah,
      school_id: schoolA.id,
      category_id: catFurnId,
      code: 'SUB-ALM',
      name: 'Steel Almirahs & Cabinets',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Demo Assets
    const ast1Id = 'af100000-0000-0000-0000-000000000001';
    const ast2Id = 'af100000-0000-0000-0000-000000000002';
    const ast3Id = 'af100000-0000-0000-0000-000000000003';
    const ast4Id = 'af100000-0000-0000-0000-000000000004';
    const ast5Id = 'af100000-0000-0000-0000-000000000005';
    const ast6Id = 'af100000-0000-0000-0000-000000000006';

    mem.insert('assets', {
      id: ast1Id,
      school_id: schoolA.id,
      current_location_id: locA1.id,
      location_id: locA1.id,
      asset_code: 'AST-2026-000001',
      asset_name: 'Dell Latitude 5440 Laptop (14" FHD / Core i7 / 16GB / 512GB)',
      name: 'Dell Latitude 5440 Laptop (14" FHD / Core i7 / 16GB / 512GB)',
      category_id: catITId,
      subcategory_id: subcatLaptops,
      brand: 'Dell',
      model: 'Latitude 5440',
      serial_number: 'DL-LAT-884912',
      room_number: 'Faculty Room 204',
      building: 'Block A, 2nd Floor',
      department: 'Senior Science Dept',
      status: 'ASSIGNED',
      condition: 'GOOD',
      current_custodian_user_id: uVikram.id,
      custodian_id: uVikram.id,
      assigned_to_user_id: uVikram.id,
      purchase_date: '2025-06-15',
      purchase_price: 68500.0,
      salvage_value: 5000.0,
      useful_life_years: 4,
      warranty_end_date: '2028-06-14',
      vendor_id: vendorAbcId,
      barcode: '890100100001',
      asset_tag: 'DPA-IT-001',
      remarks: 'Dedicated faculty laptop issued for senior physics instruction',
      created_by: uSuperA.id,
      updated_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mem.insert('assets', {
      id: ast2Id,
      school_id: schoolA.id,
      current_location_id: locA1.id,
      location_id: locA1.id,
      asset_code: 'AST-2026-000002',
      asset_name: 'Epson EB-E01 3LCD Projector 3300 Lumens',
      name: 'Epson EB-E01 3LCD Projector 3300 Lumens',
      category_id: catAVId,
      subcategory_id: subcatProjectors,
      brand: 'Epson',
      model: 'EB-E01',
      serial_number: 'EPS-PROJ-44321',
      room_number: 'Smart Room 102',
      building: 'Academic Wing B',
      department: 'Academics',
      status: 'AVAILABLE',
      condition: 'GOOD',
      purchase_date: '2025-08-10',
      purchase_price: 38900.0,
      salvage_value: 2000.0,
      useful_life_years: 5,
      warranty_end_date: '2027-08-09',
      vendor_id: vendorAbcId,
      barcode: '890100100002',
      asset_tag: 'DPA-AV-002',
      remarks: 'Mounted ceiling projector in Smart Class 102',
      created_by: uSuperA.id,
      updated_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mem.insert('assets', {
      id: ast3Id,
      school_id: schoolA.id,
      current_location_id: locA1.id,
      location_id: locA1.id,
      asset_code: 'AST-2026-000003',
      asset_name: 'Daikin 2.0 Ton Inverter Split Air Conditioner',
      name: 'Daikin 2.0 Ton Inverter Split Air Conditioner',
      category_id: catElecId,
      subcategory_id: subcatAC,
      brand: 'Daikin',
      model: 'FTKF60TV',
      serial_number: 'DK-AC-992102',
      room_number: 'Server Room 01',
      building: 'IT Complex Ground',
      department: 'IT Infrastructure',
      status: 'UNDER_MAINTENANCE',
      condition: 'FAIR',
      purchase_date: '2024-04-20',
      purchase_price: 54000.0,
      salvage_value: 3000.0,
      useful_life_years: 8,
      warranty_end_date: '2029-04-19',
      vendor_id: vendorAbcId,
      barcode: '890100100003',
      asset_tag: 'DPA-ELEC-003',
      remarks: 'Scheduled compressor coolant recharge and coil cleaning',
      created_by: uSuperA.id,
      updated_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mem.insert('assets', {
      id: ast4Id,
      school_id: schoolA.id,
      current_location_id: locA1.id,
      location_id: locA1.id,
      asset_code: 'AST-2026-000004',
      asset_name: 'HP LaserJet Pro MFP 4104dw Wireless All-in-One Printer',
      name: 'HP LaserJet Pro MFP 4104dw Wireless All-in-One Printer',
      category_id: catITId,
      subcategory_id: subcatPrinters,
      brand: 'HP',
      model: 'MFP 4104dw',
      serial_number: 'HP-PRN-554421',
      room_number: 'Admin Office',
      building: 'Administrative Wing',
      department: 'Administration',
      status: 'AVAILABLE',
      condition: 'GOOD',
      purchase_date: '2025-03-12',
      purchase_price: 36500.0,
      salvage_value: 2000.0,
      useful_life_years: 5,
      warranty_end_date: '2027-03-11',
      vendor_id: vendorAbcId,
      barcode: '890100100004',
      asset_tag: 'DPA-IT-004',
      remarks: 'Heavy duty duplex network printer for fee receipts and circulars',
      created_by: uSuperA.id,
      updated_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mem.insert('assets', {
      id: ast5Id,
      school_id: schoolA.id,
      current_location_id: locA2.id,
      location_id: locA2.id,
      asset_code: 'AST-2026-000005',
      asset_name: 'Olympus CX23 Binocular Biological Microscope LED',
      name: 'Olympus CX23 Binocular Biological Microscope LED',
      category_id: catLabId,
      subcategory_id: subcatMicroscopes,
      brand: 'Olympus',
      model: 'CX23-RFS2',
      serial_number: 'OLY-MIC-33109',
      room_number: 'Biology Lab 03',
      building: 'Noida Science Wing',
      department: 'Science & Lab',
      status: 'AVAILABLE',
      condition: 'NEW',
      purchase_date: '2025-11-05',
      purchase_price: 29500.0,
      salvage_value: 2000.0,
      useful_life_years: 10,
      warranty_end_date: '2028-11-04',
      vendor_id: vendorAbcId,
      barcode: '890100100005',
      asset_tag: 'DPA-LAB-005',
      remarks: 'New batch microscope for senior biology practicals at Noida campus',
      created_by: uSuperA.id,
      updated_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mem.insert('assets', {
      id: ast6Id,
      school_id: schoolA.id,
      current_location_id: locA1.id,
      location_id: locA1.id,
      asset_code: 'AST-2026-000006',
      asset_name: 'Godrej 4-Shelf Heavy Duty Steel Almirah with Digital Locker',
      name: 'Godrej 4-Shelf Heavy Duty Steel Almirah with Digital Locker',
      category_id: catFurnId,
      subcategory_id: subcatAlmirah,
      brand: 'Godrej Interio',
      model: 'Storwel Plain Plus',
      serial_number: 'GD-ALM-10293',
      room_number: 'Examination Record Vault',
      building: 'Administrative Wing',
      department: 'Examinations',
      status: 'AVAILABLE',
      condition: 'GOOD',
      purchase_date: '2024-02-18',
      purchase_price: 22400.0,
      salvage_value: 3000.0,
      useful_life_years: 15,
      warranty_end_date: '2034-02-17',
      vendor_id: vendorAbcId,
      barcode: '890100100006',
      asset_tag: 'DPA-FURN-006',
      remarks: 'Secure storage for CBSE examination papers and master registers',
      created_by: uSuperA.id,
      updated_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Asset Assignment for AST-2026-000001
    mem.insert('asset_assignments', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      asset_id: ast1Id,
      assigned_to_user_id: uVikram.id,
      user_id: uVikram.id,
      location_id: locA1.id,
      assigned_by: uSuperA.id,
      assignment_date: '2025-06-20',
      expected_return_date: '2026-05-30',
      actual_return_date: null,
      condition_at_assignment: 'NEW',
      remarks: 'Handed over in pristine boxed condition with charger and bag',
      is_active: true,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Asset Maintenance for AST-2026-000003
    mem.insert('asset_maintenance', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      asset_id: ast3Id,
      maintenance_type: 'PREVENTIVE',
      service_date: '2026-04-12',
      scheduled_date: '2026-04-12',
      vendor_id: vendorAbcId,
      service_provider: 'CoolTech Facilities Support',
      issue_description: 'Quarterly Server Room Cooling Overhaul: Filter cleaning, refrigerant pressure test, and condenser coil descaling',
      work_performed: 'Filter cleaned, refrigerant topped up 400g, condenser fan inspected',
      cost: 3200.0,
      warranty_claim: false,
      status: 'IN_PROGRESS',
      previous_asset_status: 'AVAILABLE',
      remarks: 'Technician on-site servicing compressor unit',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Asset Movement History for AST-2026-000001
    mem.insert('asset_movements', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      asset_id: ast1Id,
      from_location_id: locA1.id,
      to_location_id: locA1.id,
      from_room: 'Central IT Store 101',
      to_room: 'Faculty Room 204',
      movement_date: '2025-06-20',
      reason: 'Assigned to Senior Faculty member',
      condition: 'GOOD',
      moved_by: uSuperA.id,
      remarks: 'Initial deployment from central IT warehouse inventory',
      created_at: new Date().toISOString(),
    });

    // ========================================================================
    // 20. Library Management Module Seed Data
    // ========================================================================

    // Library Settings
    mem.insert('library_settings', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      loan_period_days: 14,
      maximum_books_per_member: 3,
      student_issue_limit: 3,
      staff_issue_limit: 5,
      maximum_renewals: 2,
      fine_per_day: 5.00,
      grace_period_days: 1,
      reservation_enabled: true,
      reservation_expiry_days: 7,
      auto_fine_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Library Categories
    const catMathId = crypto.randomUUID();
    mem.insert('library_categories', {
      id: catMathId,
      school_id: schoolA.id,
      name: 'Mathematics',
      code: 'MATH',
      description: 'Algebra, Geometry, Calculus, and Secondary Textbooks',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const catScienceId = crypto.randomUUID();
    mem.insert('library_categories', {
      id: catScienceId,
      school_id: schoolA.id,
      name: 'Science & Technology',
      code: 'SCI',
      description: 'Physics, Chemistry, Biology, and Computer Science',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const catLitId = crypto.randomUUID();
    mem.insert('library_categories', {
      id: catLitId,
      school_id: schoolA.id,
      name: 'Literature & Fiction',
      code: 'LIT',
      description: 'Classics, Novels, Short Stories, and Poetry',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const catRefId = crypto.randomUUID();
    mem.insert('library_categories', {
      id: catRefId,
      school_id: schoolA.id,
      name: 'Biographies & General Knowledge',
      code: 'REF',
      description: 'Autobiographies, Encyclopedias, and Reference Manuals',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Authors
    const authRdSharmaId = crypto.randomUUID();
    mem.insert('library_authors', {
      id: authRdSharmaId,
      school_id: schoolA.id,
      name: 'Dr. R.D. Sharma',
      biography: 'Renowned Indian mathematician and educator known for CBSE textbooks',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const authHcVermaId = crypto.randomUUID();
    mem.insert('library_authors', {
      id: authHcVermaId,
      school_id: schoolA.id,
      name: 'Prof. H.C. Verma',
      biography: 'Indian experimental physicist and author of Concepts of Physics',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const authKiplingId = crypto.randomUUID();
    mem.insert('library_authors', {
      id: authKiplingId,
      school_id: schoolA.id,
      name: 'Rudyard Kipling',
      biography: 'English novelist, short-story writer, poet, and Nobel laureate',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const authKalamId = crypto.randomUUID();
    mem.insert('library_authors', {
      id: authKalamId,
      school_id: schoolA.id,
      name: 'Dr. A.P.J. Abdul Kalam',
      biography: '11th President of India and aerospace scientist',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Publishers
    const pubNcertId = crypto.randomUUID();
    mem.insert('library_publishers', {
      id: pubNcertId,
      school_id: schoolA.id,
      name: 'NCERT Publishing',
      contact: 'Publication Division',
      email: 'contact@ncert.nic.in',
      phone: '+91 11 2656 0464',
      address: 'Sri Aurobindo Marg, New Delhi',
      website: 'https://ncert.nic.in',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const pubBharatiId = crypto.randomUUID();
    mem.insert('library_publishers', {
      id: pubBharatiId,
      school_id: schoolA.id,
      name: 'Bharati Bhawan Publishers',
      contact: 'Sales Department',
      email: 'info@bharatibhawan.com',
      phone: '+91 11 2327 6535',
      address: 'Ansari Road, Daryaganj, New Delhi',
      website: 'https://bharatibhawan.com',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const pubPenguinId = crypto.randomUUID();
    mem.insert('library_publishers', {
      id: pubPenguinId,
      school_id: schoolA.id,
      name: 'Penguin Random House India',
      contact: 'Distribution Desk',
      email: 'sales@penguinrandomhouse.in',
      phone: '+91 12 4478 5600',
      address: 'Infinity Tower C, DLF Cyber City, Gurugram',
      website: 'https://penguin.co.in',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const pubUnivId = crypto.randomUUID();
    mem.insert('library_publishers', {
      id: pubUnivId,
      school_id: schoolA.id,
      name: 'Universities Press',
      contact: 'Customer Relations',
      email: 'info@universitiespress.com',
      phone: '+91 40 2766 2849',
      address: 'Himayatnagar, Hyderabad',
      website: 'https://universitiespress.com',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Books
    const book1Id = crypto.randomUUID();
    mem.insert('library_books', {
      id: book1Id,
      school_id: schoolA.id,
      accession_reference: 'REF-MTH-10-01',
      isbn: '978-8174507006',
      title: 'Mathematics for Class 10',
      subtitle: 'Comprehensive CBSE Textbook and Practice Problems',
      category_id: catMathId,
      publisher_id: pubNcertId,
      publication_year: 2024,
      edition: '12th Edition',
      language: 'English',
      pages: 480,
      description: 'Standard prescribed curriculum mathematics textbook for secondary class 10 boards',
      subject: 'Mathematics',
      class_level: 'Class 10',
      price: 350.00,
      status: 'ACTIVE',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('library_book_authors', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      book_id: book1Id,
      author_id: authRdSharmaId,
      is_primary: true,
      created_at: new Date().toISOString(),
    });

    const book2Id = crypto.randomUUID();
    mem.insert('library_books', {
      id: book2Id,
      school_id: schoolA.id,
      accession_reference: 'REF-PHY-11-01',
      isbn: '978-8177091878',
      title: 'Concepts of Physics - Volume 1',
      subtitle: 'Mechanics, Waves, and Thermodynamics',
      category_id: catScienceId,
      publisher_id: pubBharatiId,
      publication_year: 2023,
      edition: 'Revised Standard',
      language: 'English',
      pages: 462,
      description: 'Foundational physics textbook with conceptual questions and numericals',
      subject: 'Physics',
      class_level: 'Class 11',
      price: 450.00,
      status: 'ACTIVE',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('library_book_authors', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      book_id: book2Id,
      author_id: authHcVermaId,
      is_primary: true,
      created_at: new Date().toISOString(),
    });

    const book3Id = crypto.randomUUID();
    mem.insert('library_books', {
      id: book3Id,
      school_id: schoolA.id,
      accession_reference: 'REF-LIT-001',
      isbn: '978-0141325293',
      title: 'The Jungle Book',
      subtitle: 'Classic Children Stories of Mowgli and Baloo',
      category_id: catLitId,
      publisher_id: pubPenguinId,
      publication_year: 2021,
      edition: 'Puffin Classics',
      language: 'English',
      pages: 224,
      description: 'Classic adventure novel set in the Indian Seoni jungle',
      subject: 'Literature',
      class_level: 'All Classes',
      price: 250.00,
      status: 'ACTIVE',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('library_book_authors', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      book_id: book3Id,
      author_id: authKiplingId,
      is_primary: true,
      created_at: new Date().toISOString(),
    });

    const book4Id = crypto.randomUUID();
    mem.insert('library_books', {
      id: book4Id,
      school_id: schoolA.id,
      accession_reference: 'REF-BIO-001',
      isbn: '978-8173711466',
      title: 'Wings of Fire',
      subtitle: 'An Autobiography of APJ Abdul Kalam',
      category_id: catRefId,
      publisher_id: pubUnivId,
      publication_year: 2022,
      edition: 'Illustrated Special Edition',
      language: 'English',
      pages: 180,
      description: 'Inspirational journey of Dr. Kalam from Rameswaram to leading the missile defense program',
      subject: 'General Knowledge',
      class_level: 'All Classes',
      price: 300.00,
      status: 'ACTIVE',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mem.insert('library_book_authors', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      book_id: book4Id,
      author_id: authKalamId,
      is_primary: true,
      created_at: new Date().toISOString(),
    });

    // Book Copies
    const copy1Id = crypto.randomUUID();
    mem.insert('library_book_copies', {
      id: copy1Id,
      school_id: schoolA.id,
      book_id: book1Id,
      copy_code: 'LIB-2026-000001',
      accession_number: 'ACC-00101',
      barcode: 'BC-LIB-000001',
      purchase_date: '2025-04-10',
      purchase_price: 350.00,
      location_id: locA1.id,
      room: 'Central Library Hall',
      rack: 'M1',
      shelf: 'S2',
      condition: 'GOOD',
      status: 'ISSUED',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const copy2Id = crypto.randomUUID();
    mem.insert('library_book_copies', {
      id: copy2Id,
      school_id: schoolA.id,
      book_id: book1Id,
      copy_code: 'LIB-2026-000002',
      accession_number: 'ACC-00102',
      barcode: 'BC-LIB-000002',
      purchase_date: '2025-04-10',
      purchase_price: 350.00,
      location_id: locA1.id,
      room: 'Central Library Hall',
      rack: 'M1',
      shelf: 'S2',
      condition: 'NEW',
      status: 'AVAILABLE',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const copy3Id = crypto.randomUUID();
    mem.insert('library_book_copies', {
      id: copy3Id,
      school_id: schoolA.id,
      book_id: book1Id,
      copy_code: 'LIB-2026-000003',
      accession_number: 'ACC-00103',
      barcode: 'BC-LIB-000003',
      purchase_date: '2025-04-10',
      purchase_price: 350.00,
      location_id: locA1.id,
      room: 'Central Library Hall',
      rack: 'M1',
      shelf: 'S2',
      condition: 'FAIR',
      status: 'AVAILABLE',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const copy4Id = crypto.randomUUID();
    mem.insert('library_book_copies', {
      id: copy4Id,
      school_id: schoolA.id,
      book_id: book2Id,
      copy_code: 'LIB-2026-000004',
      accession_number: 'ACC-00104',
      barcode: 'BC-LIB-000004',
      purchase_date: '2025-05-15',
      purchase_price: 450.00,
      location_id: locA1.id,
      room: 'Central Library Hall',
      rack: 'P1',
      shelf: 'S1',
      condition: 'GOOD',
      status: 'AVAILABLE',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const copy5Id = crypto.randomUUID();
    mem.insert('library_book_copies', {
      id: copy5Id,
      school_id: schoolA.id,
      book_id: book3Id,
      copy_code: 'LIB-2026-000005',
      accession_number: 'ACC-00105',
      barcode: 'BC-LIB-000005',
      purchase_date: '2025-06-01',
      purchase_price: 250.00,
      location_id: locA1.id,
      room: 'Junior Reading Lounge',
      rack: 'L1',
      shelf: 'S3',
      condition: 'GOOD',
      status: 'AVAILABLE',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const copy6Id = crypto.randomUUID();
    mem.insert('library_book_copies', {
      id: copy6Id,
      school_id: schoolA.id,
      book_id: book4Id,
      copy_code: 'LIB-2026-000006',
      accession_number: 'ACC-00106',
      barcode: 'BC-LIB-000006',
      purchase_date: '2025-06-01',
      purchase_price: 300.00,
      location_id: locA1.id,
      room: 'Central Library Hall',
      rack: 'B1',
      shelf: 'S1',
      condition: 'GOOD',
      status: 'AVAILABLE',
      created_by: uSuperA.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Library Members
    mem.insert('library_members', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      user_id: uAarav.id,
      membership_number: 'MEM-2026-0001',
      membership_type: 'STUDENT',
      status: 'ACTIVE',
      max_books_allowed: 3,
      joined_date: '2024-04-01',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mem.insert('library_members', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      user_id: uVikram.id,
      membership_number: 'MEM-2026-0002',
      membership_type: 'TEACHER',
      status: 'ACTIVE',
      max_books_allowed: 5,
      joined_date: '2024-04-01',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Active Library Issue
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nineDaysAhead = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    mem.insert('library_issues', {
      id: crypto.randomUUID(),
      school_id: schoolA.id,
      member_user_id: uAarav.id,
      book_id: book1Id,
      book_copy_id: copy1Id,
      issue_date: fiveDaysAgo,
      due_date: nineDaysAhead,
      return_date: null,
      renewal_count: 0,
      status: 'ISSUED',
      issued_by: uSuperA.id,
      remarks: 'Issued for secondary mathematics preparation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  // Initial audit log
  mem.insert('audit_logs', {
    id: crypto.randomUUID(),
    school_id: schoolA.id,
    user_id: uSuperA.id,
    action: 'INIT',
    module: 'SYSTEM',
    entity_name: 'seed',
    record_id: 'SYSTEM_BOOT',
    new_values: { seeded: true, users_count: 9, designations_count: 11 },
    ip_address: '127.0.0.1',
    user_agent: 'SeedScript/1.0',
    created_at: new Date().toISOString(),
  });
}

