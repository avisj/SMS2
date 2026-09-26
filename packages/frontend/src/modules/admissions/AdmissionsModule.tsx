// ========================================================================
// Admissions & Enquiry CRM Module
// Full pipeline: Lead capture, follow-up tracking, applications,
// document verification via Supabase Storage, and conversion to Universal Student
// ========================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Users,
  Search,
  Filter,
  Plus,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  ArrowRight,
  TrendingUp,
  GraduationCap,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Eye,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import {
  AdmissionSource,
  AdmissionEnquiry,
  AdmissionFollowup,
  AdmissionApplication,
  ClassItem,
  SectionItem,
  AcademicSession,
} from '../../types/index.js';

interface AdmissionsModuleProps {
  tabId?: string;
}

export const AdmissionsModule: React.FC<AdmissionsModuleProps> = () => {
  const { userContext } = useAuth();
  const { openTab } = useWorkspace();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'pipeline' | 'followups' | 'applications' | 'sources' | 'public_tester'
  >('pipeline');

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Master Data
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [sources, setSources] = useState<AdmissionSource[]>([]);

  // Pipeline Data
  const [metrics, setMetrics] = useState<any>({
    total_enquiries: 0,
    new_enquiries: 0,
    scheduled_followups: 0,
    total_applications: 0,
    admitted_count: 0,
    conversion_rate_percentage: 0,
  });
  const [enquiries, setEnquiries] = useState<AdmissionEnquiry[]>([]);
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Modals
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<AdmissionEnquiry | null>(null);
  const [enquiryFollowups, setEnquiryFollowups] = useState<AdmissionFollowup[]>([]);

  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<AdmissionApplication | null>(null);

  // Form states
  const [enquiryForm, setEnquiryForm] = useState({
    student_first_name: '',
    student_last_name: '',
    parent_name: '',
    primary_phone: '',
    email: '',
    source_type: 'WALK_IN',
    source_id: '',
    seeking_class_id: '',
    notes: '',
  });

  const [followupForm, setFollowupForm] = useState({
    contacted_via: 'PHONE' as 'PHONE' | 'EMAIL' | 'IN_PERSON' | 'SMS' | 'WHATSAPP',
    followup_date: new Date().toISOString().split('T')[0],
    next_followup_date: '',
    response_notes: '',
    updateEnquiryStatus: '',
  });

  const [applicationForm, setApplicationForm] = useState({
    enquiry_id: '',
    student_first_name: '',
    student_middle_name: '',
    student_last_name: '',
    date_of_birth: '2015-05-15',
    gender: 'MALE',
    blood_group: 'O+',
    nationality: 'Indian',
    religion: '',
    category: 'GENERAL',
    class_id: '',
    section_id: '',
    academic_session_id: '',
    primary_contact_name: '',
    primary_contact_phone: '',
    primary_contact_email: '',
    primary_contact_relation: 'FATHER' as 'FATHER' | 'MOTHER' | 'GUARDIAN',
    address: '',
    documents: [] as Array<{
      file_url: string;
      storage_path: string;
      file_name: string;
      file_size?: number;
      mime_type?: string;
    }>,
  });

  const [convertForm, setConvertForm] = useState({
    admission_number: '',
    roll_number: '',
    section_id: '',
    create_login_access: true,
  });

  // Public lead generator tester state
  const [publicTesterForm, setPublicTesterForm] = useState({
    student_first_name: 'Ananya',
    student_last_name: 'Sharma',
    parent_name: 'Vikram Sharma',
    primary_phone: '+91 98765 43210',
    email: 'vikram.sharma@example.com',
    notes: 'Interested in Grade 6 admission for the upcoming academic session.',
  });
  const [publicSubmitResult, setPublicSubmitResult] = useState<any>(null);

  // Load Initial Data
  const loadMasterData = async () => {
    try {
      const [classRes, sessRes, srcRes]: any[] = await Promise.all([
        api.get('/academics/classes').catch(() => ({ data: [] })),
        api.get('/academics/sessions').catch(() => ({ data: [] })),
        api.get('/admissions/sources').catch(() => ({ data: [] })),
      ]);
      setClasses(classRes?.data || []);
      setSessions(sessRes?.data || []);
      setSources(srcRes?.data || []);
    } catch (err: any) {
      console.error('Failed to load master data:', err);
    }
  };

  const loadPipelineData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, enquiriesRes, appsRes]: any[] = await Promise.all([
        api.get('/admissions/dashboard-metrics').catch(() => ({ data: null })),
        api.get('/admissions/enquiries').catch(() => ({ data: [] })),
        api.get('/admissions/applications').catch(() => ({ data: [] })),
      ]);

      if (metricsRes?.data) setMetrics(metricsRes.data);
      setEnquiries(enquiriesRes?.data || []);
      setApplications(appsRes?.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load admissions pipeline data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
    loadPipelineData();
  }, []);

  // Fetch sections when class changes in application form
  useEffect(() => {
    if (applicationForm.class_id) {
      api
        .get(`/academics/classes/${applicationForm.class_id}/sections`)
        .then((res: any) => setSections(res.data || []))
        .catch(() => setSections([]));
    } else {
      setSections([]);
    }
  }, [applicationForm.class_id]);

  // Handle Enquiry Submission
  const handleCreateEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/admissions/enquiries', enquiryForm);
      setShowEnquiryModal(false);
      setActionSuccess('Enquiry recorded successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      setEnquiryForm({
        student_first_name: '',
        student_last_name: '',
        parent_name: '',
        primary_phone: '',
        email: '',
        source_type: 'WALK_IN',
        source_id: '',
        seeking_class_id: '',
        notes: '',
      });
      loadPipelineData();
    } catch (err: any) {
      setError(err.message || 'Failed to record enquiry');
    } finally {
      setLoading(false);
    }
  };

  // Open Follow-up Modal for specific enquiry
  const handleOpenFollowup = async (enquiry: AdmissionEnquiry) => {
    setSelectedEnquiry(enquiry);
    setFollowupForm({
      contacted_via: 'PHONE',
      followup_date: new Date().toISOString().split('T')[0],
      next_followup_date: '',
      response_notes: '',
      updateEnquiryStatus: enquiry.status === 'NEW' ? 'CONTACTED' : enquiry.status,
    });
    try {
      const res: any = await api.get(`/admissions/enquiries/${enquiry.id}/followups`);
      setEnquiryFollowups(res.data || []);
    } catch {
      setEnquiryFollowups([]);
    }
    setShowFollowupModal(true);
  };

  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry) return;
    try {
      setLoading(true);
      await api.post(`/admissions/enquiries/${selectedEnquiry.id}/followups`, followupForm);
      setShowFollowupModal(false);
      setActionSuccess('Follow-up logged successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      loadPipelineData();
    } catch (err: any) {
      setError(err.message || 'Failed to record follow-up');
    } finally {
      setLoading(false);
    }
  };

  // Handle Document Upload via Storage API
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const uploadRes: any = await api.post('/people/upload', {
          fileName: file.name,
          fileType: file.type || 'application/pdf',
          fileSize: file.size,
          base64Data,
          category: 'admissions',
        });

        if (uploadRes?.data) {
          setApplicationForm(prev => ({
            ...prev,
            documents: [
              ...prev.documents,
              {
                file_url: uploadRes.data.url,
                storage_path: uploadRes.data.storage_path,
                file_name: uploadRes.data.file_name,
                file_size: uploadRes.data.file_size,
                mime_type: uploadRes.data.mime_type,
              },
            ],
          }));
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill Application from Enquiry
  const handleConvertEnquiryToApplication = (enquiry: AdmissionEnquiry) => {
    setApplicationForm({
      enquiry_id: enquiry.id,
      student_first_name: enquiry.student_first_name,
      student_middle_name: '',
      student_last_name: enquiry.student_last_name || '',
      date_of_birth: '2015-05-15',
      gender: 'MALE',
      blood_group: 'O+',
      nationality: 'Indian',
      religion: '',
      category: 'GENERAL',
      class_id: enquiry.seeking_class_id || (classes[0]?.id || ''),
      section_id: '',
      academic_session_id: enquiry.academic_session_id || (sessions[0]?.id || ''),
      primary_contact_name: enquiry.parent_name,
      primary_contact_phone: enquiry.primary_phone,
      primary_contact_email: enquiry.email || '',
      primary_contact_relation: 'FATHER',
      address: '',
      documents: [],
    });
    setShowApplicationModal(true);
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/admissions/applications', applicationForm);
      setShowApplicationModal(false);
      setActionSuccess('Formal admission application submitted successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      loadPipelineData();
    } catch (err: any) {
      setError(err.message || 'Failed to create application');
    } finally {
      setLoading(false);
    }
  };

  // Convert Application to Student
  const handleOpenConvertModal = (app: AdmissionApplication) => {
    setSelectedApplication(app);
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setConvertForm({
      admission_number: `ADM-${year}-${randomSuffix}`,
      roll_number: '',
      section_id: app.section_id || '',
      create_login_access: true,
    });
    // Load sections for this class
    api
      .get(`/academics/classes/${app.class_id}/sections`)
      .then((res: any) => setSections(res.data || []))
      .catch(() => setSections([]));
    setShowConvertModal(true);
  };

  const handleExecuteConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApplication) return;
    try {
      setLoading(true);
      const res: any = await api.post(
        `/admissions/applications/${selectedApplication.id}/convert`,
        convertForm
      );
      setShowConvertModal(false);
      setActionSuccess(
        `Student enrolled successfully! Admission No: ${res?.data?.admission_number}`
      );
      setTimeout(() => setActionSuccess(null), 6000);
      loadPipelineData();
    } catch (err: any) {
      setError(err.message || 'Failed to convert application to student');
    } finally {
      setLoading(false);
    }
  };

  // Test Public Website Enquiry API
  const handleTestPublicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setPublicSubmitResult(null);
      const schoolId = userContext?.school_id;
      const res: any = await api.post('/admissions/public/enquiry', {
        ...publicTesterForm,
        school_id: schoolId,
      });
      setPublicSubmitResult(res.data);
      setActionSuccess('Public website enquiry received and logged into CRM!');
      setTimeout(() => setActionSuccess(null), 4000);
      loadPipelineData();
    } catch (err: any) {
      setError(err.message || 'Public submission failed');
    } finally {
      setLoading(false);
    }
  };

  // Filtered Enquiries
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter(item => {
      const matchSearch =
        !searchQuery ||
        item.student_first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.student_last_name &&
          item.student_last_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.parent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.primary_phone.includes(searchQuery);

      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchClass = !classFilter || item.seeking_class_id === classFilter;
      return matchSearch && matchStatus && matchClass;
    });
  }, [enquiries, searchQuery, statusFilter, classFilter]);

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <Badge variant="indigo">New Lead</Badge>;
      case 'CONTACTED':
        return <Badge variant="primary">Contacted</Badge>;
      case 'CAMPUS_VISIT_SCHEDULED':
        return <Badge variant="amber">Visit Scheduled</Badge>;
      case 'APPLICATION_SUBMITTED':
        return <Badge variant="purple">App Submitted</Badge>;
      case 'ADMITTED':
        return <Badge variant="success">Admitted</Badge>;
      case 'CLOSED_LOST':
        return <Badge variant="slate">Closed / Lost</Badge>;
      case 'SUBMITTED':
        return <Badge variant="indigo">Submitted</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="warning">Under Review</Badge>;
      case 'APPROVED':
        return <Badge variant="emerald">Approved for Admission</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Admissions & Enquiry CRM
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                End-to-end prospective student admissions, follow-ups, applications, and conversion
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPipelineData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setApplicationForm(prev => ({
                ...prev,
                class_id: classes[0]?.id || '',
                academic_session_id: sessions[0]?.id || '',
              }));
              setShowApplicationModal(true);
            }}
          >
            <FileText className="w-4 h-4 mr-2" />
            Direct Application
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowEnquiryModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Enquiry / Lead
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{actionSuccess}</p>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 border-l-4 border-l-brand-600">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total Enquiries
              </p>
              <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                {metrics.total_enquiries}
              </h3>
            </div>
            <Users className="w-5 h-5 text-brand-600" />
          </div>
          <p className="text-xs text-brand-600 mt-2 font-medium">
            {metrics.new_enquiries} new untreated leads
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Active Follow-ups
              </p>
              <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                {metrics.scheduled_followups}
              </h3>
            </div>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Scheduled communications
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Applications
              </p>
              <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                {metrics.total_applications}
              </h3>
            </div>
            <FileText className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Formal applications submitted
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Admitted Students
              </p>
              <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                {metrics.admitted_count}
              </h3>
            </div>
            <GraduationCap className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
            Enrolled in academic roster
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-indigo-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Conversion Rate
              </p>
              <h3 className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                {metrics.conversion_rate_percentage}%
              </h3>
            </div>
            <TrendingUp className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Leads to enrolled ratio
          </p>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'pipeline'
                ? 'border-brand-600 text-brand-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            }`}
          >
            <Users className="w-4 h-4" />
            Enquiry Pipeline
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-brand-50 text-brand-800 font-semibold">
              {enquiries.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('applications')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'applications'
                ? 'border-brand-600 text-brand-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            Formal Applications
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-brand-50 text-brand-800 font-semibold">
              {applications.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'sources'
                ? 'border-brand-600 text-brand-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Lead Sources
          </button>

          <button
            onClick={() => setActiveTab('public_tester')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'public_tester'
                ? 'border-brand-600 text-brand-600 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Public Website Form Simulator
          </button>
        </nav>
      </div>

      {/* TAB 1: ENQUIRY PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by student name, parent name, or phone number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="NEW">New Lead</option>
              <option value="CONTACTED">Contacted</option>
              <option value="CAMPUS_VISIT_SCHEDULED">Visit Scheduled</option>
              <option value="APPLICATION_SUBMITTED">App Submitted</option>
              <option value="ADMITTED">Admitted</option>
              <option value="CLOSED_LOST">Closed / Lost</option>
            </select>

            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Enquiries Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Student & Parent</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Seeking Class</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Contact</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Source</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredEnquiries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500 dark:text-gray-400">
                      No enquiries match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredEnquiries.map(enquiry => (
                    <tr key={enquiry.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {enquiry.student_first_name} {enquiry.student_last_name || ''}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Parent: {enquiry.parent_name}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {enquiry.seeking_class?.name || (
                          <span className="text-gray-400 italic">Not specified</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {enquiry.primary_phone}
                        </div>
                        {enquiry.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            {enquiry.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="slate">{enquiry.source_type}</Badge>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(enquiry.status)}</td>
                      <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(enquiry.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenFollowup(enquiry)}
                            title="Log Follow-up / View History"
                          >
                            <MessageSquare className="w-3.5 h-3.5 mr-1" />
                            Follow-up
                          </Button>
                          {enquiry.status !== 'APPLICATION_SUBMITTED' && enquiry.status !== 'ADMITTED' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleConvertEnquiryToApplication(enquiry)}
                              title="Start Formal Application"
                            >
                              <ArrowRight className="w-3.5 h-3.5 mr-1" />
                              Apply
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FORMAL APPLICATIONS */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">App #</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Student & Contact</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Applied Class</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Documents</th>
                  <th className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500 dark:text-gray-400">
                      No applications recorded yet.
                    </td>
                  </tr>
                ) : (
                  applications.map(app => (
                    <tr key={app.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {app.application_number}
                        <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                          {app.application_date}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {app.student_first_name} {app.student_last_name || ''}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {app.primary_contact_name} ({app.primary_contact_phone})
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{app.class_name || 'Assigned Class'}</div>
                        {app.section_name && (
                          <div className="text-xs text-gray-500">Section {app.section_name}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(app.status)}</td>
                      <td className="py-3 px-4">
                        {app.documents && app.documents.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {app.documents.map((doc, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                              >
                                <FileText className="w-3 h-3 text-blue-500" />
                                {doc.file_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">None attached</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {app.status === 'ADMITTED' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTab('students', 'Students Master', 'GraduationCap')}
                            className="text-emerald-600 dark:text-emerald-400 border-emerald-300"
                          >
                            <GraduationCap className="w-3.5 h-3.5 mr-1" />
                            View Enrolled
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenConvertModal(app)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Admit & Convert
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SOURCES */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sources.map(src => (
              <Card key={src.id} className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">{src.name}</h4>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">Code: {src.code}</p>
                </div>
                <Badge variant="slate">Active Channel</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PUBLIC WEBSITE FORM SIMULATOR */}
      {activeTab === 'public_tester' && (
        <Card className="p-6 max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Public Website Lead Endpoint Simulator
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Simulates a submission to the unauthenticated rate-limited endpoint (
              <code>POST /api/v1/admissions/public/enquiry</code>).
            </p>
          </div>

          <form onSubmit={handleTestPublicSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student First Name *
                </label>
                <input
                  type="text"
                  required
                  value={publicTesterForm.student_first_name}
                  onChange={e =>
                    setPublicTesterForm(p => ({ ...p, student_first_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student Last Name
                </label>
                <input
                  type="text"
                  value={publicTesterForm.student_last_name}
                  onChange={e =>
                    setPublicTesterForm(p => ({ ...p, student_last_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Parent / Guardian Name *
                </label>
                <input
                  type="text"
                  required
                  value={publicTesterForm.parent_name}
                  onChange={e =>
                    setPublicTesterForm(p => ({ ...p, parent_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Primary Contact Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={publicTesterForm.primary_phone}
                  onChange={e =>
                    setPublicTesterForm(p => ({ ...p, primary_phone: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parent Email
              </label>
              <input
                type="email"
                value={publicTesterForm.email}
                onChange={e => setPublicTesterForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Enquiry Notes / Queries
              </label>
              <textarea
                rows={3}
                value={publicTesterForm.notes}
                onChange={e => setPublicTesterForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
            </div>

            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? 'Submitting to Public Lead Endpoint...' : 'Submit Website Enquiry'}
            </Button>
          </form>

          {publicSubmitResult && (
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Received & Ingested into Multi-Tenant Pipeline
              </h4>
              <pre className="text-xs font-mono overflow-x-auto text-emerald-900 dark:text-emerald-200">
                {JSON.stringify(publicSubmitResult, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      )}

      {/* MODAL 1: NEW ENQUIRY */}
      {showEnquiryModal && (
        <Modal
          isOpen={showEnquiryModal}
          onClose={() => setShowEnquiryModal(false)}
          title="Record New Walk-in / Phone Enquiry"
        >
          <form onSubmit={handleCreateEnquiry} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student First Name *
                </label>
                <input
                  type="text"
                  required
                  value={enquiryForm.student_first_name}
                  onChange={e =>
                    setEnquiryForm(p => ({ ...p, student_first_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student Last Name
                </label>
                <input
                  type="text"
                  value={enquiryForm.student_last_name}
                  onChange={e =>
                    setEnquiryForm(p => ({ ...p, student_last_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Parent / Guardian Name *
                </label>
                <input
                  type="text"
                  required
                  value={enquiryForm.parent_name}
                  onChange={e => setEnquiryForm(p => ({ ...p, parent_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={enquiryForm.primary_phone}
                  onChange={e => setEnquiryForm(p => ({ ...p, primary_phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Seeking Class
                </label>
                <select
                  value={enquiryForm.seeking_class_id}
                  onChange={e =>
                    setEnquiryForm(p => ({ ...p, seeking_class_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <option value="">Select Target Class...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lead Channel
                </label>
                <select
                  value={enquiryForm.source_type}
                  onChange={e => setEnquiryForm(p => ({ ...p, source_type: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <option value="WALK_IN">Walk-in Visit</option>
                  <option value="PHONE">Phone Call</option>
                  <option value="WEBSITE">Website Lead</option>
                  <option value="REFERRAL">Word of Mouth / Referral</option>
                  <option value="SOCIAL_MEDIA">Social Media Campaign</option>
                  <option value="NEWSPAPER">Newspaper / Print</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parent Email
              </label>
              <input
                type="email"
                value={enquiryForm.email}
                onChange={e => setEnquiryForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Conversation Notes & Remarks
              </label>
              <textarea
                rows={3}
                value={enquiryForm.notes}
                onChange={e => setEnquiryForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                placeholder="Parent questions, previous school details, special interests..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setShowEnquiryModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                Save Enquiry
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: LOG FOLLOW-UP */}
      {showFollowupModal && selectedEnquiry && (
        <Modal
          isOpen={showFollowupModal}
          onClose={() => setShowFollowupModal(false)}
          title={`Follow-up with ${selectedEnquiry.parent_name} (${selectedEnquiry.student_first_name})`}
        >
          <div className="space-y-5">
            {/* History */}
            {enquiryFollowups.length > 0 && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2 max-h-48 overflow-y-auto">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Past Interactions
                </p>
                {enquiryFollowups.map(f => (
                  <div key={f.id} className="text-xs border-b pb-2 border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between font-medium">
                      <span>{f.contacted_via} - {f.status}</span>
                      <span className="text-gray-400">{f.followup_date}</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mt-1">{f.response_notes}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveFollowup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contact Channel
                  </label>
                  <select
                    value={followupForm.contacted_via}
                    onChange={e =>
                      setFollowupForm(p => ({ ...p, contacted_via: e.target.value as any }))
                    }
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  >
                    <option value="PHONE">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                    <option value="IN_PERSON">In-Person Meeting</option>
                    <option value="SMS">SMS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    required
                    value={followupForm.followup_date}
                    onChange={e =>
                      setFollowupForm(p => ({ ...p, followup_date: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Interaction Outcome & Response Notes *
                </label>
                <textarea
                  rows={3}
                  required
                  value={followupForm.response_notes}
                  onChange={e =>
                    setFollowupForm(p => ({ ...p, response_notes: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  placeholder="Detail discussion, fee structure shared, scheduled school tour..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Next Follow-up Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={followupForm.next_followup_date}
                    onChange={e =>
                      setFollowupForm(p => ({ ...p, next_followup_date: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Update Lead Pipeline Status
                  </label>
                  <select
                    value={followupForm.updateEnquiryStatus}
                    onChange={e =>
                      setFollowupForm(p => ({ ...p, updateEnquiryStatus: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  >
                    <option value="">Keep Existing</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="CAMPUS_VISIT_SCHEDULED">Visit Scheduled</option>
                    <option value="APPLICATION_SUBMITTED">Application Submitted</option>
                    <option value="CLOSED_LOST">Closed / Lost</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowFollowupModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  Save Follow-up
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* MODAL 3: APPLICATION SUBMISSION */}
      {showApplicationModal && (
        <Modal
          isOpen={showApplicationModal}
          onClose={() => setShowApplicationModal(false)}
          title="Submit Formal Admission Application"
        >
          <form onSubmit={handleCreateApplication} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Student Details
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={applicationForm.student_first_name}
                  onChange={e =>
                    setApplicationForm(p => ({ ...p, student_first_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Middle Name</label>
                <input
                  type="text"
                  value={applicationForm.student_middle_name}
                  onChange={e =>
                    setApplicationForm(p => ({ ...p, student_middle_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Last Name</label>
                <input
                  type="text"
                  value={applicationForm.student_last_name}
                  onChange={e =>
                    setApplicationForm(p => ({ ...p, student_last_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={applicationForm.date_of_birth}
                  onChange={e =>
                    setApplicationForm(p => ({ ...p, date_of_birth: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Gender *</label>
                <select
                  value={applicationForm.gender}
                  onChange={e => setApplicationForm(p => ({ ...p, gender: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Blood Group</label>
                <select
                  value={applicationForm.blood_group}
                  onChange={e =>
                    setApplicationForm(p => ({ ...p, blood_group: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-2 border-t">
              Academic Program & Cohort
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Academic Session *</label>
                <select
                  required
                  value={applicationForm.academic_session_id}
                  onChange={e =>
                    setApplicationForm(p => ({ ...p, academic_session_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <option value="">Select Academic Session...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Applied Class *</label>
                <select
                  required
                  value={applicationForm.class_id}
                  onChange={e => setApplicationForm(p => ({ ...p, class_id: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <option value="">Select Class...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-2 border-t">
              Primary Parent / Guardian Contact
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Parent Name *</label>
                <input
                  type="text"
                  required
                  value={applicationForm.primary_contact_name}
                  onChange={e =>
                    setApplicationForm(p => ({ ...p, primary_contact_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Relationship *</label>
                <select
                  value={applicationForm.primary_contact_relation}
                  onChange={e =>
                    setApplicationForm(p => ({
                      ...p,
                      primary_contact_relation: e.target.value as any,
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                  <option value="GUARDIAN">Guardian</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Phone *</label>
                <input
                  type="tel"
                  required
                  value={applicationForm.primary_contact_phone}
                  onChange={e =>
                    setApplicationForm(p => ({ ...p, primary_contact_phone: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>

            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider pt-2 border-t">
              Documents & Uploads (Real Supabase Storage)
            </h4>
            <div className="border border-dashed border-gray-300 dark:border-gray-700 p-4 rounded-lg text-center">
              <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
              <p className="text-xs text-gray-500 mb-2">
                Upload Birth Certificate, Previous Report Card, or Transfer Certificate
              </p>
              <input
                type="file"
                id="docUpload"
                onChange={handleDocumentUpload}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('docUpload')?.click()}
                disabled={loading}
              >
                Select Document
              </Button>
            </div>

            {applicationForm.documents.length > 0 && (
              <div className="space-y-1">
                {applicationForm.documents.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded border"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      {d.file_name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setApplicationForm(p => ({
                          ...p,
                          documents: p.documents.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowApplicationModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                Submit Application
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: CONVERT APPLICATION TO STUDENT */}
      {showConvertModal && selectedApplication && (
        <Modal
          isOpen={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          title={`Admit & Enrol: ${selectedApplication.student_first_name} ${selectedApplication.student_last_name || ''}`}
        >
          <form onSubmit={handleExecuteConversion} className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-xs text-blue-800 dark:text-blue-300">
              This action will create an authoritative Universal User, Student Profile, and
              Academic Enrollment linked to the class.
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Admission Number *
              </label>
              <input
                type="text"
                required
                value={convertForm.admission_number}
                onChange={e =>
                  setConvertForm(p => ({ ...p, admission_number: e.target.value }))
                }
                className="w-full px-3 py-2 border rounded-md text-sm font-mono bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Section Assignment
                </label>
                <select
                  value={convertForm.section_id}
                  onChange={e => setConvertForm(p => ({ ...p, section_id: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <option value="">No Section Yet</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>
                      Section {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Roll Number (Optional)
                </label>
                <input
                  type="text"
                  value={convertForm.roll_number}
                  onChange={e => setConvertForm(p => ({ ...p, roll_number: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="createLogin"
                checked={convertForm.create_login_access}
                onChange={e =>
                  setConvertForm(p => ({ ...p, create_login_access: e.target.checked }))
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="createLogin" className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                Generate student portal login credentials automatically
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setShowConvertModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                Finalize Admission & Provision Student
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
export default AdmissionsModule;
