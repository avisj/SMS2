// ========================================================================
// TeacherAssignmentsModule Component
// Teaching Allocation Matrix and Teacher's Personal Responsibilities View
// Governed by teacher_assignments.manage and teacher_assignments.view
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Users,
  MapPin,
  Calendar,
  Layers,
  BookOpen,
  CheckCircle,
  Star,
  Trash2,
  ShieldAlert,
  GraduationCap,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import {
  TeacherSubjectAssignment,
  TeacherResponsibility,
  AcademicSession,
  Location,
  ClassItem,
  SectionItem,
  SubjectItem,
  AcademicClassSection,
  AcademicClassSubject,
  User,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';

interface TeacherAssignmentsModuleProps {
  tabId: string;
}

export const TeacherAssignmentsModule: React.FC<TeacherAssignmentsModuleProps> = () => {
  const { userContext, activeBranch } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermission();

  const canManage = isSuperAdmin || hasPermission('teacher_assignments.manage');
  const canView = isSuperAdmin || hasPermission('teacher_assignments.view');

  const [activeTab, setActiveTab] = useState<'matrix' | 'my_responsibilities'>('matrix');

  // Master Data
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);

  // Cascading Selection State
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');

  // Allocation List
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [myResponsibilities, setMyResponsibilities] = useState<TeacherResponsibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State for Assigning
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [modalClassId, setModalClassId] = useState<string>('');
  const [modalConfiguredSections, setModalConfiguredSections] = useState<AcademicClassSection[]>([]);
  const [modalConfiguredSubjects, setModalConfiguredSubjects] = useState<AcademicClassSubject[]>([]);

  const [assignForm, setAssignForm] = useState({
    teacher_user_id: '',
    section_id: '',
    subject_id: '',
    is_primary_teacher: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [sessData, locData, clsData, staffData] = await Promise.all([
        api.get<AcademicSession[]>('/academics/sessions?includeInactive=true'),
        api.get<Location[]>('/locations'),
        api.get<ClassItem[]>('/academics/classes'),
        api.get<User[]>('/people/staff'),
      ]);

      setSessions(sessData);
      setLocations(locData);
      setClasses(clsData);
      setTeachers(staffData);

      const currentSess = sessData.find(s => s.is_current) || sessData[0];
      if (currentSess && !selectedSessionId) setSelectedSessionId(currentSess.id);

      const defaultLoc = locData.find(l => l.id === activeBranch?.id) || locData[0];
      if (defaultLoc && !selectedLocationId) setSelectedLocationId(defaultLoc.id);
    } catch (err) {
      console.error('Failed to load initial master data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    if (!selectedSessionId || !selectedLocationId) return;
    setLoading(true);
    try {
      let url = `/academics/teacher-assignments?sessionId=${selectedSessionId}&locationId=${selectedLocationId}`;
      if (selectedClassId !== 'ALL') {
        url += `&classId=${selectedClassId}`;
      }
      const data = await api.get<TeacherSubjectAssignment[]>(url);
      setAssignments(data);
    } catch (err) {
      console.error('Failed to load teacher assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMyResponsibilities = async () => {
    try {
      const data = await api.get<TeacherResponsibility[]>('/academics/my-teaching-responsibilities');
      setMyResponsibilities(data);
    } catch (err) {
      console.error('Failed to load teaching responsibilities:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
    loadMyResponsibilities();
  }, [activeBranch]);

  useEffect(() => {
    if (selectedSessionId && selectedLocationId) {
      loadAssignments();
    }
  }, [selectedSessionId, selectedLocationId, selectedClassId]);

  // When class changes in Assign Modal, load configured sections and subjects
  const handleModalClassChange = async (classId: string) => {
    setModalClassId(classId);
    try {
      const [secOfferings, subjOfferings] = await Promise.all([
        api.get<AcademicClassSection[]>(
          `/academics/class-sections?sessionId=${selectedSessionId}&classId=${classId}`
        ),
        api.get<AcademicClassSubject[]>(
          `/academics/class-subjects?sessionId=${selectedSessionId}&classId=${classId}`
        ),
      ]);
      setModalConfiguredSections(secOfferings);
      setModalConfiguredSubjects(subjOfferings);

      setAssignForm(prev => ({
        ...prev,
        section_id: secOfferings[0]?.section_id || '',
        subject_id: subjOfferings[0]?.subject_id || '',
      }));
    } catch (err) {
      console.error('Failed to load offerings for modal class:', err);
    }
  };

  const handleOpenAssignModal = () => {
    const firstClassId = classes[0]?.id || '';
    setAssignForm({
      teacher_user_id: teachers[0]?.id || '',
      section_id: '',
      subject_id: '',
      is_primary_teacher: false,
    });
    setErrorMessage(null);
    setIsAssignModalOpen(true);
    if (firstClassId) {
      handleModalClassChange(firstClassId);
    }
  };

  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post('/academics/teacher-assignments', {
        teacher_user_id: assignForm.teacher_user_id,
        academic_session_id: selectedSessionId,
        location_id: selectedLocationId,
        class_id: modalClassId,
        section_id: assignForm.section_id,
        subject_id: assignForm.subject_id,
        is_primary_teacher: assignForm.is_primary_teacher,
      });
      setIsAssignModalOpen(false);
      loadAssignments();
      loadMyResponsibilities();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to assign teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string, teacherName: string, subjectName: string) => {
    if (!confirm(`Unassign teacher [${teacherName}] from [${subjectName}]?`)) return;
    try {
      await api.delete(`/academics/teacher-assignments/${id}`);
      loadAssignments();
      loadMyResponsibilities();
    } catch (err: any) {
      alert(err.message || 'Failed to remove assignment');
    }
  };

  const currentSession = sessions.find(s => s.id === selectedSessionId);
  const currentLocation = locations.find(l => l.id === selectedLocationId);

  const filteredAssignments = assignments.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.teacher?.first_name?.toLowerCase().includes(q) ||
      a.teacher?.last_name?.toLowerCase().includes(q) ||
      a.subject?.name?.toLowerCase().includes(q) ||
      a.class?.display_name?.toLowerCase().includes(q) ||
      a.section?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-teal-600" />
            Teacher Subject Assignments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Allocate faculty teaching duties across sessions, campuses, classes, sections, and subjects.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex bg-slate-200/70 p-1 rounded-lg self-start">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'matrix' ? 'bg-white text-teal-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Allocation Matrix
          </button>
          <button
            onClick={() => setActiveTab('my_responsibilities')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'my_responsibilities' ? 'bg-white text-teal-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            My Teaching Responsibilities ({myResponsibilities.length})
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIEW 1: TEACHING ALLOCATION MATRIX                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Cascading Filter Bar */}
          <Card className="p-4 bg-white border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <label className="text-xs font-semibold text-slate-700">Session:</label>
                  <select
                    value={selectedSessionId}
                    onChange={e => setSelectedSessionId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.is_current ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <label className="text-xs font-semibold text-slate-700">Branch:</label>
                  <select
                    value={selectedLocationId}
                    onChange={e => setSelectedLocationId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.location_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <label className="text-xs font-semibold text-slate-700">Class:</label>
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="ALL">All Classes</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {canManage && (
                <Button onClick={handleOpenAssignModal} className="flex items-center gap-1.5 self-start">
                  <Plus className="w-4 h-4" />
                  Assign Teacher to Subject
                </Button>
              )}
            </div>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden border-slate-200 bg-white">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Showing <strong>{filteredAssignments.length}</strong> active allocations in {currentLocation?.location_name}
              </span>
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter allocations..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Faculty / Teacher</th>
                    <th className="py-3 px-4">Class & Section</th>
                    <th className="py-3 px-4">Assigned Subject</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Campus</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading teacher allocations...
                      </td>
                    </tr>
                  ) : filteredAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No teacher allocations found for the selected branch/session.
                      </td>
                    </tr>
                  ) : (
                    filteredAssignments.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">
                            {a.teacher ? `${a.teacher.first_name} ${a.teacher.last_name || ''}` : 'Unknown'}
                          </p>
                          <span className="text-[10px] text-slate-400 font-normal">
                            @{a.teacher?.username}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {a.class?.display_name} — Section {a.section?.name}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-teal-700">{a.subject?.name}</span>
                          <span className="block text-[10px] font-mono text-slate-400">{a.subject?.code}</span>
                        </td>
                        <td className="py-3 px-4">
                          {a.is_primary_teacher ? (
                            <Badge variant="purple" className="flex items-center gap-1 w-fit">
                              <Star className="w-3 h-3 fill-purple-700 text-purple-700" />
                              Primary Faculty
                            </Badge>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Subject Teacher</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {a.location?.location_name}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={a.status === 'ACTIVE' ? 'emerald' : 'slate'}>{a.status}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canManage && (
                            <button
                              onClick={() =>
                                handleDeactivate(
                                  a.id,
                                  `${a.teacher?.first_name} ${a.teacher?.last_name || ''}`,
                                  a.subject?.name || ''
                                )
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Unassign Teacher"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 2: TEACHER'S OWN VIEW (MY RESPONSIBILITIES)                */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'my_responsibilities' && (
        <div className="space-y-4">
          <Card className="p-4 bg-teal-50/60 border border-teal-200">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-6 h-6 text-teal-700 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-teal-900">
                  Teaching Load for @{userContext?.username} ({userContext?.email})
                </h3>
                <p className="text-[11px] text-teal-700 mt-0.5">
                  Your assigned academic subjects, classrooms, and branch campuses queried live from the database.
                </p>
              </div>
            </div>
          </Card>

          {myResponsibilities.length === 0 ? (
            <Card className="p-8 text-center bg-white border-slate-200">
              <p className="text-xs text-slate-400">
                You have no active teaching assignments allocated in the system.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myResponsibilities.map(r => (
                <Card key={r.assignment_id} className="p-4 bg-white border-slate-200 shadow-sm hover:border-teal-300 transition-all">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900">{r.class_name} — Section {r.section_name}</span>
                    <Badge variant={r.is_primary_teacher ? 'purple' : 'teal'}>
                      {r.is_primary_teacher ? 'Primary' : 'Subject Faculty'}
                    </Badge>
                  </div>

                  <div className="pt-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="font-bold text-slate-800">{r.subject_name}</span>
                      <span className="text-[10px] font-mono text-slate-400">({r.subject_code})</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{r.location_name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Session: {r.session_name}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Assign Teacher */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Teacher to Class & Subject (${currentLocation?.location_name})`}
      >
        <form onSubmit={handleSaveAssign} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Faculty / Teacher</label>
            <select
              value={assignForm.teacher_user_id}
              onChange={e => setAssignForm({ ...assignForm, teacher_user_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
              required
            >
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name || ''} (@{t.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Class</label>
            <select
              value={modalClassId}
              onChange={e => handleModalClassChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
              required
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Configured Section</label>
              <select
                value={assignForm.section_id}
                onChange={e => setAssignForm({ ...assignForm, section_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                required
                disabled={modalConfiguredSections.length === 0}
              >
                {modalConfiguredSections.length === 0 ? (
                  <option value="">No sections configured</option>
                ) : (
                  modalConfiguredSections.map(cs => (
                    <option key={cs.section_id} value={cs.section_id}>
                      Section {cs.section?.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Offered Subject</label>
              <select
                value={assignForm.subject_id}
                onChange={e => setAssignForm({ ...assignForm, subject_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                required
                disabled={modalConfiguredSubjects.length === 0}
              >
                {modalConfiguredSubjects.length === 0 ? (
                  <option value="">No subjects offered</option>
                ) : (
                  modalConfiguredSubjects.map(cs => (
                    <option key={cs.subject_id} value={cs.subject_id}>
                      {cs.subject?.name} ({cs.subject?.code})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={assignForm.is_primary_teacher}
                onChange={e => setAssignForm({ ...assignForm, is_primary_teacher: e.target.checked })}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
              />
              <span className="text-xs font-medium text-slate-700">
                Designate as Primary Faculty / Lead for this Classroom
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || modalConfiguredSections.length === 0 || modalConfiguredSubjects.length === 0}
            >
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
