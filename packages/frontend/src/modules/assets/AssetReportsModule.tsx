// ========================================================================
// Asset Reports & Audit Registers Module
// Tabbed audit reports: Master Asset Register, Custody Ledger, Maintenance Cost
// Breakdown, Warranty Expiration Schedule, and Disposals with CSV Export
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Calendar,
  Building2,
  Boxes,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { api } from '../../api/client.js';
import { useCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions, formatLocationDisplay } from '../../utils/locations.js';
import {
  Asset,
  AssetAssignment,
  AssetMaintenance,
  AssetDisposal,
  Location,
} from '../../types/index.js';

type ReportTab = 'master' | 'custody' | 'maintenance' | 'warranty' | 'disposals';

export const AssetReportsModule: React.FC<{ tabId?: string }> = () => {
  const { symbol, format } = useCurrency();

  const [activeTab, setActiveTab] = useState<ReportTab>('master');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Data sets
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [maintenance, setMaintenance] = useState<AssetMaintenance[]>([]);
  const [disposals, setDisposals] = useState<AssetDisposal[]>([]);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadReportData();
  }, [selectedLocation]);

  const loadLocations = async () => {
    try {
      const data = await api.get<Location[]>('/locations');
      setLocations(data || []);
    } catch (err) {
      console.error('Failed to load locations', err);
    }
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [assetsData, asgData, maintData, dispData] = await Promise.all([
        api.get<Asset[]>('/assets/assets', { location_id: selectedLocation || undefined }),
        api.get<AssetAssignment[]>('/assets/assignments'),
        api.get<AssetMaintenance[]>('/assets/maintenance'),
        api.get<AssetDisposal[]>('/assets/disposals'),
      ]);
      setAssets(assetsData || []);
      setAssignments(asgData || []);
      setMaintenance(maintData || []);
      setDisposals(dispData || []);
    } catch (err) {
      console.error('Failed to load asset report datasets', err);
    } finally {
      setLoading(false);
    }
  };

  // CSV Export utility
  const exportToCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `asset_report_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;

    if (activeTab === 'master') {
      headers = ['Asset Code', 'Asset Name', 'Category', 'Branch', 'Room', 'Condition', 'Status', 'Purchase Date', 'Cost', 'Warranty End'];
      rows = assets.map((a) => [
        a.asset_code,
        `"${a.asset_name.replace(/"/g, '""')}"`,
        a.category?.name || 'Uncategorized',
        formatLocationDisplay(a.location),
        a.room_number || a.room || '',
        a.condition,
        a.status,
        a.purchase_date || '',
        a.purchase_price || 0,
        a.warranty_end_date || '',
      ]);
    } else if (activeTab === 'custody') {
      headers = ['Asset Code', 'Asset Name', 'Custodian', 'Email', 'Branch', 'Issue Date', 'Expected Return', 'Condition', 'Status'];
      rows = assignments.map((asg) => [
        asg.asset?.asset_code || '',
        `"${(asg.asset?.asset_name || '').replace(/"/g, '""')}"`,
        `"${asg.assigned_to_user?.first_name || ''} ${asg.assigned_to_user?.last_name || ''}"`,
        asg.assigned_to_user?.email || '',
        formatLocationDisplay(asg.location || asg.asset?.location),
        asg.assignment_date,
        asg.expected_return_date || '',
        asg.condition_at_assignment,
        asg.is_active ? 'ACTIVE' : 'RETURNED',
      ]);
    } else if (activeTab === 'maintenance') {
      headers = ['Asset Code', 'Asset Name', 'Service Type', 'Date', 'Vendor / Technician', 'Issue Description', 'Work Performed', 'Cost', 'Status'];
      rows = maintenance.map((m) => [
        m.asset?.asset_code || '',
        `"${(m.asset?.asset_name || '').replace(/"/g, '""')}"`,
        m.maintenance_type,
        m.service_date,
        `"${m.vendor?.name || m.service_provider || 'In-House'}"`,
        `"${(m.issue_description || '').replace(/"/g, '""')}"`,
        `"${(m.work_performed || '').replace(/"/g, '""')}"`,
        m.cost || 0,
        m.status,
      ]);
    } else if (activeTab === 'warranty') {
      headers = ['Asset Code', 'Asset Name', 'Category', 'Branch', 'Vendor', 'Warranty End Date', 'Status'];
      rows = assets.filter((a) => a.warranty_end_date).map((a) => [
        a.asset_code,
        `"${a.asset_name.replace(/"/g, '""')}"`,
        a.category?.name || '',
        formatLocationDisplay(a.location),
        a.vendor?.name || '',
        a.warranty_end_date || '',
        a.status,
      ]);
    } else if (activeTab === 'disposals') {
      headers = ['Asset Code', 'Asset Name', 'Disposal Date', 'Method', 'Reason', 'Recovery Value', 'Approver'];
      rows = disposals.map((d) => [
        d.asset?.asset_code || '',
        `"${(d.asset?.asset_name || '').replace(/"/g, '""')}"`,
        d.disposal_date,
        d.disposal_method,
        `"${(d.disposal_reason || '').replace(/"/g, '""')}"`,
        d.disposal_value || 0,
        `"${d.approved_by_user?.first_name || ''} ${d.approved_by_user?.last_name || ''}"`,
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const locationOptions = getLocationSelectOptions(locations, {
    includeAll: true,
    allLabel: 'All Campuses & Branches',
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Asset Audit Reports & Registers</h1>
            <Badge variant="indigo">Compliance</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Authoritative registers for CBSE physical audit compliance, custody verification, and annual valuation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadReportData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {[
          { id: 'master', label: 'Master Asset Register' },
          { id: 'custody', label: 'Custody & Assignment Ledger' },
          { id: 'maintenance', label: 'Service & Maintenance Cost' },
          { id: 'warranty', label: 'Warranty Expiration Register' },
          { id: 'disposals', label: 'Scrapped & Disposed Assets' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ReportTab)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search report entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="w-full sm:w-72">
          <Select
            options={locationOptions}
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          />
        </div>
      </Card>

      {/* Report Table Display */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'master' && (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Asset Code</th>
                  <th className="py-3 px-4">Name / Model</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Branch Placement</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Purchase Price</th>
                  <th className="py-3 px-4 text-right">Warranty Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assets.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/70">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-600">{a.asset_code}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{a.asset_name}</div>
                      <div className="text-xs text-gray-400">{a.brand} {a.model}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">{a.category?.name || 'Uncategorized'}</td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-800">
                      {formatLocationDisplay(a.location)} ({a.room_number || a.room || 'Store'})
                    </td>
                    <td className="py-3 px-4 text-xs font-medium">{a.condition}</td>
                    <td className="py-3 px-4 text-xs">
                      <Badge variant={a.status === 'AVAILABLE' ? 'success' : a.status === 'ASSIGNED' ? 'indigo' : 'warning'}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900 text-xs">{format(a.purchase_price)}</td>
                    <td className="py-3 px-4 text-xs text-right font-medium text-gray-700">{a.warranty_end_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'custody' && (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Asset Code & Item</th>
                  <th className="py-3 px-4">Custodian User</th>
                  <th className="py-3 px-4">Branch Placement</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Expected Return</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4 text-right">Custody State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map((asg) => (
                  <tr key={asg.id} className="hover:bg-gray-50/70">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{asg.asset?.asset_name}</div>
                      <div className="text-xs font-mono text-blue-600">{asg.asset?.asset_code}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">
                        {asg.assigned_to_user?.first_name} {asg.assigned_to_user?.last_name}
                      </div>
                      <div className="text-xs text-gray-400">{asg.assigned_to_user?.email}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-800">
                      {formatLocationDisplay(asg.location || asg.asset?.location)}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium">{asg.assignment_date}</td>
                    <td className="py-3 px-4 text-xs text-gray-600">{asg.expected_return_date || 'Open-ended'}</td>
                    <td className="py-3 px-4 text-xs font-medium">{asg.condition_at_assignment}</td>
                    <td className="py-3 px-4 text-right">
                      <Badge variant={asg.is_active ? 'indigo' : 'slate'}>
                        {asg.is_active ? 'Active Custody' : 'Returned'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'maintenance' && (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Asset Code & Item</th>
                  <th className="py-3 px-4">Maintenance Type</th>
                  <th className="py-3 px-4">Service Date</th>
                  <th className="py-3 px-4">Contractor / Technician</th>
                  <th className="py-3 px-4">Issue Description</th>
                  <th className="py-3 px-4">Cost Incurred</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {maintenance.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/70">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{m.asset?.asset_name}</div>
                      <div className="text-xs font-mono text-blue-600">{m.asset?.asset_code}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-800">{m.maintenance_type}</td>
                    <td className="py-3 px-4 text-xs">{m.service_date}</td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-700">
                      {m.vendor?.name || m.service_provider || 'In-House'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-700 max-w-xs truncate">{m.issue_description}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900 text-xs">{format(m.cost)}</td>
                    <td className="py-3 px-4 text-right">
                      <Badge variant={m.status === 'COMPLETED' ? 'success' : 'warning'}>{m.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'warranty' && (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Asset Code & Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Branch Placement</th>
                  <th className="py-3 px-4">Supplier / Vendor</th>
                  <th className="py-3 px-4">Purchase Date</th>
                  <th className="py-3 px-4">Warranty End Date</th>
                  <th className="py-3 px-4 text-right">Coverage Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assets
                  .filter((a) => a.warranty_end_date)
                  .map((a) => {
                    const isExpired = new Date(a.warranty_end_date!) < new Date();
                    return (
                      <tr key={a.id} className="hover:bg-gray-50/70">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900">{a.asset_name}</div>
                          <div className="text-xs font-mono text-blue-600">{a.asset_code}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">{a.category?.name}</td>
                        <td className="py-3 px-4 text-xs font-medium text-gray-800">
                          {formatLocationDisplay(a.location)}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-700">{a.vendor?.name || 'OEM Direct'}</td>
                        <td className="py-3 px-4 text-xs">{a.purchase_date || '—'}</td>
                        <td className="py-3 px-4 text-xs font-semibold text-gray-900">{a.warranty_end_date}</td>
                        <td className="py-3 px-4 text-right">
                          <Badge variant={isExpired ? 'danger' : 'success'}>
                            {isExpired ? 'Expired' : 'Active OEM Coverage'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {activeTab === 'disposals' && (
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Asset Code & Item</th>
                  <th className="py-3 px-4">Decommission Date</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Recovery Value</th>
                  <th className="py-3 px-4 text-right">Approver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {disposals.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/70">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{d.asset?.asset_name}</div>
                      <div className="text-xs font-mono text-rose-600">{d.asset?.asset_code}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-800">{d.disposal_date}</td>
                    <td className="py-3 px-4 text-xs">
                      <Badge variant="slate">{d.disposal_method.replace('_', ' ')}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-700 max-w-sm truncate">{d.disposal_reason}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900 text-xs">{format(d.disposal_value)}</td>
                    <td className="py-3 px-4 text-xs text-right font-medium text-gray-700">
                      {d.approved_by_user ? `${d.approved_by_user.first_name} ${d.approved_by_user.last_name}` : 'Authorized Approver'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};
