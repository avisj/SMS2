// ========================================================================
// UserProfileDrawer Component
// Comprehensive slide-over profile drawer for the UNIVERSAL users model
// Renders Identity, Roles, Branches, Taxonomy, Student/Staff extensions, and Audit trail
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  X,
  User as UserIcon,
  Shield,
  MapPin,
  Tag,
  GraduationCap,
  Briefcase,
  Clock,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  Save,
  CheckCircle,
  KeyRound,
  Award,
  FileText,
  History,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { api } from '../../api/client.js';
import {
  User,
  DetailedUserProfile,
  UserCategory,
  UserSubcategory,
  UserTag,
  UserLabel,
  UserLoginAccess,
} from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Button } from '../common/Button.js';
import { Input } from '../common/Input.js';
import { Modal } from '../common/Modal.js';

interface UserProfileDrawerProps {
  userId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({
  userId,
  onClose,
  onUpdated,
}) => {
  const [profile, setProfile] = useState<DetailedUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'academic' | 'employment' | 'taxonomy' | 'audit'>('overview');

  // Login Access State
  const [loginAccess, setLoginAccess] = useState<UserLoginAccess | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPassword, setCreatePassword] = useState('');

  // Taxonomy options for editing
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [tags, setTags] = useState<UserTag[]>([]);
  const [labels, setLabels] = useState<UserLabel[]>([]);

  // Selected taxonomy IDs for editing
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [savingTaxonomy, setSavingTaxonomy] = useState(false);
  const [taxSuccess, setTaxSuccess] = useState(false);

  useEffect(() => {
    if (!userId) return;
    loadProfile(userId);
  }, [userId]);

