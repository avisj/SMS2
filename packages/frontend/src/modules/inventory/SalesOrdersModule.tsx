// ========================================================================
// Sales Orders Module
// Student uniforms, books & stationery sales orders, tracking & fulfillment
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Receipt,
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
  PackageCheck,
  Ban,
  DollarSign,
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
import {
  SalesOrder,
  SalesOrderStatus,
  SalesOrderCustomerType,
  SalesOrderPaymentStatus,
  SKU,
  Location,
  InventoryStockBalance,
} from '../../types/index.js';

interface SOLineForm {
  sku_id: string;
  quantity_ordered: number;
  unit_price: number;
  discount_amount: number;
}

interface FulfillLineForm {
  sku_id: string;
  quantity_ordered: number;
  already_fulfilled: number;
  quantity_fulfilling: number;
}

export const SalesOrdersModule: React.FC<{ tabId?: string }> = () => {
  const { branches } = useAuth();
  const { symbol, formatCurrency } = useCurrency();
  const [sos, setSos] = useState<SalesOrder[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stockBalances, setStockBalances] = useState<InventoryStockBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>('');

  // Details Modal
  const [viewingSO, setViewingSO] = useState<SalesOrder | null>(null);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [formLocationId, setFormLocationId] = useState<string>('');
  const [formCustomerType, setFormCustomerType] = useState<SalesOrderCustomerType>('STUDENT');
  const [formCustomerName, setFormCustomerName] = useState<string>('');
  const [formPaymentStatus, setFormPaymentStatus] = useState<SalesOrderPaymentStatus>('PAID');
  const [formOrderDate, setFormOrderDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formLines, setFormLines] = useState<SOLineForm[]>([]);

  // Fulfill Modal
  const [fulfillingSO, setFulfillingSO] = useState<SalesOrder | null>(null);
  const [fulfillLines, setFulfillLines] = useState<FulfillLineForm[]>([]);
  const [fulfillLocationId, setFulfillLocationId] = useState<string>('');

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [selectedLocation, selectedStatus, selectedCustomerType]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (selectedLocation) params.location_id = selectedLocation;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedCustomerType) params.customer_type = selectedCustomerType;

      const [soRes, skuRes, locRes, stockRes] = await Promise.all([
        api.get<SalesOrder[]>('/inventory/sales-orders', params),
        api.get<SKU[]>('/inventory/skus', { status: 'ACTIVE' }),
        api.get<Location[]>('/locations').catch(() => branches || []),
        api.get<InventoryStockBalance[]>('/inventory/stock', params),
      ]);

      setSos(soRes || []);
      setSkus(skuRes || []);
      setLocations(locRes && locRes.length > 0 ? locRes : branches || []);
      setStockBalances(stockRes || []);
    } catch (err) {
      console.error('Failed to load sales orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStock = (skuId: string, locId: string) => {
    const bal = stockBalances.find(b => b.sku_id === skuId && b.location_id === locId);
    if (!bal) return 0;
    return Math.max(0, (bal.quantity || 0) - (bal.reserved_quantity || 0));
  };

  const getStatusBadge = (status: SalesOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="slate">Draft</Badge>;
      case 'CONFIRMED':
        return <Badge variant="indigo">Confirmed</Badge>;
      case 'PARTIALLY_FULFILLED':
        return <Badge variant="warning">Partially Fulfilled</Badge>;
      case 'FULFILLED':
        return <Badge variant="success">Fulfilled</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: SalesOrderPaymentStatus) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">Paid</span>;
      case 'PARTIALLY_PAID':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">Partially Paid</span>;
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">Pending</span>;
      case 'WAIVED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800">Waived</span>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const openCreateModal = () => {
    const activeLocs = locations.filter(l => l.status === 'ACTIVE' || !l.status);
    const loc = (selectedLocation && activeLocs.some(l => l.id === selectedLocation))
      ? selectedLocation
      : (activeLocs[0]?.id || locations[0]?.id || '');
    setFormLocationId(loc);
    setFormCustomerType('STUDENT');
    setFormCustomerName('');
    setFormPaymentStatus('PAID');
    setFormOrderDate(new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormLines([
      {
        sku_id: skus[0]?.id || '',
        quantity_ordered: 1,
        unit_price: skus[0]?.selling_price || 0,
        discount_amount: 0,
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
        quantity_ordered: 1,
        unit_price: skus[0]?.selling_price || 0,
        discount_amount: 0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    setFormLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, updates: Partial<SOLineForm>) => {
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

  const calculateSubtotal = () =>
    formLines.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_price || 0), 0);

  const calculateTotalDiscount = () =>
    formLines.reduce((sum, item) => sum + (item.discount_amount || 0), 0);

  const calculateTotal = () => Math.max(0, calculateSubtotal() - calculateTotalDiscount());

  const handleCreateSO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');

      if (!formLocationId) {
        setErrorMsg('Please select a branch location');
        return;
      }
      if (!formCustomerName.trim()) {
        setErrorMsg('Please enter customer / student name');
        return;
      }
      if (formLines.length === 0) {
        setErrorMsg('Please add at least one line item to the order');
        return;
      }

      for (let i = 0; i < formLines.length; i++) {
        if (formLines[i].quantity_ordered <= 0) {
          setErrorMsg(`Line #${i + 1}: Quantity ordered must be greater than 0`);
          return;
        }
      }

      await api.post('/inventory/sales-orders', {
        location_id: formLocationId,
        customer_type: formCustomerType,
        customer_name: formCustomerName.trim(),
        order_date: formOrderDate || undefined,
        payment_status: formPaymentStatus,
        notes: formNotes || undefined,
        items: formLines.map(l => ({
          sku_id: l.sku_id,
          quantity_ordered: l.quantity_ordered,
          unit_price: l.unit_price,
          discount_amount: l.discount_amount,
        })),
      });

      setSuccessMsg('Sales Order created successfully (Stock remains un-decremented until order fulfillment).');
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to create sales order');
    } finally {
      setSaving(false);
    }
  };

  // Open Fulfill Modal
  const openFulfillModal = (so: SalesOrder) => {
    setFulfillingSO(so);
    setFulfillLocationId(so.location_id);
    const lines: FulfillLineForm[] = (so.items || []).map(it => {
      const pending = Math.max(0, it.quantity_ordered - (it.quantity_fulfilled || 0));
      const avail = getAvailableStock(it.sku_id, so.location_id);
      return {
        sku_id: it.sku_id,
        quantity_ordered: it.quantity_ordered,
        already_fulfilled: it.quantity_fulfilled || 0,
        quantity_fulfilling: Math.min(pending, avail),
      };
    });
    setFulfillLines(lines);
    setErrorMsg('');
  };

  const handleFulfillSO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillingSO) return;
    try {
      setSaving(true);
      setErrorMsg('');

      const toFulfill = fulfillLines.filter(l => l.quantity_fulfilling > 0);
      if (toFulfill.length === 0) {
        setErrorMsg('Please enter a quantity greater than 0 for at least one item');
        return;
      }

      for (const line of toFulfill) {
        const pending = line.quantity_ordered - line.already_fulfilled;
        if (line.quantity_fulfilling > pending) {
          setErrorMsg(`Cannot fulfill more than pending quantity (${pending}) for this item.`);
          return;
        }
        const avail = getAvailableStock(line.sku_id, fulfillLocationId);
        if (line.quantity_fulfilling > avail) {
          const skuObj = skus.find(s => s.id === line.sku_id);
          setErrorMsg(
            `Insufficient stock for ${skuObj?.sku_code}. Available: ${avail}, requested: ${line.quantity_fulfilling}`
          );
          return;
        }
      }

      await api.post(`/inventory/sales-orders/${fulfillingSO.id}/fulfill`, {
        location_id: fulfillLocationId,
        fulfilled_items: toFulfill.map(l => ({
          sku_id: l.sku_id,
          quantity_fulfilled: l.quantity_fulfilling,
        })),
      });

      setSuccessMsg(`Sales Order ${fulfillingSO.so_number} fulfilled! Stock balances decremented.`);
      setFulfillingSO(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to fulfill order');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSO = async (so: SalesOrder) => {
    if (!confirm(`Are you sure you want to cancel Sales Order ${so.so_number}?`)) return;
    try {
      await api.post(`/inventory/sales-orders/${so.id}/cancel`);
      setSuccessMsg(`Sales Order ${so.so_number} has been cancelled.`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to cancel sales order');
    }
  };

  const filteredSOs = sos.filter(so => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const num = so.so_number?.toLowerCase() || '';
    const cust = so.customer_name?.toLowerCase() || '';
    const loc = (so.location?.location_name || so.location?.name || '').toLowerCase();
    return num.includes(term) || cust.includes(term) || loc.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" />
            Sales Orders & Point of Sale (POS)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Uniforms, stationery, and book orders for students and staff with fulfillment dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1" />
            Create Sales Order
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
              placeholder="Search by SO number, customer name, or location..."
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
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'PARTIALLY_FULFILLED', label: 'Partially Fulfilled' },
                { value: 'FULFILLED', label: 'Fulfilled' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* SO Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">SO Number</th>
                <th className="px-4 py-3">Order Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Branch Location</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Payment</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading Sales Orders...
                  </td>
                </tr>
              ) : filteredSOs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No Sales Orders found. Click "Create Sales Order" to record an order.
                  </td>
                </tr>
              ) : (
                filteredSOs.map(so => {
                  const canFulfill = so.status === 'CONFIRMED' || so.status === 'PARTIALLY_FULFILLED';
                  const canCancel = so.status === 'CONFIRMED' || so.status === 'DRAFT';

                  return (
                    <tr key={so.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {so.so_number}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(so.order_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900 block">{so.customer_name}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                          {so.customer_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {formatLocationDisplay(so.location)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(so.status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getPaymentBadge(so.payment_status)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {so.items?.length || 0} SKUs
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(so.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingSO(so)}
                            title="View SO Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {canFulfill && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openFulfillModal(so)}
                              title="Fulfill Order (Dispatch Goods)"
                            >
                              <PackageCheck className="w-3.5 h-3.5 mr-1" />
                              Fulfill
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelSO(so)}
                              className="text-rose-600 hover:bg-rose-50"
                              title="Cancel SO"
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

      {/* Create SO Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Sales Order"
      >
        <form onSubmit={handleCreateSO} className="space-y-4 max-w-2xl">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fulfilling Branch Location <span className="text-rose-500">*</span>
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
                Customer Type <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formCustomerType}
                onChange={e => setFormCustomerType(e.target.value as SalesOrderCustomerType)}
                options={[
                  { value: 'STUDENT', label: 'Student' },
                  { value: 'STAFF', label: 'Staff Member / Teacher' },
                  { value: 'PARENT', label: 'Parent / Guardian' },
                  { value: 'EXTERNAL', label: 'External Customer' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Aarav Sharma (Grade 10-A)"
                value={formCustomerName}
                onChange={e => setFormCustomerName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Status
              </label>
              <Select
                value={formPaymentStatus}
                onChange={e => setFormPaymentStatus(e.target.value as SalesOrderPaymentStatus)}
                options={[
                  { value: 'PAID', label: 'Paid in Full' },
                  { value: 'PENDING', label: 'Pending Payment' },
                  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
                  { value: 'WAIVED', label: 'Waived / Free' },
                ]}
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
                Notes / Student Roll #
              </label>
              <Input
                placeholder="e.g. Uniform fee receipt #UF-8802"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
              />
            </div>
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
              {formLines.map((line, idx) => {
                const avail = getAvailableStock(line.sku_id, formLocationId);

                return (
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
                          {skus.map(s => {
                            const curAvail = getAvailableStock(s.id, formLocationId);
                            return (
                              <option key={s.id} value={s.id}>
                                {s.sku_code} - {s.product?.name || 'Product'} (Avail: {curAvail})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Qty (Avail: {avail})
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
                          Selling Price ({symbol})
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
                          Discount ({symbol})
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={line.discount_amount}
                          onChange={e => updateLine(idx, { discount_amount: parseFloat(e.target.value) || 0 })}
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
                      Line Total: {formatCurrency(line.quantity_ordered * line.unit_price - (line.discount_amount || 0))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-medium">{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Discount:</span>
                <span className="font-mono text-rose-600">-{formatCurrency(calculateTotalDiscount())}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 text-sm">
                <span>Total Payable:</span>
                <span className="font-mono text-indigo-700">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Creating Order...' : 'Confirm Sales Order'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Fulfill SO Modal */}
      {fulfillingSO && (
        <Modal
          isOpen={!!fulfillingSO}
          onClose={() => setFulfillingSO(null)}
          title={`Fulfill Sales Order: ${fulfillingSO.so_number}`}
        >
          <form onSubmit={handleFulfillSO} className="space-y-4 max-w-2xl">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-400 block">Customer:</span>
                <span className="font-semibold text-slate-900">{fulfillingSO.customer_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Dispatch Branch:</span>
                <span className="font-semibold text-slate-900">{formatLocationDisplay(fulfillingSO.location)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Status:</span>
                {getStatusBadge(fulfillingSO.status)}
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Fulfilled</th>
                    <th className="px-3 py-2 text-right">Pending</th>
                    <th className="px-3 py-2 text-right">Available Stock</th>
                    <th className="px-3 py-2 text-right w-28">Fulfill Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {fulfillLines.map((line, idx) => {
                    const skuObj = skus.find(s => s.id === line.sku_id);
                    const pending = line.quantity_ordered - line.already_fulfilled;
                    const avail = getAvailableStock(line.sku_id, fulfillLocationId);

                    return (
                      <tr key={line.sku_id}>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {skuObj?.sku_name || skuObj?.product?.name || skuObj?.sku_code || 'Item'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {line.quantity_ordered}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {line.already_fulfilled}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {pending}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-brand-700">
                          {avail}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max={Math.min(pending, avail)}
                            step="any"
                            value={line.quantity_fulfilling}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setFulfillLines(prev =>
                                prev.map((l, i) => (i === idx ? { ...l, quantity_fulfilling: val } : l))
                              );
                            }}
                            className="w-full text-right font-mono font-bold text-indigo-800 bg-indigo-50/50 border border-indigo-300 rounded px-2 py-1 text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-[11px] text-indigo-800">
              Fulfilling this sales order will physically decrement on-hand inventory stock at <b>{formatLocationDisplay(fulfillingSO.location)}</b> and record immutable fulfillment audit logs in the stock ledger.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="outline" type="button" onClick={() => setFulfillingSO(null)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? 'Dispatching Stock...' : 'Confirm Fulfillment & Dispatch'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Details Modal */}
      {viewingSO && (
        <Modal
          isOpen={!!viewingSO}
          onClose={() => setViewingSO(null)}
          title={`Sales Order: ${viewingSO.so_number}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block">Customer:</span>
                <span className="font-semibold text-slate-900">{viewingSO.customer_name}</span>
                <span className="text-[10px] text-slate-500 block uppercase">{viewingSO.customer_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Branch Location:</span>
                <span className="font-semibold text-slate-900">{formatLocationDisplay(viewingSO.location)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Order Date:</span>
                <span className="font-semibold text-slate-900">{new Date(viewingSO.order_date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Status / Payment:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getStatusBadge(viewingSO.status)}
                  {getPaymentBadge(viewingSO.payment_status)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Ordered Items
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Ordered</th>
                      <th className="px-3 py-2 text-right">Fulfilled</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Discount</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewingSO.items?.map(it => (
                      <tr key={it.id}>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {it.sku?.sku_name || it.sku?.product?.name || it.sku?.sku_code || 'Item'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {it.quantity_ordered}
                        </td>
                        <td className="px-3 py-2 text-right text-indigo-700 font-semibold">
                          {it.quantity_fulfilled || 0}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">
                          {formatCurrency(it.unit_price)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-rose-600">
                          -{formatCurrency(it.discount_amount)}
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
              <span className="font-semibold text-slate-600">Total Order Amount:</span>
              <span className="text-base font-bold text-indigo-800 font-mono">
                {formatCurrency(viewingSO.total_amount)}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setViewingSO(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
