// ========================================================================
// Stock Adjustment Module
// Cycle counting, physical inventory discrepancies, write-offs & corrections
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Plus,
  Search,
  RefreshCw,
  Building2,
  Calendar,
  Eye,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { InventoryAdjustment, SKU, Location } from '../../types/index.js';
import { useCurrency, formatCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions, formatLocationDisplay } from '../../utils/locations.js';

interface AdjustmentLineForm {
  sku_id: string;
  adjustment_type: 'INCREASE' | 'DECREASE';
  quantity: number;
  unit_cost: number;
  remarks: string;
}

export const StockAdjustmentModule: React.FC<{ tabId?: string }> = () => {
  const { branches } = useAuth();
  const { symbol, format } = useCurrency();
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Details Modal
  const [viewingAdj, setViewingAdj] = useState<InventoryAdjustment | null>(null);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [formLocationId, setFormLocationId] = useState<string>('');
  const [formReason, setFormReason] = useState<string>('Physical Count Audit');
  const [formAdjustmentDate, setFormAdjustmentDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formLines, setFormLines] = useState<AdjustmentLineForm[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [selectedLocation]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (selectedLocation) params.location_id = selectedLocation;

      const [adjRes, skuRes, locRes] = await Promise.all([
        api.get<InventoryAdjustment[]>('/inventory/adjustments', params),
        api.get<SKU[]>('/inventory/skus', { status: 'ACTIVE' }),
        api.get<Location[]>('/locations').catch(() => branches || []),
      ]);

      setAdjustments(adjRes || []);
      setSkus(skuRes || []);
      setLocations(locRes && locRes.length > 0 ? locRes : branches || []);
    } catch (err) {
      console.error('Failed to load adjustments:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    const activeLocs = locations.filter(l => l.status === 'ACTIVE' || !l.status);
    const loc = (selectedLocation && activeLocs.some(l => l.id === selectedLocation))
      ? selectedLocation
      : (activeLocs[0]?.id || locations[0]?.id || '');
    setFormLocationId(loc);
    setFormReason('Physical Count Audit');
    setFormAdjustmentDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormLines([
      {
        sku_id: skus[0]?.id || '',
        adjustment_type: 'DECREASE',
        quantity: 1,
        unit_cost: skus[0]?.cost_price || 0,
        remarks: '',
      },
    ]);
    setErrorMsg('');
    setIsCreateOpen(true);
  };

  const addLine = () => {
    setFormLines(prev => [
      ...prev,
      {
        sku_id: skus[0]?.id || '',
        adjustment_type: 'DECREASE',
        quantity: 1,
        unit_cost: skus[0]?.cost_price || 0,
        remarks: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    setFormLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<AdjustmentLineForm>) => {
    setFormLines(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...updates };
        if (updates.sku_id && updates.sku_id !== item.sku_id) {
          const selected = skus.find(s => s.id === updates.sku_id);
          if (selected && selected.cost_price !== undefined) {
            updated.unit_cost = selected.cost_price;
          }
        }
        return updated;
      })
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');

      if (!formLocationId) {
        setErrorMsg('Please select a storage branch / warehouse');
        return;
      }

      if (formLines.length === 0) {
        setErrorMsg('Please add at least one line item to adjust');
        return;
      }

      for (let i = 0; i < formLines.length; i++) {
        const line = formLines[i];
        if (!line.sku_id) {
          setErrorMsg(`Line #${i + 1}: Please select a valid SKU`);
          return;
        }
        if (line.quantity <= 0) {
          setErrorMsg(`Line #${i + 1}: Adjustment quantity must be greater than 0`);
          return;
        }
      }

      await api.post('/inventory/adjustments', {
        location_id: formLocationId,
        reason: formReason,
        adjustment_date: formAdjustmentDate || undefined,
        notes: formNotes || undefined,
        items: formLines.map(l => ({
          sku_id: l.sku_id,
          adjustment_type: l.adjustment_type,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
          remarks: l.remarks || undefined,
        })),
      });

      setSuccessMsg('Stock adjustment recorded successfully and balances updated.');
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to record stock adjustment');
    } finally {
      setSaving(false);
    }
  };

  const filteredAdjustments = adjustments.filter(a => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const num = a.adjustment_number?.toLowerCase() || '';
    const reason = a.reason?.toLowerCase() || '';
    const loc = (a.location?.location_name || a.location?.name || '').toLowerCase();
    return num.includes(term) || reason.includes(term) || loc.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-indigo-600" />
            Stock Adjustments & Write-Offs
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile physical stock count discrepancies, record damaged goods, and audit adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />
            New Adjustment
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
          <button className="ml-auto text-emerald-700 font-bold" onClick={() => setSuccessMsg('')}>✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search by adjustment #, reason, or location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <div>
            <Select
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              options={getLocationSelectOptions(locations, { includeAll: true, allLabel: 'All Branches' })}
            />
          </div>
        </div>
      </Card>

      {/* Adjustments Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Adjustment #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Branch Location</th>
                <th className="px-4 py-3">Reason / Category</th>
                <th className="px-4 py-3 text-center">Items Count</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading Stock Adjustments...
                  </td>
                </tr>
              ) : filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No Stock Adjustments recorded. Click "New Adjustment" to reconcile stock.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map(adj => (
                  <tr key={adj.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {adj.adjustment_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(adj.adjustment_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {formatLocationDisplay(adj.location)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="slate">{adj.reason}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-slate-800">{adj.items?.length || 0} items</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {adj.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingAdj(adj)}
                        title="View Adjustment Details"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Adjustment Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Record Stock Adjustment"
      >
        <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Branch / Warehouse <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formLocationId}
                onChange={e => setFormLocationId(e.target.value)}
                options={getLocationSelectOptions(locations, { activeOnly: true })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Adjustment <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formReason}
                onChange={e => setFormReason(e.target.value)}
                options={[
                  { value: 'Physical Count Audit', label: 'Physical Count Audit' },
                  { value: 'Damaged Goods', label: 'Damaged Goods / Breakage' },
                  { value: 'Expired Stock', label: 'Expired Stock' },
                  { value: 'Discrepancy Correction', label: 'Discrepancy Correction' },
                  { value: 'Found Items', label: 'Found Unrecorded Items' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adjustment Date <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={formAdjustmentDate}
                onChange={e => setFormAdjustmentDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Audit Reference / Notes
              </label>
              <Input
                placeholder="e.g. Q3 annual physical inventory count"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Items to Adjust ({formLines.length})
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {formLines.map((line, idx) => (
                <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        SKU Item
                      </label>
                      <select
                        className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                        value={line.sku_id}
                        onChange={e => updateLine(idx, { sku_id: e.target.value })}
                        required
                      >
                        {skus.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.sku_code} - {s.sku_name || s.product?.name || s.sku_code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Action Type
                      </label>
                      <select
                        className={`w-full text-xs rounded-md border px-2 py-1.5 font-bold ${
                          line.adjustment_type === 'INCREASE'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-rose-300 bg-rose-50 text-rose-800'
                        }`}
                        value={line.adjustment_type}
                        onChange={e =>
                          updateLine(idx, {
                            adjustment_type: e.target.value as 'INCREASE' | 'DECREASE',
                          })
                        }
                      >
                        <option value="DECREASE">Decrease (-)</option>
                        <option value="INCREASE">Increase (+)</option>
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Qty Change
                      </label>
                      <Input
                        type="number"
                        min="1"
                        step="any"
                        value={line.quantity}
                        onChange={e => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>

                    <div className="col-span-1 flex justify-end pt-5">
                      {formLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <input
                      type="text"
                      placeholder="Audit reason / defect note (optional)"
                      value={line.remarks}
                      onChange={e => updateLine(idx, { remarks: e.target.value })}
                      className="text-[11px] bg-transparent border-none text-slate-600 focus:outline-none w-3/4"
                    />
                    <span className="font-semibold text-slate-700 font-mono">
                      Unit Cost: {format(line.unit_cost || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Applying Adjustments...' : 'Apply Stock Adjustment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Details Modal */}
      {viewingAdj && (
        <Modal
          isOpen={!!viewingAdj}
          onClose={() => setViewingAdj(null)}
          title={`Adjustment Note: ${viewingAdj.adjustment_number}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block">Branch:</span>
                <span className="font-semibold text-slate-900">{formatLocationDisplay(viewingAdj.location)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Reason:</span>
                <span className="font-semibold text-slate-900">{viewingAdj.reason}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Date:</span>
                <span className="font-semibold text-slate-900">{new Date(viewingAdj.adjustment_date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Notes:</span>
                <span className="font-medium text-slate-800">{viewingAdj.notes || '—'}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Adjusted Line Items
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-center">Type</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Cost</th>
                      <th className="px-3 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewingAdj.items?.map(it => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {it.sku?.sku_code} - {it.sku?.sku_name || it.sku?.product?.name || 'Item'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {it.adjustment_type === 'INCREASE' ? (
                            <Badge variant="success">
                              <ArrowUp className="w-3 h-3 mr-0.5 inline" />
                              Increase
                            </Badge>
                          ) : (
                            <Badge variant="danger">
                              <ArrowDown className="w-3 h-3 mr-0.5 inline" />
                              Decrease
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900 font-mono">
                          {it.adjustment_type === 'INCREASE' ? `+${it.quantity}` : `-${it.quantity}`}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">
                          {format(it.unit_cost || 0)}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {it.remarks || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setViewingAdj(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