  const loadProfile = async (id: string) => {
    setLoading(true);
    setTaxSuccess(false);
    try {
      const [resProfile, resCats, resTags, resLabels] = await Promise.all([
        api.get<DetailedUserProfile>(`/people/users/${id}/profile`),
        api.get<UserCategory[]>('/people/categories'),
        api.get<UserTag[]>('/people/tags'),
        api.get<UserLabel[]>('/people/labels'),
      ]);
      setProfile(resProfile);
      setCategories(resCats);
      setTags(resTags);
      setLabels(resLabels);

      // Load Login Access state
      try {
        const resLogin = await api.get<UserLoginAccess>(`/users/${id}/login-access`);
        setLoginAccess(resLogin);
      } catch {
        setLoginAccess(null);
      }

      // Initialize taxonomy form selection
      setSelectedCategoryIds(resProfile.user.categories?.map(c => c.id) || []);
      setSelectedTagIds(resProfile.user.tags?.map(t => t.id) || []);
      setSelectedLabelIds(resProfile.user.labels?.map(l => l.id) || []);

      // Set default tab based on user profile availability
      if (resProfile.student_profile) {
        setActiveTab('academic');
      } else if (resProfile.staff_profile) {
        setActiveTab('employment');
      } else {
        setActiveTab('overview');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLoginStatus = async (status: 'ACTIVE' | 'DISABLED') => {
    if (!userId) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await api.put<UserLoginAccess>(`/users/${userId}/login-access/status`, { status });
      setLoginAccess(res);
      setActionSuccess(`Login access has been ${status === 'ACTIVE' ? 'enabled' : 'disabled'}.`);
      onUpdated?.();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update login status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !resetPassword) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.post(`/users/${userId}/login-access/reset-password`, { password: resetPassword });
      setShowResetModal(false);
      setResetPassword('');
      setActionSuccess('Password successfully reset.');
      onUpdated?.();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateLoginAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await api.post<UserLoginAccess>(`/users/${userId}/login-access`, {
        password: createPassword || 'password123',
      });
      setLoginAccess(res);
      setShowCreateModal(false);
      setCreatePassword('');
      setActionSuccess('Login access successfully created.');
      onUpdated?.();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create login access');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveTaxonomy = async () => {
    if (!userId) return;
    setSavingTaxonomy(true);
    setTaxSuccess(false);
    try {
      await api.put(`/people/users/${userId}/taxonomy`, {
        category_ids: selectedCategoryIds,
        tag_ids: selectedTagIds,
        label_ids: selectedLabelIds,
      });
      setTaxSuccess(true);
      await loadProfile(userId);
      onUpdated?.();
      setTimeout(() => setTaxSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update taxonomy:', err);
    } finally {
      setSavingTaxonomy(false);
    }
  };

  if (!userId) return null;

  const user = profile?.user;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-teal-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
              {user?.last_name ? user.last_name[0].toUpperCase() : ''}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">
                  {user ? `${user.first_name} ${user.last_name || ''}` : 'Loading profile...'}
                </h3>
                {user?.status && (
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    user.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {user.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>@{user?.username}</span>
                <span>•</span>
                <span className="text-teal-300 font-medium">{user?.user_type?.name || 'User'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            Overview & Roles
          </button>

          {profile?.student_profile && (
            <button
              onClick={() => setActiveTab('academic')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'academic'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Academic Dimension
            </button>
          )}

          {profile?.staff_profile && (
            <button
              onClick={() => setActiveTab('employment')}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'employment'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Employment Dimension
            </button>
          )}

          <button
            onClick={() => setActiveTab('taxonomy')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'taxonomy'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Taxonomy & Tags
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Audit Ledger
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Loading user profile details...</div>
          ) : !user ? (
            <div className="py-16 text-center text-rose-500">Failed to load user details.</div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & ROLES */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Basic Contact Grid */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block">Email Address</span>
                      <span className="text-slate-800 font-medium flex items-center gap-1 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {user.email}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Phone Number</span>
                      <span className="text-slate-800 font-medium flex items-center gap-1 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {user.phone || 'Not provided'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Account Created</span>
                      <span className="text-slate-800 font-medium flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Universal ID</span>
                      <span className="text-slate-600 font-mono text-[11px] truncate block mt-0.5">
                        {user.id}
                      </span>
                    </div>
                  </div>

                  {/* Login Access & Authentication Management Card */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                          <KeyRound className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Login Access & Credentials</h4>
                          <p className="text-[11px] text-slate-500">School ID-scoped authentication context</p>
                        </div>
                      </div>
                      <div>
                        {loginAccess?.status === 'ENABLED' ? (
                          <Badge variant="emerald" size="sm">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : loginAccess?.status === 'DISABLED' ? (
                          <Badge variant="rose" size="sm">
                            Disabled
                          </Badge>
                        ) : (
                          <Badge variant="slate" size="sm">
                            Not Created
                          </Badge>
                        )}
                      </div>
                    </div>

                    {actionError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium">
                        {actionError}
                      </div>
                    )}

                    {actionSuccess && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium">
                        {actionSuccess}
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">School ID</span>
                        <span className="font-mono font-bold text-slate-800">
                          {loginAccess?.school_id_code || (user.locations?.[0]?.school_id_code) || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">User ID</span>
                        <span className="font-medium text-slate-800 font-mono">
                          {loginAccess?.username || user.username}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Last Login</span>
                        <span className="text-slate-600">
                          {loginAccess?.last_login_at ? new Date(loginAccess.last_login_at).toLocaleString() : 'Never'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {loginAccess?.status === 'NOT_CREATED' ? (
                        <Button
                          size="sm"
                          variant="primary"
                          loading={actionLoading}
                          onClick={() => setShowCreateModal(true)}
                        >
                          Create Login Access
                        </Button>
                      ) : (
                        <>
                          {loginAccess?.status === 'ENABLED' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-600 hover:bg-rose-50 border-rose-200"
                              loading={actionLoading}
                              onClick={() => handleToggleLoginStatus('DISABLED')}
                            >
                              Disable Login
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                              loading={actionLoading}
                              onClick={() => handleToggleLoginStatus('ACTIVE')}
                            >
                              Enable Login
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            loading={actionLoading}
                            onClick={() => setShowResetModal(true)}
                          >
                            Reset Password
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Multi-Role Assignments */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-teal-600" />
                      Dynamic RBAC Role Assignments ({user.roles?.length || 0})
                    </h4>
                    <div className="space-y-2">
                      {user.roles && user.roles.length > 0 ? (
                        user.roles.map(role => (
                          <div key={role.id} className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold text-slate-900">{role.name}</span>
                              <span className="text-[11px] text-slate-400 block">{role.code}</span>
                            </div>
                            <Badge variant={role.is_system ? 'slate' : 'indigo'}>
                              {role.is_system ? 'System Role' : 'Custom Role'}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 bg-slate-50 text-slate-400 text-xs rounded-lg text-center">
                          No roles assigned.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Multi-Branch Access */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-600" />
                      Branch & Campus Access ({user.locations?.length || 0})
                    </h4>
                    <div className="space-y-2">
                      {user.locations && user.locations.length > 0 ? (
                        user.locations.map(loc => (
                          <div key={loc.id} className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold text-slate-900">{loc.location_name}</span>
                              <span className="text-[11px] text-slate-400 block">{loc.location_code} • {loc.city}</span>
                            </div>
                            <Badge variant="emerald">Active Access</Badge>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 bg-slate-50 text-slate-400 text-xs rounded-lg text-center">
                          No specific branch assigned (Platform/Universal).
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ACADEMIC DIMENSION */}
              {activeTab === 'academic' && profile?.student_profile && (
                <div className="space-y-6">
                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-teal-900">Enrolled Student Record</span>
                        <div className="text-lg font-bold text-teal-950">
                          {profile.student_profile.class_name} {profile.student_profile.section_name && `• ${profile.student_profile.section_name}`}
                        </div>
                      </div>
                      <Badge variant="emerald">{profile.student_profile.academic_session || '2026-2027'}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Admission Number</span>
                      <span className="text-slate-900 font-semibold text-sm mt-0.5 block font-mono">
                        {profile.student_profile.admission_number}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Roll Number</span>
                      <span className="text-slate-900 font-semibold text-sm mt-0.5 block">
                        {profile.student_profile.roll_number || 'N/A'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">House</span>
                      <span className="text-slate-900 font-semibold mt-0.5 block">
                        {profile.student_profile.house || 'N/A'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Stream & Medium</span>
                      <span className="text-slate-900 font-semibold mt-0.5 block">
                        {profile.student_profile.stream || 'General'} ({profile.student_profile.medium || 'English'})
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Blood Group & Gender</span>
                      <span className="text-slate-900 font-semibold mt-0.5 block">
                        {profile.student_profile.blood_group || 'N/A'} • {profile.student_profile.gender || 'N/A'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Admission Date</span>
                      <span className="text-slate-900 font-semibold mt-0.5 block">
                        {profile.student_profile.admission_date || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h5 className="text-xs font-semibold text-slate-700 mb-2">Emergency Contact Details</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium">Contact Person:</span>
                        <span className="text-slate-800 font-semibold block">{profile.student_profile.emergency_contact_name || 'Not specified'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Contact Phone:</span>
                        <span className="text-slate-800 font-semibold block">{profile.student_profile.emergency_contact_phone || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Previous School Academic History */}
                  {profile.student_profile.previous_academic_records && profile.student_profile.previous_academic_records.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-teal-600" />
                        Previous School Academic History ({profile.student_profile.previous_academic_records.length})
                      </h5>
                      <div className="space-y-2">
                        {profile.student_profile.previous_academic_records.map((rec, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center justify-between font-semibold text-slate-900 mb-1">
                              <span>{rec.previous_school_name}</span>
                              <Badge variant="slate" size="sm">{rec.academic_year || 'N/A'}</Badge>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 text-[11px]">
                              <div><span className="text-slate-400">Board:</span> {rec.board || 'N/A'}</div>
                              <div><span className="text-slate-400">Class:</span> {rec.class_name || 'N/A'}</div>
                              <div><span className="text-slate-400">Marks/Grade:</span> {rec.marks_grade || 'N/A'}</div>
                              <div><span className="text-slate-400">Result:</span> {rec.result || 'N/A'}</div>
                            </div>
                            {rec.remarks && <p className="text-[11px] text-slate-500 mt-1 italic">{rec.remarks}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Awards & Achievements */}
                  {profile.student_profile.achievements && profile.student_profile.achievements.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        Awards & Extracurricular Achievements ({profile.student_profile.achievements.length})
                      </h5>
                      <div className="space-y-2">
                        {profile.student_profile.achievements.map((ach, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center justify-between font-semibold text-slate-900 mb-1">
                              <span>{ach.title}</span>
                              <Badge variant="indigo" size="sm">{ach.level || 'School Level'}</Badge>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-3">
                              <span>Category: {ach.category}</span>
                              {ach.achievement_date && <span>Date: {ach.achievement_date}</span>}
                              {ach.award_position && <span>Position: {ach.award_position}</span>}
                            </div>
                            {ach.description && <p className="text-[11px] text-slate-600 mt-1">{ach.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verified Documents */}
                  {profile.student_profile.documents && profile.student_profile.documents.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-600" />
                        Verified Documents & Attachments ({profile.student_profile.documents.length})
                      </h5>
                      <div className="space-y-2">
                        {profile.student_profile.documents.map((doc, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-slate-900">{doc.document_name}</div>
                              <div className="text-[11px] text-slate-500">{doc.document_type} {doc.document_number && `• ${doc.document_number}`}</div>
                            </div>
                            {doc.file_url && (
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-teal-600 hover:text-teal-800 text-xs font-semibold flex items-center gap-1"
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: EMPLOYMENT DIMENSION */}
              {activeTab === 'employment' && profile?.staff_profile && (
                <div className="space-y-6">
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-indigo-900">Faculty & Staff Profile</span>
                        <div className="text-lg font-bold text-indigo-950">
                          {profile.staff_profile.designation?.name || 'Staff Member'}
                        </div>
                      </div>
                      <Badge variant="indigo">{profile.staff_profile.department || 'General'}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Employee Code</span>
                      <span className="text-slate-900 font-semibold text-sm mt-0.5 block font-mono">
                        {profile.staff_profile.employee_code}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Employment Type</span>
                      <span className="text-slate-900 font-semibold mt-0.5 block">
                        {profile.staff_profile.employment_type || 'PERMANENT'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Qualification</span>
                      <span className="text-slate-900 font-semibold mt-0.5 block">
                        {profile.staff_profile.qualification || 'Not recorded'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Experience</span>
                      <span className="text-slate-900 font-semibold mt-0.5 block">
                        {profile.staff_profile.experience_years !== undefined ? `${profile.staff_profile.experience_years} Years` : 'N/A'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Joining Date</span>
                      <span className="text-slate-900 font-semibold mt-0.5 block">
                        {profile.staff_profile.joining_date || 'N/A'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium block">Emergency Contact</span>
                      <span className="text-slate-900 font-semibold mt-0.5 block">
                        {profile.staff_profile.emergency_contact_name || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Academic & Professional Qualifications */}
                  {profile.staff_profile.qualifications && profile.staff_profile.qualifications.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                        Academic Degrees & Qualifications ({profile.staff_profile.qualifications.length})
                      </h5>
                      <div className="space-y-2">
                        {profile.staff_profile.qualifications.map((q, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center justify-between font-semibold text-slate-900 mb-1">
                              <span>{q.qualification_name} ({q.education_level})</span>
                              <Badge variant="indigo" size="sm">{q.passing_year || 'N/A'}</Badge>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600 text-[11px]">
                              <div><span className="text-slate-400">Institution:</span> {q.institution}</div>
                              {q.board_university && <div><span className="text-slate-400">Board/Univ:</span> {q.board_university}</div>}
                              {q.marks_grade && <div><span className="text-slate-400">Grade:</span> {q.marks_grade}</div>}
                              {q.specialization && <div><span className="text-slate-400">Major:</span> {q.specialization}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Professional Experience */}
                  {profile.staff_profile.experiences && profile.staff_profile.experiences.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        Prior Employment & Teaching Experience ({profile.staff_profile.experiences.length})
                      </h5>
                      <div className="space-y-2">
                        {profile.staff_profile.experiences.map((exp, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center justify-between font-semibold text-slate-900 mb-1">
                              <span>{exp.organization}</span>
                              <Badge variant="slate" size="sm">{exp.duration || 'Prior'}</Badge>
                            </div>
                            <div className="text-[11px] text-slate-600">
                              <span className="font-medium text-slate-800">{exp.designation}</span>
                              {(exp.from_date || exp.to_date) && (
                                <span className="text-slate-400 ml-2">({exp.from_date || '—'} to {exp.to_date || 'Present'})</span>
                              )}
                            </div>
                            {exp.responsibilities && (
                              <p className="text-[11px] text-slate-500 mt-1">{exp.responsibilities}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Professional Certifications */}
                  {profile.staff_profile.certifications && profile.staff_profile.certifications.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        Certifications & Accreditations ({profile.staff_profile.certifications.length})
                      </h5>
                      <div className="space-y-2">
                        {profile.staff_profile.certifications.map((cert, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center justify-between font-semibold text-slate-900 mb-1">
                              <span>{cert.certification_name}</span>
                              {cert.credential_number && <Badge variant="slate" size="sm">{cert.credential_number}</Badge>}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              <span>Authority: {cert.issuing_organization || 'N/A'}</span>
                              {cert.issue_date && <span className="ml-3">Issued: {cert.issue_date}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verified Documents */}
                  {profile.staff_profile.documents && profile.staff_profile.documents.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        Documents & Attachments ({profile.staff_profile.documents.length})
                      </h5>
                      <div className="space-y-2">
                        {profile.staff_profile.documents.map((doc, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-slate-900">{doc.document_name}</div>
                              <div className="text-[11px] text-slate-500">{doc.document_type} {doc.document_number && `• ${doc.document_number}`}</div>
                            </div>
                            {doc.file_url && (
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1"
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: TAXONOMY & TAGS */}
              {activeTab === 'taxonomy' && (
                <div className="space-y-6">
                  {taxSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Taxonomy assignments updated successfully.
                    </div>
                  )}

                  {/* Active Tags Summary */}
                  <div>
                    <h5 className="text-xs font-semibold text-slate-700 mb-2">Assigned Category & Subcategory</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {user.categories && user.categories.length > 0 ? (
                        user.categories.map(c => (
                          <Badge key={c.id} variant="slate">{c.name}</Badge>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">No categories assigned.</span>
                      )}
                    </div>
                  </div>

                  {/* Taxonomy Multi-Select Configuration */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 text-xs">
                    <h5 className="font-semibold text-slate-800">Edit Classification & Tags</h5>

                    {/* Categories Checkboxes */}
                    <div>
                      <label className="text-slate-500 font-medium block mb-1.5">Categories:</label>
                      <div className="grid grid-cols-2 gap-2">
                        {categories.map(cat => {
                          const isChecked = selectedCategoryIds.includes(cat.id);
                          return (
                            <label key={cat.id} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCategoryIds([...selectedCategoryIds, cat.id]);
                                  } else {
                                    setSelectedCategoryIds(selectedCategoryIds.filter(id => id !== cat.id));
                                  }
                                }}
                                className="rounded text-teal-600 focus:ring-teal-500"
                              />
                              <span>{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tags Checkboxes */}
                    <div>
                      <label className="text-slate-500 font-medium block mb-1.5">User Tags:</label>
                      <div className="flex flex-wrap gap-2">
                        {tags.map(tag => {
                          const isChecked = selectedTagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id));
                                } else {
                                  setSelectedTagIds([...selectedTagIds, tag.id]);
                                }
                              }}
                              style={{
                                borderColor: tag.color,
                                backgroundColor: isChecked ? `${tag.color}20` : 'white',
                                color: isChecked ? tag.color : '#64748b',
                              }}
                              className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition-all ${
                                isChecked ? 'shadow-xs font-bold' : 'opacity-70'
                              }`}
                            >
                              {isChecked ? '✓ ' : '+ '}{tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Labels Checkboxes */}
                    <div>
                      <label className="text-slate-500 font-medium block mb-1.5">Color-Coded Status Labels:</label>
                      <div className="flex flex-wrap gap-2">
                        {labels.map(lbl => {
                          const isChecked = selectedLabelIds.includes(lbl.id);
                          return (
                            <button
                              key={lbl.id}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setSelectedLabelIds(selectedLabelIds.filter(id => id !== lbl.id));
                                } else {
                                  setSelectedLabelIds([...selectedLabelIds, lbl.id]);
                                }
                              }}
                              style={{
                                borderColor: lbl.color,
                                backgroundColor: isChecked ? `${lbl.color}20` : 'white',
                                color: isChecked ? lbl.color : '#64748b',
                              }}
                              className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition-all ${
                                isChecked ? 'shadow-xs font-bold' : 'opacity-70'
                              }`}
                            >
                              {isChecked ? '● ' : '○ '}{lbl.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveTaxonomy}
                        loading={savingTaxonomy}
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Save Taxonomy Changes
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: AUDIT LEDGER */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Audit Log History ({profile.audit_history?.length || 0})
                  </h4>
                  <div className="space-y-3">
                    {profile.audit_history && profile.audit_history.length > 0 ? (
                      profile.audit_history.map(log => (
                        <div key={log.id} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-800">
                              {log.action} • {log.module}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            Actor: <span className="font-medium text-slate-700">{log.username || 'System'}</span>
                          </div>
                          {log.new_values && (
                            <pre className="mt-1.5 p-2 bg-slate-50 rounded text-[10px] text-slate-600 overflow-x-auto">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-slate-50 text-slate-400 text-xs text-center rounded-lg">
                        No audit records recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reset Password Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setResetPassword('');
        }}
        title="Reset User Password"
        subtitle={user ? `Set a new login password for ${user.username}` : 'Set a new password'}
        maxWidth="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="New Password"
            type="password"
            placeholder="Enter at least 6 characters"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowResetModal(false);
                setResetPassword('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={actionLoading}
              disabled={!resetPassword || resetPassword.length < 6}
            >
              Reset Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Login Access Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreatePassword('');
        }}
        title="Create Login Access"
        subtitle={user ? `Generate login credentials for ${user.username}` : 'Generate credentials'}
        maxWidth="sm"
      >
        <form onSubmit={handleCreateLoginAccess} className="space-y-4">
          <Input
            label="Password"
            type="password"
            placeholder="Enter at least 6 characters"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreateModal(false);
                setCreatePassword('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={actionLoading}
              disabled={!createPassword || createPassword.length < 6}
            >
              Create Access
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
