// ========================================================================
// Stock Ledger Module
// Append-only immutable movement audit trail and inventory transaction log
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Search,
  RefreshCw,
  Download,
  Building2,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { InventoryStockLedger, Location, StockMovementType } from '../../types/index.js';
import { useCurrency, formatCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions, formatLocationDisplay } from '../../utils/locations.js';

export const StockLedgerModule: React.FC<{ tabId?: string }> = () => {
  const { branches } = useAuth();
  const { symbol, format } = useCurrency();
  const [entries, setEntries] = useState<InventoryStockLedger[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const limit = 50;

  // Filters
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedMovement, setSelectedMovement] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    loadLedger();
  }, [selectedLocation, selectedMovement, startDate, endDate, page]);

  const loadLedger = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        limit,
        offset: page * limit,
      };
      if (selectedLocation) params.location_id = selectedLocation;
      if (selectedMovement) params.movement_type = selectedMovement;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const [ledgerRes, locRes] = await Promise.all([
        api.get<{ data: InventoryStockLedger[]; total: number }>('/inventory/ledger', params),
        api.get<Location[]>('/locations').catch(() => branches || []),
      ]);

      setEntries(ledgerRes?.data || []);
      setTotal(ledgerRes?.total || 0);
      setLocations(locRes && locRes.length > 0 ? locRes : branches || []);
    } catch (err) {
      console.error('Failed to load stock ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMovementBadge = (type: StockMovementType) => {
    switch (type) {
      case 'OPENING':
        return <Badge variant="primary">Opening</Badge>;
      case 'STOCK_IN':
      case 'PURCHASE_RECEIPT':
      case 'ADJUSTMENT_IN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
            {type.replace('_', ' ')}
          </span>
        );
      case 'STOCK_OUT':
      case 'SALES_FULFILLMENT':
      case 'ADJUSTMENT_OUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
            <ArrowUpRight className="w-3 h-3 text-rose-600" />
            {type.replace('_', ' ')}
          </span>
        );
      default:
        return <Badge variant="slate">{type}</Badge>;
    }
  };

  const exportToCsv = () => {
    if (entries.length === 0) return;
    const headers = [
      'Date & Time',
      'Movement Type',
      'Reference Type',
      'SKU Code',
      'Product Name',
      'Location',
      'Quantity Change',
      'Previous Balance',
      'New Balance',
      'Unit Cost',
      'Total Value',
      'Notes',
    ];

    const rows = entries.map(e => [
      `"${new Date(e.created_at).toLocaleString()}"`,
      `"${e.movement_type}"`,
      `"${e.reference_type}"`,
      `"${e.sku?.sku_code || ''}"`,
      `"${(e.sku?.product?.name || '').replace(/"/g, '""')}"`,
      `"${formatLocationDisplay(e.location).replace(/"/g, '""')}"`,
      e.quantity,
      e.previous_balance,
      e.new_balance,
      e.unit_cost,
      (e.quantity * (e.unit_cost || 0)).toFixed(2),
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventory_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEntries = entries.filter(e => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const skuCode = e.sku?.sku_code?.toLowerCase() || '';
    const prodName = e.sku?.product?.name?.toLowerCase() || '';
    const locName = (e.location?.location_name || e.location?.name || '').toLowerCase();
    const notes = e.notes?.toLowerCase() || '';
    return skuCode.includes(term) || prodName.includes(term) || locName.includes(term) || notes.includes(term);
  });

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-brand-600" />
            Stock Ledger & Movement History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete, immutable financial and physical movement audit trail of all warehouse inventory transactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToCsv} disabled={entries.length === 0}>
            <Download className="w-4 h-4 mr-1 text-brand-600" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadLedger} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search</label>
            <Input
              placeholder="Search SKU code, product, notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Branch / Location</label>
            <Select
              value={selectedLocation}
              onChange={e => {
                setSelectedLocation(e.target.value);
                setPage(0);
              }}
              options={getLocationSelectOptions(locations, { includeAll: true, allLabel: 'All Branches' })}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Movement Type</label>
            <Select
              value={selectedMovement}
              onChange={e => {
                setSelectedMovement(e.target.value);
                setPage(0);
              }}
              options={[
                { value: '', label: 'All Movement Types' },
                { value: 'OPENING', label: 'Opening Stock' },
                { value: 'STOCK_IN', label: 'Stock In (Direct)' },
                { value: 'PURCHASE_RECEIPT', label: 'Purchase Receipt' },
                { value: 'STOCK_OUT', label: 'Stock Out (Direct)' },
                { value: 'SALES_FULFILLMENT', label: 'Sales Fulfillment' },
                { value: 'ADJUSTMENT_IN', label: 'Adjustment In (+)' },
                { value: 'ADJUSTMENT_OUT', label: 'Adjustment Out (-)' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Ledger Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Movement Type</th>
                <th className="px-4 py-3">SKU & Item</th>
                <th className="px-4 py-3">Branch Location</th>
                <th className="px-4 py-3 text-right">Qty Change</th>
                <th className="px-4 py-3 text-right">Prev Balance</th>
                <th className="px-4 py-3 text-right">New Balance</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-right">Txn Value</th>
                <th className="px-4 py-3">Reference / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    Querying immutable ledger trail...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No ledger entries match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => {
                  const isPositive = [
                    'STOCK_IN',
                    'PURCHASE_RECEIPT',
                    'ADJUSTMENT_IN',
                    'OPENING',
                  ].includes(entry.movement_type);

                  const txnVal = Math.abs(entry.quantity) * (entry.unit_cost || 0);

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {getMovementBadge(entry.movement_type)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-slate-900 block">
                          {entry.sku?.sku_code || '—'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {entry.sku?.sku_name || entry.sku?.product?.name || 'Item'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {formatLocationDisplay(entry.location)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
                          {isPositive ? `+${entry.quantity}` : `-${entry.quantity}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500">
                        {entry.previous_balance.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {entry.new_balance.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {format(entry.unit_cost || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {format(txnVal)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                        {entry.notes || entry.reference_type}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
          <div>
            Showing <span className="font-bold">{entries.length}</span> of{' '}
            <span className="font-bold">{total}</span> total ledger logs
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Prev
            </Button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page + 1 >= totalPages || loading}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
