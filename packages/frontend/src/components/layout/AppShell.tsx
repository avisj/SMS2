// ========================================================================
// AppShell Component
// Combines Category Sidebar, Header, WorkspaceTabBar, and Multitasking Tab Screens
// Up to 8 open tabs with full state and DOM preservation
// ========================================================================

import React from 'react';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { WorkspaceTabBar } from '../workspace/WorkspaceTabBar.js';
import { WorkspaceOverflowModal } from '../workspace/WorkspaceOverflowModal.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';

// Module Components
import { DashboardModule } from '../../modules/dashboard/DashboardModule.js';
import { SchoolsModule } from '../../modules/schools/SchoolsModule.js';
import { LocationsModule } from '../../modules/locations/LocationsModule.js';
import { UsersModule } from '../../modules/users/UsersModule.js';
import { StudentsMasterModule } from '../../modules/students/StudentsMasterModule.js';
import { StaffMasterModule } from '../../modules/staff/StaffMasterModule.js';
import { ParentsMasterModule } from '../../modules/parents/ParentsMasterModule.js';
import { AdmissionsModule } from '../../modules/admissions/AdmissionsModule.js';
import { DesignationsModule } from '../../modules/designations/DesignationsModule.js';
import { CategoriesTypesModule } from '../../modules/taxonomy/CategoriesTypesModule.js';
import { TagsLabelsModule } from '../../modules/taxonomy/TagsLabelsModule.js';
import { TaxonomyMasterModule } from '../../modules/taxonomy/TaxonomyMasterModule.js';

// Academic Separated Modules
import { ClassesMasterModule } from '../../modules/academics/ClassesMasterModule.js';
import { SectionsMasterModule } from '../../modules/academics/SectionsMasterModule.js';
import { ClassSectionSetupModule } from '../../modules/academics/ClassSectionSetupModule.js';
import { SubjectsMasterModule } from '../../modules/academics/SubjectsMasterModule.js';
import { SubjectGroupsModule } from '../../modules/academics/SubjectGroupsModule.js';
import { SubjectOfferingsModule } from '../../modules/academics/SubjectOfferingsModule.js';
import { StudentAssignmentModule } from '../../modules/academics/StudentAssignmentModule.js';
import { TeacherAssignmentsModule } from '../../modules/academics/TeacherAssignmentsModule.js';
import { MyTeachingScheduleModule } from '../../modules/academics/MyTeachingScheduleModule.js';
import { TimetableConfigModule } from '../../modules/timetable/TimetableConfigModule.js';
import { StudentTimetableModule } from '../../modules/timetable/StudentTimetableModule.js';

// Attendance Modules
import { StudentAttendanceModule } from '../../modules/attendance/StudentAttendanceModule.js';
import { StaffAttendanceModule } from '../../modules/attendance/StaffAttendanceModule.js';
import { AttendanceHistoryModule } from '../../modules/attendance/AttendanceHistoryModule.js';
import { AttendanceDashboardModule } from '../../modules/attendance/AttendanceDashboardModule.js';
import { AttendanceReportsModule } from '../../modules/attendance/AttendanceReportsModule.js';

// Access & Security Separated Modules
import { RolesMasterModule } from '../../modules/roles/RolesMasterModule.js';
import { RightsMasterModule } from '../../modules/roles/RightsMasterModule.js';
import { RoleRightsModule } from '../../modules/roles/RoleRightsModule.js';
import { UserRolesModule } from '../../modules/roles/UserRolesModule.js';
import { AccessScopeModule } from '../../modules/roles/AccessScopeModule.js';
import { RolesPermissionsModule } from '../../modules/roles/RolesPermissionsModule.js';

import { AlertTriangle } from 'lucide-react';

// Settings & System Modules
import { CategorizedSettingsModule } from '../../modules/settings/CategorizedSettingsModule.js';
import { FeatureConfigModule } from '../../modules/features/FeatureConfigModule.js';
import { AuditLogsModule } from '../../modules/audit/AuditLogsModule.js';

