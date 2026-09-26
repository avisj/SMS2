// ========================================================================
// FeeRefundsModule
// Audit Trail of Processed Fee Refunds & Reversal Engine
// ========================================================================

import React, { useEffect, useState } from 'react';
import { RotateCcw, Plus, Search, Calendar, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { api } from '../../api/client.js';
import { FeeRefund, FeePayment } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { useCurrency } from '../../utils/currency.js';

interface FeeRefundsModuleProps {
  tabId?: string;
}

export const FeeRefundsModule: React.FC<FeeRefundsModuleProps> = () => {
  const { symbol, format } = useCurrency();
  const [refunds, setRefunds] = useState<FeeRefund[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [paymentSearch, setPaymentSearch] = useState<string>('');
  const [matchingPayments, setMatchingPayments] = useState<FeePayment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<FeePayment | null>(null);
  const [searchingPayments, setSearchingPayments] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    refund_amount: 0,
    refund_mode: 'BANK_TRANSFER',
    reason: '',
    reference_no: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadRefunds = async () => {
    try {
      setLoading(true);
      const data = await api.get<FeeRefund[]>('/fees/refunds');
      setRefunds(data || []);
    } catch (err) {
      console.error('[FeeRefundsModule] Error loading refunds:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefunds();
  }, []);

  // Search payments for refund
  useEffect(() => {
    if (!paymentSearch.trim() || paymentSearch.length < 2) {
      setMatchingPayments([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearchingPayments(true);
        const results = await api.get<FeePayment[]>('/fees/payments');
        const eligible = (results || []).filter(
          (p) =>
            p.status !== 'REFUNDED' &&
            (p.payment_number.toLowerCase().includes(paymentSearch.toLowerCase()) ||
              p.student?.full_name?.toLowerCase().includes(paymentSearch.toLowerCase()))
        );
        setMatchingPayments(eligible.slice(0, 8));
      } catch (err) {
        console.error(err);
      } finally {
        setSearchingPayments(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [paymentSearch]);

  const handleOpenAdd = () => {
    setSelectedPayment(null);
    setPaymentSearch('');
    setFormData({
      refund_amount: 0,
      refund_mode: 'BANK_TRANSFER',
      reason: '',
      reference_no: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) {
      setFormError('Please select a payment voucher to refund from.');
      return;
    }

    const maxRefundable = Math.max(0, selectedPayment.total_amount - (selectedPayment.refunded_amount || 0));
    if (formData.refund_amount <= 0) {
      setFormError('Refund amount must be greater than zero.');
      return;
    }
    if (formData.refund_amount > maxRefundable) {
      setFormError(`Refund amount cannot exceed remaining payment balance (${format(maxRefundable)})`);
      return;
    }
    if (!formData.reason.trim()) {
      setFormError('Reason for refund is required.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await api.post('/fees/refunds', {
        payment_id: selectedPayment.id,
        refund_amount: formData.refund_amount,
        refund_mode: formData.refund_mode,
        reason: formData.reason,
        reference_no: formData.reference_no || undefined,
      });

      setIsModalOpen(false);
      loadRefunds();
    } catch (err: any) {
      setFormError(err.message || 'Failed to process refund');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-indigo-600" />
            Fee Refunds & Adjustments Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative audit trail of processed refunds. Reverses student allocations and receipts.
          </p>
        </div>

        <Button onClick={handleOpenAdd} className="flex items-center gap-1.5 text-xs">
          <Plus className="w-4 h-4" />
          Process Fee Refund
        </Button>
      </div>

      {/* Refunds Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Refund #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Payment Ref #</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3 text-right">Refund Amount ({symbol})</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Loading refunds records...
                  </td>
                </tr>
              ) : refunds.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No refunds processed yet.
                  </td>
                </tr>
              ) : (
                refunds.map((rf) => (
                  <tr key={rf.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{rf.refund_number}</td>
                    <td className="px-4 py-3 text-slate-600">{rf.refund_date}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {rf.student?.full_name || rf.student?.first_name || 'Student'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {rf.payment?.payment_number || 'Payment'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {rf.refund_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-rose-700">
                      {format(rf.refund_amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{rf.reason}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="success" size="sm">
                        {rf.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Process Refund Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Process Fee Refund">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">1. Select Payment Voucher *</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search payment # or student name..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200"
              />
            </div>

            {matchingPayments.length > 0 && !selectedPayment && (
              <div className="mt-1 border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white shadow-md">
                {matchingPayments.map((p) => {
                  const remaining = p.total_amount - (p.refunded_amount || 0);
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPayment(p);
                        setPaymentSearch(p.payment_number);
                        setFormData((prev) => ({ ...prev, refund_amount: remaining }));
                      }}
                      className="p-2 hover:bg-indigo-50 cursor-pointer"
                    >
                      <p className="font-bold text-slate-900">
                        {p.payment_number} — {p.student?.full_name || 'Student'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Paid: {format(p.total_amount)} | Remaining: {format(remaining)} | Mode: {p.payment_mode}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedPayment && (
              <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-indigo-900">{selectedPayment.payment_number}</p>
                  <p className="text-[11px] text-indigo-700">
                    Max Refundable: {format(selectedPayment.total_amount - (selectedPayment.refunded_amount || 0))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="text-indigo-600 font-semibold text-xs hover:underline"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Refund Amount ({symbol}) *</label>
              <Input
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 500"
                value={formData.refund_amount}
                onChange={(e) => setFormData({ ...formData, refund_amount: Number(e.target.value) })}
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Refund Mode *</label>
              <select
                value={formData.refund_mode}
                onChange={(e) => setFormData({ ...formData, refund_mode: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              >
                <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                <option value="UPI">UPI Reversal</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Transaction Ref / Cheque #</label>
            <Input
              type="text"
              placeholder="e.g. REF-AXIS-99128"
              value={formData.reference_no}
              onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Refund Justification / Reason *</label>
            <textarea
              rows={2}
              placeholder="State reason for reversal/refund..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Processing...' : 'Submit Refund'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
