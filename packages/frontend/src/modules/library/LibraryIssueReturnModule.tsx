// ========================================================================
// Library Issue & Return Module
// Circulation Desk: Check-Out, Check-In, Renewals, Overdue Calculation,
// and Condition Inspection on Return
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  BookOpen,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Barcode,
  Calendar,
  IndianRupee,
  UserCheck,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useCurrency } from '../../utils/currency.js';
import { formatLocationDisplay } from '../../utils/locations.js';
import {
  LibraryIssue,
  LibraryBookCopy,
  LibraryMember,
  LibrarySettings,
  BookCopyCondition,
} from '../../types/index.js';

export const LibraryIssueReturnModule: React.FC<{ tabId?: string }> = () => {
  const { symbol, format } = useCurrency();

  const [issues, setIssues] = useState<LibraryIssue[]>([]);
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [availableCopies, setAvailableCopies] = useState<LibraryBookCopy[]>([]);
  const [settings, setSettings] = useState<LibrarySettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ISSUED');

  // Issue Book Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);
  const [selectedMemberUserId, setSelectedMemberUserId] = useState<string>('');
  const [selectedCopyId, setSelectedCopyId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [issueRemarks, setIssueRemarks] = useState<string>('');
  const [issuing, setIssuing] = useState<boolean>(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Return Book Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [targetIssue, setTargetIssue] = useState<LibraryIssue | null>(null);
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [returnCondition, setReturnCondition] = useState<BookCopyCondition>('GOOD');
  const [returnRemarks, setReturnRemarks] = useState<string>('');
  const [returning, setReturning] = useState<boolean>(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const loadCirculationData = async () => {
    setLoading(true);
    try {
      const [iRes, mRes, cRes, sRes] = await Promise.all([
        api.get<LibraryIssue[]>('/library/issues'),
        api.get<LibraryMember[]>('/library/members'),
        api.get<LibraryBookCopy[]>('/library/copies', { status: 'AVAILABLE' }),
        api.get<LibrarySettings>('/library/settings'),
      ]);

      if (iRes) setIssues(iRes);
      if (mRes) setMembers(mRes);
      if (cRes) setAvailableCopies(cRes);
      if (sRes) setSettings(sRes);
    } catch (err: any) {
      console.error('Failed to load circulation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCirculationData();
  }, []);

  const handleOpenIssueModal = () => {
    const activeMembers = members.filter((m) => m.status === 'ACTIVE');
    setSelectedMemberUserId(activeMembers.length > 0 ? activeMembers[0].user_id : '');
    setSelectedCopyId(availableCopies.length > 0 ? availableCopies[0].id : '');

    const loanDays = settings?.loan_period_days || 14;
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + loanDays);
    setDueDate(defaultDue.toISOString().split('T')[0]);

    setIssueRemarks('');
    setIssueError(null);
    setIsIssueModalOpen(true);
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueError(null);

    if (!selectedCopyId) {
      setIssueError('Please select an available book copy to issue.');
      return;
    }
    if (!selectedMemberUserId) {
      setIssueError('Please select a borrower member.');
      return;
    }

    setIssuing(true);
    try {
      await api.post('/library/issues', {
        book_copy_id: selectedCopyId,
        member_user_id: selectedMemberUserId,
        due_date: dueDate || undefined,
        remarks: issueRemarks.trim() || undefined,
      });

      setIsIssueModalOpen(false);
      loadCirculationData();
    } catch (err: any) {
      setIssueError(err.response?.data?.error?.message || err.message || 'Failed to issue book.');
    } finally {
      setIssuing(false);
    }
  };

  const handleOpenReturnModal = (issue: LibraryIssue) => {
    setTargetIssue(issue);
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnCondition(issue.book_copy?.condition || 'GOOD');
    setReturnRemarks('');
    setReturnError(null);
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetIssue) return;
    setReturnError(null);
    setReturning(true);

    try {
      await api.post(`/library/issues/${targetIssue.id}/return`, {
        return_date: returnDate,
        condition: returnCondition,
        remarks: returnRemarks.trim() || undefined,
      });

      setIsReturnModalOpen(false);
      loadCirculationData();
    } catch (err: any) {
      setReturnError(err.response?.data?.error?.message || err.message || 'Failed to process return.');
    } finally {
      setReturning(false);
    }
  };

  const handleRenew = async (issue: LibraryIssue) => {
    if (!window.confirm(`Renew book loan for "${issue.book?.title}" (Copy: ${issue.book_copy?.copy_code})?`)) return;

    try {
      await api.post(`/library/issues/${issue.id}/renew`);
      loadCirculationData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.message || 'Renewal rejected.');
    }
  };

  const filteredIssues = issues.filter((i) => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    const title = (i.book?.title || '').toLowerCase();
    const copyCode = (i.book_copy?.copy_code || '').toLowerCase();
    const barcode = (i.book_copy?.barcode || '').toLowerCase();
    const memberName = i.member_user
      ? `${i.member_user.first_name || ''} ${i.member_user.last_name || ''}`.toLowerCase()
      : '';
    return title.includes(term) || copyCode.includes(term) || barcode.includes(term) || memberName.includes(term);
  });

  const now = new Date().toISOString().split('T')[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Issue & Return Circulation Desk</h1>
            <Badge variant="indigo">Daily Counter</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Check-out books, process returns, renew active loans, and calculate overdue fines automatically
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadCirculationData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenIssueModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Check-Out / Issue Book
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by book, copy code, or borrower..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['ISSUED', 'RETURNED', 'ALL'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st === 'ALL' ? '' : st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                (st === 'ALL' && !statusFilter) || statusFilter === st
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st === 'ALL' ? 'All Loans' : st === 'ISSUED' ? 'Active Loans' : 'Returned History'}
            </button>
          ))}
        </div>
      </Card>

      {/* Issues Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Book Title & Copy</th>
                <th className="py-3 px-4">Borrower / Member</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Renewals</th>
                <th className="py-3 px-4">Circulation Status</th>
                <th className="py-3 px-4 text-right">Counter Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading circulation ledger...
                  </td>
                </tr>
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <BookOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No circulation records found.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => {
                  const isOverdue = issue.status === 'ISSUED' && issue.due_date < now;
                  return (
                    <tr key={issue.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{issue.book?.title}</div>
                        <div className="text-xs font-mono text-blue-600 flex items-center gap-1.5 mt-0.5">
                          <span>{issue.book_copy?.copy_code}</span>
                          {issue.book_copy?.barcode && (
                            <span className="text-gray-400 text-[11px]">({issue.book_copy.barcode})</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {issue.member_user?.first_name} {issue.member_user?.last_name}
                        </div>
                        <div className="text-xs text-gray-400">{issue.member_user?.email}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">{issue.issue_date}</td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        <span className={isOverdue ? 'text-rose-600' : 'text-gray-900'}>
                          {issue.due_date}
                        </span>
                        {isOverdue && (
                          <div className="text-[10px] text-rose-500 flex items-center gap-1 mt-0.5 font-bold">
                            <AlertTriangle className="w-3 h-3" />
                            Overdue
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-medium">
                          {issue.renewal_count} / {settings?.maximum_renewals ?? 2}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            issue.status === 'RETURNED'
                              ? 'success'
                              : isOverdue
                              ? 'danger'
                              : 'indigo'
                          }
                        >
                          {isOverdue ? 'OVERDUE' : issue.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {issue.status === 'ISSUED' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRenew(issue)}
                              disabled={issue.renewal_count >= (settings?.maximum_renewals ?? 2)}
                              title="Renew Loan Period"
                            >
                              Renew
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenReturnModal(issue)}
                              title="Process Return & Check-In"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Return
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Issue Book Modal */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title="Check-Out / Issue Book to Member"
      >
        <form onSubmit={handleIssueSubmit} className="space-y-4">
          {issueError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{issueError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
              Select Available Copy *
            </label>
            <Select
              options={
                availableCopies.length > 0
                  ? availableCopies.map((c) => ({
                      value: c.id,
                      label: `${c.copy_code} — ${c.book?.title} (${formatLocationDisplay(c.location)} / ${c.rack || 'R'}-${c.shelf || 'S'})`,
                    }))
                  : [{ value: '', label: 'No Available Copies in Stacks' }]
              }
              value={selectedCopyId}
              onChange={(e) => setSelectedCopyId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
              Borrower Member *
            </label>
            <Select
              options={members
                .filter((m) => m.status === 'ACTIVE')
                .map((m) => ({
                  value: m.user_id,
                  label: `${m.membership_number} — ${m.user?.first_name} ${m.user?.last_name || ''} (${m.membership_type}, ${m.active_issues_count ?? 0} active)`,
                }))}
              value={selectedMemberUserId}
              onChange={(e) => setSelectedMemberUserId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
              Scheduled Due Date *
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Default loan period is {settings?.loan_period_days || 14} days from today.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Issue Remarks</label>
            <Input
              value={issueRemarks}
              onChange={(e) => setIssueRemarks(e.target.value)}
              placeholder="e.g. Issued for board examination preparation"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsIssueModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={issuing || availableCopies.length === 0}>
              {issuing ? 'Issuing...' : 'Confirm Issue'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Return Book Check-In Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={`Return Book Check-In: ${targetIssue?.book_copy?.copy_code || ''}`}
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          {returnError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{returnError}</div>
          )}

          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-xs space-y-1">
            <div className="font-semibold text-blue-900">{targetIssue?.book?.title}</div>
            <div className="text-blue-700">
              Borrower: {targetIssue?.member_user?.first_name} {targetIssue?.member_user?.last_name}
            </div>
            <div className="text-blue-600">
              Issued: {targetIssue?.issue_date} • Due: {targetIssue?.due_date}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Return Date *</label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
              Inspected Book Condition *
            </label>
            <Select
              options={[
                { value: 'GOOD', label: 'Good Working Condition' },
                { value: 'NEW', label: 'Pristine / Like New' },
                { value: 'FAIR', label: 'Fair / Minor Wear' },
                { value: 'DAMAGED', label: 'Damaged (Requires Repair / Bindery)' },
                { value: 'POOR', label: 'Poor (Heavy wear)' },
              ]}
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value as BookCopyCondition)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Return Remarks</label>
            <Input
              value={returnRemarks}
              onChange={(e) => setReturnRemarks(e.target.value)}
              placeholder="e.g. Returned on time, pages intact"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsReturnModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={returning}>
              {returning ? 'Processing...' : 'Complete Return Check-In'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
