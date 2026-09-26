// ========================================================================
// Opening Stock Module
// Initialize and record starting stock quantities per SKU and Location
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  RefreshCw,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { InventoryStockBalance, SKU, Location } from '../../types/index.js';
import { useCurrency, formatCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions, formatLocationDisplay } from '../../utils/locations.js';

export const OpeningStockModule: React.FC<{ tabId?: string }> = () => {
  const { branches } = useAuth();
  const { symbol, format } = useCurrency();
  const [stocks, setStocks] = useState<InventoryStockBalance[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalLocationId, setModalLocationId] = useState<string>('');
  const [modalSkuId, setModalSkuId] = useState<string>('');
  const [modalQuantity, setModalQuantity] = useState<string>('0');
  const [modalUnitCost, setModalUnitCost] = useState<string>('0');
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

      const [stockRes, skuRes, locRes] = await Promise.all([
        api.get<InventoryStockBalance[]>('/inventory/stock', params),
        api.get<SKU[]>('/inventory/skus', { status: 'ACTIVE' }),
        api.get<Location[]>('/locations').catch(() => branches || []),
      ]);

      setStocks(stockRes || []);
      setSkus(skuRes || []);
      setLocations(locRes && locRes.length > 0 ? locRes : branches || []);
    } catch (err) {
      console.error('Failed to load stock data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    const activeLocs = locations.filter(l => l.status === 'ACTIVE' || !l.status);
    const defaultLoc = (selectedLocation && activeLocs.some(l => l.id === selectedLocation))
      ? selectedLocation
      : (activeLocs[0]?.id || locations[0]?.id || '');
    setModalLocationId(defaultLoc);
    setModalSkuId(skus[0]?.id || '');
    setModalQuantity('100');
    setModalUnitCost(skus[0]?.cost_price?.toString() || '0');
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  };

  const handleSkuChange = (skuId: string) => {
    setModalSkuId(skuId);
    const selected = skus.find(s => s.id === skuId);
    if (selected && selected.cost_price) {
      setModalUnitCost(selected.cost_price.toString());
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');

      if (!modalLocationId) {
        setErrorMsg('Please select a storage branch / location');
        return;
      }
      if (!modalSkuId) {
        setErrorMsg('Please select a SKU item');
        return;
      }
      const qtyNum = parseFloat(modalQuantity);
      if (isNaN(qtyNum) || qtyNum < 0) {
        setErrorMsg('Quantity must be a valid non-negative number');
        return;
      }
      const costNum = parseFloat(modalUnitCost) || 0;

      await api.post('/inventory/opening-stock', {
        location_id: modalLocationId,
        sku_id: modalSkuId,
        quantity: qtyNum,
        unit_cost: costNum,
      });

      setSuccessMsg('Opening stock balance recorded and ledger updated successfully.');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to set opening stock');
    } finally {
      setSaving(false);
    }
  };

  const filteredStocks = stocks.filter(s => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const code = s.sku?.sku_code?.toLowerCase() || '';
    const name = s.sku?.product?.name?.toLowerCase() || '';
    const barcode = s.sku?.barcode?.toLowerCase() || '';
    const loc = (s.location?.location_name || s.location?.name || '').toLowerCase();
    return code.includes(term) || name.includes(term) || barcode.includes(term) || loc.includes(term);
  });

  const totalUnits = filteredStocks.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const totalValuation = filteredStocks.reduce((sum, s) => sum + ((s.quantity || 0) * (s.sku?.cost_price || 0)), 0);
  const lowStockCount = filteredStocks.filter(s => (s.sku?.reorder_level || 0) > 0 && s.quantity <= (s.sku?.reorder_level || 0)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-brand-600" />
            Stock Balances & Opening Stock
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Initialize opening inventory balances per branch and inspect live multi-location stock levels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={openModal}>
            <Plus className="w-4 h-4 mr-1" />
            Set Opening Stock
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Stock Units</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalUnits.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Across all matching balances</div>
        </Card>
        <Card className="p-4 border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Valuation (Cost)</div>
          <div className="text-2xl font-bold text-brand-700 mt-1">{format(totalValuation)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Estimated asset inventory value</div>
        </Card>
        <Card className="p-4 border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock SKUs</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{lowStockCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Below defined reorder levels</div>
        </Card>
        <Card className="p-4 border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Keeping Records</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{filteredStocks.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Active branch-SKU pairs</div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search by SKU code, product title, barcode, or location..."
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

      {/* Stock Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">SKU Code</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Branch Location</th>
                <th className="px-4 py-3 text-right">On Hand Qty</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-right">Total Valuation</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading stock records...
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No stock balances found matching your criteria. Click "Set Opening Stock" to initialize items.
                  </td>
                </tr>
              ) : (
                filteredStocks.map(stock => {
                  const sku = stock.sku;
                  const prod = sku?.product;
                  const available = (stock.quantity || 0) - (stock.reserved_quantity || 0);
                  const isLow = (sku?.reorder_level || 0) > 0 && stock.quantity <= (sku?.reorder_level || 0);
                  const isOut = stock.quantity <= 0;
                  const cost = sku?.cost_price || 0;
                  const val = stock.quantity * cost;

                  return (
                    <tr key={stock.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">
                        {sku?.sku_code || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {sku?.sku_name || prod?.name || '—'}
                        {sku?.barcode && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            UPC/Barcode: {sku.barcode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {prod?.category?.name || 'General'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-slate-800 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {formatLocationDisplay(stock.location)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {stock.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 font-medium">
                        {stock.reserved_quantity?.toLocaleString() || 0}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-brand-700">
                        {available.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">
                        {format(cost)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                        {format(val)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isOut ? (
                          <Badge variant="danger">Out of Stock</Badge>
                        ) : isLow ? (
                          <Badge variant="warning">Low Stock</Badge>
                        ) : (
                          <Badge variant="success">In Stock</Badge>
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

      {/* Opening Stock Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Set / Initialize Opening Stock"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Branch / Storage Location <span className="text-rose-500">*</span>
            </label>
            <Select
              value={modalLocationId}
              onChange={e => setModalLocationId(e.target.value)}
              options={getLocationSelectOptions(locations, { activeOnly: true })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Item / SKU <span className="text-rose-500">*</span>
            </label>
            <Select
              value={modalSkuId}
              onChange={e => handleSkuChange(e.target.value)}
              options={skus.map(s => ({
                value: s.id,
                label: `${s.sku_code} - ${s.sku_name || s.product?.name || 'Item'} (${s.uom?.code || s.product?.uom?.code || 'units'})`,
              }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Opening Quantity <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                value={modalQuantity}
                onChange={e => setModalQuantity(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit Cost ({symbol})
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                value={modalUnitCost}
                onChange={e => setModalUnitCost(e.target.value)}
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
            <p className="font-semibold text-slate-800 mb-1">Audit Trail & Invariant Compliance:</p>
            Recording opening stock will atomically set the balance at the selected location and record an immutable ledger entry of type <code className="bg-slate-200 px-1 py-0.5 rounded text-brand-800 font-mono">OPENING</code>.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Recording Stock...' : 'Save Opening Stock'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
