// ========================================================================
// Library Reservations Module
// Manage Book Hold Queues, Reservation Requests, Expiry, and Cancellations
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  BookmarkCheck,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  User,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import {
  LibraryReservation,
  LibraryBook,
  LibraryMember,
  LibraryReservationStatus,
} from '../../types/index.js';

export const LibraryReservationsModule: React.FC<{ tabId?: string }> = () => {
  const [reservations, setReservations] = useState<LibraryReservation[]>([]);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Place Reservation Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [selectedMemberUserId, setSelectedMemberUserId] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Cancellation State
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resResv, resBooks, resMembers] = await Promise.all([
        api.get<LibraryReservation[]>('/library/reservations'),
        api.get<LibraryBook[]>('/library/books'),
        api.get<LibraryMember[]>('/library/members'),
      ]);

      if (resResv) setReservations(resResv);
      if (resBooks) setBooks(resBooks);
      if (resMembers) setMembers(resMembers);
    } catch (err: any) {
      console.error('Error fetching reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePlaceReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookId || !selectedMemberUserId) {
      setError('Please select both a book and an active library member.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await api.post<LibraryReservation>('/library/reservations', {
        book_id: selectedBookId,
        member_user_id: selectedMemberUserId,
        remarks: remarks.trim() || undefined,
      });

      setIsModalOpen(false);
      setSelectedBookId('');
      setSelectedMemberUserId('');
      setRemarks('');
      await fetchData();
    } catch (err: any) {
      setError(err?.message || 'Failed to place reservation.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelReservation = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      setCancellingId(id);
      await api.post<LibraryReservation>(`/library/reservations/${id}/cancel`, {});
      await fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel reservation.');
    } finally {
      setCancellingId(null);
    }
  };

  // Filtered reservations
  const filtered = reservations.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const bookTitle = r.book?.title?.toLowerCase() || '';
    const bookIsbn = r.book?.isbn?.toLowerCase() || '';
    const memberName = `${r.member_user?.first_name || ''} ${r.member_user?.last_name || ''}`.toLowerCase();
    return bookTitle.includes(term) || bookIsbn.includes(term) || memberName.includes(term);
  });

  const activeCount = reservations.filter((r) => r.status === 'ACTIVE').length;
  const fulfilledCount = reservations.filter((r) => r.status === 'FULFILLED').length;
  const expiredCount = reservations.filter((r) => r.status === 'EXPIRED').length;

  const getStatusBadge = (status: LibraryReservationStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="indigo">Active Queue</Badge>;
      case 'FULFILLED':
        return <Badge variant="emerald">Fulfilled</Badge>;
      case 'CANCELLED':
        return <Badge variant="slate">Cancelled</Badge>;
      case 'EXPIRED':
        return <Badge variant="rose">Expired</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BookmarkCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Book Reservations
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage student & staff book reservation queues and allocation priorities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Place Reservation
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Total Requests</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{reservations.length}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
              <BookmarkCheck className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Active Queue</p>
              <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{activeCount}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Fulfilled Holds</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fulfilledCount}</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Expired / Void</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{expiredCount}</h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-lg">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Search by book title, ISBN, or borrower name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-56 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active Queue' },
                { value: 'FULFILLED', label: 'Fulfilled' },
                { value: 'CANCELLED', label: 'Cancelled' },
                { value: 'EXPIRED', label: 'Expired' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Reservations Table */}
      <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                <th className="py-3 px-4">Book Details</th>
                <th className="py-3 px-4">Borrower</th>
                <th className="py-3 px-4">Queue Pos.</th>
                <th className="py-3 px-4">Reservation Date</th>
                <th className="py-3 px-4">Hold Expiry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading reservations...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No reservations found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((resv) => (
                  <tr
                    key={resv.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                        {resv.book?.title || 'Unknown Title'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        ISBN: {resv.book?.isbn || 'N/A'} • {resv.book?.category?.name || 'General'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {resv.member_user
                          ? `${resv.member_user.first_name} ${resv.member_user.last_name}`
                          : 'Unknown Member'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {resv.member_user?.email || resv.member_user_id}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {resv.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                          #{resv.queue_position}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">--</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {new Date(resv.reservation_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {new Date(resv.expiry_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(resv.status)}</td>
                    <td className="py-3 px-4 text-right">
                      {resv.status === 'ACTIVE' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          disabled={cancellingId === resv.id}
                          onClick={() => handleCancelReservation(resv.id)}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Place Reservation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError(null);
        }}
        title="Place Book Reservation"
      >
        <form onSubmit={handlePlaceReservation} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Book <span className="text-rose-500">*</span>
            </label>
            <Select
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              options={[
                { value: '', label: '-- Select a Title to Reserve --' },
                ...books.map((b) => ({
                  value: b.id,
                  label: `${b.title} (Available Copies: ${b.available_copies ?? b.available_copies_count ?? 0} / Total: ${b.total_copies ?? b.total_copies_count ?? 0})`,
                })),
              ]}
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Member will be placed in the reservation priority queue for this book.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Library Member <span className="text-rose-500">*</span>
            </label>
            <Select
              value={selectedMemberUserId}
              onChange={(e) => setSelectedMemberUserId(e.target.value)}
              options={[
                { value: '', label: '-- Select Member --' },
                ...members
                  .filter((m) => m.status === 'ACTIVE')
                  .map((m) => ({
                    value: m.user_id,
                    label: `${m.user ? `${m.user.first_name} ${m.user.last_name}` : m.membership_number} (${m.membership_type})`,
                  })),
              ]}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks / Justification
            </label>
            <Input
              placeholder="e.g. Recommended reading for semester exams"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Placing...' : 'Confirm Reservation'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
