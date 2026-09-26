// ========================================================================
// Purchase Orders Module
// Procurement lifecycle: Vendor ordering, cost tracking & warehouse receiving
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
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
  PackageCheck,
  Ban,
  ArrowDownLeft,
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
import { PurchaseOrder, InventoryVendor, SKU, Location, PurchaseOrderStatus } from '../../types/index.js';

interface POLineForm {
  sku_id: string;
  quantity_ordered: number;
  unit_price: number;
  tax_rate: number;
}

interface ReceiveLineForm {
  sku_id: string;
  quantity_ordered: number;
  already_received: number;
  quantity_receiving: number;
  unit_cost: number;
}

export const PurchaseOrdersModule: React.FC<{ tabId?: string }> = () => {
  const { branches } = useAuth();
  const { symbol, formatCurrency } = useCurrency();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Details Modal
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [formLocationId, setFormLocationId] = useState<string>('');
  const [formVendorId, setFormVendorId] = useState<string>('');
  const [formOrderDate, setFormOrderDate] = useState<string>('');
  const [formExpectedDate, setFormExpectedDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formLines, setFormLines] = useState<POLineForm[]>([]);

  // Receive Modal
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceiveLineForm[]>([]);
  const [receiveLocationId, setReceiveLocationId] = useState<string>('');

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [selectedLocation, selectedStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (selectedLocation) params.location_id = selectedLocation;
      if (selectedStatus) params.status = selectedStatus;

      const [poRes, vendorRes, skuRes, locRes] = await Promise.all([
        api.get<PurchaseOrder[]>('/inventory/purchase-orders', params),
        api.get<InventoryVendor[]>('/inventory/vendors', { status: 'ACTIVE' }),
        api.get<SKU[]>('/inventory/skus', { status: 'ACTIVE' }),
        api.get<Location[]>('/locations').catch(() => branches || []),
      ]);

      setPos(poRes || []);
      setVendors(vendorRes || []);
      setSkus(skuRes || []);
      setLocations(locRes && locRes.length > 0 ? locRes : branches || []);
    } catch (err) {
      console.error('Failed to load purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="slate">Draft</Badge>;
      case 'ORDERED':
        return <Badge variant="indigo">Ordered</Badge>;
      case 'PARTIALLY_RECEIVED':
        return <Badge variant="warning">Partially Received</Badge>;
      case 'RECEIVED':
        return <Badge variant="success">Fully Received</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const openCreateModal = () => {
    const activeLocs = locations.filter(l => l.status === 'ACTIVE' || !l.status);
    const defaultLocId = (selectedLocation && activeLocs.some(l => l.id === selectedLocation))
      ? selectedLocation
      : (activeLocs[0]?.id || locations[0]?.id || '');
    setFormLocationId(defaultLocId);
    setFormVendorId(vendors[0]?.id || '');
    setFormOrderDate(new Date().toISOString().split('T')[0]);
    setFormExpectedDate('');
    setFormNotes('');
    setFormLines([
      {
        sku_id: skus[0]?.id || '',
        quantity_ordered: 10,
        unit_price: skus[0]?.cost_price || 0,
        tax_rate: 0,
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
        quantity_ordered: 10,
        unit_price: skus[0]?.cost_price || 0,
        tax_rate: 0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    setFormLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<POLineForm>) => {
    setFormLines(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...updates };
        if (updates.sku_id && updates.sku_id !== item.sku_id) {
          const selected = skus.find(s => s.id === updates.sku_id);
          if (selected && selected.cost_price !== undefined) {
            updated.unit_price = selected.cost_price;
          }
        }
        return updated;
      })
    );
  };

  const calculateSubtotal = () =>
    formLines.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_price || 0), 0);

  const calculateTax = () =>
    formLines.reduce(
      (sum, item) => sum + ((item.quantity_ordered * item.unit_price * (item.tax_rate || 0)) / 100 || 0),
      0
    );

  const calculateTotal = () => calculateSubtotal() + calculateTax();

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');

      if (!formLocationId) {
        setErrorMsg('Please select a delivery location');
        return;
      }
      if (!formVendorId) {
        setErrorMsg('Please select a supplier / vendor');
        return;
      }
      if (formLines.length === 0) {
        setErrorMsg('Please add at least one line item');
        return;
      }

      for (let i = 0; i < formLines.length; i++) {
        if (formLines[i].quantity_ordered <= 0) {
          setErrorMsg(`Line #${i + 1}: Quantity ordered must be greater than 0`);
          return;
        }
      }

      await api.post('/inventory/purchase-orders', {
        location_id: formLocationId,
        vendor_id: formVendorId,
        order_date: formOrderDate || undefined,
        expected_date: formExpectedDate || undefined,
        notes: formNotes || undefined,
        items: formLines.map(l => ({
          sku_id: l.sku_id,
          quantity_ordered: l.quantity_ordered,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
        })),
      });

      setSuccessMsg('Purchase Order created successfully (Stock remains unchanged until goods are received).');
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  // Open Receive Modal
  const openReceiveModal = (po: PurchaseOrder) => {
    setReceivingPO(po);
    setReceiveLocationId(po.location_id);
    const lines: ReceiveLineForm[] = (po.items || []).map(it => {
      const pending = Math.max(0, it.quantity_ordered - (it.quantity_received || 0));
      return {
        sku_id: it.sku_id,
        quantity_ordered: it.quantity_ordered,
        already_received: it.quantity_received || 0,
        quantity_receiving: pending,
        unit_cost: it.unit_price || 0,
      };
    });
    setReceiveLines(lines);
    setErrorMsg('');
  };

  const handleReceivePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPO) return;
    try {
      setSaving(true);
      setErrorMsg('');

      const toReceive = receiveLines.filter(l => l.quantity_receiving > 0);
      if (toReceive.length === 0) {
        setErrorMsg('Please enter a quantity greater than 0 for at least one item');
        return;
      }

      for (const line of toReceive) {
        const pending = line.quantity_ordered - line.already_received;
        if (line.quantity_receiving > pending) {
          setErrorMsg(`Cannot receive more than pending quantity (${pending}) for this item.`);
          return;
        }
      }

      await api.post(`/inventory/purchase-orders/${receivingPO.id}/receive`, {
        location_id: receiveLocationId,
        received_items: toReceive.map(l => ({
          sku_id: l.sku_id,
          quantity_received: l.quantity_receiving,
          unit_cost: l.unit_cost,
        })),
      });

      setSuccessMsg(`Goods received for ${receivingPO.po_number}! Stock balances and ledger updated.`);
      setReceivingPO(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to receive goods');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPO = async (po: PurchaseOrder) => {
    if (!confirm(`Are you sure you want to cancel Purchase Order ${po.po_number}?`)) return;
    try {
      await api.post(`/inventory/purchase-orders/${po.id}/cancel`);
      setSuccessMsg(`Purchase Order ${po.po_number} has been cancelled.`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to cancel purchase order');
    }
  };

  const filteredPOs = pos.filter(po => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const num = po.po_number?.toLowerCase() || '';
    const vendor = po.vendor?.name?.toLowerCase() || '';
    const loc = (po.location?.location_name || po.location?.name || '').toLowerCase();
    return num.includes(term) || vendor.includes(term) || loc.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-brand-600" />
            Purchase Orders (Procurement)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create vendor purchase orders, monitor deliveries, and receive inventory into warehouse stock.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />
            Create Purchase Order
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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search by PO number, vendor, or destination branch..."
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
          <div>
            <Select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'ORDERED', label: 'Ordered' },
                { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
                { value: 'RECEIVED', label: 'Fully Received' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* PO Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">Supplier / Vendor</th>
                <th className="px-4 py-3">Delivery Branch</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading Purchase Orders...
                  </td>
                </tr>
              ) : filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No Purchase Orders found. Click "Create Purchase Order" to place orders.
                  </td>
                </tr>
              ) : (
                filteredPOs.map(po => {
                  const canReceive = po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED';
                  const canCancel = po.status === 'ORDERED' || po.status === 'DRAFT';

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {po.po_number}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(po.order_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          {po.vendor?.name || 'Vendor'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {formatLocationDisplay(po.location)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(po.status)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {po.items?.length || 0} SKUs
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(po.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingPO(po)}
                            title="View PO Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {canReceive && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openReceiveModal(po)}
                              title="Receive Goods into Inventory"
                            >
                              <PackageCheck className="w-3.5 h-3.5 mr-1" />
                              Receive
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelPO(po)}
                              className="text-rose-600 hover:bg-rose-50"
                              title="Cancel PO"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create PO Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Purchase Order"
      >
        <form onSubmit={handleCreatePO} className="space-y-4 max-w-2xl">
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
                Supplier / Vendor <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formVendorId}
                onChange={e => setFormVendorId(e.target.value)}
                options={vendors.map(v => ({ value: v.id, label: v.name || 'Vendor' }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Order Date <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={formOrderDate}
                onChange={e => setFormOrderDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expected Delivery Date
              </label>
              <Input
                type="date"
                value={formExpectedDate}
                onChange={e => setFormExpectedDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Order Notes / Delivery Instructions
            </label>
            <Input
              placeholder="e.g. Deliver to Gate 2 warehouse during business hours"
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
            />
          </div>

          {/* Line Items */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Order Items ({formLines.length})
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
                        className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 focus:border-brand-500 focus:outline-none"
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
                        Qty Ordered
                      </label>
                      <Input
                        type="number"
                        min="1"
                        step="any"
                        value={line.quantity_ordered}
                        onChange={e => updateLine(idx, { quantity_ordered: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Unit Price ({symbol})
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={line.unit_price}
                        onChange={e => updateLine(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Tax %
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={line.tax_rate}
                        onChange={e => updateLine(idx, { tax_rate: parseFloat(e.target.value) || 0 })}
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

                  <div className="text-right text-[11px] font-mono text-slate-600">
                    Line Total: {formatCurrency(line.quantity_ordered * line.unit_price * (1 + (line.tax_rate || 0) / 100))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-medium">{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Estimated Tax:</span>
                <span className="font-mono font-medium">{formatCurrency(calculateTax())}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 text-sm">
                <span>Total PO Amount:</span>
                <span className="font-mono text-brand-700">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Placing Order...' : 'Submit Purchase Order'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Receive PO Modal */}
      {receivingPO && (
        <Modal
          isOpen={!!receivingPO}
          onClose={() => setReceivingPO(null)}
          title={`Receive Goods: ${receivingPO.po_number}`}
        >
          <form onSubmit={handleReceivePO} className="space-y-4 max-w-2xl">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-400 block">Vendor:</span>
                <span className="font-semibold text-slate-900">{receivingPO.vendor?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Warehouse Branch:</span>
                <span className="font-semibold text-slate-900">{formatLocationDisplay(receivingPO.location)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Status:</span>
                {getStatusBadge(receivingPO.status)}
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Received</th>
                    <th className="px-3 py-2 text-right">Pending</th>
                    <th className="px-3 py-2 text-right w-32">Receive Now</th>
                    <th className="px-3 py-2 text-right w-28">Unit Cost ({symbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {receiveLines.map((line, idx) => {
                    const skuObj = skus.find(s => s.id === line.sku_id);
                    const pending = line.quantity_ordered - line.already_received;
                    const isFullyReceived = pending <= 0;

                    return (
                      <tr key={line.sku_id} className={isFullyReceived ? 'bg-slate-50/60' : ''}>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {skuObj?.sku_name || skuObj?.product?.name || skuObj?.sku_code || 'Item'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {line.quantity_ordered}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {line.already_received}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {Math.max(0, pending)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isFullyReceived ? (
                            <span className="inline-flex items-center justify-end w-full">
                              <Badge variant="success">Fully Received</Badge>
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={pending}
                              step="any"
                              value={line.quantity_receiving}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setReceiveLines(prev =>
                                  prev.map((l, i) => (i === idx ? { ...l, quantity_receiving: val } : l))
                                );
                              }}
                              className="w-full text-right font-mono font-bold text-emerald-800 bg-emerald-50/50 border border-emerald-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={isFullyReceived}
                            value={line.unit_cost}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setReceiveLines(prev =>
                                prev.map((l, i) => (i === idx ? { ...l, unit_cost: val } : l))
                              );
                            }}
                            className="w-full text-right font-mono text-slate-700 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-brand-50 border border-brand-200 rounded-lg text-[11px] text-brand-800">
              Receiving goods will increment on-hand physical inventory at <b>{formatLocationDisplay(receivingPO.location)}</b> and record immutable Goods Receipt entries in the stock ledger.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="outline" type="button" onClick={() => setReceivingPO(null)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? 'Processing Receipt...' : 'Confirm Goods Receipt'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Details Modal */}
      {viewingPO && (
        <Modal
          isOpen={!!viewingPO}
          onClose={() => setViewingPO(null)}
          title={`Purchase Order: ${viewingPO.po_number}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block">Vendor:</span>
                <span className="font-semibold text-slate-900">{viewingPO.vendor?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Delivery Branch:</span>
                <span className="font-semibold text-slate-900">{formatLocationDisplay(viewingPO.location)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Order Date:</span>
                <span className="font-semibold text-slate-900">{new Date(viewingPO.order_date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Status:</span>
                {getStatusBadge(viewingPO.status)}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Order Items
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Ordered</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Tax</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewingPO.items?.map(it => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {it.sku?.sku_name || it.sku?.product?.name || it.sku?.sku_code || 'Item'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {it.quantity_ordered}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-700 font-semibold">
                          {it.quantity_received || 0}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">
                          {formatCurrency(it.unit_price)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">
                          {it.tax_rate}%
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(it.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-600">Total Purchase Amount:</span>
              <span className="text-base font-bold text-brand-800 font-mono">
                {formatCurrency(viewingPO.total_amount)}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setViewingPO(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
