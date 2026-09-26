// ========================================================================
// Asset Management Dashboard Module
// Real-time KPI metrics, condition breakdown, capital asset valuation,
// warranty alerts, and quick action launchpad for School Assets
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  ShieldCheck,
  UserCheck,
  Wrench,
  AlertTriangle,
  Clock,
  IndianRupee,
  RefreshCw,
  Plus,
  ArrowRight,
  Building2,
  FileSpreadsheet,
  Layers,
  ArrowLeftRight,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { api } from '../../api/client.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { useCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions } from '../../utils/locations.js';
import { AssetDashboardMetrics, Location } from '../../types/index.js';

export const AssetDashboardModule: React.FC<{ tabId?: string }> = () => {
  const { openTab } = useWorkspace();
  const { symbol, format } = useCurrency();

  const [metrics, setMetrics] = useState<AssetDashboardMetrics | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [selectedLocation]);

  const loadLocations = async () => {
    try {
      const data = await api.get<Location[]>('/locations');
      setLocations(data || []);
    } catch (err) {
      console.error('Failed to load locations', err);
    }
  };

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await api.get<AssetDashboardMetrics>('/assets/dashboard', {
        location_id: selectedLocation || undefined,
      });
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load asset dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  const locationOptions = getLocationSelectOptions(locations, {
    includeAll: true,
    allLabel: 'All School Campuses & Branches',
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Asset Management Overview</h1>
            <Badge variant="indigo">Fixed Assets</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time physical asset registers, custody assignments, preventative maintenance & valuations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Select
              options={locationOptions}
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            />
          </div>

          <Button variant="outline" onClick={loadMetrics} disabled={loading} title="Refresh metrics">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            onClick={() => openTab('assets_master', 'Asset Master Register', 'Boxes')}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Register Asset
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assets */}
        <Card className="p-5 border-l-4 border-l-blue-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Assets</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : (metrics?.total_assets ?? 0).toLocaleString()}
              </h3>
              <p className="text-xs text-gray-500 mt-1">Active inventory in master</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Boxes className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Assigned Assets */}
        <Card className="p-5 border-l-4 border-l-indigo-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">In Custody / Assigned</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : (metrics?.assigned_assets ?? 0).toLocaleString()}
              </h3>
              <p className="text-xs text-indigo-600 font-medium mt-1">
                {metrics && metrics.total_assets > 0
                  ? `${Math.round(((metrics.assigned_assets || 0) / metrics.total_assets) * 100)}% utilization`
                  : '0% utilization'}
              </p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Maintenance / Service */}
        <Card className="p-5 border-l-4 border-l-amber-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Under Service</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : (metrics?.under_maintenance ?? 0).toLocaleString()}
              </h3>
              <p className="text-xs text-amber-600 font-medium mt-1">
                {(metrics?.maintenance_due ?? 0)} pending jobs
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Wrench className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Total Capital Valuation */}
        <Card className="p-5 border-l-4 border-l-emerald-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Acquisition Value</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : format(metrics?.total_acquisition_value || 0)}
              </h3>
              <p className="text-xs text-emerald-600 font-medium mt-1">Total capitalization</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <IndianRupee className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Secondary Quick Alert Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-amber-900">
              {metrics?.warranty_expiring_soon ?? 0} Assets
            </div>
            <div className="text-xs text-amber-700">Warranty expiring in next 30 days</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-rose-50/70 border border-rose-200/80 rounded-xl">
          <div className="p-2.5 bg-rose-100 text-rose-700 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-rose-900">
              {(metrics?.damaged_assets ?? 0) + (metrics?.lost_assets ?? 0)} Problem Assets
            </div>
            <div className="text-xs text-rose-700">Damaged, missing, or critical condition</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-blue-900">
              {metrics?.available_assets ?? 0} Available in Pool
            </div>
            <div className="text-xs text-blue-700">Ready for instant assignment/deployment</div>
          </div>
        </div>
      </div>

      {/* Breakdown Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories Breakdown */}
        <Card className="p-5 col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-900">Asset Categories & Capital Distribution</h3>
              <p className="text-xs text-gray-500">Distribution across major school asset classifications</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openTab('assets_categories', 'Categories & Taxonomy', 'FolderTree')}
            >
              Manage Categories <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          <div className="space-y-4">
            {metrics?.by_category && metrics.by_category.length > 0 ? (
              metrics.by_category.map((cat) => {
                const percent = metrics.total_acquisition_value > 0
                  ? Math.round((cat.value / metrics.total_acquisition_value) * 100)
                  : 0;
                return (
                  <div key={cat.category_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-800">{cat.category_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{cat.count} units</span>
                        <span className="font-semibold text-gray-900">{format(cat.value)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-brand-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(percent, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No asset category data recorded.</p>
            )}
          </div>
        </Card>

        {/* Quick Launchpad & Operational Shortcuts */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Operational Launchpad</h3>
            <p className="text-xs text-gray-500 mb-4">Direct shortcuts to daily asset workflows</p>

            <div className="space-y-2.5">
              <button
                onClick={() => openTab('assets_assignment', 'Custody & Assignment', 'UserCheck')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-md">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Custody & Assignment</div>
                    <div className="text-xs text-gray-500">Issue or return staff & lab assets</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => openTab('assets_movement', 'Relocation & Transfers', 'ArrowLeftRight')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-md">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Inter-Branch Movement</div>
                    <div className="text-xs text-gray-500">Relocate between campuses or rooms</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => openTab('assets_maintenance', 'Service & Maintenance', 'Wrench')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-md">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Service & Maintenance</div>
                    <div className="text-xs text-gray-500">Log repairs, servicing & coolant checks</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => openTab('assets_reports', 'Asset Audit Reports', 'FileSpreadsheet')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-md">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Asset Audit Registers</div>
                    <div className="text-xs text-gray-500">Export master asset register to CSV</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500 text-center">
            Multi-tenant data isolated for School Tenant
          </div>
        </Card>
      </div>

      {/* Location Distribution */}
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Campus & Location Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics?.by_location && metrics.by_location.length > 0 ? (
            metrics.by_location.map((loc) => (
              <div
                key={loc.location_id}
                className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-white hover:border-blue-200 transition-all cursor-pointer"
                onClick={() => {
                  setSelectedLocation(loc.location_id);
                }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900 text-sm truncate">{loc.location_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>{loc.count} units placed</span>
                  <span className="font-semibold text-gray-800">{format(loc.value)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 col-span-3 text-center py-4">No campus placement data found.</p>
          )}
        </div>
      </Card>
    </div>
  );
};
