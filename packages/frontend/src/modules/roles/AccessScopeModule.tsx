// ========================================================================
// AccessScopeModule Component
// Dedicated Access & Location Scope Management
// Configures multi-branch data scopes for users
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Search,
  Edit2,
  RefreshCw,
  Building,
  CheckCircle2,
  Users,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import { Location, UserRoleAssignment, UserLocationAccess } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface AccessScopeModuleProps {
  tabId: string;
}

export const AccessScopeModule: React.FC<AccessScopeModuleProps> = () => {
  const { userContext } = useAuth();

  const [users, setUsers] = useState<UserRoleAssignment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState<UserRoleAssignment | null>(null);
  const [userLocations, setUserLocations] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, locsData] = await Promise.all([
        api.get<UserRoleAssignment[]>('/roles/user-assignments/all'),
        api.get<Location[]>('/locations'),
      ]);
      setUsers(usersData);
      setLocations(locsData);
    } catch (err) {
      console.error('Failed to load access scope data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userContext?.school_id]);

  const handleOpenEditScopes = async (item: UserRoleAssignment) => {
    setSelectedUser(item);
    try {
      const access = await api.get<UserLocationAccess[]>(`/roles/user-scopes/${item.user.id}`);
      setUserLocations(access.map(a => a.location_id));
    } catch (err) {
      setUserLocations([]);
    }
    setIsModalOpen(true);
  };

  const toggleLocation = (locId: string) => {
    setUserLocations(prev =>
      prev.includes(locId) ? prev.filter(id => id !== locId) : [...prev, locId]
    );
  };

  const handleSaveScopes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);

    try {
      await api.put(`/roles/user-scopes/${selectedUser.user.id}`, {
        branchIds: userLocations,
      });
      setUsers(prev => prev.map(u =>
        u.user.id === selectedUser.user.id ? { ...u, location_ids: [...userLocations] } : u
      ));
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update location scopes');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = users.filter(u => {
    const query = search.toLowerCase();
    const fullName = `${u.user.first_name || ''} ${u.user.last_name || ''}`.toLowerCase();
    return (
      fullName.includes(query) ||
      u.user.username?.toLowerCase().includes(query) ||
      u.user.email?.toLowerCase().includes(query) ||
      u.user.user_type_code?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-teal-600" />
            Access & Location Scopes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Control which campuses and branches each user is permitted to view or manage.
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

      {/* Users & Scope Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Roles Granted</th>
                <th className="py-3 px-4">Available Campuses in School</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    Loading access scopes...
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
                        @{item.user.username}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="indigo">{item.user.user_type_code}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {item.roles.map(r => (
                          <Badge key={r.id} variant="slate" className="text-[10px]">
                            {r.name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-slate-700">
                        {item.location_ids ? item.location_ids.length : 0} Campus{(item.location_ids?.length || 0) === 1 ? '' : 'es'} Configured
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEditScopes(item)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="ml-1">Configure Campus Scope</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Configure Location Scopes Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Configure Campus Access: ${selectedUser?.user.first_name} ${selectedUser?.user.last_name}`}
      >
        <form onSubmit={handleSaveScopes} className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="font-bold text-slate-900">
              {selectedUser?.user.first_name} {selectedUser?.user.last_name} (@{selectedUser?.user.username})
            </div>
            <div className="text-slate-500">
              Users can only view and manage records belonging to their permitted branch scopes.
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Permitted Branches / Campuses
            </label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-60 overflow-y-auto space-y-1 bg-white">
              {locations.map(loc => {
                const isSelected = userLocations.includes(loc.id);
                return (
                  <label
                    key={loc.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer text-xs transition-colors ${
                      isSelected ? 'bg-teal-50/80 border border-teal-200 text-teal-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLocation(loc.id)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span>{loc.location_name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{loc.location_code}</span>
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
              {submitting ? 'Saving...' : 'Save Campus Scope'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
