// ========================================================================
// StaffMasterModule Component
// Specialized Operational View querying the UNIVERSAL users table
// Zero separate staff tables - complete employment dimension integration
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Search,
  Plus,
  Filter,
  Users,
  Building,
  Eye,
  CheckCircle,
  Tag,
  Shield,
  Layers,
  GraduationCap,
  Camera,
  Upload,
  Trash2,
  MapPin,
  Award,
  FileText,
  Key,
  AlertCircle,
  UserCheck,
  Clock,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { User, Location, Designation, UserCategory, Role } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { UserProfileDrawer } from '../../components/profile/UserProfileDrawer.js';

interface QualificationRecord {
  education_level: string;
  qualification_name: string;
  institution: string;
  board_university: string;
  passing_year: number | undefined;
  marks_grade: string;
  specialization: string;
  certificate_url: string;
  remarks: string;
}

interface ExperienceRecord {
  organization: string;
  designation: string;
  from_date: string;
  to_date: string;
  duration: string;
  responsibilities: string;
  experience_letter_url: string;
  remarks: string;
}

interface CertificationRecord {
  certification_name: string;
  issuing_organization: string;
  issue_date: string;
  expiry_date: string;
  credential_number: string;
  attachment_url: string;
  remarks: string;
}

interface DocumentRecord {
  document_type: string;
  document_name: string;
  document_number: string;
  issue_date: string;
  expiry_date: string;
  file_url: string;
  remarks: string;
}

export type StaffTab =
  | 'basic'
  | 'employment'
  | 'branches'
  | 'qualifications'
  | 'experience'
  | 'certifications'
  | 'documents'
  | 'login';

export const STAFF_TAB_ORDER: StaffTab[] = [
  'basic',
  'employment',
  'branches',
  'qualifications',
  'experience',
  'certifications',
  'documents',
  'login',
];

interface StaffMasterModuleProps {
  tabId: string;
}