// Fees Management Modules
import { FeeDashboardModule } from '../../modules/fees/FeeDashboardModule.js';
import { FeeHeadsModule } from '../../modules/fees/FeeHeadsModule.js';
import { FeeStructuresModule } from '../../modules/fees/FeeStructuresModule.js';
import { StudentFeeAssignmentModule } from '../../modules/fees/StudentFeeAssignmentModule.js';
import { FeeCollectionModule } from '../../modules/fees/FeeCollectionModule.js';
import { FeeReceiptsModule } from '../../modules/fees/FeeReceiptsModule.js';
import { FeeOutstandingModule } from '../../modules/fees/FeeOutstandingModule.js';
import { FeeDiscountsModule } from '../../modules/fees/FeeDiscountsModule.js';
import { FeeRefundsModule } from '../../modules/fees/FeeRefundsModule.js';
import { FeeReportsModule } from '../../modules/fees/FeeReportsModule.js';

// Exams & Results Modules
import { ExamDashboardModule } from '../../modules/exams/ExamDashboardModule.js';
import { ExamMasterModule } from '../../modules/exams/ExamMasterModule.js';
import { ExamStructureModule } from '../../modules/exams/ExamStructureModule.js';
import { ExamScheduleModule } from '../../modules/exams/ExamScheduleModule.js';
import { MarksEntryModule } from '../../modules/exams/MarksEntryModule.js';
import { ExamResultsModule } from '../../modules/exams/ExamResultsModule.js';
import { ReportCardsModule } from '../../modules/exams/ReportCardsModule.js';
import { ExamReportsModule } from '../../modules/exams/ExamReportsModule.js';

// Communication Modules
import { CommunicationDashboardModule } from '../../modules/communication/CommunicationDashboardModule.js';
import { AnnouncementsNoticesModule } from '../../modules/communication/AnnouncementsNoticesModule.js';
import { ComposeCommunicationModule } from '../../modules/communication/ComposeCommunicationModule.js';
import { CommunicationTemplatesModule } from '../../modules/communication/CommunicationTemplatesModule.js';
import { CommunicationHistoryModule } from '../../modules/communication/CommunicationHistoryModule.js';
import { DeliveryReportsModule } from '../../modules/communication/DeliveryReportsModule.js';
import { CommunicationInboxModule } from '../../modules/communication/CommunicationInboxModule.js';

// Transport Management Modules
import { TransportDashboardModule } from '../../modules/transport/TransportDashboardModule.js';
import { VehicleMasterModule } from '../../modules/transport/VehicleMasterModule.js';
import { DriverStaffModule } from '../../modules/transport/DriverStaffModule.js';
import { RouteMasterModule } from '../../modules/transport/RouteMasterModule.js';
import { RouteStopsModule } from '../../modules/transport/RouteStopsModule.js';
import { StudentTransportAssignmentModule } from '../../modules/transport/StudentTransportAssignmentModule.js';
import { DailyTripsModule } from '../../modules/transport/DailyTripsModule.js';
import { GpsLiveTrackingModule } from '../../modules/transport/GpsLiveTrackingModule.js';
import { TransportReportsModule } from '../../modules/transport/TransportReportsModule.js';

// Inventory & Order Management Modules
import { InventoryDashboardModule } from '../../modules/inventory/InventoryDashboardModule.js';
import { SkuMasterModule } from '../../modules/inventory/SkuMasterModule.js';
import { CategoriesModule as InventoryCategoriesModule } from '../../modules/inventory/CategoriesModule.js';
import { SubcategoriesModule as InventorySubcategoriesModule } from '../../modules/inventory/SubcategoriesModule.js';
import { UomModule as InventoryUomModule } from '../../modules/inventory/UomModule.js';
import { BrandsModule as InventoryBrandsModule } from '../../modules/inventory/BrandsModule.js';
import { VendorsModule as InventoryVendorsModule } from '../../modules/inventory/VendorsModule.js';
import { OpeningStockModule } from '../../modules/inventory/OpeningStockModule.js';
import { StockInModule } from '../../modules/inventory/StockInModule.js';
import { StockOutModule } from '../../modules/inventory/StockOutModule.js';
import { StockAdjustmentModule } from '../../modules/inventory/StockAdjustmentModule.js';
import { StockLedgerModule } from '../../modules/inventory/StockLedgerModule.js';
import { PurchaseOrdersModule } from '../../modules/inventory/PurchaseOrdersModule.js';
import { SalesOrdersModule } from '../../modules/inventory/SalesOrdersModule.js';
import { InventoryReportsModule } from '../../modules/inventory/InventoryReportsModule.js';

