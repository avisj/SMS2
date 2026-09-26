// ========================================================================
// Stock In Module (Goods Receipt Notes)
// Receive direct deliveries into warehouse/branches & record physical stock in
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  Plus,
  Search,
  RefreshCw,
  Building2,
  Calendar,
  Truck,
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
import { useCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions, formatLocationDisplay } from '../../utils/locations.js';
import { InventoryStockIn, InventoryVendor, SKU, Location } from '../../types/index.js';

interface StockInLineForm {
  sku_id: string;
  quantity: number;
  unit_cost: number;
  remarks: string;
}

export const StockInModule: React.FC<{ tabId?: string }> = () => {
  const { branches } = useAuth();
  const { symbol, formatCurrency } = useCurrency();
  const [receipts, setReceipts] = useState<InventoryStockIn[]>([]);
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // View Details Modal
  const [viewingReceipt, setViewingReceipt] = useState<InventoryStockIn | null>(null);

  // Create Stock In Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [formLocationId, setFormLocationId] = useState<string>('');
  const [formVendorId, setFormVendorId] = useState<string>('');
  const [formReceiptDate, setFormReceiptDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formLines, setFormLines] = useState<StockInLineForm[]>([]);
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

      const [inRes, vendorRes, skuRes, locRes] = await Promise.all([
        api.get<InventoryStockIn[]>('/inventory/stock-in', params),
        api.get<InventoryVendor[]>('/inventory/vendors', { status: 'ACTIVE' }),
        api.get<SKU[]>('/inventory/skus', { status: 'ACTIVE' }),
        api.get<Location[]>('/locations').catch(() => branches || []),
      ]);

      setReceipts(inRes || []);
      setVendors(vendorRes || []);
      setSkus(skuRes || []);
      setLocations(locRes && locRes.length > 0 ? locRes : branches || []);
    } catch (err) {
      console.error('Failed to load stock in records:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    const activeLocs = locations.filter(l => l.status === 'ACTIVE' || !l.status);
    const defaultLocId = (selectedLocation && activeLocs.some(l => l.id === selectedLocation))
      ? selectedLocation
      : (activeLocs[0]?.id || locations[0]?.id || '');
    setFormLocationId(defaultLocId);
    setFormVendorId('');
    setFormReceiptDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormLines([
      {
        sku_id: skus[0]?.id || '',
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
        quantity: 1,
        unit_cost: skus[0]?.cost_price || 0,
        remarks: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    setFormLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<StockInLineForm>) => {
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
        setErrorMsg('Please select a destination branch / warehouse');
        return;
      }

      if (formLines.length === 0) {
        setErrorMsg('Please add at least one line item to receive');
        return;
      }

      for (let i = 0; i < formLines.length; i++) {
        const line = formLines[i];
        if (!line.sku_id) {
          setErrorMsg(`Line #${i + 1}: Please select a valid SKU`);
          return;
        }
        if (line.quantity <= 0) {
          setErrorMsg(`Line #${i + 1}: Received quantity must be greater than 0`);
          return;
        }
      }

      await api.post('/inventory/stock-in', {
        location_id: formLocationId,
        vendor_id: formVendorId || undefined,
        receipt_date: formReceiptDate || undefined,
        notes: formNotes || undefined,
        items: formLines.map(l => ({
          sku_id: l.sku_id,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
          remarks: l.remarks || undefined,
        })),
      });

      setSuccessMsg('Goods Receipt Note recorded successfully and inventory stock incremented.');
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to record stock in');
    } finally {
      setSaving(false);
    }
  };

  const calculateTotalCost = () => {
    return formLines.reduce((sum, item) => sum + (item.quantity * item.unit_cost || 0), 0);
  };

  const filteredReceipts = receipts.filter(r => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const num = r.receipt_number?.toLowerCase() || '';
    const vendor = r.vendor?.name?.toLowerCase() || '';
    const loc = (r.location?.location_name || r.location?.name || '').toLowerCase();
    return num.includes(term) || vendor.includes(term) || loc.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowDownLeft className="w-6 h-6 text-emerald-600" />
            Stock In / Goods Receipt Notes (GRN)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Record direct physical deliveries and vendor receipts to increment warehouse stock balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />
            New Stock In
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
              placeholder="Search by receipt number, vendor, or branch..."
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

      {/* Receipts Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Receipt #</th>
                <th className="px-4 py-3">Receipt Date</th>
                <th className="px-4 py-3">Destination Branch</th>
                <th className="px-4 py-3">Supplier / Vendor</th>
                <th className="px-4 py-3 text-center">Items Received</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading Goods Receipt Notes...
                  </td>
                </tr>
              ) : filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No Goods Receipt Notes found. Click "New Stock In" to record incoming stock.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {rec.receipt_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(rec.receipt_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {formatLocationDisplay(rec.location)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {rec.vendor?.name ? (
                        <span className="inline-flex items-center gap-1 text-slate-800 font-medium">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          {rec.vendor.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Direct Delivery</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="slate">{rec.items?.length || 0} line items</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                      {formatCurrency(rec.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {rec.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingReceipt(rec)}
                        title="View Receipt Details"
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

      {/* Create Stock In Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Record Goods Receipt Note (Stock In)"
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
                Receiving Branch / Warehouse <span className="text-rose-500">*</span>
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
                Supplier / Vendor (Optional)
              </label>
              <Select
                value={formVendorId}
                onChange={e => setFormVendorId(e.target.value)}
                options={[
                  { value: '', label: 'Select Vendor (Optional)' },
                  ...vendors.map(v => ({ value: v.id, label: v.name || 'Vendor' })),
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt Date <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={formReceiptDate}
                onChange={e => setFormReceiptDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                General Notes / Delivery Ref
              </label>
              <Input
                placeholder="e.g. Challan #9981 / Delivery van"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Line Items to Receive ({formLines.length})
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
                        className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 focus:border-emerald-500 focus:outline-none"
                        value={line.sku_id}
                        onChange={e => updateLine(idx, { sku_id: e.target.value })}
                        required
                      >
                        {skus.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.sku_code} - {s.product?.name || 'Product'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Quantity
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

                    <div className="col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Unit Cost ({symbol})
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={line.unit_cost}
                        onChange={e => updateLine(idx, { unit_cost: parseFloat(e.target.value) || 0 })}
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
                      placeholder="Remarks / batch / expiration note (optional)"
                      value={line.remarks}
                      onChange={e => updateLine(idx, { remarks: e.target.value })}
                      className="text-[11px] bg-transparent border-none text-slate-600 focus:outline-none w-2/3"
                    />
                    <span className="font-semibold text-slate-700 font-mono">
                      Subtotal: {formatCurrency(line.quantity * line.unit_cost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Total Receipt Amount:</span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                {formatCurrency(calculateTotalCost())}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Processing Receipt...' : 'Record Goods Receipt'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Details Modal */}
      {viewingReceipt && (
        <Modal
          isOpen={!!viewingReceipt}
          onClose={() => setViewingReceipt(null)}
          title={`Receipt Note: ${viewingReceipt.receipt_number}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block">Branch:</span>
                <span className="font-semibold text-slate-900">{formatLocationDisplay(viewingReceipt.location)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Vendor:</span>
                <span className="font-semibold text-slate-900">{viewingReceipt.vendor?.name || 'Direct Delivery'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Receipt Date:</span>
                <span className="font-semibold text-slate-900">{new Date(viewingReceipt.receipt_date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Cost:</span>
                <span className="font-bold text-emerald-700 font-mono">{formatCurrency(viewingReceipt.total_amount)}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Received Line Items
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Quantity</th>
                      <th className="px-3 py-2 text-right">Unit Cost</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewingReceipt.items?.map(it => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {it.sku?.sku_name || it.sku?.product?.name || it.sku?.sku_code || 'Item'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {it.quantity}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">
                          {formatCurrency(it.unit_cost)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(it.total_cost)}
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
              <Button variant="outline" size="sm" onClick={() => setViewingReceipt(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
