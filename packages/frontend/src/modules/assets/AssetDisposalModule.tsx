// ========================================================================
// Asset Disposals & Write-Offs Module
// Decommissioning lifecycle, scrap sales, obsolete equipment write-offs,
// and safety verification preventing disposal of active custody items
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Archive,
  Plus,
  RefreshCw,
  Search,
  Calendar,
  AlertTriangle,
  IndianRupee,
  ShieldAlert,
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
import { Asset, AssetDisposal, User } from '../../types/index.js';

export const AssetDisposalModule: React.FC<{ tabId?: string }> = () => {
  const { symbol, format } = useCurrency();

  const [disposals, setDisposals] = useState<AssetDisposal[]>([]);
  const [eligibleAssets, setEligibleAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Dispose Modal
  const [isDisposeModalOpen, setIsDisposeModalOpen] = useState<boolean>(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [disposalDate, setDisposalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [disposalReason, setDisposalReason] = useState<string>('');
  const [disposalMethod, setDisposalMethod] = useState<string>('SCRAP_SALE');
  const [disposalValue, setDisposalValue] = useState<string>('0');
  const [approvedBy, setApprovedBy] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [disposing, setDisposing] = useState<boolean>(false);
  const [disposeError, setDisposeError] = useState<string>('');

  useEffect(() => {
    loadPrerequisites();
    loadDisposals();
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [assetsData, usersData] = await Promise.all([
        api.get<Asset[]>('/assets/assets'),
        api.get<User[]>('/users'),
      ]);
      // Filter out already disposed, assigned, or under maintenance assets
      const eligible = (assetsData || []).filter(
        (a) => a.status !== 'DISPOSED' && a.status !== 'ASSIGNED' && a.status !== 'UNDER_MAINTENANCE'
      );
      setEligibleAssets(eligible);
      setUsers(usersData || []);
    } catch (err) {
      console.error('Failed to load eligible assets or approvers', err);
    }
  };

  const loadDisposals = async () => {
    setLoading(true);
    try {
      const data = await api.get<AssetDisposal[]>('/assets/disposals');
      setDisposals(data || []);
    } catch (err) {
      console.error('Failed to load disposals', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDisposeModal = async () => {
    await loadPrerequisites();
    setSelectedAssetId(eligibleAssets[0]?.id || '');
    setDisposalDate(new Date().toISOString().split('T')[0]);
    setDisposalReason('');
    setDisposalMethod('SCRAP_SALE');
    setDisposalValue('0');
    setApprovedBy(users[0]?.id || '');
    setRemarks('');
    setDisposeError('');
    setIsDisposeModalOpen(true);
  };

  const handleDisposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setDisposeError('Please select an asset to decommission.');
      return;
    }
    if (!disposalReason.trim()) {
      setDisposeError('Reason for disposal is required.');
      return;
    }

    setDisposing(true);
    setDisposeError('');
    try {
      await api.post('/assets/disposals', {
        asset_id: selectedAssetId,
        disposal_date: disposalDate,
        disposal_reason: disposalReason.trim(),
        disposal_method: disposalMethod,
        disposal_value: Number(disposalValue) || 0,
        approved_by: approvedBy || null,
        remarks: remarks.trim() || undefined,
      });

      setIsDisposeModalOpen(false);
      loadDisposals();
      loadPrerequisites();
    } catch (err: any) {
      setDisposeError(err.message || 'Failed to dispose asset.');
    } finally {
      setDisposing(false);
    }
  };

  const filteredDisposals = disposals.filter((d) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const code = (d.asset?.asset_code || '').toLowerCase();
    const name = (d.asset?.asset_name || '').toLowerCase();
    const r = (d.disposal_reason || '').toLowerCase();
    return code.includes(term) || name.includes(term) || r.includes(term);
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Asset Disposals & Write-Offs</h1>
            <Badge variant="slate">Decommissioning</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Authoritative register of decommissioned e-waste, scrap sales, obsolete apparatus, and loss write-offs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadDisposals} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenDisposeModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Write-Off Asset
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by asset code, title, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      {/* Disposals Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Decommissioned Asset</th>
                <th className="py-3 px-4">Disposal Date</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Justification / Reason</th>
                <th className="py-3 px-4">Scrap / Recovery Value</th>
                <th className="py-3 px-4 text-right">Authorized Approver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading disposal records...
                  </td>
                </tr>
              ) : filteredDisposals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <Boxes className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No written-off assets recorded.
                  </td>
                </tr>
              ) : (
                filteredDisposals.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{d.asset?.asset_name || 'Asset Item'}</div>
                      <div className="text-xs font-mono text-rose-600">{d.asset?.asset_code}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-800">{d.disposal_date}</td>
                    <td className="py-3 px-4 text-xs">
                      <Badge variant="slate">{d.disposal_method.replace('_', ' ')}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-700 max-w-sm">
                      <div className="font-medium truncate">{d.disposal_reason}</div>
                      {d.remarks && <div className="text-gray-400 text-xs truncate mt-0.5">{d.remarks}</div>}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900 text-xs">
                      {format(d.disposal_value || 0)}
                    </td>
                    <td className="py-3 px-4 text-xs text-right text-gray-600 font-medium">
                      {d.approved_by_user ? `${d.approved_by_user.first_name} ${d.approved_by_user.last_name}` : 'School Director'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Write-Off Modal */}
      <Modal
        isOpen={isDisposeModalOpen}
        onClose={() => setIsDisposeModalOpen(false)}
        title="Decommission & Write-Off Asset"
      >
        <form onSubmit={handleDisposeSubmit} className="space-y-4">
          {disposeError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{disposeError}</span>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Permanent Action:</strong> Decommissioned assets will have their status transitioned to
              DISPOSED and condition to CRITICAL. Assets currently in active custody or under maintenance must be returned/closed first.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Select Asset *</label>
            <Select
              options={
                eligibleAssets.length > 0
                  ? eligibleAssets.map((a) => ({
                      value: a.id,
                      label: `${a.asset_code} — ${a.asset_name} (${a.condition})`,
                    }))
                  : [{ value: '', label: 'No eligible unassigned assets' }]
              }
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Disposal Method *</label>
              <Select
                options={[
                  { value: 'SCRAP_SALE', label: 'E-Waste / Scrap Sale' },
                  { value: 'DONATION', label: 'Donation to NGO / Affiliate' },
                  { value: 'OBSOLETE', label: 'Technologically Obsolete' },
                  { value: 'DAMAGED_BEYOND_REPAIR', label: 'Damaged Beyond Repair' },
                  { value: 'LOST_THEFT', label: 'Lost / Police Report Filed' },
                ]}
                value={disposalMethod}
                onChange={(e) => setDisposalMethod(e.target.value as any)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Decommission Date *</label>
              <Input
                type="date"
                value={disposalDate}
                onChange={(e) => setDisposalDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Scrap / Recovery Value ({symbol})</label>
              <Input
                type="number"
                value={disposalValue}
                onChange={(e) => setDisposalValue(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Authorizing Approver</label>
              <Select
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.first_name} ${u.last_name}`,
                }))}
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Reason for Disposal *</label>
            <Input
              value={disposalReason}
              onChange={(e) => setDisposalReason(e.target.value)}
              placeholder="e.g. Motherboard burnt beyond economic repair; CBSE audit write-off approved"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Audit Notes / Document Reference</label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Scrapped under e-waste disposal certificate #EW-2026-99"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsDisposeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={disposing || eligibleAssets.length === 0}>
              {disposing ? 'Writing Off...' : 'Confirm Write-Off'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
