// ========================================================================
// Library Members Module
// Universal Users Integration: Student & Staff Library Profiles,
// Borrowing Privileges, Active Loans, and Membership Status
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  ShieldAlert,
  Edit2,
  BookOpen,
  IndianRupee,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useCurrency } from '../../utils/currency.js';
import { LibraryMember, User } from '../../types/index.js';

export const LibraryMembersModule: React.FC<{ tabId?: string }> = () => {
  const { symbol, format } = useCurrency();

  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [membershipType, setMembershipType] = useState<'STUDENT' | 'TEACHER' | 'STAFF'>('STUDENT');
  const [maxBooks, setMaxBooks] = useState<string>('3');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'INACTIVE'>('ACTIVE');
  const [remarks, setRemarks] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mRes, uRes] = await Promise.all([
        api.get<LibraryMember[]>('/library/members'),
        api.get<User[]>('/users'),
      ]);

      if (mRes) setMembers(mRes);
      if (uRes) setUsers(uRes);
    } catch (err: any) {
      console.error('Failed to load library members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const enrolledUserIds = new Set(members.map((m) => m.user_id));
  const availableUsers = users.filter((u) => !enrolledUserIds.has(u.id));

  const handleOpenAdd = () => {
    setEditingMemberId(null);
    setUserId(availableUsers.length > 0 ? availableUsers[0].id : '');
    setMembershipType('STUDENT');
    setMaxBooks('3');
    setStatus('ACTIVE');
    setRemarks('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: LibraryMember) => {
    setEditingMemberId(m.id);
    setUserId(m.user_id);
    setMembershipType(m.membership_type);
    setMaxBooks(m.max_books_allowed ? String(m.max_books_allowed) : '3');
    setStatus(m.status);
    setRemarks(m.remarks || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!userId && !editingMemberId) {
      setFormError('Please select a user to enroll.');
      return;
    }

    setSaving(true);
    try {
      if (editingMemberId) {
        await api.put(`/library/members/${editingMemberId}`, {
          membership_type: membershipType,
          status,
          max_books_allowed: parseInt(maxBooks, 10) || 3,
          remarks: remarks.trim() || undefined,
        });
      } else {
        await api.post('/library/members', {
          user_id: userId,
          membership_type: membershipType,
          status,
          max_books_allowed: parseInt(maxBooks, 10) || 3,
          remarks: remarks.trim() || undefined,
        });
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || err.message || 'Failed to save member.');
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (selectedType && m.membership_type !== selectedType) return false;
    if (selectedStatus && m.status !== selectedStatus) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    const num = m.membership_number.toLowerCase();
    const uName = m.user ? `${m.user.first_name || ''} ${m.user.last_name || ''}`.toLowerCase() : '';
    const email = (m.user?.email || '').toLowerCase();
    return num.includes(term) || uName.includes(term) || email.includes(term);
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Library Members</h1>
            <Badge variant="indigo">Universal User Accounts</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage borrowing privileges and circulation status for students, teachers, and school staff
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-1.5" />
            Enroll Member
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by member #, name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-44">
            <Select
              options={[
                { value: '', label: 'All Member Types' },
                { value: 'STUDENT', label: 'Students' },
                { value: 'TEACHER', label: 'Teachers' },
                { value: 'STAFF', label: 'Staff' },
              ]}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'SUSPENDED', label: 'Suspended' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Members Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Membership #</th>
                <th className="py-3 px-4">Member / User</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Active Loans</th>
                <th className="py-3 px-4">Overdue Loans</th>
                <th className="py-3 px-4">Unpaid Fines</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading library members...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No library members found.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-blue-600">
                      {m.membership_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        {m.user?.first_name} {m.user?.last_name}
                      </div>
                      <div className="text-xs text-gray-400">{m.user?.email}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <Badge
                        variant={
                          m.membership_type === 'TEACHER'
                            ? 'purple'
                            : m.membership_type === 'STUDENT'
                            ? 'teal'
                            : 'slate'
                        }
                      >
                        {m.membership_type}
                      </Badge>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Limit: {m.max_books_allowed || 3} books
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-gray-800">
                      <span className="bg-gray-100 px-2 py-0.5 rounded">
                        {m.active_issues_count ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {(m.overdue_issues_count ?? 0) > 0 ? (
                        <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {m.overdue_issues_count} overdue
                        </span>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {(m.total_fines_unpaid ?? 0) > 0 ? (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {format(m.total_fines_unpaid!)}
                        </span>
                      ) : (
                        <span className="text-gray-400">₹0.00</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          m.status === 'ACTIVE'
                            ? 'success'
                            : m.status === 'SUSPENDED'
                            ? 'danger'
                            : 'slate'
                        }
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEdit(m)}>
                        <Edit2 className="w-3.5 h-3.5 mr-1 text-blue-600" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Member Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMemberId ? 'Update Library Membership' : 'Enroll Library Member'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{formError}</div>
          )}

          {!editingMemberId ? (
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                Select Universal User to Enroll *
              </label>
              <Select
                options={
                  availableUsers.length > 0
                    ? availableUsers.map((u) => ({
                        value: u.id,
                        label: `${u.first_name} ${u.last_name || ''} (${u.email || u.username})`,
                      }))
                    : [{ value: '', label: 'All existing users already enrolled' }]
                }
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs space-y-1">
              <span className="text-blue-900 font-semibold block">Member Profile:</span>
              <span className="text-blue-700">
                Editing privileges for registered member ID: {userId}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Member Classification</label>
              <Select
                options={[
                  { value: 'STUDENT', label: 'Student' },
                  { value: 'TEACHER', label: 'Teacher / Faculty' },
                  { value: 'STAFF', label: 'Administrative Staff' },
                ]}
                value={membershipType}
                onChange={(e) => setMembershipType(e.target.value as any)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Max Borrowing Limit</label>
              <Input
                type="number"
                min="1"
                max="20"
                value={maxBooks}
                onChange={(e) => setMaxBooks(e.target.value)}
                placeholder="3"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Membership Status</label>
            <Select
              options={[
                { value: 'ACTIVE', label: 'Active (Allowed to Borrow)' },
                { value: 'SUSPENDED', label: 'Suspended (Blocked from New Issues)' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Remarks / Note</label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. CBSE board student special book privilege"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingMemberId ? 'Save Changes' : 'Enroll Member'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
