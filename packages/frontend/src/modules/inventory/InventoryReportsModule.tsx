// ========================================================================
// Inventory Reports Module
// Real-time stock valuation, low stock replenishment alerts & audit reports
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Search,
  RefreshCw,
  Download,
  Building2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Package,
  Boxes,
  ShoppingBag,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { StockValuationReportItem, LowStockAlertItem, Location } from '../../types/index.js';
import { useCurrency, formatCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions } from '../../utils/locations.js';

export const InventoryReportsModule: React.FC<{ tabId?: string }> = () => {
  const { branches } = useAuth();
  const { openTab } = useWorkspace();
  const { symbol, format } = useCurrency();
  const [activeTab, setActiveTab] = useState<'valuation' | 'low_stock'>('valuation');

  const [valuationData, setValuationData] = useState<StockValuationReportItem[]>([]);
  const [lowStockData, setLowStockData] = useState<LowStockAlertItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [activeTab, selectedLocation]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (selectedLocation) params.location_id = selectedLocation;

      const locRes = await api.get<Location[]>('/locations').catch(() => branches || []);
      setLocations(locRes && locRes.length > 0 ? locRes : branches || []);

      if (activeTab === 'valuation') {
        const valRes = await api.get<StockValuationReportItem[]>('/inventory/reports/valuation', params);
        setValuationData(valRes || []);
      } else {
        const lowRes = await api.get<LowStockAlertItem[]>('/inventory/reports/low-stock', params);
        setLowStockData(lowRes || []);
      }
    } catch (err) {
      console.error('Failed to load inventory report data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export CSV Handler
  const exportValuationCsv = () => {
    if (valuationData.length === 0) return;
    const headers = [
      'SKU Code',
      'Barcode',
      'Product Name',
      'Category',
      'Location',
      'Quantity on Hand',
      'Cost Price',
      'Selling Price',
      'Cost Valuation',
      'Selling Valuation',
      'Stock Status',
    ];
    const rows = valuationData.map(v => [
      `"${v.sku_code}"`,
      `"${v.barcode || ''}"`,
      `"${v.product_name.replace(/"/g, '""')}"`,
      `"${v.category_name || ''}"`,
      `"${v.location_name}"`,
      v.quantity,
      v.cost_price,
      v.selling_price,
      v.total_cost_valuation,
      v.total_selling_valuation,
      `"${v.stock_status}"`,
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `stock_valuation_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportLowStockCsv = () => {
    if (lowStockData.length === 0) return;
    const headers = [
      'SKU Code',
      'Product Name',
      'Location',
      'Current Quantity',
      'Reorder Level',
      'Min Order Qty',
      'Cost Price',
      'Suggested Order Qty',
      'Estimated Replenishment Cost',
    ];
    const rows = lowStockData.map(l => [
      `"${l.sku_code}"`,
      `"${l.product_name.replace(/"/g, '""')}"`,
      `"${l.location_name}"`,
      l.current_quantity,
      l.reorder_level,
      l.min_order_qty,
      l.cost_price,
      l.suggested_order_qty,
      (l.suggested_order_qty * l.cost_price).toFixed(2),
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `low_stock_alerts_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics for Valuation
  const filteredValuation = valuationData.filter(v => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      v.sku_code.toLowerCase().includes(term) ||
      v.product_name.toLowerCase().includes(term) ||
      v.location_name.toLowerCase().includes(term) ||
      (v.category_name && v.category_name.toLowerCase().includes(term))
    );
  });

  const totalCostValuation = filteredValuation.reduce((sum, v) => sum + (v.total_cost_valuation || 0), 0);
  const totalSellingValuation = filteredValuation.reduce((sum, v) => sum + (v.total_selling_valuation || 0), 0);
  const totalValuationUnits = filteredValuation.reduce((sum, v) => sum + (v.quantity || 0), 0);
  const potentialMargin = totalSellingValuation - totalCostValuation;

  // Metrics for Low Stock
  const filteredLowStock = lowStockData.filter(l => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      l.sku_code.toLowerCase().includes(term) ||
      l.product_name.toLowerCase().includes(term) ||
      l.location_name.toLowerCase().includes(term)
    );
  });

  const totalSuggestedUnits = filteredLowStock.reduce((sum, l) => sum + (l.suggested_order_qty || 0), 0);
  const totalReplenishmentCost = filteredLowStock.reduce(
    (sum, l) => sum + (l.suggested_order_qty * (l.cost_price || 0)),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-brand-600" />
            Inventory & Order Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stock valuation, inventory balance sheets, margin analysis, and automated replenishment alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={activeTab === 'valuation' ? exportValuationCsv : exportLowStockCsv}
            disabled={activeTab === 'valuation' ? valuationData.length === 0 : lowStockData.length === 0}
          >
            <Download className="w-4 h-4 mr-1 text-brand-600" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('valuation')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'valuation'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Stock Valuation & Margin Report
        </button>
        <button
          onClick={() => setActiveTab('low_stock')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'low_stock'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Low Stock & Reorder Alerts ({lowStockData.length})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search by SKU code, product title, category, or branch..."
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

      {/* Valuation View */}
      {activeTab === 'valuation' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Stock Units</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{totalValuationUnits.toLocaleString()}</div>
              <div className="text-[11px] text-slate-400 mt-1">Across {filteredValuation.length} line items</div>
            </Card>
            <Card className="p-4 border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Asset Valuation (Cost)</div>
              <div className="text-2xl font-bold text-brand-700 mt-1">
                {format(totalCostValuation)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total investment on-hand</div>
            </Card>
            <Card className="p-4 border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Retail Valuation (Selling)</div>
              <div className="text-2xl font-bold text-indigo-700 mt-1">
                {format(totalSellingValuation)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Gross sales potential</div>
            </Card>
            <Card className="p-4 border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Margin Potential</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {format(potentialMargin)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {totalCostValuation > 0
                  ? `${((potentialMargin / totalCostValuation) * 100).toFixed(1)}% markup`
                  : '0% markup'}
              </div>
            </Card>
          </div>

          {/* Valuation Table */}
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
                    <th className="px-4 py-3 text-right">Cost Price</th>
                    <th className="px-4 py-3 text-right">Selling Price</th>
                    <th className="px-4 py-3 text-right">Total Cost Value</th>
                    <th className="px-4 py-3 text-right">Total Retail Value</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                        Generating stock valuation ledger report...
                      </td>
                    </tr>
                  ) : filteredValuation.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        No valuation records match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredValuation.map(row => (
                      <tr key={`${row.sku_id}-${row.location_id}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-900">
                          {row.sku_code}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.product_name}
                          {row.barcode && (
                            <span className="block text-[10px] text-slate-400 font-mono">
                              Barcode: {row.barcode}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {row.category_name || 'General'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {row.location_name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {row.quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          {format(row.cost_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          {format(row.selling_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-brand-800">
                          {format(row.total_cost_valuation)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {format(row.total_selling_valuation)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.stock_status === 'OUT_OF_STOCK' ? (
                            <Badge variant="danger">Out of Stock</Badge>
                          ) : row.stock_status === 'LOW_STOCK' ? (
                            <Badge variant="warning">Low Stock</Badge>
                          ) : (
                            <Badge variant="success">In Stock</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Low Stock View */}
      {activeTab === 'low_stock' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Critical Low Stock Items</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{filteredLowStock.length}</div>
              <div className="text-[11px] text-slate-400 mt-1">Below defined safety reorder thresholds</div>
            </Card>
            <Card className="p-4 border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Suggested Order Units</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{totalSuggestedUnits.toLocaleString()}</div>
              <div className="text-[11px] text-slate-400 mt-1">Recommended replenishment quantities</div>
            </Card>
            <Card className="p-4 border-slate-200">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimated Replenishment Cost</div>
              <div className="text-2xl font-bold text-brand-700 mt-1">
                {format(totalReplenishmentCost)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Based on standard supplier cost prices</div>
            </Card>
          </div>

          {/* Low Stock Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">SKU Code</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Branch Location</th>
                    <th className="px-4 py-3 text-right">Current Stock</th>
                    <th className="px-4 py-3 text-right">Reorder Point</th>
                    <th className="px-4 py-3 text-right">Min Order Qty</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                    <th className="px-4 py-3 text-right">Suggested Qty</th>
                    <th className="px-4 py-3 text-right">Estimated Cost</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-600" />
                        Scanning inventory stock thresholds...
                      </td>
                    </tr>
                  ) : filteredLowStock.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        Great job! No items are currently below their reorder threshold.
                      </td>
                    </tr>
                  ) : (
                    filteredLowStock.map(row => {
                      const estCost = row.suggested_order_qty * (row.cost_price || 0);

                      return (
                        <tr key={`${row.sku_id}-${row.location_id}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-medium text-slate-900">
                            {row.sku_code}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {row.product_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              {row.location_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                            {row.current_quantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">
                            {row.reorder_level}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">
                            {row.min_order_qty}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">
                            {format(row.cost_price)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-brand-800">
                            +{row.suggested_order_qty}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {format(estCost)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openTab('purchase_orders', 'Purchase Orders', 'ShoppingBag')}
                              title="Open Purchase Orders"
                            >
                              <ShoppingBag className="w-3.5 h-3.5 mr-1 text-brand-600" />
                              Order
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