// Asset Management Modules
import { AssetDashboardModule } from '../../modules/assets/AssetDashboardModule.js';
import { AssetMasterModule } from '../../modules/assets/AssetMasterModule.js';
import { AssetCategoriesModule } from '../../modules/assets/AssetCategoriesModule.js';
import { AssetLocationsModule } from '../../modules/assets/AssetLocationsModule.js';
import { AssetAssignmentModule } from '../../modules/assets/AssetAssignmentModule.js';
import { AssetMovementModule } from '../../modules/assets/AssetMovementModule.js';
import { AssetMaintenanceModule } from '../../modules/assets/AssetMaintenanceModule.js';
import { AssetDisposalModule } from '../../modules/assets/AssetDisposalModule.js';
import { AssetReportsModule } from '../../modules/assets/AssetReportsModule.js';

// Library Management Modules
import { LibraryDashboardModule } from '../../modules/library/LibraryDashboardModule.js';
import { BookMasterModule } from '../../modules/library/BookMasterModule.js';
import { BookCopiesModule } from '../../modules/library/BookCopiesModule.js';
import { BookCategoriesModule as LibraryCategoriesModule } from '../../modules/library/BookCategoriesModule.js';
import { AuthorsModule as LibraryAuthorsModule } from '../../modules/library/AuthorsModule.js';
import { PublishersModule as LibraryPublishersModule } from '../../modules/library/PublishersModule.js';
import { LibraryMembersModule } from '../../modules/library/LibraryMembersModule.js';
import { LibraryIssueReturnModule } from '../../modules/library/LibraryIssueReturnModule.js';
import { LibraryReservationsModule } from '../../modules/library/LibraryReservationsModule.js';
import { LibraryFinesModule } from '../../modules/library/LibraryFinesModule.js';
import { LibraryLostDamagedModule } from '../../modules/library/LibraryLostDamagedModule.js';
import { LibraryReportsModule } from '../../modules/library/LibraryReportsModule.js';

