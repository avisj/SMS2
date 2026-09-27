// ========================================================================
// Sidebar Component — Dual-Rail + Contextual Hover-Flyout Navigation
// Compact 68px Primary Rail with Zero-Shift Floating Flyout Overlay (250px)
// Flicker-prevented hover timers, click/touch fallback, 10-tab workspace preservation
// ZERO hardcoded role checks - strictly evaluates dynamic permissions
// ========================================================================

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  LayoutDashboard,
  Building,
  MapPin,
  Users,
  GraduationCap,
  Briefcase,
  Award,
  Tag,
  FolderTree,
  Calendar,
  Layers,
  BookOpen,
  UserCheck,
  UserCog,
  Grid,
  Building2,
  CalendarCheck,
  Key,
  Shield,
  Sparkles,
  HeartHandshake,
  CalendarRange,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  CreditCard,
  Receipt,
  Percent,
  RotateCcw,
  FileText,
  AlertCircle,
  Edit3,
  Printer,
  MessageSquare,
  Send,
  Bell,
  BookmarkCheck,
  Inbox,
  Bus,
  Radio,
  Navigation,
  Boxes,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  ShoppingBag,
  FileBarChart,
  Wrench,
  Archive,
  ArrowLeftRight,
  Copy,
  IndianRupee,
  ShieldAlert,
  UserPlus,
  Sliders,
  ToggleRight,
  ClipboardList,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { usePermission } from '../../hooks/usePermission.js';

export type NavigationMode = 'hover_dual_rail' | 'expanded_sidebar';

interface NavItem {
  key: string;
  label: string;
  iconName: string;
  icon: React.ReactNode;
  permission?: string;
  superAdminOnly?: boolean;
}

interface NavCategory {
  id: string;
  title: string;
  shortLabel: string;
  icon: React.ReactNode;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const { openTab } = useWorkspace();
  const { hasPermission, isSuperAdmin } = usePermission();

  // Navigation Presentation Mode (Stored in localStorage)
  const [navMode, setNavMode] = useState<NavigationMode>(() => {
    const saved = localStorage.getItem('sms_navigation_mode');
    return saved === 'expanded_sidebar' ? 'expanded_sidebar' : 'hover_dual_rail';
  });

  // Listen to external mode change events (e.g. from School Settings)
  useEffect(() => {
    const handleModeChange = (e: any) => {
      if (e.detail === 'expanded_sidebar' || e.detail === 'hover_dual_rail') {
        setNavMode(e.detail);
      }
    };
    window.addEventListener('sms_nav_mode_change', handleModeChange);
    return () => window.removeEventListener('sms_nav_mode_change', handleModeChange);
  }, []);

