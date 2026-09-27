// ========================================================================
// StudentsMasterModule Component
// Specialized Operational View querying the UNIVERSAL users table
// Zero separate student tables - complete academic dimension integration
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
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
  Sparkles,
  Upload,
  Trash2,
  FileText,
  Award,
  History,
  UserCheck,
  Key,
  Camera,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { User, Location, UserTag, UserLabel, ClassItem, SectionItem, AcademicSession } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { UserProfileDrawer } from '../../components/profile/UserProfileDrawer.js';
import { tableStyles } from '../../utils/themeStyles.js';

interface PreviousSchoolRecord {
  previous_school_name: string;
  board: string;
  class_name: string;
  academic_year: string;
  marks_grade: string;
  result: string;
  remarks: string;
  attachment_url: string;
}

interface AchievementRecord {
  title: string;
  category: string;
  level: string;
  award_position: string;
  achievement_date: string;
  description: string;
  attachment_url: string;
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

export type EnrollTab = 'basic' | 'academic' | 'previous' | 'achievements' | 'documents' | 'login';
export const ENROLL_TAB_ORDER: EnrollTab[] = ['basic', 'academic', 'previous', 'achievements', 'documents', 'login'];

interface StudentsMasterModuleProps {
  tabId: string;
}

export const StudentsMasterModule: React.FC<StudentsMasterModuleProps> = ({ tabId }) => {
  const { userContext, activeBranch } = useAuth();
  const { tabs, updateTabState } = useWorkspace();
  const { hasPermission } = usePermission();

  const currentTab = tabs.find(t => t.id === tabId);
  const initialSearch = currentTab?.state.searchQuery || '';
  const initialClass = currentTab?.state.filters?.className || '';
  const initialSection = currentTab?.state.filters?.sectionName || '';
  const initialHouse = currentTab?.state.filters?.house || '';
  const initialStream = currentTab?.state.filters?.stream || '';

  const [search, setSearch] = useState(initialSearch);
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [selectedSection, setSelectedSection] = useState(initialSection);
  const [selectedHouse, setSelectedHouse] = useState(initialHouse);
  const [selectedStream, setSelectedStream] = useState(initialStream);

  const [students, setStudents] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [sectionsList, setSectionsList] = useState<SectionItem[]>([]);
  const [currentSession, setCurrentSession] = useState<AcademicSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected student for slide-over drawer
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Onboard Student Modal state (6 Tabs)
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [activeEnrollTab, setActiveEnrollTab] = useState<EnrollTab>('basic');
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [enrollForm, setEnrollForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    profile_photo_url: '',
    username: '',
    email: '',
    phone: '',
    gender: 'MALE',
    date_of_birth: '',
    blood_group: 'O+',
    nationality: 'Indian',
    religion: '',
    category_name: 'General',
    address: '',
    location_id: '',
    admission_number: '',
    roll_number: '',
    admission_date: new Date().toISOString().split('T')[0],
    academic_session: '',
    class_name: '',
    section_name: '',
    house: 'Red',
    stream: 'General',
    medium: 'English',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    create_login_access: false,
    login_password: '',
    confirm_password: '',
    login_status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
  });

  const [prevSchoolRecords, setPrevSchoolRecords] = useState<PreviousSchoolRecord[]>([
    { previous_school_name: '', board: '', class_name: '', academic_year: '', marks_grade: '', result: '', remarks: '', attachment_url: '' },
  ]);
  const [achievementsList, setAchievementsList] = useState<AchievementRecord[]>([
    { title: '', category: 'Academics', level: 'School', award_position: '', achievement_date: '', description: '', attachment_url: '' },
  ]);
  const [documentsList, setDocumentsList] = useState<DocumentRecord[]>([
    { document_type: 'Birth Certificate', document_name: '', document_number: '', issue_date: '', expiry_date: '', file_url: '', remarks: '' },
  ]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    updateTabState(tabId, { searchQuery: val });
  };

  const handleClassChange = (val: string) => {
    setSelectedClass(val);
    updateTabState(tabId, { filters: { ...currentTab?.state.filters, className: val } });
  };

  const handleSectionChange = (val: string) => {
    setSelectedSection(val);
    updateTabState(tabId, { filters: { ...currentTab?.state.filters, sectionName: val } });
  };

  const handleHouseChange = (val: string) => {
    setSelectedHouse(val);
    updateTabState(tabId, { filters: { ...currentTab?.state.filters, house: val } });
  };

