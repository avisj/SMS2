// ========================================================================
// ParentsMasterModule Component
// Dedicated Operational Master for Parents & Guardians
// Built strictly on Universal Users Table (user_type = 'PARENT')
// Supports normalized M:N parent-child relationships & optional login access
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  GraduationCap,
  Building,
  Eye,
  Link,
  Unlink,
  CheckCircle,
  XCircle,
  Key,
  Shield,
  Phone,
  Mail,
  HeartHandshake,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { User, Location } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { UserProfileDrawer } from '../../components/profile/UserProfileDrawer.js';

interface ParentsMasterModuleProps {
  tabId: string;
}

export const ParentsMasterModule: React.FC<ParentsMasterModuleProps> = ({ tabId }) => {
  const { userContext, activeBranch } = useAuth();
  const { tabs, updateTabState } = useWorkspace();
  const { hasPermission } = usePermission();

  const currentTab = tabs.find(t => t.id === tabId);
  const initialSearch = currentTab?.state.searchQuery || '';
  const initialLocation = currentTab?.state.filters?.locationId || '';
  const initialStatus = currentTab?.state.filters?.status || '';

  const [search, setSearch] = useState(initialSearch);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);

  const [parents, setParents] = useState<User[]>([]);
  const [studentsList, setStudentsList] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected parent for profile slide-over drawer
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Add Parent Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [parentForm, setParentForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    location_id: '',
    create_login_access: false,
    login_username: '',
    login_password: '',
    confirm_password: '',
    login_status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
    link_student_id: '',
    relationship_type: 'FATHER',
    is_emergency_contact: true,
  });

  // Link Student Modal state
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkParent, setLinkParent] = useState<User | null>(null);
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkRelType, setLinkRelType] = useState('FATHER');
  const [linkEmergency, setLinkEmergency] = useState(false);
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    updateTabState(tabId, { searchQuery: val });
  };

  const handleLocationChange = (val: string) => {
    setSelectedLocation(val);
    updateTabState(tabId, { filters: { ...currentTab?.state.filters, locationId: val } });
  };

  const handleStatusChange = (val: string) => {
    setSelectedStatus(val);
    updateTabState(tabId, { filters: { ...currentTab?.state.filters, status: val } });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [parentsData, locsData, studentsData] = await Promise.all([
        api.get<User[]>('/people/parents', {
          search: search || undefined,
          location_id: selectedLocation || undefined,
          status: selectedStatus || undefined,
        }).catch(err => {
          console.error('Failed to load parents list', err);
          return [] as User[];
        }),
        api.get<Location[]>('/locations').catch(err => {
          console.error('Failed to load locations', err);
          return [] as Location[];
        }),
        api.get<User[]>('/people/students').catch(err => {
          console.error('Failed to load students for parent linking', err);
          return [] as User[];
        }),
      ]);

      setParents(parentsData || []);
      setLocations(locsData || []);
      setStudentsList(studentsData || []);
    } catch (err: any) {
      console.error('Failed to load parents master data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedLocation, selectedStatus]);

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (parentForm.create_login_access) {
      if (!parentForm.login_password || parentForm.login_password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }
      if (parentForm.login_password !== parentForm.confirm_password) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    try {
      setAddSubmitting(true);
      const payload: any = {
        first_name: parentForm.first_name,
        middle_name: parentForm.middle_name || undefined,
        last_name: parentForm.last_name || undefined,
        email: parentForm.email,
        phone: parentForm.phone || undefined,
        location_id: parentForm.location_id || activeBranch?.id || locations[0]?.id,
        create_login_access: parentForm.create_login_access,
        login_password: parentForm.create_login_access ? parentForm.login_password : undefined,
        login_status: parentForm.create_login_access ? parentForm.login_status : undefined,
      };

      if (parentForm.link_student_id) {
        payload.student_links = [
          {
            student_user_id: parentForm.link_student_id,
            relationship_type: parentForm.relationship_type,
            is_emergency_contact: parentForm.is_emergency_contact,
          },
        ];
      }

      await api.post('/people/parents', payload);
      setIsAddOpen(false);
      setParentForm({
        first_name: '',
        middle_name: '',
        last_name: '',
        email: '',
        phone: '',
        location_id: '',
        create_login_access: false,
        login_username: '',
        login_password: '',
        confirm_password: '',
        login_status: 'ACTIVE',
        link_student_id: '',
        relationship_type: 'FATHER',
        is_emergency_contact: true,
      });
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create parent/guardian record');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleQuickLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkParent || !linkStudentId) return;

    try {
      setLinkSubmitting(true);
      await api.post(`/people/parents/${linkParent.id}/students`, {
        student_user_id: linkStudentId,
        relationship_type: linkRelType,
        is_emergency_contact: linkEmergency,
      });
      setIsLinkOpen(false);
      setLinkParent(null);
      setLinkStudentId('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to link student');
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleUnlink = async (parentUserId: string, studentUserId: string) => {
    if (!confirm('Are you sure you want to unlink this student from the parent?')) return;
    try {
      await api.delete(`/people/parents/${parentUserId}/students/${studentUserId}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to unlink student');
    }
  };

  // Metrics calculation
  const totalParents = parents.length;
  const linkedStudentsCount = parents.reduce((acc, p) => acc + (p.children?.length || 0), 0);
  const activeLoginsCount = parents.filter(p => p.login_access?.has_login).length;
  const multiChildCount = parents.filter(p => (p.children?.length || 0) > 1).length;

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Parents & Guardians Master</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200">
                Universal Users View
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Universal user directory for parents & guardians with multi-child relationship mapping
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLinkParent(parents[0] || null);
              setIsLinkOpen(true);
            }}
            disabled={parents.length === 0 || studentsList.length === 0}
            className="flex items-center space-x-2"
          >
            <Link className="w-4 h-4" />
            <span>Link Student</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Parent / Guardian</span>
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Parents</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{totalParents}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Linked Students</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{linkedStudentsCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Login Accounts</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{activeLoginsCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Multi-Child Families</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{multiChildCount}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 flex-1 min-w-[280px] max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search parent name, email, phone, child..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedLocation}
            onChange={e => handleLocationChange(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Branches</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>
                {loc.location_name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => handleStatusChange(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main Table Area */}
      <div>
        {loading ? (
          <div className="flex justify-center items-center h-64 text-slate-400 text-sm">
            Loading parents and guardians directory...
          </div>
        ) : parents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No Parents or Guardians Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || selectedLocation
                ? 'Try adjusting your search query or branch filter.'
                : 'Click "Add Parent / Guardian" to register the first parent and link students.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Parent / Guardian</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Linked Students (Children)</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Login Access</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parents.map(parent => {
                  const hasLogin = parent.login_access?.has_login;
                  const primaryLocation = parent.locations?.[0]?.location_name || 'All Locations';
                  const children = parent.children || [];

                  return (
                    <tr key={parent.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {parent.first_name?.[0]?.toUpperCase() || 'P'}
                            {parent.last_name?.[0]?.toUpperCase() || ''}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {parent.first_name} {parent.last_name || ''}
                            </div>
                            <div className="text-[11px] text-slate-400">ID: {parent.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{parent.email}</span>
                        </div>
                        {parent.phone && (
                          <div className="flex items-center space-x-1.5 text-slate-500 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{parent.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {children.length === 0 ? (
                          <span className="text-slate-400 italic">No linked students</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {children.map((c, idx) => {
                              const child = (c as any).child || (c as any).user;
                              if (!child) return null;
                              const classInfo = child?.student_profile?.class_name || '';
                              const secInfo = child?.student_profile?.section_name || '';
                              return (
                                <span
                                  key={child.id || idx}
                                  className="inline-flex items-center space-x-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded text-[11px]"
                                >
                                  <GraduationCap className="w-3 h-3" />
                                  <span className="font-medium">
                                    {child.first_name || 'Student'} {child.last_name || ''}
                                  </span>
                                  {classInfo && (
                                    <span className="text-indigo-500 font-normal">
                                      ({classInfo}
                                      {secInfo ? `-${secInfo}` : ''})
                                    </span>
                                  )}
                                  <span className="text-slate-500 font-normal capitalize">
                                    • {(c.relationship_type || '').toLowerCase()}
                                  </span>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (child.id) {
                                        handleUnlink(parent.id, child.id);
                                      }
                                    }}
                                    title="Unlink student"
                                    className="text-slate-400 hover:text-red-600 ml-1"
                                  >
                                    <Unlink className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        <span className="inline-flex items-center space-x-1 text-slate-600">
                          <Building className="w-3 h-3 text-slate-400" />
                          <span>{primaryLocation}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {hasLogin ? (
                          <Badge variant="emerald" className="flex items-center space-x-1 w-max">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Active Login</span>
                          </Badge>
                        ) : (
                          <Badge variant="slate" className="flex items-center space-x-1 w-max">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>No Login</span>
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant={parent.status === 'ACTIVE' ? 'emerald' : 'slate'}
                          className="capitalize"
                        >
                          {parent.status?.toLowerCase() || 'active'}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setLinkParent(parent);
                              setIsLinkOpen(true);
                            }}
                            title="Link Student"
                            className="p-1 h-7 text-indigo-600 hover:bg-indigo-50"
                          >
                            <Link className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUserId(parent.id)}
                            title="View Full Profile"
                            className="p-1 h-7 text-slate-600 hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Parent / Guardian Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Register Parent / Guardian"
      >
        <form onSubmit={handleAddParent} className="space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">First Name *</label>
              <Input
                type="text"
                required
                value={parentForm.first_name}
                onChange={e => setParentForm({ ...parentForm, first_name: e.target.value })}
                placeholder="e.g. Rajesh"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Last Name</label>
              <Input
                type="text"
                value={parentForm.last_name}
                onChange={e => setParentForm({ ...parentForm, last_name: e.target.value })}
                placeholder="e.g. Sharma"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email Address *</label>
              <Input
                type="email"
                required
                value={parentForm.email}
                onChange={e => setParentForm({ ...parentForm, email: e.target.value })}
                placeholder="e.g. rajesh.parent@example.com"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
              <Input
                type="tel"
                value={parentForm.phone}
                onChange={e => setParentForm({ ...parentForm, phone: e.target.value })}
                placeholder="e.g. +91 9876543210"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Branch / Location</label>
            <select
              value={parentForm.location_id}
              onChange={e => setParentForm({ ...parentForm, location_id: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700"
            >
              <option value="">Select Branch (Defaults to Primary)</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.location_name} ({l.location_code})
                </option>
              ))}
            </select>
          </div>

          {/* Link Student Selection Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>Link Student (Child)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Student</label>
                <select
                  value={parentForm.link_student_id}
                  onChange={e => setParentForm({ ...parentForm, link_student_id: e.target.value })}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700"
                >
                  <option value="">-- Select Student (Optional) --</option>
                  {studentsList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name || ''} ({s.student_profile?.admission_number} - {s.student_profile?.class_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Relationship</label>
                <select
                  value={parentForm.relationship_type}
                  onChange={e => setParentForm({ ...parentForm, relationship_type: e.target.value })}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700"
                >
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                  <option value="GUARDIAN">Guardian</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={parentForm.is_emergency_contact}
                onChange={e => setParentForm({ ...parentForm, is_emergency_contact: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span>Set as Emergency Contact</span>
            </label>
          </div>

          {/* Create Login Access Section */}
          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-3">
            <label className="flex items-center space-x-2 text-slate-800 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={parentForm.create_login_access}
                onChange={e => setParentForm({ ...parentForm, create_login_access: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span>Create Login Access for this User</span>
            </label>

            {parentForm.create_login_access && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 bg-white p-2 rounded border border-indigo-100">
                  <span>School ID Context:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {userContext?.school_id_code || 'DPA-DEL-001'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Password *</label>
                    <Input
                      type="password"
                      required={parentForm.create_login_access}
                      value={parentForm.login_password}
                      onChange={e => setParentForm({ ...parentForm, login_password: e.target.value })}
                      placeholder="Min. 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Confirm Password *</label>
                    <Input
                      type="password"
                      required={parentForm.create_login_access}
                      value={parentForm.confirm_password}
                      onChange={e => setParentForm({ ...parentForm, confirm_password: e.target.value })}
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Initial Login Status</label>
                  <select
                    value={parentForm.login_status}
                    onChange={e => setParentForm({ ...parentForm, login_status: e.target.value as any })}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700"
                  >
                    <option value="ACTIVE">ACTIVE (Can log in immediately)</option>
                    <option value="DISABLED">DISABLED (Login suspended)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" onClick={() => setIsAddOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={addSubmitting}>
              {addSubmitting ? 'Saving...' : 'Register Parent'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Link Student Modal */}
      <Modal
        isOpen={isLinkOpen}
        onClose={() => setIsLinkOpen(false)}
        title={`Link Student to Parent: ${linkParent?.first_name || ''} ${linkParent?.last_name || ''}`}
      >
        <form onSubmit={handleQuickLink} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Select Student (Child) *</label>
            <select
              required
              value={linkStudentId}
              onChange={e => setLinkStudentId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700"
            >
              <option value="">-- Choose Student --</option>
              {studentsList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name || ''} ({s.student_profile?.admission_number} - {s.student_profile?.class_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Relationship Type</label>
            <select
              value={linkRelType}
              onChange={e => setLinkRelType(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700"
            >
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="GUARDIAN">Guardian</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={linkEmergency}
              onChange={e => setLinkEmergency(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <span>Set as Emergency Contact</span>
          </label>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" onClick={() => setIsLinkOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={linkSubmitting}>
              {linkSubmitting ? 'Linking...' : 'Confirm Link'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* User Profile Drawer */}
      <UserProfileDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onUpdated={loadData}
      />
    </div>
  );
};