export const StaffMasterModule: React.FC<StaffMasterModuleProps> = ({ tabId }) => {
  const { userContext, activeBranch } = useAuth();
  const { tabs, updateTabState } = useWorkspace();
  const { hasPermission } = usePermission();

  const currentTab = tabs.find(t => t.id === tabId);
  const initialSearch = currentTab?.state.searchQuery || '';
  const initialDesignation = currentTab?.state.filters?.designationId || '';
  const initialDepartment = currentTab?.state.filters?.department || '';

  const [search, setSearch] = useState(initialSearch);
  const [selectedDesignation, setSelectedDesignation] = useState(initialDesignation);
  const [selectedDepartment, setSelectedDepartment] = useState(initialDepartment);

  const [staff, setStaff] = useState<User[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected staff user for slide-over drawer
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Add Staff Modal state (8 Tabs)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeStaffTab, setActiveStaffTab] = useState<StaffTab>('basic');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [staffForm, setStaffForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    profile_photo_url: '',
    username: '',
    email: '',
    phone: '',
    gender: 'MALE',
    date_of_birth: '',
    address: '',
    user_type_code: 'TEACHER' as 'TEACHER' | 'STAFF' | 'ADMIN',
    role_ids: [] as string[],
    location_ids: [] as string[],
    primary_location_id: '',
    employee_code: '',
    designation_id: '',
    department: 'Academics',
    employment_type: 'PERMANENT' as 'PERMANENT' | 'PROBATION' | 'CONTRACT' | 'PART_TIME' | 'TEMPORARY',
    joining_date: new Date().toISOString().split('T')[0],
    confirmation_date: '',
    work_shift: 'Morning (08:00 AM - 02:30 PM)',
    qualification: '',
    experience_years: 3,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    create_login_access: false,
    login_password: '',
    confirm_password: '',
    login_status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
  });

  const [qualificationsList, setQualificationsList] = useState<QualificationRecord[]>([
    { education_level: 'Bachelors', qualification_name: 'B.Ed', institution: '', board_university: '', passing_year: 2020, marks_grade: '', specialization: '', certificate_url: '', remarks: '' },
  ]);

  const [experiencesList, setExperiencesList] = useState<ExperienceRecord[]>([
    { organization: '', designation: '', from_date: '', to_date: '', duration: '', responsibilities: '', experience_letter_url: '', remarks: '' },
  ]);

  const [certificationsList, setCertificationsList] = useState<CertificationRecord[]>([
    { certification_name: '', issuing_organization: '', issue_date: '', expiry_date: '', credential_number: '', attachment_url: '', remarks: '' },
  ]);

  const [documentsList, setDocumentsList] = useState<DocumentRecord[]>([
    { document_type: 'Resume / CV', document_name: '', document_number: '', issue_date: '', expiry_date: '', file_url: '', remarks: '' },
  ]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    updateTabState(tabId, { searchQuery: val });
  };

  const handleDesignationChange = (val: string) => {
    setSelectedDesignation(val);
    updateTabState(tabId, { filters: { ...currentTab?.state.filters, designationId: val } });
  };

  const handleDepartmentChange = (val: string) => {
    setSelectedDepartment(val);
    updateTabState(tabId, { filters: { ...currentTab?.state.filters, department: val } });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffData, desigData, locsData, rolesData] = await Promise.all([
        api.get<User[]>('/people/staff', {
          search: search || undefined,
          designation_id: selectedDesignation || undefined,
          department: selectedDepartment || undefined,
        }),
        api.get<Designation[]>('/people/designations'),
        api.get<Location[]>('/locations'),
        api.get<Role[]>('/roles'),
      ]);
      setStaff(staffData);
      setDesignations(desigData);
      setLocations(locsData);
      setRoles(rolesData);

      if (locsData.length > 0 && staffForm.location_ids.length === 0) {
        setStaffForm(prev => ({
          ...prev,
          location_ids: [locsData[0].id],
          primary_location_id: locsData[0].id,
        }));
      }
      if (desigData.length > 0 && !staffForm.designation_id) {
        setStaffForm(prev => ({ ...prev, designation_id: desigData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load staff master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedDesignation, selectedDepartment, activeBranch]);

  // Helpers
  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setStaffForm(prev => ({ ...prev, login_password: pass, confirm_password: pass }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setStaffForm(prev => ({ ...prev, profile_photo_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Branch Selection Helpers (Multi-branch with primary designation)
  const toggleLocationAssignment = (locId: string) => {
    setStaffForm(prev => {
      const exists = prev.location_ids.includes(locId);
      const nextLocations = exists ? prev.location_ids.filter(id => id !== locId) : [...prev.location_ids, locId];
      let primary = prev.primary_location_id;
      if (primary === locId && exists) {
        primary = nextLocations[0] || '';
      } else if (!primary && nextLocations.length > 0) {
        primary = nextLocations[0];
      }
      return {
        ...prev,
        location_ids: nextLocations,
        primary_location_id: primary,
      };
    });
  };

  const setPrimaryLocation = (locId: string) => {
    setStaffForm(prev => ({
      ...prev,
      primary_location_id: locId,
      location_ids: prev.location_ids.includes(locId) ? prev.location_ids : [...prev.location_ids, locId],
    }));
  };

  // Role Selection Helper
  const toggleRole = (roleId: string) => {
    setStaffForm(prev => {
      const exists = prev.role_ids.includes(roleId);
      return {
        ...prev,
        role_ids: exists ? prev.role_ids.filter(id => id !== roleId) : [...prev.role_ids, roleId],
      };
    });
  };

  // Row Management Helpers
  const addQualificationRow = () => {
    setQualificationsList(prev => [
      ...prev,
      { education_level: 'Bachelors', qualification_name: '', institution: '', board_university: '', passing_year: new Date().getFullYear(), marks_grade: '', specialization: '', certificate_url: '', remarks: '' },
    ]);
  };
  const removeQualificationRow = (idx: number) => {
    setQualificationsList(prev => prev.filter((_, i) => i !== idx));
  };
  const updateQualificationRow = (idx: number, field: keyof QualificationRecord, val: any) => {
    setQualificationsList(prev => prev.map((q, i) => i === idx ? { ...q, [field]: val } : q));
  };

  const addExperienceRow = () => {
    setExperiencesList(prev => [
      ...prev,
      { organization: '', designation: '', from_date: '', to_date: '', duration: '', responsibilities: '', experience_letter_url: '', remarks: '' },
    ]);
  };
  const removeExperienceRow = (idx: number) => {
    setExperiencesList(prev => prev.filter((_, i) => i !== idx));
  };
  const updateExperienceRow = (idx: number, field: keyof ExperienceRecord, val: string) => {
    setExperiencesList(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  };

  const addCertificationRow = () => {
    setCertificationsList(prev => [
      ...prev,
      { certification_name: '', issuing_organization: '', issue_date: '', expiry_date: '', credential_number: '', attachment_url: '', remarks: '' },
    ]);
  };
  const removeCertificationRow = (idx: number) => {
    setCertificationsList(prev => prev.filter((_, i) => i !== idx));
  };
  const updateCertificationRow = (idx: number, field: keyof CertificationRecord, val: string) => {
    setCertificationsList(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };

  const addDocumentRow = () => {
    setDocumentsList(prev => [
      ...prev,
      { document_type: 'Resume / CV', document_name: '', document_number: '', issue_date: '', expiry_date: '', file_url: '', remarks: '' },
    ]);
  };
  const removeDocumentRow = (idx: number) => {
    setDocumentsList(prev => prev.filter((_, i) => i !== idx));
  };
  const updateDocumentRow = (idx: number, field: keyof DocumentRecord, val: string) => {
    setDocumentsList(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (staffForm.location_ids.length === 0) {
      setErrorMessage('Please select at least one branch / campus for this staff member.');
      setActiveStaffTab('branches');
      return;
    }

    if (staffForm.create_login_access) {
      if (!staffForm.login_password || staffForm.login_password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        setActiveStaffTab('login');
        return;
      }
      if (staffForm.login_password !== staffForm.confirm_password) {
        setErrorMessage('Passwords do not match.');
        setActiveStaffTab('login');
        return;
      }
    }

    setAddSubmitting(true);

    try {
      const payload: any = {
        ...staffForm,
        qualifications: qualificationsList.filter(q => q.qualification_name.trim() && q.institution.trim()),
        experiences: experiencesList.filter(e => e.organization.trim()),
        certifications: certificationsList.filter(c => c.certification_name.trim()),
        documents: documentsList.filter(d => d.document_name.trim() && d.file_url.trim()),
      };
      if (!staffForm.create_login_access) {
        delete payload.login_password;
        delete payload.confirm_password;
      }
      await api.post('/people/staff', payload);
      setIsAddOpen(false);
      setStaffForm({
        first_name: '',
        middle_name: '',
        last_name: '',
        profile_photo_url: '',
        username: '',
        email: '',
        phone: '',
        gender: 'MALE',
        date_of_birth: '',
        address: '',
        user_type_code: 'TEACHER',
        role_ids: [],
        location_ids: locations.length > 0 ? [locations[0].id] : [],
        primary_location_id: locations.length > 0 ? locations[0].id : '',
        employee_code: '',
        designation_id: designations[0]?.id || '',
        department: 'Academics',
        employment_type: 'PERMANENT',
        joining_date: new Date().toISOString().split('T')[0],
        confirmation_date: '',
        work_shift: 'Morning (08:00 AM - 02:30 PM)',
        qualification: '',
        experience_years: 3,
        emergency_contact_name: '',
        emergency_contact_phone: '',
        create_login_access: false,
        login_password: '',
        confirm_password: '',
        login_status: 'ACTIVE',
      });
      setQualificationsList([{ education_level: 'Bachelors', qualification_name: 'B.Ed', institution: '', board_university: '', passing_year: 2020, marks_grade: '', specialization: '', certificate_url: '', remarks: '' }]);
      setExperiencesList([{ organization: '', designation: '', from_date: '', to_date: '', duration: '', responsibilities: '', experience_letter_url: '', remarks: '' }]);
      setCertificationsList([{ certification_name: '', issuing_organization: '', issue_date: '', expiry_date: '', credential_number: '', attachment_url: '', remarks: '' }]);
      setDocumentsList([{ document_type: 'Resume / CV', document_name: '', document_number: '', issue_date: '', expiry_date: '', file_url: '', remarks: '' }]);
      setActiveStaffTab('basic');
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add staff member');
    } finally {
      setAddSubmitting(false);
    }
  };

  // Metrics
  const totalStaff = staff.length;
  const facultyCount = staff.filter(s => s.user_type?.code === 'TEACHER').length;
  const nonTeachingCount = staff.filter(s => ['STAFF', 'ADMIN', 'DIRECTOR'].includes(s.user_type?.code || '')).length;
  const classTeacherCount = staff.filter(s => s.tags?.some(t => t.code === 'TAG-CT')).length;

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Staff Master</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200">
              Universal Users View
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Specialized operational directory for teaching faculty and administrative personnel with employment dimensions.
          </p>
        </div>

        {hasPermission('users.create') && (
          <Button variant="primary" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Staff Member
          </Button>
        )}
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Total Staff Members</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalStaff}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Teaching Faculty</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{facultyCount}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Non-Teaching Support</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{nonTeachingCount}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Class Teachers</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{classTeacherCount}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Advanced Filter Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Filter className="w-3.5 h-3.5 text-indigo-600" />
          Employment Filters & Search
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <Input
            placeholder="Search name, email, employee code..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="text-xs"
          />

          {/* Designation Filter */}
          <select
            value={selectedDesignation}
            onChange={(e) => handleDesignationChange(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
          >
            <option value="">All Designations (Database Driven)</option>
            {designations.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={selectedDepartment}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
          >
            <option value="">All Departments</option>
            <option value="Physics & Science">Physics & Science</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Finance & Accounts">Finance & Accounts</option>
            <option value="Academic Administration">Academic Administration</option>
            <option value="Executive Management">Executive Management</option>
          </select>
        </div>
      </Card>

      {/* Staff Directory Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Employee Code</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Role & User Type</th>
                <th className="py-3 px-4">Campus Branches</th>
                <th className="py-3 px-4">Taxonomy Tags</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    Loading staff records from universal users table...
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No staff members match the selected criteria.
                  </td>
                </tr>
              ) : (
                staff.map(member => {
                  const sp = member.staff_profile;
                  return (
                    <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {member.first_name[0].toUpperCase()}
                            {member.last_name ? member.last_name[0].toUpperCase() : ''}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {member.first_name} {member.last_name || ''}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {member.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {sp?.employee_code || '—'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {sp?.designation?.name || 'Staff Member'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {sp?.employment_type || 'PERMANENT'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-700">
                        {sp?.department || 'General'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="slate">{member.user_type?.name || 'Staff'}</Badge>
                          {member.roles?.[0] && (
                            <Badge variant="indigo">{member.roles[0].name}</Badge>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {member.locations?.map(l => (
                            <span key={l.id} className="text-[11px] text-slate-700 block font-medium">
                              • {l.location_name}
                            </span>
                          )) || <span className="text-slate-400">All Campuses</span>}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {member.tags?.map(t => (
                            <span
                              key={t.id}
                              style={{ backgroundColor: `${t.color}20`, color: t.color, borderColor: `${t.color}40` }}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                            >
                              {t.name}
                            </span>
                          ))}
                          {(!member.tags || member.tags.length === 0) && (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedUserId(member.id)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View Profile
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Slide-Over Profile Drawer */}
      <UserProfileDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onUpdated={loadData}
      />

      {/* Add Staff Member Modal (8-Tab Comprehensive Onboarding) */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Staff Member"
        subtitle="Complete onboarding with employment details, multi-branch assignment, qualifications, experience, and login credentials"
        maxWidth="5xl"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tab Navigation Strip */}
          <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveStaffTab('basic')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeStaffTab === 'basic'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              1. Basic Info & Photo
            </button>
            <button
              type="button"
              onClick={() => setActiveStaffTab('employment')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeStaffTab === 'employment'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              2. Employment Info
            </button>
            <button
              type="button"
              onClick={() => setActiveStaffTab('branches')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeStaffTab === 'branches'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              3. Branch Assignment ({staffForm.location_ids.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveStaffTab('qualifications')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeStaffTab === 'qualifications'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              4. Education ({qualificationsList.filter(q => q.qualification_name).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveStaffTab('experience')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeStaffTab === 'experience'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              5. Experience ({experiencesList.filter(e => e.organization).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveStaffTab('certifications')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeStaffTab === 'certifications'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              6. Certifications ({certificationsList.filter(c => c.certification_name).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveStaffTab('documents')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeStaffTab === 'documents'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              7. Documents ({documentsList.filter(d => d.document_name).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveStaffTab('login')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeStaffTab === 'login'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              8. Login & Account
            </button>
          </div>

          {/* TAB 1: BASIC INFO & PHOTO */}
          {activeStaffTab === 'basic' && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="relative group">
                  {staffForm.profile_photo_url ? (
                    <img
                      src={staffForm.profile_photo_url}
                      alt="Staff Preview"
                      className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500 shadow-sm"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-indigo-100 text-indigo-700 flex flex-col items-center justify-center border-2 border-dashed border-indigo-300">
                      <Camera className="w-7 h-7 mb-1 text-indigo-500" />
                      <span className="text-[10px] font-medium">Add Photo</span>
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-xs font-semibold">
                    <span>Change</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <h4 className="text-sm font-semibold text-slate-900">Staff Profile Photo</h4>
                  <p className="text-xs text-slate-500">
                    Upload employee identification photo. Supports PNG, JPG or WebP.
                  </p>
                  <div className="flex items-center gap-2 justify-center sm:justify-start pt-1">
                    <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Upload Photo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                    {staffForm.profile_photo_url && (
                      <button
                        type="button"
                        onClick={() => setStaffForm({ ...staffForm, profile_photo_url: '' })}
                        className="text-xs text-rose-600 hover:text-rose-700 px-2 py-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">First Name *</label>
                  <Input
                    required
                    value={staffForm.first_name}
                    onChange={e => setStaffForm({ ...staffForm, first_name: e.target.value })}
                    placeholder="e.g. Ramesh"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Middle Name</label>
                  <Input
                    value={staffForm.middle_name}
                    onChange={e => setStaffForm({ ...staffForm, middle_name: e.target.value })}
                    placeholder="e.g. Chandra"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Last Name</label>
                  <Input
                    value={staffForm.last_name}
                    onChange={e => setStaffForm({ ...staffForm, last_name: e.target.value })}
                    placeholder="e.g. Sharma"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Gender</label>
                  <select
                    value={staffForm.gender}
                    onChange={e => setStaffForm({ ...staffForm, gender: e.target.value })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Date of Birth</label>
                  <Input
                    type="date"
                    value={staffForm.date_of_birth}
                    onChange={e => setStaffForm({ ...staffForm, date_of_birth: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">User Classification *</label>
                  <select
                    value={staffForm.user_type_code}
                    onChange={e => setStaffForm({ ...staffForm, user_type_code: e.target.value as any })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="TEACHER">Teaching Faculty (TEACHER)</option>
                    <option value="STAFF">Support / Office Staff (STAFF)</option>
                    <option value="ADMIN">Administrator (ADMIN)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address *</label>
                  <Input
                    required
                    type="email"
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="e.g. ramesh.sharma@dpa.edu"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Contact Phone</label>
                  <Input
                    value={staffForm.phone}
                    onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Residential Address</label>
                <Input
                  value={staffForm.address}
                  onChange={e => setStaffForm({ ...staffForm, address: e.target.value })}
                  placeholder="Complete residential address, city, pincode"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Emergency Contact Person</label>
                  <Input
                    value={staffForm.emergency_contact_name}
                    onChange={e => setStaffForm({ ...staffForm, emergency_contact_name: e.target.value })}
                    placeholder="Spouse / Parent / Next of Kin name"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Emergency Contact Phone</label>
                  <Input
                    value={staffForm.emergency_contact_phone}
                    onChange={e => setStaffForm({ ...staffForm, emergency_contact_phone: e.target.value })}
                    placeholder="e.g. +91 98111 22233"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EMPLOYMENT INFO */}
          {activeStaffTab === 'employment' && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-900 flex items-start gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Employment Details & Designation:</span> Link this staff member to their official post, department, employment contract, and teaching workload shifts.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Employee Code *</label>
                  <Input
                    required
                    value={staffForm.employee_code}
                    onChange={e => setStaffForm({ ...staffForm, employee_code: e.target.value })}
                    placeholder="e.g. EMP-1042"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Designation / Role Title *</label>
                  <select
                    required
                    value={staffForm.designation_id}
                    onChange={e => setStaffForm({ ...staffForm, designation_id: e.target.value })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Select Designation...</option>
                    {designations.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Department</label>
                  <Input
                    value={staffForm.department}
                    onChange={e => setStaffForm({ ...staffForm, department: e.target.value })}
                    placeholder="e.g. Science & Physics"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Employment Type</label>
                  <select
                    value={staffForm.employment_type}
                    onChange={e => setStaffForm({ ...staffForm, employment_type: e.target.value as any })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="PERMANENT">Permanent</option>
                    <option value="PROBATION">Probation</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="PART_TIME">Part-Time</option>
                    <option value="TEMPORARY">Temporary / Guest</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Joining Date *</label>
                  <Input
                    type="date"
                    required
                    value={staffForm.joining_date}
                    onChange={e => setStaffForm({ ...staffForm, joining_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Confirmation Date</label>
                  <Input
                    type="date"
                    value={staffForm.confirmation_date}
                    onChange={e => setStaffForm({ ...staffForm, confirmation_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Work Shift / Timings</label>
                  <Input
                    value={staffForm.work_shift}
                    onChange={e => setStaffForm({ ...staffForm, work_shift: e.target.value })}
                    placeholder="e.g. Morning (08:00 AM - 02:30 PM)"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Total Experience (Years)</label>
                  <Input
                    type="number"
                    min="0"
                    value={staffForm.experience_years}
                    onChange={e => setStaffForm({ ...staffForm, experience_years: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Primary Qualifications Summary</label>
                <Input
                  value={staffForm.qualification}
                  onChange={e => setStaffForm({ ...staffForm, qualification: e.target.value })}
                  placeholder="e.g. M.Sc. Physics (Gold Medalist), B.Ed., CTET Qualified"
                />
              </div>
            </div>
          )}

          {/* TAB 3: BRANCH / LOCATION ASSIGNMENT */}
          {activeStaffTab === 'branches' && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Multi-Branch & Primary Location Assignment:</span>
                  Unlike students whose enrollment is restricted to a single class & section, staff and faculty can operate across multiple campus locations with data scoping. Select all branches this staff member is authorized to access, and designate one primary base branch.
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Select Campuses / Branches Authorized for this Staff Member ({staffForm.location_ids.length} selected) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {locations.map(loc => {
                    const isSelected = staffForm.location_ids.includes(loc.id);
                    const isPrimary = staffForm.primary_location_id === loc.id;
                    return (
                      <div
                        key={loc.id}
                        className={`p-3 rounded-lg border transition-all flex items-start justify-between gap-3 ${
                          isSelected
                            ? isPrimary
                              ? 'bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-400'
                              : 'bg-slate-50 border-slate-300'
                            : 'bg-white border-slate-200 hover:border-slate-300 opacity-75'
                        }`}
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLocationAssignment(loc.id)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <div>
                            <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                              {loc.location_name}
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {loc.location_code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {loc.city || 'Main City'}{loc.state ? `, ${loc.state}` : ''}
                            </div>
                          </div>
                        </label>

                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => setPrimaryLocation(loc.id)}
                            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors shrink-0 ${
                              isPrimary
                                ? 'bg-brand-600 text-white shadow-xs'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                            }`}
                          >
                            {isPrimary ? '★ Primary Branch' : 'Make Primary'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EDUCATION & QUALIFICATIONS */}
          {activeStaffTab === 'qualifications' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Academic Degrees & Qualifications</h4>
                  <p className="text-xs text-slate-500">Add degrees, diplomas, postgraduate qualifications, and teacher training certifications.</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addQualificationRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Qualification
                </Button>
              </div>

              {qualificationsList.map((q, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 relative">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700">Qualification #{idx + 1}</span>
                    {qualificationsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQualificationRow(idx)}
                        className="text-rose-600 hover:text-rose-800 text-xs flex items-center gap-1 font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Education Level</label>
                      <select
                        value={q.education_level}
                        onChange={e => updateQualificationRow(idx, 'education_level', e.target.value)}
                        className="block w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500"
                      >
                        <option value="High School">High School (10th)</option>
                        <option value="Higher Secondary">Higher Secondary (12th)</option>
                        <option value="Diploma">Diploma</option>
                        <option value="Bachelors">Bachelor's Degree (Graduation)</option>
                        <option value="Masters">Master's Degree (Post-Graduation)</option>
                        <option value="Doctorate">Doctorate / Ph.D.</option>
                        <option value="PostDoc">Post-Doctoral</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Degree / Qualification *</label>
                      <Input
                        value={q.qualification_name}
                        onChange={e => updateQualificationRow(idx, 'qualification_name', e.target.value)}
                        placeholder="e.g. B.Ed / M.Sc. Mathematics"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Specialization / Major</label>
                      <Input
                        value={q.specialization || ''}
                        onChange={e => updateQualificationRow(idx, 'specialization', e.target.value)}
                        placeholder="e.g. Pure Mathematics"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">College / Institute *</label>
                      <Input
                        value={q.institution}
                        onChange={e => updateQualificationRow(idx, 'institution', e.target.value)}
                        placeholder="e.g. Delhi University"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Passing Year</label>
                      <Input
                        type="number"
                        value={q.passing_year || ''}
                        onChange={e => updateQualificationRow(idx, 'passing_year', parseInt(e.target.value, 10) || undefined)}
                        placeholder="2020"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Grade / % / CGPA</label>
                      <Input
                        value={q.marks_grade || ''}
                        onChange={e => updateQualificationRow(idx, 'marks_grade', e.target.value)}
                        placeholder="e.g. First Div (8.4 CGPA)"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: PROFESSIONAL EXPERIENCE */}
          {activeStaffTab === 'experience' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Prior Employment & Teaching Experience</h4>
                  <p className="text-xs text-slate-500">Record previous schools, universities, or corporate institutions.</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addExperienceRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Experience Record
                </Button>
              </div>

              {experiencesList.map((exp, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 relative">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700">Experience #{idx + 1}</span>
                    {experiencesList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExperienceRow(idx)}
                        className="text-rose-600 hover:text-rose-800 text-xs flex items-center gap-1 font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Organization / School Name *</label>
                      <Input
                        value={exp.organization}
                        onChange={e => updateExperienceRow(idx, 'organization', e.target.value)}
                        placeholder="e.g. St. Xavier's Senior Secondary School"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Designation Held</label>
                      <Input
                        value={exp.designation}
                        onChange={e => updateExperienceRow(idx, 'designation', e.target.value)}
                        placeholder="e.g. Senior PGT Physics Teacher"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">From Date</label>
                      <Input
                        type="date"
                        value={exp.from_date || ''}
                        onChange={e => updateExperienceRow(idx, 'from_date', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">To Date</label>
                      <Input
                        type="date"
                        value={exp.to_date || ''}
                        onChange={e => updateExperienceRow(idx, 'to_date', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Duration / Tenure</label>
                      <Input
                        value={exp.duration || ''}
                        onChange={e => updateExperienceRow(idx, 'duration', e.target.value)}
                        placeholder="e.g. 3 Years 6 Months"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Key Responsibilities & Subjects Handled</label>
                    <Input
                      value={exp.responsibilities || ''}
                      onChange={e => updateExperienceRow(idx, 'responsibilities', e.target.value)}
                      placeholder="e.g. Classes 11-12 Physics, Lab In-charge, Science Club Coordinator"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: CERTIFICATIONS */}
          {activeStaffTab === 'certifications' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Professional Certifications & Licenses</h4>
                  <p className="text-xs text-slate-500">Record state teacher eligibility tests (CTET/STET), Cambridge certifications, or technical licenses.</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addCertificationRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Certification
                </Button>
              </div>

              {certificationsList.map((cert, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 relative">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700">Certification #{idx + 1}</span>
                    {certificationsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCertificationRow(idx)}
                        className="text-rose-600 hover:text-rose-800 text-xs flex items-center gap-1 font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Certification Title *</label>
                      <Input
                        value={cert.certification_name}
                        onChange={e => updateCertificationRow(idx, 'certification_name', e.target.value)}
                        placeholder="e.g. Central Teacher Eligibility Test (CTET Paper II)"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Issuing Organization / Authority</label>
                      <Input
                        value={cert.issuing_organization || ''}
                        onChange={e => updateCertificationRow(idx, 'issuing_organization', e.target.value)}
                        placeholder="e.g. CBSE / Cambridge Assessment"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Credential / Roll No.</label>
                      <Input
                        value={cert.credential_number || ''}
                        onChange={e => updateCertificationRow(idx, 'credential_number', e.target.value)}
                        placeholder="e.g. CTET-2023-88910"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Issue Date</label>
                      <Input
                        type="date"
                        value={cert.issue_date || ''}
                        onChange={e => updateCertificationRow(idx, 'issue_date', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Expiry Date (if applicable)</label>
                      <Input
                        type="date"
                        value={cert.expiry_date || ''}
                        onChange={e => updateCertificationRow(idx, 'expiry_date', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 7: DOCUMENTS */}
          {activeStaffTab === 'documents' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Documents & Verified Attachments</h4>
                  <p className="text-xs text-slate-500">Attach resume, government ID proof, degree certificates, and police verification.</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addDocumentRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Document
                </Button>
              </div>

              {documentsList.map((doc, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 relative">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700">Document #{idx + 1}</span>
                    {documentsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDocumentRow(idx)}
                        className="text-rose-600 hover:text-rose-800 text-xs flex items-center gap-1 font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Document Type</label>
                      <select
                        value={doc.document_type}
                        onChange={e => updateDocumentRow(idx, 'document_type', e.target.value)}
                        className="block w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500"
                      >
                        <option value="Resume / CV">Resume / Curriculum Vitae</option>
                        <option value="Government ID">Government ID (Aadhaar / Passport / Voter ID)</option>
                        <option value="Educational Certificate">Degree / Educational Certificate</option>
                        <option value="Experience Letter">Relieving / Experience Letter</option>
                        <option value="Police Verification">Background Check / Police Verification</option>
                        <option value="Medical Certificate">Medical Fitness Certificate</option>
                        <option value="Appointment Letter">Appointment / Offer Letter</option>
                        <option value="Other">Other Document</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Document Title / File Name *</label>
                      <Input
                        value={doc.document_name}
                        onChange={e => {
                          updateDocumentRow(idx, 'document_name', e.target.value);
                          if (!doc.file_url) {
                            updateDocumentRow(idx, 'file_url', `/uploads/documents/${e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'doc'}.pdf`);
                          }
                        }}
                        placeholder="e.g. Ramesh_Sharma_Resume.pdf"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Document / Identification Number</label>
                      <Input
                        value={doc.document_number || ''}
                        onChange={e => updateDocumentRow(idx, 'document_number', e.target.value)}
                        placeholder="e.g. AADHAAR-XXXX-XXXX-1234"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Document File / Cloud Reference URL</label>
                      <Input
                        value={doc.file_url}
                        onChange={e => updateDocumentRow(idx, 'file_url', e.target.value)}
                        placeholder="/uploads/documents/doc.pdf"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 8: LOGIN & ACCOUNT */}
          {activeStaffTab === 'login' && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-900">
                <p className="font-semibold mb-1 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  Universal Authentication & Access Governance
                </p>
                <p>
                  Every staff member is a universal user. Configure their system sign-in credentials, assign role-based authorization sets, and define account status.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Role Assignments (Select all that apply)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                  {roles.map(r => (
                    <label key={r.id} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffForm.role_ids.includes(r.id)}
                        onChange={() => toggleRole(r.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <span className="truncate">{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={staffForm.create_login_access}
                      onChange={e => setStaffForm({ ...staffForm, create_login_access: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Create Login Credentials</span>
                      <span className="text-[11px] text-slate-500">Allow this staff member to sign in to the portal immediately</span>
                    </div>
                  </label>

                  {staffForm.create_login_access && (
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 bg-indigo-50 border border-indigo-200 rounded"
                    >
                      Generate Strong Password
                    </button>
                  )}
                </div>

                {staffForm.create_login_access ? (
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Username *</label>
                        <Input
                          required={staffForm.create_login_access}
                          value={staffForm.username}
                          onChange={e => setStaffForm({ ...staffForm, username: e.target.value })}
                          placeholder="e.g. ramesh.sharma"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Login Status</label>
                        <select
                          value={staffForm.login_status}
                          onChange={e => setStaffForm({ ...staffForm, login_status: e.target.value as any })}
                          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="ACTIVE">ACTIVE (Can log in immediately)</option>
                          <option value="DISABLED">DISABLED (Login suspended)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Password *</label>
                        <Input
                          type="password"
                          required={staffForm.create_login_access}
                          value={staffForm.login_password}
                          onChange={e => setStaffForm({ ...staffForm, login_password: e.target.value })}
                          placeholder="Min. 6 characters"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Confirm Password *</label>
                        <Input
                          type="password"
                          required={staffForm.create_login_access}
                          value={staffForm.confirm_password}
                          onChange={e => setStaffForm({ ...staffForm, confirm_password: e.target.value })}
                          placeholder="Re-enter password"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-800">
                    Staff profile and employment dimension will be recorded for operations, payroll, and class scheduling without active credentials. Login access can be activated at any time from Users Master.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation & Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              {activeStaffTab !== 'basic' && (
                <Button
                  variant="secondary"
                  type="button"
                  size="sm"
                  onClick={() => {
                    const currentIdx = STAFF_TAB_ORDER.indexOf(activeStaffTab);
                    if (currentIdx > 0) setActiveStaffTab(STAFF_TAB_ORDER[currentIdx - 1]);
                  }}
                >
                  Previous Tab
                </Button>
              )}
              {activeStaffTab !== 'login' && (
                <Button
                  variant="secondary"
                  type="button"
                  size="sm"
                  onClick={() => {
                    const currentIdx = STAFF_TAB_ORDER.indexOf(activeStaffTab);
                    if (currentIdx < STAFF_TAB_ORDER.length - 1) setActiveStaffTab(STAFF_TAB_ORDER[currentIdx + 1]);
                  }}
                >
                  Next Tab
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" type="button" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={addSubmitting}>
                Save & Add Staff Member
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