  // Hover & Flyout State (Default: Dashboard)
  const [activeCategoryId, setActiveCategoryId] = useState<string>('DASHBOARD');
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  // Accordion state for Expanded Menu Mode (default with first categories open)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() => {
    return new Set(['DASHBOARD', 'PEOPLE']);
  });

  const toggleCategoryAccordion = (categoryId: string) => {
    setExpandedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Timers to prevent rapid flicker when crossing icons or moving diagonally to flyout
  const openTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // High-Level Category Hierarchy
  const categories: NavCategory[] = [
    {
      id: 'DASHBOARD',
      title: 'DASHBOARD',
      shortLabel: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      items: [
        {
          key: 'dashboard',
          label: 'Dashboard Overview',
          iconName: 'LayoutDashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
      ],
    },
    {
      id: 'TENANT',
      title: 'SCHOOL / TENANT',
      shortLabel: 'School',
      icon: <Building className="w-5 h-5" />,
      items: [
        {
          key: 'schools',
          label: 'Schools (Tenants)',
          iconName: 'Building',
          icon: <Building className="w-4 h-4" />,
          permission: 'schools.view',
          superAdminOnly: true,
        },
        {
          key: 'locations',
          label: 'Branches / Locations',
          iconName: 'MapPin',
          icon: <MapPin className="w-4 h-4" />,
          permission: 'locations.view',
        },
      ],
    },
    {
      id: 'PEOPLE',
      title: 'PEOPLE & COMMUNITY',
      shortLabel: 'People',
      icon: <Users className="w-5 h-5" />,
      items: [
        {
          key: 'admissions',
          label: 'Admissions & CRM',
          iconName: 'UserPlus',
          icon: <UserPlus className="w-4 h-4" />,
          permission: 'users.view',
        },
        {
          key: 'students',
          label: 'Students Master',
          iconName: 'GraduationCap',
          icon: <GraduationCap className="w-4 h-4" />,
          permission: 'users.view',
        },
        {
          key: 'staff',
          label: 'Staff & Faculty Master',
          iconName: 'Briefcase',
          icon: <Briefcase className="w-4 h-4" />,
          permission: 'users.view',
        },
        {
          key: 'parents',
          label: 'Parents / Guardians',
          iconName: 'HeartHandshake',
          icon: <HeartHandshake className="w-4 h-4" />,
          permission: 'users.view',
        },
        {
          key: 'designations',
          label: 'Designations',
          iconName: 'Award',
          icon: <Award className="w-4 h-4" />,
          permission: 'users.view',
        },
        {
          key: 'categories_types',
          label: 'Categories / Subcategories',
          iconName: 'FolderTree',
          icon: <FolderTree className="w-4 h-4" />,
          permission: 'users.view',
        },
        {
          key: 'tags_labels',
          label: 'Tags & Labels',
          iconName: 'Tag',
          icon: <Tag className="w-4 h-4" />,
          permission: 'users.view',
        },
      ],
    },
    {
      id: 'ACADEMIC',
      title: 'ACADEMIC & TIMETABLE',
      shortLabel: 'Academic',
      icon: <BookOpen className="w-5 h-5" />,
      items: [
        {
          key: 'classes_master',
          label: 'Classes Master',
          iconName: 'Layers',
          icon: <Layers className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'sections_master',
          label: 'Sections Master',
          iconName: 'Grid',
          icon: <Grid className="w-4 h-4" />,
          permission: 'sections.view',
        },
        {
          key: 'class_section_setup',
          label: 'Class & Section Setup',
          iconName: 'Building2',
          icon: <Building2 className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'subjects_master',
          label: 'Subjects Master',
          iconName: 'BookOpen',
          icon: <BookOpen className="w-4 h-4" />,
          permission: 'subjects.view',
        },
        {
          key: 'subject_groups',
          label: 'Subject Groups',
          iconName: 'FolderTree',
          icon: <FolderTree className="w-4 h-4" />,
          permission: 'subject_groups.view',
        },
        {
          key: 'subject_offerings',
          label: 'Subject & Offering',
          iconName: 'Sparkles',
          icon: <Sparkles className="w-4 h-4" />,
          permission: 'subjects.view',
        },
        {
          key: 'student_assignments',
          label: 'Student Class Assignment',
          iconName: 'UserCheck',
          icon: <UserCheck className="w-4 h-4" />,
          permission: 'students.class_assign',
        },
        {
          key: 'teacher_assignments',
          label: 'Teacher Class Assignment',
          iconName: 'UserCog',
          icon: <UserCog className="w-4 h-4" />,
          permission: 'teacher_assignments.view',
        },
        {
          key: 'teaching_schedule',
          label: 'My Teaching Schedule',
          iconName: 'CalendarCheck',
          icon: <CalendarCheck className="w-4 h-4" />,
          permission: 'teacher_assignments.view',
        },
        {
          key: 'timetable_config',
          label: 'Timetable Configuration',
          iconName: 'Clock',
          icon: <Clock className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'student_timetable',
          label: 'Student Timetable',
          iconName: 'CalendarRange',
          icon: <CalendarRange className="w-4 h-4" />,
          permission: 'classes.view',
        },
      ],
    },
    {
      id: 'ATTENDANCE',
      title: 'ATTENDANCE SYSTEM',
      shortLabel: 'Attendance',
      icon: <CalendarCheck className="w-5 h-5" />,
      items: [
        {
          key: 'student_attendance',
          label: 'Student Attendance',
          iconName: 'UserCheck',
          icon: <UserCheck className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'staff_attendance',
          label: 'Staff Attendance',
          iconName: 'Briefcase',
          icon: <Briefcase className="w-4 h-4" />,
          permission: 'users.view',
        },
        {
          key: 'attendance_history',
          label: 'Attendance History',
          iconName: 'Clock',
          icon: <Clock className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'attendance_dashboard',
          label: 'Attendance Dashboard',
          iconName: 'TrendingUp',
          icon: <TrendingUp className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'attendance_reports',
          label: 'Attendance Reports',
          iconName: 'FileSpreadsheet',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          permission: 'classes.view',
        },
      ],
    },
    {
      id: 'FINANCE',
      title: 'FINANCE & FEES',
      shortLabel: 'Finance',
      icon: <IndianRupee className="w-5 h-5" />,
      items: [
        {
          key: 'fee_dashboard',
          label: 'Fee Dashboard',
          iconName: 'TrendingUp',
          icon: <TrendingUp className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'fee_heads',
          label: 'Fee Heads (Master)',
          iconName: 'Tag',
          icon: <Tag className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'fee_structures',
          label: 'Fee Structures',
          iconName: 'Layers',
          icon: <Layers className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'fee_assignment',
          label: 'Student Fee Demands',
          iconName: 'FileText',
          icon: <FileText className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'fee_collection',
          label: 'Fee Collection Desk',
          iconName: 'CreditCard',
          icon: <CreditCard className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'fee_receipts',
          label: 'Fee Receipts',
          iconName: 'Receipt',
          icon: <Receipt className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'fee_outstanding',
          label: 'Outstanding & Ledger',
          iconName: 'AlertCircle',
          icon: <AlertCircle className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'fee_discounts',
          label: 'Discounts & Waivers',
          iconName: 'Percent',
          icon: <Percent className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'fee_refunds',
          label: 'Fee Refunds',
          iconName: 'RotateCcw',
          icon: <RotateCcw className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'fee_reports',
          label: 'Fee Reports & Audits',
          iconName: 'FileSpreadsheet',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          permission: 'classes.view',
        },
      ],
    },
    {
      id: 'EXAMS',
      title: 'EXAMINATIONS & MARKS',
      shortLabel: 'Exams',
      icon: <Award className="w-5 h-5" />,
      items: [
        {
          key: 'exam_dashboard',
          label: 'Exam Dashboard',
          iconName: 'Award',
          icon: <Award className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'exam_master',
          label: 'Exam Master',
          iconName: 'FileText',
          icon: <FileText className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'exam_structure',
          label: 'Exam Structure',
          iconName: 'Layers',
          icon: <Layers className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'exam_schedule',
          label: 'Exam Schedule',
          iconName: 'Calendar',
          icon: <Calendar className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'marks_entry',
          label: 'Marks Entry',
          iconName: 'Edit3',
          icon: <Edit3 className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'exam_results',
          label: 'Results Ledger',
          iconName: 'TrendingUp',
          icon: <TrendingUp className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'report_cards',
          label: 'Report Cards',
          iconName: 'Printer',
          icon: <Printer className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'exam_reports',
          label: 'Exam Reports',
          iconName: 'FileSpreadsheet',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          permission: 'classes.view',
        },
      ],
    },
    {
      id: 'COMMUNICATION',
      title: 'COMMUNICATION CENTER',
      shortLabel: 'Comms',
      icon: <MessageSquare className="w-5 h-5" />,
      items: [
        {
          key: 'communication_dashboard',
          label: 'Communication Dashboard',
          iconName: 'MessageSquare',
          icon: <MessageSquare className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'announcements_notices',
          label: 'Announcements / Notices',
          iconName: 'Bell',
          icon: <Bell className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'compose_communication',
          label: 'Compose Communication',
          iconName: 'Send',
          icon: <Send className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'communication_templates',
          label: 'Templates & Drafts',
          iconName: 'BookmarkCheck',
          icon: <BookmarkCheck className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'communication_history',
          label: 'Communication History',
          iconName: 'Clock',
          icon: <Clock className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'delivery_reports',
          label: 'Delivery Reports',
          iconName: 'TrendingUp',
          icon: <TrendingUp className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'communication_inbox',
          label: 'My Messages & Inbox',
          iconName: 'Inbox',
          icon: <Inbox className="w-4 h-4" />,
          permission: 'users.view',
        },
      ],
    },
    {
      id: 'TRANSPORT',
      title: 'TRANSPORT & FLEET',
      shortLabel: 'Transport',
      icon: <Bus className="w-5 h-5" />,
      items: [
        {
          key: 'transport_dashboard',
          label: 'Transport Dashboard',
          iconName: 'Bus',
          icon: <Bus className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'vehicle_master',
          label: 'Vehicle Master',
          iconName: 'Bus',
          icon: <Bus className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'driver_staff',
          label: 'Driver / Transport Staff',
          iconName: 'UserCheck',
          icon: <UserCheck className="w-4 h-4" />,
          permission: 'users.view',
        },
        {
          key: 'route_master',
          label: 'Route Master',
          iconName: 'Navigation',
          icon: <Navigation className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'route_stops',
          label: 'Route Stops & Manifests',
          iconName: 'MapPin',
          icon: <MapPin className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'student_transport',
          label: 'Student Route Allocation',
          iconName: 'Users',
          icon: <Users className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'daily_trips',
          label: 'Daily Trips & Dispatch',
          iconName: 'Clock',
          icon: <Clock className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'gps_tracking',
          label: 'GPS & Telemetry',
          iconName: 'Radio',
          icon: <Radio className="w-4 h-4" />,
          permission: 'classes.view',
        },
        {
          key: 'transport_reports',
          label: 'Transport Reports',
          iconName: 'FileSpreadsheet',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          permission: 'classes.view',
        },
      ],
    },
    {
      id: 'INVENTORY',
      title: 'INVENTORY MANAGEMENT',
      shortLabel: 'Inventory',
      icon: <Package className="w-5 h-5" />,
      items: [
        {
          key: 'inventory_dashboard',
          label: 'Inventory Dashboard',
          iconName: 'LayoutDashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
          permission: 'inventory.dashboard.view',
        },
        {
          key: 'sku_master',
          label: 'SKU / Barcode Master',
          iconName: 'Tag',
          icon: <Tag className="w-4 h-4" />,
          permission: 'inventory.sku.view',
        },
        {
          key: 'inventory_categories',
          label: 'Categories',
          iconName: 'FolderTree',
          icon: <FolderTree className="w-4 h-4" />,
          permission: 'inventory.taxonomy.manage',
        },
        {
          key: 'inventory_subcategories',
          label: 'Subcategories',
          iconName: 'Layers',
          icon: <Layers className="w-4 h-4" />,
          permission: 'inventory.taxonomy.manage',
        },
        {
          key: 'inventory_uoms',
          label: 'Units of Measure (UOM)',
          iconName: 'Sliders',
          icon: <Sliders className="w-4 h-4" />,
          permission: 'inventory.taxonomy.manage',
        },
        {
          key: 'inventory_brands',
          label: 'Brands Master',
          iconName: 'Award',
          icon: <Award className="w-4 h-4" />,
          permission: 'inventory.taxonomy.manage',
        },
        {
          key: 'inventory_vendors',
          label: 'Suppliers / Vendors',
          iconName: 'Building',
          icon: <Building className="w-4 h-4" />,
          permission: 'inventory.vendor.manage',
        },
        {
          key: 'inventory_opening_stock',
          label: 'Stock Balances & Opening',
          iconName: 'Boxes',
          icon: <Boxes className="w-4 h-4" />,
          permission: 'inventory.stock.view',
        },
        {
          key: 'inventory_stock_in',
          label: 'Stock In / Goods Receipt',
          iconName: 'ArrowDownLeft',
          icon: <ArrowDownLeft className="w-4 h-4" />,
          permission: 'inventory.stock.manage',
        },
        {
          key: 'inventory_stock_out',
          label: 'Stock Out / Goods Issue',
          iconName: 'ArrowUpRight',
          icon: <ArrowUpRight className="w-4 h-4" />,
          permission: 'inventory.stock.manage',
        },
        {
          key: 'inventory_stock_adjustment',
          label: 'Stock Adjustments',
          iconName: 'SlidersHorizontal',
          icon: <SlidersHorizontal className="w-4 h-4" />,
          permission: 'inventory.stock.manage',
        },
        {
          key: 'inventory_stock_ledger',
          label: 'Stock Movement Ledger',
          iconName: 'FileSpreadsheet',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          permission: 'inventory.ledger.view',
        },
        {
          key: 'inventory_reports',
          label: 'Inventory Reports',
          iconName: 'FileBarChart',
          icon: <FileBarChart className="w-4 h-4" />,
          permission: 'inventory.reports.view',
        },
      ],
    },
    {
      id: 'ORDERS',
      title: 'PURCHASE & SALES ORDERS',
      shortLabel: 'Orders',
      icon: <ShoppingBag className="w-5 h-5" />,
      items: [
        {
          key: 'purchase_orders',
          label: 'Purchase Orders',
          iconName: 'ShoppingBag',
          icon: <ShoppingBag className="w-4 h-4" />,
          permission: 'inventory.purchase_order.view',
        },
        {
          key: 'sales_orders',
          label: 'Sales Orders / POS',
          iconName: 'Receipt',
          icon: <Receipt className="w-4 h-4" />,
          permission: 'inventory.sales_order.view',
        },
      ],
    },
    {
      id: 'ASSETS',
      title: 'ASSET MANAGEMENT',
      shortLabel: 'Assets',
      icon: <Boxes className="w-5 h-5" />,
      items: [
        {
          key: 'assets_dashboard',
          label: 'Asset Dashboard',
          iconName: 'LayoutDashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
          permission: 'assets.dashboard.view',
        },
        {
          key: 'assets_master',
          label: 'Asset Master Register',
          iconName: 'Boxes',
          icon: <Boxes className="w-4 h-4" />,
          permission: 'assets.master.view',
        },
        {
          key: 'assets_categories',
          label: 'Categories & Taxonomy',
          iconName: 'FolderTree',
          icon: <FolderTree className="w-4 h-4" />,
          permission: 'assets.category.manage',
        },
        {
          key: 'assets_locations',
          label: 'Campus & Room Layout',
          iconName: 'Building2',
          icon: <Building2 className="w-4 h-4" />,
          permission: 'assets.master.view',
        },
        {
          key: 'assets_assignment',
          label: 'Custody & Assignment',
          iconName: 'UserCheck',
          icon: <UserCheck className="w-4 h-4" />,
          permission: 'assets.assignment.manage',
        },
        {
          key: 'assets_movement',
          label: 'Relocation & Transfers',
          iconName: 'ArrowLeftRight',
          icon: <ArrowLeftRight className="w-4 h-4" />,
          permission: 'assets.movement.manage',
        },
        {
          key: 'assets_maintenance',
          label: 'Service & Maintenance',
          iconName: 'Wrench',
          icon: <Wrench className="w-4 h-4" />,
          permission: 'assets.maintenance.manage',
        },
        {
          key: 'assets_disposal',
          label: 'Disposals & Write-Offs',
          iconName: 'Archive',
          icon: <Archive className="w-4 h-4" />,
          permission: 'assets.disposal.manage',
        },
        {
          key: 'assets_reports',
          label: 'Asset Audit Reports',
          iconName: 'FileSpreadsheet',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          permission: 'assets.reports.view',
        },
      ],
    },
    {
      id: 'LIBRARY',
      title: 'LIBRARY MANAGEMENT',
      shortLabel: 'Library',
      icon: <BookmarkCheck className="w-5 h-5" />,
      items: [
        {
          key: 'library_dashboard',
          label: 'Library Dashboard',
          iconName: 'LayoutDashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
          permission: 'library.dashboard.view',
        },
        {
          key: 'library_books',
          label: 'Book Master Register',
          iconName: 'BookOpen',
          icon: <BookOpen className="w-4 h-4" />,
          permission: 'library.books.view',
        },
        {
          key: 'library_copies',
          label: 'Physical Copies & Barcodes',
          iconName: 'Copy',
          icon: <Copy className="w-4 h-4" />,
          permission: 'library.copies.manage',
        },
        {
          key: 'library_categories',
          label: 'Book Categories',
          iconName: 'FolderTree',
          icon: <FolderTree className="w-4 h-4" />,
          permission: 'library.books.manage',
        },
        {
          key: 'library_authors',
          label: 'Authors Register',
          iconName: 'Users',
          icon: <Users className="w-4 h-4" />,
          permission: 'library.books.manage',
        },
        {
          key: 'library_publishers',
          label: 'Publishers Register',
          iconName: 'Building',
          icon: <Building className="w-4 h-4" />,
          permission: 'library.books.manage',
        },
        {
          key: 'library_members',
          label: 'Library Members',
          iconName: 'UserCheck',
          icon: <UserCheck className="w-4 h-4" />,
          permission: 'library.members.manage',
        },
        {
          key: 'library_circulation',
          label: 'Issue & Return Desk',
          iconName: 'RotateCcw',
          icon: <RotateCcw className="w-4 h-4" />,
          permission: 'library.issue.manage',
        },
        {
          key: 'library_reservations',
          label: 'Book Reservations',
          iconName: 'BookmarkCheck',
          icon: <BookmarkCheck className="w-4 h-4" />,
          permission: 'library.reservation.manage',
        },
        {
          key: 'library_fines',
          label: 'Fines & Collections',
          iconName: 'IndianRupee',
          icon: <IndianRupee className="w-4 h-4" />,
          permission: 'library.fines.manage',
        },
        {
          key: 'library_lost_damaged',
          label: 'Lost & Damaged Books',
          iconName: 'ShieldAlert',
          icon: <ShieldAlert className="w-4 h-4" />,
          permission: 'library.copies.manage',
        },
        {
          key: 'library_reports',
          label: 'Library Reports & Audit',
          iconName: 'FileSpreadsheet',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          permission: 'library.reports.view',
        },
      ],
    },
    {
      id: 'SETTINGS',
      title: 'SETTINGS & SYSTEM',
      shortLabel: 'Settings',
      icon: <Sliders className="w-5 h-5" />,
      items: [
        {
          key: 'settings',
          label: 'School Settings',
          iconName: 'Sliders',
          icon: <Sliders className="w-4 h-4" />,
          permission: 'settings.view',
        },
        {
          key: 'features',
          label: 'Feature Flags',
          iconName: 'ToggleRight',
          icon: <ToggleRight className="w-4 h-4" />,
          permission: 'features.view',
        },
        {
          key: 'users',
          label: 'Users Master',
          iconName: 'Users',
          icon: <Users className="w-4 h-4" />,
          permission: 'users.view',
        },
        {
          key: 'roles_master',
          label: 'Roles',
          iconName: 'Shield',
          icon: <Shield className="w-4 h-4" />,
          permission: 'roles.view',
        },
        {
          key: 'rights_master',
          label: 'Rights Master',
          iconName: 'Key',
          icon: <Key className="w-4 h-4" />,
          permission: 'roles.view',
        },
        {
          key: 'role_rights',
          label: 'Role-Rights',
          iconName: 'ShieldCheck',
          icon: <ShieldCheck className="w-4 h-4" />,
          permission: 'roles.view',
        },
        {
          key: 'user_roles',
          label: 'User Roles',
          iconName: 'UserCog',
          icon: <UserCog className="w-4 h-4" />,
          permission: 'roles.view',
        },
        {
          key: 'access_scope',
          label: 'Access / Data Scope',
          iconName: 'MapPin',
          icon: <MapPin className="w-4 h-4" />,
          permission: 'roles.view',
        },
        {
          key: 'audit',
          label: 'Audit Ledger',
          iconName: 'ClipboardList',
          icon: <ClipboardList className="w-4 h-4" />,
          permission: 'audit.view',
        },
      ],
    },
  ];

  // Helper to filter permitted items
  const filterItem = (item: NavItem) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  };

  // Selected category object for flyout
  const activeCategory =
    categories.find(c => c.id === activeCategoryId) || categories[0];
  const activeVisibleItems = activeCategory.items.filter(filterItem);

  // Contextual Hover Flyout Positioning (Content-Height, Dynamic Y-anchor beside hovered rail icon)
  const [flyoutTop, setFlyoutTop] = useState<number>(12);
  const [adjustedTop, setAdjustedTop] = useState<number>(12);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // Dynamic Content-Height & Viewport-Boundary Calculation
  useLayoutEffect(() => {
    if (flyoutOpen && flyoutRef.current) {
      const flyoutHeight = flyoutRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      const margin = 12;

      let top = flyoutTop - 4; // Align slightly above icon center for visual balance

      // If bottom of flyout would overflow viewport, shift upward
      if (top + flyoutHeight > windowHeight - margin) {
        top = windowHeight - margin - flyoutHeight;
      }

      // Ensure it doesn't overflow above top of screen
      if (top < margin) {
        top = margin;
      }

      setAdjustedTop(top);
    }
  }, [flyoutOpen, activeCategoryId, flyoutTop]);

  // Hover Handlers with Anti-Flicker Delays
  const handleCategoryMouseEnter = (categoryId: string, e?: React.MouseEvent) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    const targetTop = e?.currentTarget ? (e.currentTarget as HTMLElement).getBoundingClientRect().top : undefined;

    // Small delay to prevent accidental trigger on quick mouse transit
    openTimerRef.current = setTimeout(() => {
      setActiveCategoryId(categoryId);
      if (targetTop !== undefined) {
        setFlyoutTop(targetTop);
      }
      setFlyoutOpen(true);
    }, 120);
  };

  const handleCategoryMouseLeave = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };

  const handleNavContainerMouseLeave = () => {
    if (navMode === 'expanded_sidebar') return;

    // Generous delay allowing pointer to cross gap or move diagonally
    closeTimerRef.current = setTimeout(() => {
      setFlyoutOpen(false);
    }, 250);
  };

  const handleNavContainerMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  // Click handler on rail icon (switches category and opens flyout; never pins)
  const handleCategoryClick = (categoryId: string, e?: React.MouseEvent) => {
    setActiveCategoryId(categoryId);
    if (e?.currentTarget) {
      setFlyoutTop((e.currentTarget as HTMLElement).getBoundingClientRect().top);
    }
    setFlyoutOpen(true);
  };

  // Close flyout on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && flyoutOpen) {
        setFlyoutOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flyoutOpen]);

  // Handle module item click: opens tab and immediately closes flyout
  const handleItemClick = (item: NavItem) => {
    openTab(item.key, item.label, item.iconName);
    if (navMode !== 'expanded_sidebar') {
      setFlyoutOpen(false);
    }
  };

  // ------------------------------------------------------------------------
  // Render: Categorized Accordion Sidebar Mode (~250px Width, Reserves Workspace)
  // ------------------------------------------------------------------------
  if (navMode === 'expanded_sidebar') {
    return (
      <aside className="w-[250px] bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 h-screen select-none">
        {/* Brand Header */}
        <div className="h-14 flex items-center px-4 border-b border-slate-800 justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="font-semibold text-white text-sm tracking-wide">
              eSchool
            </span>
          </div>
        </div>

        {/* Categorized Accordion Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {categories.map(cat => {
            const visibleItems = cat.items.filter(filterItem);
            if (visibleItems.length === 0) return null;

            const isExpanded = expandedCategoryIds.has(cat.id);
            const hasSingleItem = visibleItems.length === 1;

            return (
              <div key={cat.id} className="space-y-0.5">
                {/* Category Header Accordion Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (hasSingleItem) {
                      handleItemClick(visibleItems[0]);
                    } else {
                      toggleCategoryAccordion(cat.id);
                    }
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors group text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-slate-400 group-hover:text-teal-400 transition-colors shrink-0">
                      {cat.icon}
                    </span>
                    <span className="truncate text-[11px] uppercase tracking-wider font-bold text-slate-300 group-hover:text-white">
                      {cat.title}
                    </span>
                  </div>
                  {!hasSingleItem && (
                    <span className="text-slate-500 group-hover:text-slate-300 shrink-0 ml-1">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                  )}
                </button>

                {/* Collapsible Children Submenu */}
                {isExpanded && !hasSingleItem && (
                  <div className="pl-6 pr-1 py-0.5 space-y-0.5">
                    {visibleItems.map(item => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors group text-left"
                      >
                        <span className="shrink-0 text-slate-500 group-hover:text-teal-400 transition-colors">
                          {item.icon}
                        </span>
                        <span className="truncate flex-1">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    );
  }

  // ------------------------------------------------------------------------
  // Render: Dual-Rail + Contextual Hover Flyout (Default & Modern)
  // ------------------------------------------------------------------------
  return (
    <div
      className="relative flex shrink-0 select-none z-40"
      onMouseEnter={handleNavContainerMouseEnter}
      onMouseLeave={handleNavContainerMouseLeave}
    >
      {/* 1. PRIMARY SLIM RAIL (Strict 68px width, Icon-Only, Single Settings Entry) */}
      <aside
        className="w-[68px] h-screen bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 shrink-0 shadow-lg text-slate-400 relative z-40"
        role="navigation"
        aria-label="Primary Navigation Rail"
      >
        {/* Brand Mark */}
        <div className="flex flex-col items-center mb-2 shrink-0">
          <div
            className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-md cursor-pointer hover:scale-105 transition-transform"
            title="eSchool"
            onClick={(e) => handleCategoryClick('DASHBOARD', e)}
            onMouseEnter={(e) => handleCategoryMouseEnter('DASHBOARD', e)}
            onMouseLeave={handleCategoryMouseLeave}
          >
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold tracking-tight text-slate-400 mt-1 uppercase">
            eSchool
          </span>
        </div>

        {/* Categories Rail Icons List (Icon-Only, No Truncated Text) */}
        <div className="flex-1 w-full overflow-y-auto overflow-x-hidden py-1 px-2 space-y-1.5 scrollbar-none flex flex-col items-center">
          {categories.map(cat => {
            const visibleItems = cat.items.filter(filterItem);
            if (visibleItems.length === 0) return null;

            const isHovered = flyoutOpen && activeCategoryId === cat.id;

            return (
              <div key={cat.id} className="relative group w-full flex justify-center">
                <button
                  type="button"
                  onClick={(e) => handleCategoryClick(cat.id, e)}
                  onMouseEnter={(e) => handleCategoryMouseEnter(cat.id, e)}
                  onMouseLeave={handleCategoryMouseLeave}
                  className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                    isHovered
                      ? 'bg-slate-800 text-teal-400 shadow-xs'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                  aria-label={cat.title}
                  aria-haspopup="true"
                  aria-expanded={isHovered}
                >
                  <span className="shrink-0">{cat.icon}</span>
                </button>

                {/* Tooltip on Hover when flyout is closed */}
                {!flyoutOpen && (
                  <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-800 text-slate-100 text-xs font-medium rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-slate-700">
                    {cat.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* 2. CONTEXTUAL FLOATING FLYOUT LAYER (~250px Content-Height Overlay beside 68px rail, Completely Opaque) */}
      {flyoutOpen && (
        <div
          ref={flyoutRef}
          style={{ top: `${adjustedTop}px` }}
          className="fixed left-[68px] w-[250px] h-auto max-h-[calc(100vh-24px)] bg-slate-900 border border-slate-800 shadow-2xl rounded-r-xl rounded-l-none z-50 flex flex-col animate-in fade-in slide-in-from-left-2 duration-150 overflow-hidden"
          onMouseEnter={handleNavContainerMouseEnter}
          onMouseLeave={handleNavContainerMouseLeave}
        >
          {/* Flyout Header: Clean title & module count (no duplicate icon, no close button) */}
          <div className="px-3.5 py-2.5 border-b border-slate-800 shrink-0 bg-slate-900">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider truncate">
              {activeCategory.title}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {activeVisibleItems.length} module{activeVisibleItems.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Flyout Submenu List (Content-Height, natural compact bottom padding, scrolls only if exceeding max-height) */}
          <div className="overflow-y-auto p-1.5 pb-2 space-y-0.5 bg-slate-900 min-h-0 scrollbar-thin scrollbar-thumb-slate-700">
            {activeVisibleItems.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No accessible modules under this category.
              </div>
            ) : (
              activeVisibleItems.map(item => {
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <span className="shrink-0 text-slate-400 group-hover:text-teal-400 transition-colors">
                      {item.icon}
                    </span>
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
