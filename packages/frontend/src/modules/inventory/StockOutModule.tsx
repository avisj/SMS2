// ========================================================================
// Stock Out Module (Goods Issues)
// Issue inventory goods to students, departments, or staff & record physical decrement
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  Plus,
  Search,
  RefreshCw,
  Building2,
  Calendar,
  Users,
  Eye,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { InventoryStockOut, InventoryStockBalance, SKU, Location } from '../../types/index.js';
import { useCurrency, formatCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions, formatLocationDisplay } from '../../utils/locations.js';

interface StockOutLineForm {
  sku_id: string;
  quantity: number;
  unit_price: number;
  remarks: string;
}

export const StockOutModule: React.FC<{ tabId?: string }> = () => {
  const { branches } = useAuth();
  const { symbol, format } = useCurrency();
  const [issues, setIssues] = useState<InventoryStockOut[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stockBalances, setStockBalances] = useState<InventoryStockBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Details Modal
  const [viewingIssue, setViewingIssue] = useState<InventoryStockOut | null>(null);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [formLocationId, setFormLocationId] = useState<string>('');
  const [formIssuedToType, setFormIssuedToType] = useState<string>('STUDENT');
  const [formIssueDate, setFormIssueDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formLines, setFormLines] = useState<StockOutLineForm[]>([]);
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

      const [outRes, skuRes, locRes, stockRes] = await Promise.all([
        api.get<InventoryStockOut[]>('/inventory/stock-out', params),
        api.get<SKU[]>('/inventory/skus', { status: 'ACTIVE' }),
        api.get<Location[]>('/locations').catch(() => branches || []),
        api.get<InventoryStockBalance[]>('/inventory/stock', params),
      ]);

      setIssues(outRes || []);
      setSkus(skuRes || []);
      setLocations(locRes && locRes.length > 0 ? locRes : branches || []);
      setStockBalances(stockRes || []);
    } catch (err) {
      console.error('Failed to load stock out records:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStock = (skuId: string, locId: string) => {
    const bal = stockBalances.find(b => b.sku_id === skuId && b.location_id === locId);
    if (!bal) return 0;
    return Math.max(0, (bal.quantity || 0) - (bal.reserved_quantity || 0));
  };

  const openCreateModal = () => {
    const activeLocs = locations.filter(l => l.status === 'ACTIVE' || !l.status);
    const loc = (selectedLocation && activeLocs.some(l => l.id === selectedLocation))
      ? selectedLocation
      : (activeLocs[0]?.id || locations[0]?.id || '');
    setFormLocationId(loc);
    setFormIssuedToType('STUDENT');
    setFormIssueDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormLines([
      {
        sku_id: skus[0]?.id || '',
        quantity: 1,
        unit_price: skus[0]?.selling_price || 0,
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
        quantity: 1,
        unit_price: skus[0]?.selling_price || 0,
        remarks: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    setFormLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<StockOutLineForm>) => {
    setFormLines(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...updates };
        if (updates.sku_id && updates.sku_id !== item.sku_id) {
          const selected = skus.find(s => s.id === updates.sku_id);
          if (selected && selected.selling_price !== undefined) {
            updated.unit_price = selected.selling_price;
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
        setErrorMsg('Please select an issuing branch / warehouse');
        return;
      }

      if (formLines.length === 0) {
        setErrorMsg('Please add at least one line item to issue');
        return;
      }

      for (let i = 0; i < formLines.length; i++) {
        const line = formLines[i];
        if (!line.sku_id) {
          setErrorMsg(`Line #${i + 1}: Please select a valid SKU`);
          return;
        }
        if (line.quantity <= 0) {
          setErrorMsg(`Line #${i + 1}: Issued quantity must be greater than 0`);
          return;
        }
        const avail = getAvailableStock(line.sku_id, formLocationId);
        if (line.quantity > avail) {
          const skuObj = skus.find(s => s.id === line.sku_id);
          setErrorMsg(
            `Line #${i + 1} (${skuObj?.sku_code}): Insufficient stock. Available: ${avail}, requested: ${line.quantity}`
          );
          return;
        }
      }

      await api.post('/inventory/stock-out', {
        location_id: formLocationId,
        issued_to_type: formIssuedToType || undefined,
        issue_date: formIssueDate || undefined,
        notes: formNotes || undefined,
        items: formLines.map(l => ({
          sku_id: l.sku_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          remarks: l.remarks || undefined,
        })),
      });

      setSuccessMsg('Goods Issue Note recorded successfully and inventory stock decremented.');
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to record stock out');
    } finally {
      setSaving(false);
    }
  };

  const filteredIssues = issues.filter(i => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const num = i.issue_number?.toLowerCase() || '';
    const to = i.issued_to_type?.toLowerCase() || '';
    const loc = (i.location?.location_name || i.location?.name || '').toLowerCase();
    return num.includes(term) || to.includes(term) || loc.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowUpRight className="w-6 h-6 text-rose-600" />
            Stock Out / Goods Issues
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Issue inventory goods to students, departments, or staff and log physical stock reductions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />
            New Goods Issue
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
              placeholder="Search by issue number, recipient type, or branch..."
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

      {/* Issues Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Issue #</th>
                <th className="px-4 py-3">Issue Date</th>
                <th className="px-4 py-3">Source Branch</th>
                <th className="px-4 py-3">Recipient Type</th>
                <th className="px-4 py-3 text-center">Items Issued</th>
                <th className="px-4 py-3">Notes / Purpose</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-600" />
                    Loading Goods Issue records...
                  </td>
                </tr>
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No Goods Issue records found. Click "New Goods Issue" to dispatch inventory.
                  </td>
                </tr>
              ) : (
                filteredIssues.map(iss => (
                  <tr key={iss.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {iss.issue_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(iss.issue_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {formatLocationDisplay(iss.location)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-800 font-medium">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {iss.issued_to_type || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="slate">{iss.items?.length || 0} line items</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {iss.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingIssue(iss)}
                        title="View Issue Details"
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

      {/* Create Goods Issue Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Goods Issue (Stock Out)"
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
                Issuing Branch / Warehouse <span className="text-rose-500">*</span>
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
                Issued To Recipient Type <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formIssuedToType}
                onChange={e => setFormIssuedToType(e.target.value)}
                options={[
                  { value: 'STUDENT', label: 'Student' },
                  { value: 'STAFF', label: 'Staff Member / Teacher' },
                  { value: 'DEPARTMENT', label: 'School Department' },
                  { value: 'GENERAL', label: 'General Internal Consumption' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issue Date <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={formIssueDate}
                onChange={e => setFormIssueDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purpose / Requisition Ref
              </label>
              <Input
                placeholder="e.g. Science lab chemistry equipment requisition"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Line Items to Issue ({formLines.length})
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {formLines.map((line, idx) => {
                const avail = getAvailableStock(line.sku_id, formLocationId);
                const isInsufficient = line.quantity > avail;

                return (
                  <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          SKU Item
                        </label>
                        <select
                          className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 focus:border-rose-500 focus:outline-none"
                          value={line.sku_id}
                          onChange={e => updateLine(idx, { sku_id: e.target.value })}
                          required
                        >
                          {skus.map(s => {
                            const curAvail = getAvailableStock(s.id, formLocationId);
                            const displayName = s.sku_name || s.product?.name || s.sku_code;
                            return (
                              <option key={s.id} value={s.id}>
                                {s.sku_code} - {displayName} (Avail: {curAvail})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Issue Qty (Avail: {avail})
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max={avail}
                          step="any"
                          value={line.quantity}
                          onChange={e => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          required
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Price ({symbol})
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={line.unit_price}
                          onChange={e => updateLine(idx, { unit_price: parseFloat(e.target.value) || 0 })}
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

                    {isInsufficient && (
                      <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Warning: Requested quantity ({line.quantity}) exceeds available stock ({avail}).
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <input
                        type="text"
                        placeholder="Remarks / serial number / student roll (optional)"
                        value={line.remarks}
                        onChange={e => updateLine(idx, { remarks: e.target.value })}
                        className="text-[11px] bg-transparent border-none text-slate-600 focus:outline-none w-2/3"
                      />
                      <span className="font-semibold text-slate-700 font-mono">
                        Value: {format(line.quantity * line.unit_price)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Processing Issue...' : 'Confirm Goods Issue'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Details Modal */}
      {viewingIssue && (
        <Modal
          isOpen={!!viewingIssue}
          onClose={() => setViewingIssue(null)}
          title={`Goods Issue Note: ${viewingIssue.issue_number}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block">Source Branch:</span>
                <span className="font-semibold text-slate-900">{formatLocationDisplay(viewingIssue.location)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Recipient Type:</span>
                <span className="font-semibold text-slate-900">{viewingIssue.issued_to_type || 'General'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Issue Date:</span>
                <span className="font-semibold text-slate-900">{new Date(viewingIssue.issue_date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Notes:</span>
                <span className="font-medium text-slate-800">{viewingIssue.notes || '—'}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Dispatched Line Items
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Quantity</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewingIssue.items?.map(it => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {it.sku?.sku_code} - {it.sku?.sku_name || it.sku?.product?.name || 'Item'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {it.quantity}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">
                          {format(it.unit_price || 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                          {format(it.total_price || 0)}
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
              <Button variant="outline" size="sm" onClick={() => setViewingIssue(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
