// ========================================================================
// Asset Maintenance & Service Lifecycle Module
// Schedule preventative overhauls, repair servicing, vendor cost tracking,
// and completion workflows that restore assets to service
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  CheckCircle2,
  RefreshCw,
  Search,
  Calendar,
  AlertCircle,
  IndianRupee,
  Clock,
  ShieldCheck,
  Boxes,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useCurrency } from '../../utils/currency.js';
import { Asset, AssetMaintenance, AssetCondition, InventoryVendor } from '../../types/index.js';

export const AssetMaintenanceModule: React.FC<{ tabId?: string }> = () => {
  const { symbol, format } = useCurrency();

  const [records, setRecords] = useState<AssetMaintenance[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Schedule Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [maintenanceType, setMaintenanceType] = useState<string>('PREVENTIVE');
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [vendorId, setVendorId] = useState<string>('');
  const [serviceProvider, setServiceProvider] = useState<string>('');
  const [issueDescription, setIssueDescription] = useState<string>('');
  const [cost, setCost] = useState<string>('0');
  const [warrantyClaim, setWarrantyClaim] = useState<boolean>(false);
  const [scheduling, setScheduling] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string>('');

  // Complete Modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState<boolean>(false);
  const [targetRecord, setTargetRecord] = useState<AssetMaintenance | null>(null);
  const [workPerformed, setWorkPerformed] = useState<string>('');
  const [finalCost, setFinalCost] = useState<string>('0');
  const [nextServiceDate, setNextServiceDate] = useState<string>('');
  const [finalCondition, setFinalCondition] = useState<AssetCondition>('GOOD');
  const [completeRemarks, setCompleteRemarks] = useState<string>('');
  const [completing, setCompleting] = useState<boolean>(false);
  const [completeError, setCompleteError] = useState<string>('');

  useEffect(() => {
    loadPrerequisites();
    loadRecords();
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [assetsData, vendorsData] = await Promise.all([
        api.get<Asset[]>('/assets/assets'),
        api.get<InventoryVendor[]>('/inventory/vendors').catch(() => []),
      ]);
      setAssets(assetsData || []);
      setVendors(vendorsData || []);
    } catch (err) {
      console.error('Failed to load assets or vendors', err);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await api.get<AssetMaintenance[]>('/assets/maintenance');
      setRecords(data || []);
    } catch (err) {
      console.error('Failed to load maintenance records', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenScheduleModal = async () => {
    await loadPrerequisites();
    setSelectedAssetId(assets[0]?.id || '');
    setMaintenanceType('PREVENTIVE');
    setServiceDate(new Date().toISOString().split('T')[0]);
    setVendorId('');
    setServiceProvider('');
    setIssueDescription('');
    setCost('0');
    setWarrantyClaim(false);
    setScheduleError('');
    setIsScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setScheduleError('Please select an asset to service.');
      return;
    }
    if (!issueDescription.trim()) {
      setScheduleError('Issue description is required.');
      return;
    }

    setScheduling(true);
    setScheduleError('');
    try {
      await api.post('/assets/maintenance', {
        asset_id: selectedAssetId,
        maintenance_type: maintenanceType,
        service_date: serviceDate,
        vendor_id: vendorId || null,
        service_provider: serviceProvider.trim() || undefined,
        issue_description: issueDescription.trim(),
        cost: Number(cost) || 0,
        warranty_claim: warrantyClaim,
      });

      setIsScheduleModalOpen(false);
      loadRecords();
      loadPrerequisites();
    } catch (err: any) {
      setScheduleError(err.message || 'Failed to schedule maintenance.');
    } finally {
      setScheduling(false);
    }
  };

  const handleOpenCompleteModal = (m: AssetMaintenance) => {
    setTargetRecord(m);
    setWorkPerformed(m.work_performed || '');
    setFinalCost(String(m.cost || 0));
    setNextServiceDate(m.next_service_date || '');
    setFinalCondition('GOOD');
    setCompleteRemarks(m.remarks || '');
    setCompleteError('');
    setIsCompleteModalOpen(true);
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRecord) return;
    if (!workPerformed.trim()) {
      setCompleteError('Work performed description is required.');
      return;
    }

    setCompleting(true);
    setCompleteError('');
    try {
      await api.put(`/assets/maintenance/${targetRecord.id}/complete`, {
        work_performed: workPerformed.trim(),
        cost: Number(finalCost) || 0,
        next_service_date: nextServiceDate || null,
        final_condition: finalCondition,
        remarks: completeRemarks.trim() || undefined,
      });

      setIsCompleteModalOpen(false);
      loadRecords();
      loadPrerequisites();
    } catch (err: any) {
      setCompleteError(err.message || 'Failed to complete maintenance job.');
    } finally {
      setCompleting(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    const code = (r.asset?.asset_code || '').toLowerCase();
    const name = (r.asset?.asset_name || '').toLowerCase();
    const desc = (r.issue_description || '').toLowerCase();
    return code.includes(term) || name.includes(term) || desc.includes(term);
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Asset Maintenance & Servicing</h1>
            <Badge variant="warning">Repairs & Overhauls</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Preventative maintenance schedules, air conditioner servicing, laboratory calibrations, and repair logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadRecords} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenScheduleModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Schedule Service
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by asset, code, or issue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['ALL', 'IN_PROGRESS', 'COMPLETED', 'OPEN'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === status
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'ALL' ? 'All Jobs' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </Card>

      {/* Maintenance Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Asset Details</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Service Date</th>
                <th className="py-3 px-4">Service Provider / Vendor</th>
                <th className="py-3 px-4">Issue & Actions</th>
                <th className="py-3 px-4">Cost</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading maintenance records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <Boxes className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No maintenance records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((m) => {
                  const isOpen = m.status === 'OPEN' || m.status === 'IN_PROGRESS';
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{m.asset?.asset_name || 'Asset Item'}</div>
                        <div className="text-xs font-mono text-blue-600">{m.asset?.asset_code}</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-gray-800">
                        {m.maintenance_type}
                      </td>
                      <td className="py-3 px-4 text-xs">{m.service_date}</td>
                      <td className="py-3 px-4 text-xs font-medium text-gray-700">
                        {m.vendor?.name || m.service_provider || 'In-House Facilities Staff'}
                      </td>
                      <td className="py-3 px-4 text-xs max-w-xs">
                        <div className="text-gray-900 truncate font-medium">{m.issue_description}</div>
                        {m.work_performed && (
                          <div className="text-emerald-700 truncate mt-0.5">Done: {m.work_performed}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900 text-xs">
                        {format(m.cost || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={m.status === 'COMPLETED' ? 'success' : 'warning'}>
                          {m.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isOpen && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenCompleteModal(m)}
                            title="Complete Service Job"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Complete
                          </Button>
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

      {/* Schedule Maintenance Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Asset Maintenance / Service"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          {scheduleError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{scheduleError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Select Asset *</label>
            <Select
              options={assets.map((a) => ({
                value: a.id,
                label: `${a.asset_code} — ${a.asset_name} (${a.status})`,
              }))}
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Maintenance Type *</label>
              <Select
                options={[
                  { value: 'PREVENTIVE', label: 'Preventive Overhaul' },
                  { value: 'REPAIR', label: 'Breakdown Repair' },
                  { value: 'INSPECTION', label: 'Safety Inspection' },
                  { value: 'CALIBRATION', label: 'Lab Calibration' },
                  { value: 'UPGRADE', label: 'Hardware Upgrade' },
                ]}
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value as any)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Service Date *</label>
              <Input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Contracted Vendor</label>
              <Select
                options={[
                  { value: '', label: 'In-House / Custom Technician' },
                  ...vendors.map((v) => ({ value: v.id, label: v.name })),
                ]}
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Service Technician / Agency</label>
              <Input
                value={serviceProvider}
                onChange={(e) => setServiceProvider(e.target.value)}
                placeholder="e.g. Daikin Authorized Service"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Issue Description *</label>
            <Input
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="e.g. Filter cleaning, refrigerant pressure test, and condenser fan lubrication"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Estimated Cost ({symbol})</label>
              <Input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                min="0"
              />
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={warrantyClaim}
                  onChange={(e) => setWarrantyClaim(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Covered under OEM Warranty
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={scheduling}>
              {scheduling ? 'Scheduling...' : 'Confirm Maintenance'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Complete Maintenance Modal */}
      <Modal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        title={`Complete Service: ${targetRecord?.asset?.asset_code || ''}`}
      >
        <form onSubmit={handleCompleteSubmit} className="space-y-4">
          {completeError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{completeError}</div>
          )}

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1">
            <div className="font-semibold text-amber-900">{targetRecord?.asset?.asset_name}</div>
            <div className="text-amber-800">Issue: {targetRecord?.issue_description}</div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Work Performed *</label>
            <Input
              value={workPerformed}
              onChange={(e) => setWorkPerformed(e.target.value)}
              placeholder="e.g. Cleaned coils, topped up 400g refrigerant, replaced filter mesh"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Final Actual Cost ({symbol})</label>
              <Input
                type="number"
                value={finalCost}
                onChange={(e) => setFinalCost(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Next Service Due Date</label>
              <Input
                type="date"
                value={nextServiceDate}
                onChange={(e) => setNextServiceDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Restored Condition *</label>
            <Select
              options={[
                { value: 'GOOD', label: 'Good Working Condition' },
                { value: 'NEW', label: 'Like New (Pristine)' },
                { value: 'FAIR', label: 'Fair / Operational with wear' },
              ]}
              value={finalCondition}
              onChange={(e) => setFinalCondition(e.target.value as AssetCondition)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsCompleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={completing}>
              {completing ? 'Completing...' : 'Close & Restore to Service'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
