// ========================================================================
// Library Fines Module
// Manage Overdue & Damage Penalties, Collections, Receipts, and Waivers
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  IndianRupee,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileCheck,
  User,
  AlertCircle,
  CreditCard,
  Ban,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useCurrency } from '../../utils/currency.js';
import { LibraryFine, LibraryFineStatus } from '../../types/index.js';

export const LibraryFinesModule: React.FC<{ tabId?: string }> = () => {
  const { symbol, format } = useCurrency();

  const [fines, setFines] = useState<LibraryFine[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Pay Modal State
  const [payModalFine, setPayModalFine] = useState<LibraryFine | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<string>('CASH');
  const [payRef, setPayRef] = useState<string>('');
  const [paying, setPaying] = useState<boolean>(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Waive Modal State
  const [waiveModalFine, setWaiveModalFine] = useState<LibraryFine | null>(null);
  const [waiverReason, setWaiverReason] = useState<string>('');
  const [waiving, setWaiving] = useState<boolean>(false);
  const [waiveError, setWaiveError] = useState<string | null>(null);

  const fetchFines = async () => {
    try {
      setLoading(true);
      const res = await api.get<LibraryFine[]>('/library/fines');
      if (res) {
        setFines(res);
      }
    } catch (err: any) {
      console.error('Error fetching fines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFines();
  }, []);

  const openPayModal = (fine: LibraryFine) => {
    setPayModalFine(fine);
    setPayAmount(fine.balance_amount);
    setPayMode('CASH');
    setPayRef('');
    setPayError(null);
  };

  const handlePayFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalFine) return;
    if (payAmount <= 0) {
      setPayError('Payment amount must be greater than zero.');
      return;
    }
    if (payAmount > payModalFine.balance_amount) {
      setPayError(`Payment cannot exceed outstanding balance of ${format(payModalFine.balance_amount)}.`);
      return;
    }

    try {
      setPaying(true);
      setPayError(null);
      await api.post<LibraryFine>(`/library/fines/${payModalFine.id}/pay`, {
        amount_paid: Number(payAmount),
        payment_mode: payMode,
        payment_reference: payRef.trim() || undefined,
      });

      setPayModalFine(null);
      await fetchFines();
    } catch (err: any) {
      setPayError(err?.message || 'Failed to record payment.');
    } finally {
      setPaying(false);
    }
  };

  const openWaiveModal = (fine: LibraryFine) => {
    setWaiveModalFine(fine);
    setWaiverReason('');
    setWaiveError(null);
  };

  const handleWaiveFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiveModalFine) return;
    if (!waiverReason.trim() || waiverReason.trim().length < 3) {
      setWaiveError('Please enter a valid justification reason (at least 3 characters).');
      return;
    }

    try {
      setWaiving(true);
      setWaiveError(null);
      await api.post<LibraryFine>(`/library/fines/${waiveModalFine.id}/waive`, {
        waiver_reason: waiverReason.trim(),
      });

      setWaiveModalFine(null);
      await fetchFines();
    } catch (err: any) {
      setWaiveError(err?.message || 'Failed to waive fine.');
    } finally {
      setWaiving(false);
    }
  };

  // KPIs
  const totalAssessed = fines.reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalCollected = fines.reduce((sum, f) => sum + (f.paid_amount || 0), 0);
  const totalOutstanding = fines.reduce((sum, f) => sum + (f.balance_amount || 0), 0);
  const totalWaived = fines.reduce((sum, f) => sum + (f.waived_amount || 0), 0);

  // Filtered fines
  const filtered = fines.filter((f) => {
    if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const memberName = `${f.member_user?.first_name || ''} ${f.member_user?.last_name || ''}`.toLowerCase();
    const email = f.member_user?.email?.toLowerCase() || '';
    const reason = f.reason.toLowerCase();
    return memberName.includes(term) || email.includes(term) || reason.includes(term);
  });

  const getStatusBadge = (status: LibraryFineStatus) => {
    switch (status) {
      case 'UNPAID':
        return <Badge variant="rose">Unpaid</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="amber">Partially Paid</Badge>;
      case 'PAID':
        return <Badge variant="emerald">Settled</Badge>;
      case 'WAIVED':
        return <Badge variant="slate">Waived</Badge>;
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
            <IndianRupee className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Library Fines & Collections
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Overdue book fines, loss/damage penalty ledger, cash/UPI collection, and authorized waivers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchFines} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Total Fines Assessed</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {format(totalAssessed)}
              </h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Total Collected</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {format(totalCollected)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Outstanding Balance</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {format(totalOutstanding)}
              </h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Authorized Waivers</p>
              <h3 className="text-2xl font-bold text-slate-600 dark:text-slate-400 mt-1">
                {format(totalWaived)}
              </h3>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg">
              <Ban className="w-5 h-5" />
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
              placeholder="Search by member name, email, or penalty reason..."
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
                { value: 'UNPAID', label: 'Unpaid Only' },
                { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
                { value: 'PAID', label: 'Settled' },
                { value: 'WAIVED', label: 'Waived' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Fines Table */}
      <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                <th className="py-3 px-4">Borrower / Member</th>
                <th className="py-3 px-4">Reason & Date</th>
                <th className="py-3 px-4 text-right">Fine Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading fines ledger...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No fine records found.
                  </td>
                </tr>
              ) : (
                filtered.map((fine) => (
                  <tr
                    key={fine.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {fine.member_user
                          ? `${fine.member_user.first_name} ${fine.member_user.last_name}`
                          : 'Unknown Member'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {fine.member_user?.email || fine.member_user_id}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {fine.reason}
                      </div>
                      <div className="text-xs text-slate-500">
                        Assessed on {new Date(fine.fine_date).toLocaleDateString()}
                        {fine.waiver_reason && ` • Waived: ${fine.waiver_reason}`}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-white">
                      {format(fine.amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {format(fine.paid_amount || 0)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                      {format(fine.balance_amount || 0)}
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(fine.status)}</td>
                    <td className="py-3 px-4 text-right">
                      {fine.balance_amount > 0 && fine.status !== 'WAIVED' && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openPayModal(fine)}
                          >
                            <CreditCard className="w-3.5 h-3.5 mr-1" />
                            Collect
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-slate-600 dark:text-slate-300"
                            onClick={() => openWaiveModal(fine)}
                          >
                            Waive
                          </Button>
                        </div>
                      )}
                      {fine.status === 'PAID' && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          Receipt: {fine.payment_reference || fine.payment_mode || 'Cash'}
                        </span>
                      )}
                      {fine.status === 'WAIVED' && (
                        <span className="text-xs text-slate-400 italic">Waived</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Collect Payment Modal */}
      <Modal
        isOpen={!!payModalFine}
        onClose={() => setPayModalFine(null)}
        title="Record Fine Payment"
      >
        {payModalFine && (
          <form onSubmit={handlePayFine} className="space-y-4">
            {payError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{payError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Borrower:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {payModalFine.member_user
                    ? `${payModalFine.member_user.first_name} ${payModalFine.member_user.last_name}`
                    : 'Library Member'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Fine Reason:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {payModalFine.reason}
                </span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
                <span className="text-slate-500">Total Assessed:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {format(payModalFine.amount)}
                </span>
              </div>
              <div className="flex justify-between py-1 font-bold text-rose-600 dark:text-rose-400">
                <span>Outstanding Due:</span>
                <span>{format(payModalFine.balance_amount)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Amount ({symbol}) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={payModalFine.balance_amount}
                value={payAmount}
                onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <Select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value)}
                options={[
                  { value: 'CASH', label: 'Cash at Counter' },
                  { value: 'UPI', label: 'UPI / QR Code' },
                  { value: 'CARD', label: 'Debit / Credit Card' },
                  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                  { value: 'OTHER', label: 'Other' },
                ]}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Transaction / Receipt Reference
              </label>
              <Input
                placeholder="e.g. REC-2026-0819 or UPI Txn Ref"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayModalFine(null)}
                disabled={paying}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={paying}>
                {paying ? 'Processing...' : 'Confirm Receipt'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Waive Fine Modal */}
      <Modal
        isOpen={!!waiveModalFine}
        onClose={() => setWaiveModalFine(null)}
        title="Waive Library Fine"
      >
        {waiveModalFine && (
          <form onSubmit={handleWaiveFine} className="space-y-4">
            {waiveError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{waiveError}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
              <p className="font-semibold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Waiver Authorization
              </p>
              <p>
                You are waiving outstanding fine of{' '}
                <span className="font-bold">{format(waiveModalFine.balance_amount)}</span> for{' '}
                <span className="font-medium">
                  {waiveModalFine.member_user
                    ? `${waiveModalFine.member_user.first_name} ${waiveModalFine.member_user.last_name}`
                    : 'Library Member'}
                </span>
                . An audit log entry will be created.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Waiver Justification / Reason <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Approved medical leave exemption / Principal dispensation"
                value={waiverReason}
                onChange={(e) => setWaiverReason(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWaiveModalFine(null)}
                disabled={waiving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                disabled={waiving}
              >
                {waiving ? 'Waiving...' : 'Confirm Waiver'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
