// ========================================================================
// Inventory Dashboard Module
// High-Level KPIs, Stock Valuation, Low Stock & Out of Stock Alerts,
// Movement Trends and Quick Action Workflows
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  TrendingDown,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { api } from '../../api/client.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { InventoryDashboardStats, LowStockAlertItem } from '../../types/index.js';
import { useCurrency, formatCurrency } from '../../utils/currency.js';

interface InventoryDashboardModuleProps {
  tabId?: string;
}

export const InventoryDashboardModule: React.FC<InventoryDashboardModuleProps> = () => {
  const { openTab } = useWorkspace();
  const { symbol, format } = useCurrency();
  const [stats, setStats] = useState<InventoryDashboardStats | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [statsRes, alertsRes] = await Promise.all([
        api.get<InventoryDashboardStats>('/inventory/dashboard'),
        api.get<LowStockAlertItem[]>('/inventory/reports/low-stock'),
      ]);
      if (statsRes) setStats(statsRes);
      if (alertsRes) setLowStockAlerts(alertsRes.slice(0, 5));
    } catch (err) {
      console.error('Failed to load inventory dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'OPENING':
        return <Badge variant="slate">Opening</Badge>;
      case 'PURCHASE_RECEIPT':
      case 'STOCK_IN':
      case 'ADJUSTMENT_IN':
        return <Badge variant="emerald">Stock In</Badge>;
      case 'SALES_FULFILLMENT':
      case 'STOCK_OUT':
      case 'ADJUSTMENT_OUT':
        return <Badge variant="amber">Stock Out</Badge>;
      default:
        return <Badge variant="slate">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-brand-600 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading Inventory Intelligence...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Inventory & Order Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stock valuation, multi-branch tracking, purchase receipts, and order fulfillment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openTab('purchase_orders', 'Purchase Orders', 'ShoppingCart')}
            className="text-xs gap-1.5"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" />
            Purchase Orders
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openTab('sales_orders', 'Sales Orders', 'Receipt')}
            className="text-xs gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5 text-brand-600" />
            Sales Orders
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => openTab('inventory_stock_in', 'Stock In', 'ArrowDownLeft')}
            className="text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Receive Stock
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Products / SKUs</span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats?.total_products || 0}{' '}
            <span className="text-xs font-normal text-slate-400">/ {stats?.total_skus || 0} SKUs</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-brand-600">
            <span>{stats?.total_stock_units || 0} Total Units on Hand</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Stock Valuation</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {format(stats?.total_stock_valuation || 0)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-indigo-600">
            <span>Cost basis inventory value</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Low Stock / Out of Stock</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats?.low_stock_count || 0}{' '}
            <span className="text-xs font-normal text-rose-500">
              ({stats?.out_of_stock_count || 0} Out of Stock)
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
            <span>At or below reorder threshold</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending Orders</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats?.pending_pos_count || 0} POs{' '}
            <span className="text-xs font-normal text-slate-400">/ {stats?.pending_sos_count || 0} SOs</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-purple-600">
            <span>Awaiting receipt or fulfillment</span>
          </div>
        </Card>
      </div>

      {/* Main Grid: Reorder Alerts + Recent Movement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5 bg-white border border-slate-200/80 rounded-xl shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Low Stock Warnings</h3>
              </div>
              <button
                onClick={() => openTab('inventory_reports', 'Inventory Reports', 'FileSpreadsheet')}
                className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
              >
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {lowStockAlerts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">All SKUs healthy above reorder point</div>
              ) : (
                lowStockAlerts.map((alert) => (
                  <div key={alert.sku_id + alert.location_id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{alert.product_name}</div>
                      <div className="text-[11px] text-slate-400">
                        {alert.sku_code} • {alert.location_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-rose-600">{alert.current_quantity} left</div>
                      <div className="text-[10px] text-slate-400">Reorder at {alert.reorder_point}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Category Distribution */}
          <Card className="p-5 bg-white border border-slate-200/80 rounded-xl shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100">
              Top Categories
            </h3>
            <div className="mt-3 space-y-2">
              {stats?.top_categories?.map((cat) => (
                <div key={cat.name} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-slate-600 font-medium">{cat.name}</span>
                  <Badge variant="primary">{cat.count} products</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent Stock Ledger Movements */}
        <div className="lg:col-span-2">
          <Card className="p-5 bg-white border border-slate-200/80 rounded-xl shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Stock Movements</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Immutable audit trail of physical changes</p>
              </div>
              <button
                onClick={() => openTab('inventory_stock_ledger', 'Stock Ledger', 'ClipboardList')}
                className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
              >
                Full Ledger <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-semibold">
                    <th className="py-2.5">Date & Time</th>
                    <th className="py-2.5">SKU / Item</th>
                    <th className="py-2.5">Type</th>
                    <th className="py-2.5 text-right">Quantity</th>
                    <th className="py-2.5 text-right">New Balance</th>
                    <th className="py-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats?.recent_activities?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No recent movements logged today
                      </td>
                    </tr>
                  ) : (
                    stats?.recent_activities?.map((act) => {
                      const isPositive = Number(act.quantity) > 0;
                      return (
                        <tr key={act.id} className="hover:bg-slate-50/60">
                          <td className="py-2 text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(act.created_at).toLocaleDateString()} {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2">
                            <span className="font-semibold text-slate-800">{act.sku?.sku_code || 'SKU'}</span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                              {act.sku?.sku_name || act.sku?.product?.name || 'Item'}
                            </span>
                          </td>
                          <td className="py-2">{getMovementBadge(act.movement_type)}</td>
                          <td className="py-2 text-right font-bold">
                            <span className={isPositive ? 'text-emerald-600' : 'text-amber-600'}>
                              {isPositive ? `+${act.quantity}` : act.quantity}
                            </span>
                          </td>
                          <td className="py-2 text-right font-medium text-slate-700">{act.new_balance}</td>
                          <td className="py-2 text-[11px] text-slate-500 truncate max-w-[160px]">
                            {act.notes || '—'}
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
      </div>
    </div>
  );
};