  const handleStreamChange = (val: string) => {
    setSelectedStream(val);
    updateTabState(tabId, { filters: { ...currentTab?.state.filters, stream: val } });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsData, locsData, classesData, sectionsData, currSession] = await Promise.all([
        api.get<User[]>('/people/students', {
          search: search || undefined,
          class_name: selectedClass || undefined,
          section_name: selectedSection || undefined,
          house: selectedHouse || undefined,
          stream: selectedStream || undefined,
        }),
        api.get<Location[]>('/locations').catch(err => {
          console.warn('Locations load error in students:', err);
          return [];
        }),
        api.get<ClassItem[]>('/academics/classes').catch(err => {
          console.warn('Classes load error in students:', err);
          return [];
        }),
        api.get<SectionItem[]>('/academics/sections').catch(err => {
          console.warn('Sections load error in students:', err);
          return [];
        }),
        api.get<AcademicSession>('/academics/sessions/current').catch(err => {
          console.warn('Current session load error in students:', err);
          return null;
        }),
      ]);
      setStudents(studentsData || []);
      setLocations(locsData || []);
      setClassesList(classesData || []);
      setSectionsList(sectionsData || []);
      if (currSession) {
        setCurrentSession(currSession);
      }

      setEnrollForm(prev => ({
        ...prev,
        location_id: prev.location_id || (locsData && locsData.length > 0 ? locsData[0].id : ''),
        academic_session: prev.academic_session || (currSession?.name || ''),
        class_name: prev.class_name || (classesData && classesData.length > 0 ? (classesData[0].display_name || classesData[0].name) : ''),
        section_name: prev.section_name || (sectionsData && sectionsData.length > 0 ? sectionsData[0].name : ''),
      }));
    } catch (err) {
      console.error('Failed to load students master data:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedClass, selectedSection, selectedHouse, selectedStream, activeBranch]);

  // Helper to generate a random strong password
  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEnrollForm(prev => ({ ...prev, login_password: pass, confirm_password: pass }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEnrollForm(prev => ({ ...prev, profile_photo_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Row Management Helpers
  const addPreviousSchoolRow = () => {
    setPrevSchoolRecords(prev => [
      ...prev,
      { previous_school_name: '', board: '', class_name: '', academic_year: '', marks_grade: '', result: '', remarks: '', attachment_url: '' },
    ]);
  };

  const removePreviousSchoolRow = (index: number) => {
    setPrevSchoolRecords(prev => prev.filter((_, i) => i !== index));
  };

  const updatePreviousSchoolRow = (index: number, field: keyof PreviousSchoolRecord, val: string) => {
    setPrevSchoolRecords(prev => prev.map((r, i) => i === index ? { ...r, [field]: val } : r));
  };

  const addAchievementRow = () => {
    setAchievementsList(prev => [
      ...prev,
      { title: '', category: 'Academics', level: 'School', award_position: '', achievement_date: '', description: '', attachment_url: '' },
    ]);
  };

  const removeAchievementRow = (index: number) => {
    setAchievementsList(prev => prev.filter((_, i) => i !== index));
  };

  const updateAchievementRow = (index: number, field: keyof AchievementRecord, val: string) => {
    setAchievementsList(prev => prev.map((a, i) => i === index ? { ...a, [field]: val } : a));
  };

  const addDocumentRow = () => {
    setDocumentsList(prev => [
      ...prev,
      { document_type: 'Transfer Certificate', document_name: '', document_number: '', issue_date: '', expiry_date: '', file_url: '', remarks: '' },
    ]);
  };

  const removeDocumentRow = (index: number) => {
    setDocumentsList(prev => prev.filter((_, i) => i !== index));
  };

  const updateDocumentRow = (index: number, field: keyof DocumentRecord, val: string) => {
    setDocumentsList(prev => prev.map((d, i) => i === index ? { ...d, [field]: val } : d));
  };

  const handleOpenEnrollModal = () => {
    const nextNum = (students.length + 1).toString().padStart(3, '0');
    const autoAdm = `ADM-${new Date().getFullYear()}-${nextNum}`;
    setEnrollForm(prev => ({
      ...prev,
      admission_number: prev.admission_number || autoAdm,
      class_name: prev.class_name || (classesList[0]?.name || classesList[0]?.display_name || 'Class 10'),
      section_name: prev.section_name || (sectionsList[0]?.name || 'Section A'),
      academic_session: prev.academic_session || currentSession?.name || '2025-2026',
      location_id: prev.location_id || locations[0]?.id || activeBranch?.id || '',
      nationality: prev.nationality || 'Indian',
      blood_group: prev.blood_group || 'O+',
      category_name: prev.category_name || 'General',
    }));
    setActiveEnrollTab('basic');
    setErrorMessage(null);
    setIsEnrollOpen(true);
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validate First Name
    if (!enrollForm.first_name?.trim()) {
      setErrorMessage('Please enter the student\'s First Name.');
      setActiveEnrollTab('basic');
      return;
    }

    // 2. Validate Admission Number
    const autoAdm = `ADM-${new Date().getFullYear()}-${(students.length + 1).toString().padStart(3, '0')}`;
    const finalAdmissionNo = enrollForm.admission_number?.trim() || autoAdm;

    // 3. Validate Academic Placement
    const finalLocationId = enrollForm.location_id || locations[0]?.id || activeBranch?.id;
    if (!finalLocationId) {
      setErrorMessage('Please select a Campus Location in Academic Placement.');
      setActiveEnrollTab('academic');
      return;
    }

    const finalSession = enrollForm.academic_session?.trim() || currentSession?.name || '2025-2026';
    const finalClass = enrollForm.class_name?.trim() || (classesList[0]?.name || classesList[0]?.display_name || 'Class 10');

    // 4. Auto-generate Username and Email if blank
    const cleanFirst = enrollForm.first_name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'student';
    const cleanLast = (enrollForm.last_name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const defaultUsername = cleanLast ? `${cleanFirst}.${cleanLast}` : `${cleanFirst}.${finalAdmissionNo.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const finalUsername = enrollForm.username?.trim() || defaultUsername;
    const finalEmail = enrollForm.email?.trim() || `${finalUsername}@student.dpa.edu`;

    if (enrollForm.create_login_access) {
      if (!enrollForm.login_password || enrollForm.login_password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        setActiveEnrollTab('login');
        return;
      }
      if (enrollForm.login_password !== enrollForm.confirm_password) {
        setErrorMessage('Passwords do not match.');
        setActiveEnrollTab('login');
        return;
      }
    }

    setEnrollSubmitting(true);

    try {
      const payload: any = {
        ...enrollForm,
        admission_number: finalAdmissionNo,
        location_id: finalLocationId,
        academic_session: finalSession,
        class_name: finalClass,
        username: finalUsername,
        email: finalEmail,
        previous_academic_records: prevSchoolRecords.filter(r => r.previous_school_name.trim()),
        achievements: achievementsList.filter(a => a.title.trim()),
        documents: documentsList.filter(d => d.document_name.trim() && d.file_url.trim()),
      };
      if (!enrollForm.create_login_access) {
        delete payload.login_password;
        delete payload.confirm_password;
      }
      await api.post('/people/students', payload);
      setIsEnrollOpen(false);
      // Reset form
      setEnrollForm({
        first_name: '',
        middle_name: '',
        last_name: '',
        profile_photo_url: '',
        username: '',
        email: '',
        phone: '',
        gender: 'MALE',
        date_of_birth: '',
        blood_group: 'O+',
        nationality: 'Indian',
        religion: '',
        category_name: 'General',
        address: '',
        location_id: locations[0]?.id || '',
        admission_number: '',
        roll_number: '',
        admission_date: new Date().toISOString().split('T')[0],
        academic_session: currentSession?.name || '',
        class_name: classesList[0]?.display_name || classesList[0]?.name || '',
        section_name: sectionsList[0]?.name || '',
        house: 'Red',
        stream: 'General',
        medium: 'English',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        create_login_access: false,
        login_password: '',
        confirm_password: '',
        login_status: 'ACTIVE',
      });
      setPrevSchoolRecords([{ previous_school_name: '', board: '', class_name: '', academic_year: '', marks_grade: '', result: '', remarks: '', attachment_url: '' }]);
      setAchievementsList([{ title: '', category: 'Academics', level: 'School', award_position: '', achievement_date: '', description: '', attachment_url: '' }]);
      setDocumentsList([{ document_type: 'Birth Certificate', document_name: '', document_number: '', issue_date: '', expiry_date: '', file_url: '', remarks: '' }]);
      setActiveEnrollTab('basic');
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to enroll student');
    } finally {
      setEnrollSubmitting(false);
    }
  };

  // Metrics
  const totalStudents = students.length;
  const class10Count = students.filter(s => s.student_profile?.class_name === 'Class 10').length;
  const srSecondaryCount = students.filter(s => ['Class 11', 'Class 12'].includes(s.student_profile?.class_name || '')).length;
  const meritCount = students.filter(s => s.labels?.some(l => l.code === 'LBL-MERIT')).length;

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Students Master</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800 font-semibold border border-brand-200">
              Universal Users View
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Specialized operational directory for enrolled learners with academic dimensions and taxonomy tags.
          </p>
        </div>

        {hasPermission('users.create') && (
          <Button variant="primary" onClick={handleOpenEnrollModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Enroll New Student
          </Button>
        )}
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Total Enrolled</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalStudents}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Class 10 Wing</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{class10Count}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Senior Secondary</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{srSecondaryCount}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Merit Scholars</span>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{meritCount}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Advanced Filter Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Filter className="w-3.5 h-3.5 text-brand-600" />
          Academic Filters & Search
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="md:col-span-1">
            <Input
              placeholder="Search name, roll no, admission no..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Class Filter */}
          <select
            value={selectedClass}
            onChange={(e) => handleClassChange(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
          >
            <option value="">All Academic Classes</option>
            {classesList.map(c => (
              <option key={c.id} value={c.display_name || c.name}>
                {c.display_name || c.name}
              </option>
            ))}
          </select>

          {/* Section Filter */}
          <select
            value={selectedSection}
            onChange={(e) => handleSectionChange(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
          >
            <option value="">All Sections</option>
            {sectionsList.map(s => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          {/* House Filter */}
          <select
            value={selectedHouse}
            onChange={(e) => handleHouseChange(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
          >
            <option value="">All Houses</option>
            <option value="Red">Red House</option>
            <option value="Blue">Blue House</option>
            <option value="Green">Green House</option>
            <option value="Yellow">Yellow House</option>
          </select>

          {/* Stream Filter */}
          <select
            value={selectedStream}
            onChange={(e) => handleStreamChange(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
          >
            <option value="">All Streams</option>
            <option value="General">General</option>
            <option value="Science">Science</option>
            <option value="Commerce">Commerce</option>
            <option value="Arts">Arts</option>
          </select>
        </div>
      </Card>

      {/* Students Directory Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Admission No</th>
                <th className="py-3 px-4">Class & Sec</th>
                <th className="py-3 px-4">Roll No</th>
                <th className="py-3 px-4">Parents / Guardians</th>
                <th className="py-3 px-4">Campus Branch</th>
                <th className="py-3 px-4">Login Access</th>
                <th className="py-3 px-4">Taxonomy Tags & Labels</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    Loading student records from universal users table...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No students match the current filters.
                  </td>
                </tr>
              ) : (
                students.map(student => {
                  const sp = student.student_profile;
                  const isSelected = selectedUserId === student.id;
                  return (
                    <tr key={student.id} className={isSelected ? tableStyles.rowSelected : tableStyles.rowDefault}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {student.first_name?.[0]?.toUpperCase() || 'S'}
                            {student.last_name ? student.last_name[0]?.toUpperCase() : ''}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {student.first_name || ''} {student.last_name || ''}
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {student.email || ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {sp?.admission_number || 'N/A'}
                      </td>

                      <td className="py-3 px-4">
                        <Badge variant="primary">
                          {sp?.class_name || 'N/A'} {sp?.section_name && `• ${sp.section_name}`}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {sp?.roll_number || '—'}
                      </td>

                      <td className="py-3 px-4">
                        {student.parents && student.parents.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {student.parents.map((p, idx) => {
                              const parentUser = (p as any).parent || (p as any).user;
                              if (!parentUser) return null;
                              return (
                                <span key={parentUser.id || idx} className="text-[11px] text-slate-700">
                                  <span className="font-semibold">{parentUser.first_name || ''} {parentUser.last_name || ''}</span>
                                  <span className="text-slate-400 text-[10px]"> ({p.relationship_type ? p.relationship_type.toLowerCase() : 'guardian'})</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">None</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-slate-700 font-medium">
                          {student.locations?.[0]?.location_name || 'Main Campus'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {student.login_access?.has_login ? (
                          <Badge variant="primary" className="text-[10px]">Active</Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">No Access</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {/* Tags */}
                          {student.tags?.map(t => (
                            <span
                              key={t.id}
                              style={{ backgroundColor: `${t.color}20`, color: t.color, borderColor: `${t.color}40` }}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                            >
                              {t.name}
                            </span>
                          ))}
                          {/* Labels */}
                          {student.labels?.map(l => (
                            <span
                              key={l.id}
                              style={{ backgroundColor: `${l.color}20`, color: l.color, borderColor: `${l.color}40` }}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                              {l.name}
                            </span>
                          ))}
                          {(!student.tags?.length && !student.labels?.length) && (
                            <span className="text-slate-400 text-[11px]">None</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedUserId(student.id)}
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

      {/* Enroll New Student Modal (6-Tab Comprehensive Admission Form) */}
      <Modal
        isOpen={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        title="Enroll New Student"
        subtitle="Complete student onboarding with academic placement, previous history, achievements, and documents"
        maxWidth="5xl"
      >
        <form onSubmit={handleEnrollSubmit} className="space-y-4">
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
              onClick={() => setActiveEnrollTab('basic')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeEnrollTab === 'basic'
                  ? 'bg-brand-50 text-brand-700 border-b-2 border-brand-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              1. Basic Info & Photo
            </button>
            <button
              type="button"
              onClick={() => setActiveEnrollTab('academic')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeEnrollTab === 'academic'
                  ? 'bg-brand-50 text-brand-700 border-b-2 border-brand-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              2. Academic Placement
            </button>
            <button
              type="button"
              onClick={() => setActiveEnrollTab('previous')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeEnrollTab === 'previous'
                  ? 'bg-brand-50 text-brand-700 border-b-2 border-brand-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              3. School History ({prevSchoolRecords.filter(r => r.previous_school_name).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveEnrollTab('achievements')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeEnrollTab === 'achievements'
                  ? 'bg-brand-50 text-brand-700 border-b-2 border-brand-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              4. Achievements ({achievementsList.filter(a => a.title).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveEnrollTab('documents')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeEnrollTab === 'documents'
                  ? 'bg-brand-50 text-brand-700 border-b-2 border-brand-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              5. Documents ({documentsList.filter(d => d.document_name).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveEnrollTab('login')}
              className={`px-3 py-2 font-semibold rounded-t-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeEnrollTab === 'login'
                  ? 'bg-brand-50 text-brand-700 border-b-2 border-brand-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              6. Login & Account
            </button>
          </div>

          {/* TAB 1: BASIC INFO & PHOTO */}
          {activeEnrollTab === 'basic' && (
            <div className="space-y-4 pt-2">
              {/* Photo & Identity Section */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="relative group w-20 h-20 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                  {enrollForm.profile_photo_url ? (
                    <img
                      src={enrollForm.profile_photo_url}
                      alt="Student Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="space-y-1 text-center sm:text-left flex-1">
                  <span className="text-xs font-bold text-slate-800 block">Student Profile Photo</span>
                  <p className="text-[11px] text-slate-500">
                    Upload an ID photograph (PNG, JPG, max 5MB)
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs">
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    {enrollForm.profile_photo_url && (
                      <button
                        type="button"
                        onClick={() => setEnrollForm(prev => ({ ...prev, profile_photo_url: '' }))}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">First Name *</label>
                  <Input
                    required
                    value={enrollForm.first_name}
                    onChange={e => setEnrollForm({ ...enrollForm, first_name: e.target.value })}
                    placeholder="e.g. Aarav"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Middle Name</label>
                  <Input
                    value={enrollForm.middle_name}
                    onChange={e => setEnrollForm({ ...enrollForm, middle_name: e.target.value })}
                    placeholder="e.g. Kumar"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Last Name</label>
                  <Input
                    value={enrollForm.last_name}
                    onChange={e => setEnrollForm({ ...enrollForm, last_name: e.target.value })}
                    placeholder="e.g. Sharma"
                  />
                </div>
              </div>

              {/* Demographics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Gender *</label>
                  <select
                    value={enrollForm.gender}
                    onChange={e => setEnrollForm({ ...enrollForm, gender: e.target.value })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                    value={enrollForm.date_of_birth}
                    onChange={e => setEnrollForm({ ...enrollForm, date_of_birth: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Blood Group</label>
                  <select
                    value={enrollForm.blood_group}
                    onChange={e => setEnrollForm({ ...enrollForm, blood_group: e.target.value })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              {/* Nationality, Religion, Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Nationality</label>
                  <Input
                    value={enrollForm.nationality}
                    onChange={e => setEnrollForm({ ...enrollForm, nationality: e.target.value })}
                    placeholder="e.g. Indian"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Religion</label>
                  <Input
                    value={enrollForm.religion}
                    onChange={e => setEnrollForm({ ...enrollForm, religion: e.target.value })}
                    placeholder="e.g. Hindu / Muslim / Christian"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Category / Caste</label>
                  <Input
                    value={enrollForm.category_name}
                    onChange={e => setEnrollForm({ ...enrollForm, category_name: e.target.value })}
                    placeholder="e.g. General, OBC, SC, ST"
                  />
                </div>
              </div>

              {/* Contact & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Contact Phone</label>
                  <Input
                    value={enrollForm.phone}
                    onChange={e => setEnrollForm({ ...enrollForm, phone: e.target.value })}
                    placeholder="e.g. +91 98111 22334"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Student / Parent Email</label>
                  <Input
                    type="email"
                    value={enrollForm.email}
                    onChange={e => setEnrollForm({ ...enrollForm, email: e.target.value })}
                    placeholder="e.g. student@school.edu"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Residential Address</label>
                <textarea
                  rows={2}
                  value={enrollForm.address}
                  onChange={e => setEnrollForm({ ...enrollForm, address: e.target.value })}
                  placeholder="Street Address, City, State, Postal Code"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Emergency Contact */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs font-bold text-slate-800 block mb-2">Guardian & Emergency Contact</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Guardian Name</label>
                    <Input
                      value={enrollForm.emergency_contact_name}
                      onChange={e => setEnrollForm({ ...enrollForm, emergency_contact_name: e.target.value })}
                      placeholder="e.g. Rajesh Sharma (Father)"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Guardian Phone Number</label>
                    <Input
                      value={enrollForm.emergency_contact_phone}
                      onChange={e => setEnrollForm({ ...enrollForm, emergency_contact_phone: e.target.value })}
                      placeholder="e.g. +91 98222 33445"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACADEMIC PLACEMENT */}
          {activeEnrollTab === 'academic' && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg text-xs text-brand-900 flex items-start gap-2">
                <GraduationCap className="w-4 h-4 text-brand-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Academic Placement Policy:</span>
                  <p className="text-[11px] text-brand-800 mt-0.5">
                    Students belong to one school institution and their campus location is recorded strictly as part of their academic placement in <code>student_academic_enrollments</code>. Students do not require administrative branch-switching access.
                  </p>
                </div>
              </div>

              {/* Campus Location for Placement */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Academic Placement Campus / School Location *
                </label>
                <select
                  required
                  value={enrollForm.location_id}
                  onChange={e => setEnrollForm({ ...enrollForm, location_id: e.target.value })}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
                >
                  <option value="">Select Campus Location</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.location_name} ({loc.location_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic Session, Class, Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Academic Session *</label>
                  <Input
                    required
                    value={enrollForm.academic_session}
                    onChange={e => setEnrollForm({ ...enrollForm, academic_session: e.target.value })}
                    placeholder="e.g. 2026-2027"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Class *</label>
                  <select
                    required
                    value={enrollForm.class_name}
                    onChange={e => setEnrollForm({ ...enrollForm, class_name: e.target.value })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">Select Class</option>
                    {classesList.map(c => (
                      <option key={c.id} value={c.display_name || c.name}>
                        {c.display_name || c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Section</label>
                  <select
                    value={enrollForm.section_name}
                    onChange={e => setEnrollForm({ ...enrollForm, section_name: e.target.value })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">Select Section</option>
                    {sectionsList.map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Admission Number, Roll Number, Admission Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Admission Number *</label>
                  <Input
                    required
                    value={enrollForm.admission_number}
                    onChange={e => setEnrollForm({ ...enrollForm, admission_number: e.target.value })}
                    placeholder="e.g. ADM-2026-105"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Roll Number</label>
                  <Input
                    value={enrollForm.roll_number}
                    onChange={e => setEnrollForm({ ...enrollForm, roll_number: e.target.value })}
                    placeholder="e.g. 105"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Admission Date</label>
                  <Input
                    type="date"
                    value={enrollForm.admission_date}
                    onChange={e => setEnrollForm({ ...enrollForm, admission_date: e.target.value })}
                  />
                </div>
              </div>

              {/* House, Stream, Medium */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">House</label>
                  <select
                    value={enrollForm.house}
                    onChange={e => setEnrollForm({ ...enrollForm, house: e.target.value })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="Red">Red House</option>
                    <option value="Blue">Blue House</option>
                    <option value="Green">Green House</option>
                    <option value="Yellow">Yellow House</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Stream</label>
                  <select
                    value={enrollForm.stream}
                    onChange={e => setEnrollForm({ ...enrollForm, stream: e.target.value })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="General">General</option>
                    <option value="Science">Science</option>
                    <option value="Commerce">Commerce</option>
                    <option value="Arts">Arts</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Instruction Medium</label>
                  <select
                    value={enrollForm.medium}
                    onChange={e => setEnrollForm({ ...enrollForm, medium: e.target.value })}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Bilingual">Bilingual</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PREVIOUS SCHOOL HISTORY */}
          {activeEnrollTab === 'previous' && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Previous Schooling History</h4>
                  <p className="text-[11px] text-slate-500">Record prior institutions attended and academic credentials</p>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={addPreviousSchoolRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Previous School
                </Button>
              </div>

              {prevSchoolRecords.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  No prior school records added. Click "Add Previous School" to add prior schooling details.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {prevSchoolRecords.map((row, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 relative">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-xs font-bold text-slate-700">Record #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removePreviousSchoolRow(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">School Name *</label>
                          <Input
                            value={row.previous_school_name}
                            onChange={e => updatePreviousSchoolRow(idx, 'previous_school_name', e.target.value)}
                            placeholder="e.g. St. Xavier's High School"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Board / Affiliation</label>
                          <Input
                            value={row.board}
                            onChange={e => updatePreviousSchoolRow(idx, 'board', e.target.value)}
                            placeholder="e.g. CBSE / ICSE / State Board"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Class Passed</label>
                          <Input
                            value={row.class_name}
                            onChange={e => updatePreviousSchoolRow(idx, 'class_name', e.target.value)}
                            placeholder="e.g. Class 8"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Academic Year</label>
                          <Input
                            value={row.academic_year}
                            onChange={e => updatePreviousSchoolRow(idx, 'academic_year', e.target.value)}
                            placeholder="e.g. 2024-2025"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Marks / Percentage / Grade</label>
                          <Input
                            value={row.marks_grade}
                            onChange={e => updatePreviousSchoolRow(idx, 'marks_grade', e.target.value)}
                            placeholder="e.g. 88.5% or A1"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Result / Status</label>
                          <Input
                            value={row.result}
                            onChange={e => updatePreviousSchoolRow(idx, 'result', e.target.value)}
                            placeholder="e.g. Passed / Transferred"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Transfer Certificate (TC) / Remarks</label>
                        <Input
                          value={row.remarks}
                          onChange={e => updatePreviousSchoolRow(idx, 'remarks', e.target.value)}
                          placeholder="e.g. TC No. 5421 issued on 15 March 2025"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AWARDS & ACHIEVEMENTS */}
          {activeEnrollTab === 'achievements' && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Awards & Honors</h4>
                  <p className="text-[11px] text-slate-500">Record academic, athletic, artistic, and leadership distinctions</p>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={addAchievementRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Achievement
                </Button>
              </div>

              {achievementsList.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  No achievements recorded. Click "Add Achievement" to log distinctions.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {achievementsList.map((ach, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 relative">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-xs font-bold text-slate-700">Achievement #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeAchievementRow(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Title *</label>
                          <Input
                            value={ach.title}
                            onChange={e => updateAchievementRow(idx, 'title', e.target.value)}
                            placeholder="e.g. State Science Olympiad"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Category</label>
                          <select
                            value={ach.category}
                            onChange={e => updateAchievementRow(idx, 'category', e.target.value)}
                            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                          >
                            <option value="Academics">Academics</option>
                            <option value="Sports">Sports</option>
                            <option value="Arts">Arts</option>
                            <option value="Leadership">Leadership</option>
                            <option value="Community">Community</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Level</label>
                          <select
                            value={ach.level}
                            onChange={e => updateAchievementRow(idx, 'level', e.target.value)}
                            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                          >
                            <option value="School">School Level</option>
                            <option value="Inter-school">Inter-School</option>
                            <option value="District">District</option>
                            <option value="State">State</option>
                            <option value="National">National</option>
                            <option value="International">International</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Award / Position</label>
                          <Input
                            value={ach.award_position}
                            onChange={e => updateAchievementRow(idx, 'award_position', e.target.value)}
                            placeholder="e.g. 1st Place / Gold Medal"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Date Achieved</label>
                          <Input
                            type="date"
                            value={ach.achievement_date}
                            onChange={e => updateAchievementRow(idx, 'achievement_date', e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Description / Certificate Reference</label>
                        <Input
                          value={ach.description}
                          onChange={e => updateAchievementRow(idx, 'description', e.target.value)}
                          placeholder="Brief description of the event or certificate number"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DOCUMENTS */}
          {activeEnrollTab === 'documents' && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Student Documents</h4>
                  <p className="text-[11px] text-slate-500">Attach and catalog identity, birth, health, and transfer certificates</p>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={addDocumentRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Document
                </Button>
              </div>

              {documentsList.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  No documents cataloged. Click "Add Document" to attach certificates.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {documentsList.map((doc, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 relative">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-xs font-bold text-slate-700">Document #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeDocumentRow(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Document Type</label>
                          <select
                            value={doc.document_type}
                            onChange={e => updateDocumentRow(idx, 'document_type', e.target.value)}
                            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                          >
                            <option value="Birth Certificate">Birth Certificate</option>
                            <option value="Transfer Certificate">Transfer Certificate (TC)</option>
                            <option value="ID Proof / Aadhaar">ID Proof / Aadhaar</option>
                            <option value="Address Proof">Address Proof</option>
                            <option value="Previous Marksheet">Previous Marksheet</option>
                            <option value="Medical Certificate">Medical Certificate</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Document Title *</label>
                          <Input
                            value={doc.document_name}
                            onChange={e => updateDocumentRow(idx, 'document_name', e.target.value)}
                            placeholder="e.g. Official Birth Certificate"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Document / Registration No.</label>
                          <Input
                            value={doc.document_number}
                            onChange={e => updateDocumentRow(idx, 'document_number', e.target.value)}
                            placeholder="e.g. BC-2024-8891"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">File / Storage URL *</label>
                          <Input
                            value={doc.file_url}
                            onChange={e => updateDocumentRow(idx, 'file_url', e.target.value)}
                            placeholder="e.g. https://storage.sms.internal/docs/birth_cert.pdf"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Remarks</label>
                          <Input
                            value={doc.remarks}
                            onChange={e => updateDocumentRow(idx, 'remarks', e.target.value)}
                            placeholder="e.g. Verified against original"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: LOGIN & ACCOUNT */}
          {activeEnrollTab === 'login' && (
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 text-slate-800 font-bold cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={enrollForm.create_login_access}
                      onChange={e => setEnrollForm({ ...enrollForm, create_login_access: e.target.checked })}
                      className="w-4 h-4 text-brand-600 rounded accent-brand-600 cursor-pointer"
                    />
                    <span>Create Portal Login Access for this Student</span>
                  </label>
                  {enrollForm.create_login_access && (
                    <Badge variant="emerald" size="sm">Login Access Enabled</Badge>
                  )}
                </div>

                {!enrollForm.create_login_access ? (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-slate-400" />
                      Login Access is Optional
                    </div>
                    <p className="text-[11px] text-slate-500">
                      The student will be admitted to the school directory without web/mobile portal credentials. You can provision or generate their login at any point later from <strong>Users Master</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2 bg-white p-3 rounded-lg border border-brand-200">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200">
                      <span>School ID Organization Code:</span>
                      <span className="font-mono font-bold text-brand-700 text-xs">
                        {userContext?.school_id_code || 'DPA-DEL-001'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Username / Login ID *</label>
                        <Input
                          required={enrollForm.create_login_access}
                          value={enrollForm.username}
                          onChange={e => setEnrollForm({ ...enrollForm, username: e.target.value })}
                          placeholder="e.g. aarav.sharma"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Account Status</label>
                        <select
                          value={enrollForm.login_status}
                          onChange={e => setEnrollForm({ ...enrollForm, login_status: e.target.value as any })}
                          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none"
                        >
                          <option value="ACTIVE">ACTIVE (Student can log in immediately)</option>
                          <option value="DISABLED">DISABLED (Login suspended)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">Password *</label>
                          <button
                            type="button"
                            onClick={generateRandomPassword}
                            className="text-[10px] text-brand-600 hover:text-brand-700 font-semibold"
                          >
                            Generate Password
                          </button>
                        </div>
                        <Input
                          type="password"
                          required={enrollForm.create_login_access}
                          value={enrollForm.login_password}
                          onChange={e => setEnrollForm({ ...enrollForm, login_password: e.target.value })}
                          placeholder="Min. 6 characters"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">Confirm Password *</label>
                        <Input
                          type="password"
                          required={enrollForm.create_login_access}
                          value={enrollForm.confirm_password}
                          onChange={e => setEnrollForm({ ...enrollForm, confirm_password: e.target.value })}
                          placeholder="Re-enter password"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation & Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              {activeEnrollTab !== 'basic' && (
                <Button
                  variant="secondary"
                  type="button"
                  size="sm"
                  onClick={() => {
                    const currentIdx = ENROLL_TAB_ORDER.indexOf(activeEnrollTab);
                    if (currentIdx > 0) setActiveEnrollTab(ENROLL_TAB_ORDER[currentIdx - 1]);
                  }}
                >
                  Previous Tab
                </Button>
              )}
              {activeEnrollTab !== 'login' && (
                <Button
                  variant="secondary"
                  type="button"
                  size="sm"
                  onClick={() => {
                    const currentIdx = ENROLL_TAB_ORDER.indexOf(activeEnrollTab);
                    if (currentIdx < ENROLL_TAB_ORDER.length - 1) setActiveEnrollTab(ENROLL_TAB_ORDER[currentIdx + 1]);
                  }}
                >
                  Next Tab
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" type="button" onClick={() => setIsEnrollOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={enrollSubmitting}>
                Complete Enrollment
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