interface ModuleErrorBoundaryProps {
  moduleKey: string;
  tabId: string;
  children: React.ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModuleErrorBoundary extends React.Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ModuleErrorBoundary] Error rendering module "${this.props.moduleKey}" (tab: ${this.props.tabId}):`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white rounded-xl border border-rose-200 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Module Display Error ({this.props.moduleKey})
          </h3>
          <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
            {this.state.error?.message || 'An unexpected rendering error occurred in this module.'}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Retry Module
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppShell: React.FC = () => {
  const { tabs, activeTabId } = useWorkspace();

  const renderModuleContent = (moduleKey: string, tabId: string) => {
    switch (moduleKey) {
      // Dashboard
      case 'dashboard':
        return <DashboardModule />;

      // School / Tenant
      case 'schools':
        return <SchoolsModule tabId={tabId} />;
      case 'locations':
        return <LocationsModule tabId={tabId} />;

      // People
      case 'admissions':
      case 'admissions_crm':
      case 'admissions-crm':
        return <AdmissionsModule tabId={tabId} />;
      case 'students':
        return <StudentsMasterModule tabId={tabId} />;
      case 'staff':
        return <StaffMasterModule tabId={tabId} />;
      case 'parents':
        return <ParentsMasterModule tabId={tabId} />;
      case 'designations':
        return <DesignationsModule tabId={tabId} />;
      case 'categories_types':
        return <CategoriesTypesModule tabId={tabId} />;
      case 'tags_labels':
        return <TagsLabelsModule tabId={tabId} />;
      case 'taxonomy':
        return <TaxonomyMasterModule tabId={tabId} />;

      // Academic
      case 'classes_master':
      case 'classes':
        return <ClassesMasterModule tabId={tabId} />;
      case 'sections_master':
      case 'sections':
        return <SectionsMasterModule tabId={tabId} />;
      case 'class_section_setup':
      case 'class_sections_setup':
      case 'class_section':
      case 'class_sections':
      case 'class-section-setup':
      case 'class-sections':
      case 'classes_sections':
      case 'classes_sections_setup':
        return <ClassSectionSetupModule tabId={tabId} />;
      case 'subjects_master':
      case 'subjects':
        return <SubjectsMasterModule tabId={tabId} />;
      case 'subject_groups':
      case 'subject-groups':
        return <SubjectGroupsModule tabId={tabId} />;
      case 'subject_offerings':
      case 'subject_offering':
      case 'subjects_offerings':
      case 'subjects_offering':
      case 'subject-offerings':
      case 'subject-offering':
      case 'subjects-offerings':
        return <SubjectOfferingsModule tabId={tabId} />;
      case 'student_assignments':
      case 'student_assignment':
        return <StudentAssignmentModule tabId={tabId} />;
      case 'teacher_assignments':
      case 'teacher_assignment':
        return <TeacherAssignmentsModule tabId={tabId} />;
      case 'teaching_schedule':
        return <MyTeachingScheduleModule tabId={tabId} />;
      case 'timetable_config':
      case 'timetable-config':
      case 'timetable_configuration':
        return <TimetableConfigModule tabId={tabId} />;
      case 'student_timetable':
      case 'student-timetable':
      case 'timetable':
        return <StudentTimetableModule tabId={tabId} />;

      // Attendance
      case 'student_attendance':
      case 'student-attendance':
        return <StudentAttendanceModule tabId={tabId} />;
      case 'staff_attendance':
      case 'staff-attendance':
        return <StaffAttendanceModule tabId={tabId} />;
      case 'attendance_history':
      case 'attendance-history':
        return <AttendanceHistoryModule tabId={tabId} />;
      case 'attendance_dashboard':
      case 'attendance-dashboard':
        return <AttendanceDashboardModule tabId={tabId} />;
      case 'attendance_reports':
      case 'attendance-reports':
        return <AttendanceReportsModule tabId={tabId} />;

      // Fees Management
      case 'fee_dashboard':
      case 'fees_dashboard':
      case 'fee-dashboard':
        return <FeeDashboardModule tabId={tabId} />;
      case 'fee_heads':
      case 'fee-heads':
        return <FeeHeadsModule tabId={tabId} />;
      case 'fee_structures':
      case 'fee-structures':
        return <FeeStructuresModule tabId={tabId} />;
      case 'fee_assignment':
      case 'fee-assignment':
      case 'student_fee_demands':
        return <StudentFeeAssignmentModule tabId={tabId} />;
      case 'fee_collection':
      case 'fee-collection':
        return <FeeCollectionModule tabId={tabId} />;
      case 'fee_receipts':
      case 'fee-receipts':
        return <FeeReceiptsModule tabId={tabId} />;
      case 'fee_outstanding':
      case 'fee-outstanding':
      case 'fee_ledger':
        return <FeeOutstandingModule tabId={tabId} />;
      case 'fee_discounts':
      case 'fee-discounts':
      case 'fee_waivers':
        return <FeeDiscountsModule tabId={tabId} />;
      case 'fee_refunds':
      case 'fee-refunds':
        return <FeeRefundsModule tabId={tabId} />;
      case 'fee_reports':
      case 'fee-reports':
        return <FeeReportsModule tabId={tabId} />;

      // Exams & Results
      case 'exam_dashboard':
      case 'exam-dashboard':
      case 'exams_dashboard':
        return <ExamDashboardModule tabId={tabId} />;
      case 'exam_master':
      case 'exam-master':
      case 'exams_master':
        return <ExamMasterModule tabId={tabId} />;
      case 'exam_structure':
      case 'exam-structure':
      case 'exam_structures':
        return <ExamStructureModule tabId={tabId} />;
      case 'exam_schedule':
      case 'exam-schedule':
      case 'exam_schedules':
        return <ExamScheduleModule tabId={tabId} />;
      case 'marks_entry':
      case 'marks-entry':
        return <MarksEntryModule tabId={tabId} />;
      case 'exam_results':
      case 'exam-results':
      case 'results_ledger':
        return <ExamResultsModule tabId={tabId} />;
      case 'report_cards':
      case 'report-cards':
        return <ReportCardsModule tabId={tabId} />;
      case 'exam_reports':
      case 'exam-reports':
        return <ExamReportsModule tabId={tabId} />;

      // Communication
      case 'communication_dashboard':
      case 'communication-dashboard':
      case 'communication':
        return <CommunicationDashboardModule tabId={tabId} />;
      case 'announcements_notices':
      case 'announcements-notices':
      case 'announcements':
      case 'notices':
        return <AnnouncementsNoticesModule tabId={tabId} />;
      case 'compose_communication':
      case 'compose-communication':
      case 'compose':
        return <ComposeCommunicationModule tabId={tabId} />;
      case 'communication_templates':
      case 'communication-templates':
      case 'templates':
        return <CommunicationTemplatesModule tabId={tabId} />;
      case 'communication_history':
      case 'communication-history':
        return <CommunicationHistoryModule tabId={tabId} />;
      case 'delivery_reports':
      case 'delivery-reports':
        return <DeliveryReportsModule tabId={tabId} />;
      case 'communication_inbox':
      case 'communication-inbox':
      case 'inbox':
        return <CommunicationInboxModule tabId={tabId} />;

      // Transport Management
      case 'transport_dashboard':
      case 'transport-dashboard':
      case 'transport':
        return <TransportDashboardModule tabId={tabId} />;
      case 'vehicle_master':
      case 'vehicle-master':
      case 'vehicles':
        return <VehicleMasterModule tabId={tabId} />;
      case 'driver_staff':
      case 'driver-staff':
      case 'drivers':
        return <DriverStaffModule tabId={tabId} />;
      case 'route_master':
      case 'route-master':
      case 'routes':
        return <RouteMasterModule tabId={tabId} />;
      case 'route_stops':
      case 'route-stops':
      case 'stops':
        return <RouteStopsModule tabId={tabId} />;
      case 'student_transport':
      case 'student-transport':
        return <StudentTransportAssignmentModule tabId={tabId} />;
      case 'daily_trips':
      case 'daily-trips':
      case 'trips':
        return <DailyTripsModule tabId={tabId} />;
      case 'gps_tracking':
      case 'gps-tracking':
      case 'tracking':
        return <GpsLiveTrackingModule tabId={tabId} />;
      case 'transport_reports':
      case 'transport-reports':
        return <TransportReportsModule tabId={tabId} />;

      // Inventory & Orders
      case 'inventory_dashboard':
      case 'inventory-dashboard':
      case 'inventory':
        return <InventoryDashboardModule tabId={tabId} />;
      case 'product_master':
      case 'product-master':
      case 'products':
      case 'sku_master':
      case 'sku-master':
      case 'skus':
        return <SkuMasterModule tabId={tabId} />;
      case 'inventory_categories':
      case 'inventory-categories':
        return <InventoryCategoriesModule tabId={tabId} />;
      case 'inventory_subcategories':
      case 'inventory-subcategories':
        return <InventorySubcategoriesModule tabId={tabId} />;
      case 'inventory_uoms':
      case 'inventory-uoms':
      case 'uoms':
        return <InventoryUomModule tabId={tabId} />;
      case 'inventory_brands':
      case 'inventory-brands':
      case 'brands':
        return <InventoryBrandsModule tabId={tabId} />;
      case 'inventory_vendors':
      case 'inventory-vendors':
      case 'vendors':
        return <InventoryVendorsModule tabId={tabId} />;
      case 'inventory_opening_stock':
      case 'inventory-opening-stock':
      case 'opening_stock':
      case 'opening-stock':
      case 'stock_balances':
      case 'stock-balances':
        return <OpeningStockModule tabId={tabId} />;
      case 'inventory_stock_in':
      case 'inventory-stock-in':
      case 'stock_in':
      case 'stock-in':
        return <StockInModule tabId={tabId} />;
      case 'inventory_stock_out':
      case 'inventory-stock-out':
      case 'stock_out':
      case 'stock-out':
        return <StockOutModule tabId={tabId} />;
      case 'inventory_stock_adjustment':
      case 'inventory-stock-adjustment':
      case 'stock_adjustment':
      case 'stock-adjustment':
      case 'adjustments':
        return <StockAdjustmentModule tabId={tabId} />;
      case 'inventory_stock_ledger':
      case 'inventory-stock-ledger':
      case 'stock_ledger':
      case 'stock-ledger':
      case 'ledger':
        return <StockLedgerModule tabId={tabId} />;
      case 'purchase_orders':
      case 'purchase-orders':
      case 'pos':
        return <PurchaseOrdersModule tabId={tabId} />;
      case 'sales_orders':
      case 'sales-orders':
      case 'sos':
      case 'pos_sales':
        return <SalesOrdersModule tabId={tabId} />;
      case 'inventory_reports':
      case 'inventory-reports':
        return <InventoryReportsModule tabId={tabId} />;

      // Asset Management
      case 'assets_dashboard':
      case 'assets-dashboard':
      case 'assets':
        return <AssetDashboardModule tabId={tabId} />;
      case 'assets_master':
      case 'assets-master':
      case 'asset_master':
      case 'asset-master':
        return <AssetMasterModule tabId={tabId} />;
      case 'assets_categories':
      case 'assets-categories':
      case 'asset_categories':
        return <AssetCategoriesModule tabId={tabId} />;
      case 'assets_locations':
      case 'assets-locations':
      case 'asset_locations':
        return <AssetLocationsModule tabId={tabId} />;
      case 'assets_assignment':
      case 'assets-assignment':
      case 'asset_assignment':
      case 'asset_custody':
        return <AssetAssignmentModule tabId={tabId} />;
      case 'assets_movement':
      case 'assets-movement':
      case 'asset_movement':
      case 'asset_transfer':
        return <AssetMovementModule tabId={tabId} />;
      case 'assets_maintenance':
      case 'assets-maintenance':
      case 'asset_maintenance':
      case 'asset_service':
        return <AssetMaintenanceModule tabId={tabId} />;
      case 'assets_disposal':
      case 'assets-disposal':
      case 'asset_disposal':
      case 'asset_writeoff':
        return <AssetDisposalModule tabId={tabId} />;
      case 'assets_reports':
      case 'assets-reports':
      case 'asset_reports':
        return <AssetReportsModule tabId={tabId} />;

      // Library Management
      case 'library_dashboard':
      case 'library-dashboard':
      case 'library':
        return <LibraryDashboardModule tabId={tabId} />;
      case 'library_books':
      case 'library-books':
      case 'books':
        return <BookMasterModule tabId={tabId} />;
      case 'library_copies':
      case 'library-copies':
      case 'copies':
      case 'book_copies':
        return <BookCopiesModule tabId={tabId} />;
      case 'library_categories':
      case 'library-categories':
      case 'book_categories':
        return <LibraryCategoriesModule tabId={tabId} />;
      case 'library_authors':
      case 'library-authors':
      case 'authors':
        return <LibraryAuthorsModule tabId={tabId} />;
      case 'library_publishers':
      case 'library-publishers':
      case 'publishers':
        return <LibraryPublishersModule tabId={tabId} />;
      case 'library_members':
      case 'library-members':
      case 'library_membership':
        return <LibraryMembersModule tabId={tabId} />;
      case 'library_circulation':
      case 'library-circulation':
      case 'library_issues':
      case 'circulation':
        return <LibraryIssueReturnModule tabId={tabId} />;
      case 'library_reservations':
      case 'library-reservations':
      case 'reservations':
        return <LibraryReservationsModule tabId={tabId} />;
      case 'library_fines':
      case 'library-fines':
      case 'fines':
        return <LibraryFinesModule tabId={tabId} />;
      case 'library_lost_damaged':
      case 'library-lost-damaged':
      case 'lost_damaged':
        return <LibraryLostDamagedModule tabId={tabId} />;
      case 'library_reports':
      case 'library-reports':
        return <LibraryReportsModule tabId={tabId} />;

      // Access & Security
      case 'users':
        return <UsersModule tabId={tabId} />;
      case 'roles_master':
        return <RolesMasterModule tabId={tabId} />;
      case 'rights_master':
        return <RightsMasterModule tabId={tabId} />;
      case 'role_rights':
        return <RoleRightsModule tabId={tabId} />;
      case 'user_roles':
        return <UserRolesModule tabId={tabId} />;
      case 'access_scope':
        return <AccessScopeModule tabId={tabId} />;
      case 'roles':
        return <RolesPermissionsModule tabId={tabId} />;

      // Settings
      case 'settings':
        return <CategorizedSettingsModule tabId={tabId} />;
      case 'features':
        return <FeatureConfigModule tabId={tabId} />;

      // System
      case 'audit':
        return <AuditLogsModule tabId={tabId} />;

      default:
        return (
          <div className="p-8 text-center text-slate-400">
            Module [{moduleKey}] is under active development.
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header />

        {/* Multitasking Workspace Tabs Bar (up to 10 open tabs) */}
        <div className="relative z-30 shrink-0 bg-white">
          <WorkspaceTabBar />
        </div>

        {/* Tab Module Screens Container with Full State & DOM Preservation */}
        <main className="flex-1 relative min-h-0 overflow-hidden bg-slate-50/50">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`h-full w-full absolute inset-0 flex flex-col min-h-0 overflow-hidden ${
                tab.id === activeTabId ? 'flex' : 'hidden'
              }`}
              style={{
                transform: 'translate(0, 0)',
              }}
            >
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <ModuleErrorBoundary moduleKey={tab.moduleKey} tabId={tab.id}>
                  {renderModuleContent(tab.moduleKey, tab.id)}
                </ModuleErrorBoundary>
              </div>
            </div>
          ))}
        </main>
      </div>

      {/* 10th Module Overflow Modal */}
      <WorkspaceOverflowModal />
    </div>
  );
};
