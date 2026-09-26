// ========================================================================
// UserRolesModule Component
// Dedicated User Roles Management (User -> Roles M:N Assignment)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Users,
  Shield,
  Search,
  Edit2,
  RefreshCw,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { Role, UserRoleAssignment } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface UserRolesModuleProps {
  tabId: string;
}

export const UserRolesModule: React.FC<UserRolesModuleProps> = () => {
  const { userContext } = useAuth();
  const { hasPermission } = usePermission();

  const [assignments, setAssignments] = useState<UserRoleAssignment[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState<UserRoleAssignment | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assignData, rolesData] = await Promise.all([
        api.get<UserRoleAssignment[]>('/roles/user-assignments/all'),
        api.get<Role[]>('/roles'),
      ]);
      setAssignments(assignData);
      setAllRoles(rolesData);
    } catch (err) {
      console.error('Failed to load user roles data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userContext?.school_id]);

  const handleOpenAssign = (item: UserRoleAssignment) => {
    setSelectedUser(item);
    setSelectedRoleIds(item.roles.map(r => r.id));
    setIsModalOpen(true);
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSaveRoles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);

    try {
      await api.put(`/roles/user-assignments/${selectedUser.user.id}`, {
        roleIds: selectedRoleIds,
      });
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user roles');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = assignments.filter(a => {
    const query = search.toLowerCase();
    const fullName = `${a.user.first_name || ''} ${a.user.last_name || ''}`.toLowerCase();
    return (
      fullName.includes(query) ||
      a.user.username?.toLowerCase().includes(query) ||
      a.user.email?.toLowerCase().includes(query) ||
      a.user.user_type_code?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            User Roles Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign one or more roles to people in the system. Roles govern permissions and access rights.
          </p>
        </div>
        <Button variant="secondary" onClick={loadData}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users by name, username, email, or classification..."
            className="pl-9"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Assigned Roles</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Loading user role assignments...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {item.user.first_name} {item.user.last_name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        @{item.user.username} • {item.user.email}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="indigo">{item.user.user_type_code}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {item.roles && item.roles.length > 0 ? (
                          item.roles.map(r => (
                            <Badge key={r.id} variant={r.is_system ? 'teal' : 'slate'} className="text-[10px]">
                              {r.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">No roles assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={item.user.status === 'ACTIVE' ? 'emerald' : 'slate'}>
                        {item.user.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenAssign(item)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="ml-1">Assign Roles</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Assign Roles Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Assign Roles: ${selectedUser?.user.first_name} ${selectedUser?.user.last_name}`}
      >
        <form onSubmit={handleSaveRoles} className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="font-bold text-slate-900">
              {selectedUser?.user.first_name} {selectedUser?.user.last_name} (@{selectedUser?.user.username})
            </div>
            <div className="text-slate-500">
              Classification Type: <span className="font-semibold text-teal-700">{selectedUser?.user.user_type_code}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Select Roles to Grant
            </label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-60 overflow-y-auto space-y-1 bg-white">
              {allRoles.map(role => {
                const isSelected = selectedRoleIds.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer text-xs transition-colors ${
                      isSelected ? 'bg-teal-50/80 border border-teal-200 text-teal-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRole(role.id)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>{role.name}</span>
                      {role.is_system && (
                        <span className="text-[10px] text-teal-600 font-mono flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> system
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{role.code}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Role Assignments'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
