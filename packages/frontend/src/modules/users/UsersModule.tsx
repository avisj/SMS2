// ========================================================================
// UsersModule (Universal Users Directory)
// Dynamic User Types, Multi-Role, and Multi-Branch Management
// ZERO hardcoded user types or roles!
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  Shield,
  MapPin,
  Mail,
  Phone,
  Trash2,
  CheckCircle,
  Clock,
  UserCheck,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { User, UserType, Role, Location } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { UserProfileDrawer } from '../../components/profile/UserProfileDrawer.js';

interface UsersModuleProps {
  tabId: string;
}

export const UsersModule: React.FC<UsersModuleProps> = ({ tabId }) => {
  const { userContext, activeBranch } = useAuth();
  const { tabs, updateTabState } = useWorkspace();
  const { hasPermission } = usePermission();

  // Retrieve cached state for this specific tab instance
  const currentTab = tabs.find(t => t.id === tabId);
  const initialSearch = currentTab?.state.searchQuery || '';
  const initialUserType = currentTab?.state.filters?.userTypeId || '';
  const initialLocation = currentTab?.state.filters?.locationId || '';

  const [search, setSearch] = useState(initialSearch);
  const [selectedUserType, setSelectedUserType] = useState(initialUserType);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);

  const [users, setUsers] = useState<User[]>([]);
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected user for sliding profile drawer
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // User creation modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    user_type_id: '',
    role_ids: [] as string[],
    location_ids: [] as string[],
    create_login_access: false,
    login_username: '',
    login_password: '',
    login_confirm_password: '',
    login_status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state to workspace tab so switching tabs never loses input or filters
  const handleSearchChange = (val: string) => {
    setSearch(val);
    updateTabState(tabId, { searchQuery: val });
  };

  const handleUserTypeChange = (val: string) => {
    setSelectedUserType(val);
    updateTabState(tabId, { filters: { ...currentTab?.state.filters, userTypeId: val } });
  };

  const handleLocationChange = (val: string) => {
    setSelectedLocation(val);
    updateTabState(tabId, { filters: { ...currentTab?.state.filters, locationId: val } });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, typesData, rolesData, locsData] = await Promise.all([
        api.get<User[]>('/users', {
          search: search || undefined,
          user_type_id: selectedUserType || undefined,
          location_id: selectedLocation || undefined,
        }),
        api.get<UserType[]>('/users/meta/user-types'),
        api.get<Role[]>('/roles'),
        api.get<Location[]>('/locations'),
      ]);

      setUsers(usersData);
      setUserTypes(typesData);
      setRoles(rolesData);
      setLocations(locsData);

      // Auto-default user_type_id for form if empty
      if (!createForm.user_type_id && typesData.length > 0) {
        setCreateForm(prev => ({ ...prev, user_type_id: typesData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load user directory', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedUserType, selectedLocation, activeBranch?.id]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setErrorMessage(null);

    // Validate login access passwords if checked
    if (createForm.create_login_access) {
      if (!createForm.login_password || createForm.login_password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        setCreateSubmitting(false);
        return;
      }
      if (createForm.login_password !== createForm.login_confirm_password) {
        setErrorMessage('Password and Confirm Password do not match.');
        setCreateSubmitting(false);
        return;
      }
    }

    try {
      const payload: any = {
        ...createForm,
        school_id: userContext?.school_id || undefined,
        primary_location_id: createForm.location_ids[0] || undefined,
      };
      if (!createForm.create_login_access) {
        delete payload.login_password;
        delete payload.login_confirm_password;
        delete payload.login_username;
      }
      await api.post('/users', payload);
      setIsCreateOpen(false);
      setCreateForm({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        user_type_id: userTypes[0]?.id || '',
        role_ids: [],
        location_ids: [],
        create_login_access: false,
        login_username: '',
        login_password: '',
        login_confirm_password: '',
        login_status: 'ACTIVE',
      });
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create user');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleArchiveUser = async (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to archive user '${name}'? This uses soft-delete.`)) return;
    try {
      await api.delete(`/users/${userId}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to archive user');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Users Master
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              Access & Security
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Identity and access governance: system login credentials, School ID contexts, branch data scopes, and dynamic role assignments.
          </p>
        </div>

        {hasPermission('users.create') && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Add New User
          </Button>
        )}
      </div>

      {/* Filter Bar (State Preserved per Tab) */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-1">
            <Input
              placeholder="Search by name, email, username..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* User Type Filter (Dynamically populated from DB) */}
          <div>
            <Select
              value={selectedUserType}
              onChange={e => handleUserTypeChange(e.target.value)}
              options={[
                { value: '', label: 'All User Types' },
                ...userTypes.map(ut => ({ value: ut.id, label: ut.name })),
              ]}
            />
          </div>

          {/* Location Filter */}
          <div>
            <Select
              value={selectedLocation}
              onChange={e => handleLocationChange(e.target.value)}
              options={[
                { value: '', label: 'All Permitted Branches' },
                ...locations.map(loc => ({ value: loc.id, label: `${loc.location_name} (${loc.location_code})` })),
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Assigned Roles</th>
                <th className="py-3 px-4">Branch Access</th>
                <th className="py-3 px-4">Login Access</th>
                <th className="py-3 px-4">Taxonomy & Tags</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading users directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">No users found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try modifying your filters or search keywords.</p>
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {u.first_name[0]}{u.last_name ? u.last_name[0] : ''}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {u.first_name} {u.last_name || ''}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">@{u.username} • {u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <Badge variant="primary" size="sm">
                        {u.user_type?.name || 'Unclassified'}
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {u.roles && u.roles.length > 0 ? (
                          u.roles.map(r => (
                            <Badge key={r.id} variant="indigo" size="sm">
                              {r.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">No roles assigned</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {u.locations && u.locations.length > 0 ? (
                          u.locations.map(loc => (
                            <Badge key={loc.id} variant="slate" size="sm">
                              <MapPin className="w-3 h-3 mr-0.5 text-slate-400" />
                              {loc.location_code}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">No branch access</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {u.login_access?.status === 'ENABLED' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Enabled
                        </span>
                      ) : u.login_access?.status === 'DISABLED' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          Disabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          Not Created
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {u.tags?.map(t => (
                          <span
                            key={t.id}
                            style={{ backgroundColor: `${t.color}20`, color: t.color, borderColor: `${t.color}40` }}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                          >
                            {t.name}
                          </span>
                        ))}
                        {u.labels?.map(l => (
                          <span
                            key={l.id}
                            style={{ backgroundColor: `${l.color}20`, color: l.color, borderColor: `${l.color}40` }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                            {l.name}
                          </span>
                        ))}
                        {(!u.tags?.length && !u.labels?.length) && (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedUserId(u.id)}
                          title="View complete user profile"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Profile
                        </Button>
                        {hasPermission('users.delete') && (
                          <button
                            onClick={() => handleArchiveUser(u.id, `${u.first_name} ${u.last_name || ''}`)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Archive user (soft delete)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Slide-Over Comprehensive User Profile Drawer */}
      <UserProfileDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onUpdated={loadData}
      />

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Universal User"
        subtitle="Register a new person, select their dynamic classification, roles, and branch scopes."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="First Name"
              required
              value={createForm.first_name}
              onChange={e => setCreateForm({ ...createForm, first_name: e.target.value })}
              placeholder="e.g. Ramesh"
            />
            <Input
              label="Last Name"
              value={createForm.last_name}
              onChange={e => setCreateForm({ ...createForm, last_name: e.target.value })}
              placeholder="e.g. Gupta"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Username (Login Identifier)"
              required
              value={createForm.username}
              onChange={e => setCreateForm({ ...createForm, username: e.target.value.toLowerCase() })}
              placeholder="e.g. ramesh.gupta"
            />
            <Input
              label="Email Address"
              type="email"
              required
              value={createForm.email}
              onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="ramesh@dpa.edu"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              value={createForm.phone}
              onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />

            <Select
              label="Dynamic User Type"
              value={createForm.user_type_id}
              onChange={e => setCreateForm({ ...createForm, user_type_id: e.target.value })}
              options={userTypes.map(ut => ({ value: ut.id, label: `${ut.name} (${ut.code})` }))}
              helperText="Classification tag (NOT authorization)"
            />
          </div>

          {/* Multiple Roles Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Assign Role(s)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-36 overflow-y-auto">
              {roles.map(r => {
                const checked = createForm.role_ids.includes(r.id);
                return (
                  <label key={r.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        if (e.target.checked) {
                          setCreateForm(prev => ({ ...prev, role_ids: [...prev.role_ids, r.id] }));
                        } else {
                          setCreateForm(prev => ({ ...prev, role_ids: prev.role_ids.filter(id => id !== r.id) }));
                        }
                      }}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="truncate">{r.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Branch Location Assignment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Branch Access
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
              {locations.map(loc => {
                const checked = createForm.location_ids.includes(loc.id);
                return (
                  <label key={loc.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        if (e.target.checked) {
                          setCreateForm(prev => ({ ...prev, location_ids: [...prev.location_ids, loc.id] }));
                        } else {
                          setCreateForm(prev => ({ ...prev, location_ids: prev.location_ids.filter(id => id !== loc.id) }));
                        }
                      }}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span className="truncate">{loc.location_name} ({loc.location_code})</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Login Access Credentials Setup */}
          <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createForm.create_login_access}
                onChange={e => {
                  const checked = e.target.checked;
                  const autoUsername = `${createForm.first_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.${createForm.last_name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
                  setCreateForm(prev => ({
                    ...prev,
                    create_login_access: checked,
                    login_username: prev.login_username || autoUsername || prev.username,
                  }));
                }}
                className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
              />
              <div>
                <span className="text-xs font-bold text-slate-800">
                  Create Login Access for this User
                </span>
                <p className="text-[11px] text-slate-500">
                  Leave unchecked if creating profile-only record (e.g. young student, external contact).
                </p>
              </div>
            </label>

            {createForm.create_login_access && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      User ID (Login Username)
                    </label>
                    <Input
                      required
                      value={createForm.login_username}
                      onChange={e => setCreateForm({ ...createForm, login_username: e.target.value.toLowerCase() })}
                      placeholder="e.g. ramesh.gupta"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      Login Status
                    </label>
                    <Select
                      value={createForm.login_status}
                      onChange={e => setCreateForm({ ...createForm, login_status: e.target.value as any })}
                      options={[
                        { value: 'ACTIVE', label: 'Active (Can Log In)' },
                        { value: 'DISABLED', label: 'Disabled (Temporarily Blocked)' },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const randPass = 'P@ss' + Math.random().toString(36).slice(2, 8) + '!';
                          setCreateForm(prev => ({ ...prev, login_password: randPass, login_confirm_password: randPass }));
                        }}
                        className="text-[10px] text-brand-600 hover:text-brand-700 font-semibold"
                      >
                        Generate Password
                      </button>
                    </div>
                    <Input
                      type="password"
                      required
                      value={createForm.login_password}
                      onChange={e => setCreateForm({ ...createForm, login_password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                      Confirm Password
                    </label>
                    <Input
                      type="password"
                      required
                      value={createForm.login_confirm_password}
                      onChange={e => setCreateForm({ ...createForm, login_confirm_password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-brand-50/70 border border-brand-200/60 p-2 rounded-lg text-brand-800">
                  Password will be hashed using Node.js scrypt and stored in the dedicated credentials table. Zero plaintext stored.
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={createSubmitting}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
