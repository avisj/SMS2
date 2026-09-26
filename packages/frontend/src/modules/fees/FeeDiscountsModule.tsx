// ========================================================================
// FeeDiscountsModule
// Management of Student Fee Concessions, Scholarships, and Discretionary Waivers
// ========================================================================

import React, { useEffect, useState } from 'react';
import { Percent, Plus, Search, Filter, CheckCircle2, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { api } from '../../api/client.js';
import { FeeDemandAdjustment, StudentFeeDemand } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { useCurrency } from '../../utils/currency.js';

interface FeeDiscountsModuleProps {
  tabId?: string;
}

export const FeeDiscountsModule: React.FC<FeeDiscountsModuleProps> = () => {
  const { symbol, format } = useCurrency();
  const [adjustments, setAdjustments] = useState<FeeDemandAdjustment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [demandSearch, setDemandSearch] = useState<string>('');
  const [matchingDemands, setMatchingDemands] = useState<StudentFeeDemand[]>([]);
  const [selectedDemand, setSelectedDemand] = useState<StudentFeeDemand | null>(null);
  const [searchingDemands, setSearchingDemands] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    adjustment_type: 'DISCOUNT' as 'DISCOUNT' | 'WAIVER',
    discount_name: 'Merit Scholarship',
    amount: 0,
    reason: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadAdjustments = async () => {
    try {
      setLoading(true);
      // Query adjustments from backend
      const demands = await api.get<StudentFeeDemand[]>('/fees/demands');
      const allAdjustments: FeeDemandAdjustment[] = [];
      for (const d of demands || []) {
        if (d.discount_amount > 0 || d.waiver_amount > 0) {
          allAdjustments.push({
            id: `ADJ-${d.id.slice(0, 8)}`,
            school_id: d.school_id,
            student_fee_demand_id: d.id,
            student_user_id: d.student_user_id,
            adjustment_type: d.waiver_amount > 0 ? 'WAIVER' : 'DISCOUNT',
            discount_name: d.waiver_amount > 0 ? 'Management Waiver' : 'Concession',
            amount: d.waiver_amount > 0 ? d.waiver_amount : d.discount_amount,
            reason: 'Administrative adjustment',
            status: 'APPROVED',
            created_at: d.updated_at || d.created_at,
            updated_at: d.updated_at || d.created_at,
          });
        }
      }
      setAdjustments(allAdjustments);
    } catch (err) {
      console.error('[FeeDiscountsModule] Error loading adjustments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdjustments();
  }, []);

  // Search demands inside modal
  useEffect(() => {
    if (!demandSearch.trim() || demandSearch.length < 2) {
      setMatchingDemands([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearchingDemands(true);
        const results = await api.get<StudentFeeDemand[]>('/fees/demands', {
          search: demandSearch.trim(),
        });
        const active = (results || []).filter(
          (d) => d.status === 'UNPAID' || d.status === 'PARTIALLY_PAID' || d.status === 'OVERDUE'
        );
        setMatchingDemands(active.slice(0, 8));
      } catch (err) {
        console.error(err);
      } finally {
        setSearchingDemands(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [demandSearch]);

  const handleOpenAdd = () => {
    setSelectedDemand(null);
    setDemandSearch('');
    setFormData({
      adjustment_type: 'DISCOUNT',
      discount_name: 'Merit Scholarship',
      amount: 0,
      reason: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDemand) {
      setFormError('Please select a fee invoice to apply concession on.');
      return;
    }
    if (formData.amount <= 0) {
      setFormError('Adjustment amount must be greater than zero.');
      return;
    }

    const outstanding = Math.max(0, selectedDemand.net_amount - selectedDemand.paid_amount);
    if (formData.amount > outstanding) {
      setFormError(`Adjustment amount cannot exceed current outstanding balance (${format(outstanding)})`);
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await api.post(`/fees/demands/${selectedDemand.id}/adjustments`, {
        adjustment_type: formData.adjustment_type,
        discount_name: formData.discount_name,
        amount: formData.amount,
        reason: formData.reason || 'Scholarship concession',
      });
      setIsModalOpen(false);
      loadAdjustments();
    } catch (err: any) {
      setFormError(err.message || 'Failed to apply adjustment');
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
            <Percent className="w-6 h-6 text-indigo-600" />
            Discounts, Concessions & Waivers
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Apply merit scholarships, sibling discounts, and discretionary hardship fee waivers.
          </p>
        </div>

        <Button onClick={handleOpenAdd} className="flex items-center gap-1.5 text-xs">
          <Plus className="w-4 h-4" />
          Apply Concession / Waiver
        </Button>
      </div>

      {/* Adjustments Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Adjustment ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Title / Scheme</th>
                <th className="px-4 py-3 text-right">Amount ({symbol})</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Loading concessions records...
                  </td>
                </tr>
              ) : adjustments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No concessions or fee waivers recorded. Click "Apply Concession / Waiver" to create one.
                  </td>
                </tr>
              ) : (
                adjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{adj.id}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          adj.adjustment_type === 'WAIVER'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {adj.adjustment_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {adj.discount_name || 'Concession'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {format(adj.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{adj.reason}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="success" size="sm">
                        {adj.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Apply Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Apply Concession or Waiver">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">1. Select Fee Invoice / Demand *</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by demand # or student name..."
                value={demandSearch}
                onChange={(e) => setDemandSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200"
              />
            </div>

            {matchingDemands.length > 0 && !selectedDemand && (
              <div className="mt-1 border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white shadow-md">
                {matchingDemands.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      setSelectedDemand(d);
                      setDemandSearch(d.demand_number);
                    }}
                    className="p-2 hover:bg-indigo-50 cursor-pointer"
                  >
                    <p className="font-bold text-slate-900">
                      {d.demand_number} — {d.student?.full_name || 'Student'} ({d.fee_head?.name})
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Period: {d.billing_period} | Outstanding: {format(d.net_amount - d.paid_amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {selectedDemand && (
              <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-indigo-900">
                    {selectedDemand.demand_number} ({selectedDemand.fee_head?.name})
                  </p>
                  <p className="text-[11px] text-indigo-700">
                    Outstanding: {format(selectedDemand.net_amount - selectedDemand.paid_amount)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDemand(null)}
                  className="text-indigo-600 font-semibold text-xs hover:underline"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Adjustment Type *</label>
              <select
                value={formData.adjustment_type}
                onChange={(e) => setFormData({ ...formData, adjustment_type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              >
                <option value="DISCOUNT">DISCOUNT / CONCESSION</option>
                <option value="WAIVER">WAIVER / SCHOLARSHIP</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Concession Name *</label>
              <Input
                type="text"
                placeholder="e.g. Merit Scholarship 25%"
                value={formData.discount_name}
                onChange={(e) => setFormData({ ...formData, discount_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Concession Amount ({symbol}) *</label>
            <Input
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 1000"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Approval Justification / Reason *</label>
            <textarea
              rows={2}
              placeholder="State reason and reference for audit trail..."
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
              {submitting ? 'Applying...' : 'Apply Concession'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
