// ========================================================================
// Asset Custody & Assignment Module
// Issue physical assets to faculty/staff, track expected return dates,
// and process return check-ins with condition inspection
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  RotateCcw,
  Search,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Boxes,
  User,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { formatLocationDisplay } from '../../utils/locations.js';
import { Asset, AssetAssignment, AssetCondition, User as UserType } from '../../types/index.js';

export const AssetAssignmentModule: React.FC<{ tabId?: string }> = () => {
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RETURNED'>('ACTIVE');

  // Issue / Assign Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [assignDate, setAssignDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [conditionAtAssign, setConditionAtAssign] = useState<AssetCondition>('GOOD');
  const [assignRemarks, setAssignRemarks] = useState<string>('');
  const [assigning, setAssigning] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string>('');

  // Return Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [targetAssignment, setTargetAssignment] = useState<AssetAssignment | null>(null);
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [conditionAtReturn, setConditionAtReturn] = useState<AssetCondition>('GOOD');
  const [returnRemarks, setReturnRemarks] = useState<string>('');
  const [returning, setReturning] = useState<boolean>(false);
  const [returnError, setReturnError] = useState<string>('');

  useEffect(() => {
    loadPrerequisites();
    loadAssignments();
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [assetsData, usersData] = await Promise.all([
        api.get<Asset[]>('/assets/assets', { status: 'AVAILABLE' }),
        api.get<UserType[]>('/users'),
      ]);
      setAvailableAssets(assetsData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error('Failed to load available assets or users', err);
    }
  };

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const data = await api.get<AssetAssignment[]>('/assets/assignments');
      setAssignments(data || []);
    } catch (err) {
      console.error('Failed to load assignments', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssignModal = async () => {
    await loadPrerequisites();
    setSelectedAssetId(availableAssets[0]?.id || '');
    setSelectedUserId(users[0]?.id || '');
    setAssignDate(new Date().toISOString().split('T')[0]);
    setExpectedReturnDate('');
    setConditionAtAssign('GOOD');
    setAssignRemarks('');
    setAssignError('');
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setAssignError('Please select an available asset to issue.');
      return;
    }
    if (!selectedUserId) {
      setAssignError('Please select a recipient / custodian.');
      return;
    }

    setAssigning(true);
    setAssignError('');
    try {
      await api.post('/assets/assignments', {
        asset_id: selectedAssetId,
        assigned_to_user_id: selectedUserId,
        assignment_date: assignDate,
        expected_return_date: expectedReturnDate || null,
        condition_at_assignment: conditionAtAssign,
        remarks: assignRemarks.trim() || null,
      });

      setIsAssignModalOpen(false);
      loadAssignments();
      loadPrerequisites();
    } catch (err: any) {
      setAssignError(err.message || 'Failed to issue asset.');
    } finally {
      setAssigning(false);
    }
  };

  const handleOpenReturnModal = (asg: AssetAssignment) => {
    setTargetAssignment(asg);
    setReturnDate(new Date().toISOString().split('T')[0]);
    setConditionAtReturn(asg.condition_at_assignment || 'GOOD');
    setReturnRemarks('');
    setReturnError('');
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAssignment) return;

    setReturning(true);
    setReturnError('');
    try {
      await api.post(`/assets/assignments/${targetAssignment.id}/return`, {
        actual_return_date: returnDate,
        condition_at_return: conditionAtReturn,
        remarks: returnRemarks.trim() || undefined,
      });

      setIsReturnModalOpen(false);
      loadAssignments();
      loadPrerequisites();
    } catch (err: any) {
      setReturnError(err.message || 'Failed to process return check-in.');
    } finally {
      setReturning(false);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    if (statusFilter === 'ACTIVE' && (!a.is_active && a.actual_return_date)) return false;
    if (statusFilter === 'RETURNED' && a.is_active) return false;

    if (search) {
      const term = search.toLowerCase();
      const code = (a.asset?.asset_code || '').toLowerCase();
      const name = (a.asset?.asset_name || '').toLowerCase();
      const userName = `${a.assigned_to_user?.first_name || ''} ${a.assigned_to_user?.last_name || ''}`.toLowerCase();
      return code.includes(term) || name.includes(term) || userName.includes(term);
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Asset Custody & Assignment</h1>
            <Badge variant="indigo">Custody Ledger</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Issue computers, tablets, scientific apparatus, and tools to teachers and administrative staff
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadAssignments} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenAssignModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Issue / Assign Asset
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by asset code, title, or custodian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === 'ACTIVE'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Active Custody
          </button>
          <button
            onClick={() => setStatusFilter('RETURNED')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === 'RETURNED'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Returned History
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Logs
          </button>
        </div>
      </Card>

      {/* Assignment Records Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Asset Details</th>
                <th className="py-3 px-4">Custodian / Issued To</th>
                <th className="py-3 px-4">Branch Placement</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Expected Return</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading assignment records...
                  </td>
                </tr>
              ) : filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <Boxes className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No custody records found.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((asg) => {
                  const isActive = asg.is_active || !asg.actual_return_date;
                  return (
                    <tr key={asg.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{asg.asset?.asset_name || 'Asset Item'}</div>
                        <div className="text-xs font-mono text-blue-600">{asg.asset?.asset_code}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {asg.assigned_to_user?.first_name} {asg.assigned_to_user?.last_name}
                        </div>
                        <div className="text-xs text-gray-400">{asg.assigned_to_user?.email}</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-gray-700">
                        {formatLocationDisplay(asg.location || asg.asset?.location)}
                      </td>
                      <td className="py-3 px-4 text-xs">{asg.assignment_date}</td>
                      <td className="py-3 px-4 text-xs font-medium text-gray-700">
                        {asg.expected_return_date ? asg.expected_return_date : <span className="text-gray-400 italic">Open-ended</span>}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="font-medium">{asg.condition_at_assignment}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={isActive ? 'indigo' : 'success'}>
                          {isActive ? 'Active Custody' : 'Returned'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReturnModal(asg)}
                            title="Check-in and Return Asset"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Return
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

      {/* Issue / Assign Asset Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Issue / Assign Asset to Custodian"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          {assignError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{assignError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Select Available Asset *</label>
            <Select
              options={
                availableAssets.length > 0
                  ? availableAssets.map((a) => ({
                      value: a.id,
                      label: `${a.asset_code} — ${a.asset_name} (${a.condition})`,
                    }))
                  : [{ value: '', label: 'No Available Assets In Pool' }]
              }
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Assign to Faculty / Staff *</label>
            <Select
              options={users.map((u) => ({
                value: u.id,
                label: `${u.first_name} ${u.last_name} (${u.email})`,
              }))}
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Issue Date *</label>
              <Input
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Expected Return Date</label>
              <Input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Condition At Issue</label>
            <Select
              options={[
                { value: 'NEW', label: 'New' },
                { value: 'GOOD', label: 'Good' },
                { value: 'FAIR', label: 'Fair' },
              ]}
              value={conditionAtAssign}
              onChange={(e) => setConditionAtAssign(e.target.value as AssetCondition)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Purpose / Handover Remarks</label>
            <Input
              value={assignRemarks}
              onChange={(e) => setAssignRemarks(e.target.value)}
              placeholder="e.g. Handed over with charger, carry bag, and wireless mouse"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={assigning || availableAssets.length === 0}>
              {assigning ? 'Issuing...' : 'Issue Asset'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Return Asset Check-In Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={`Return Asset Check-In: ${targetAssignment?.asset?.asset_code || ''}`}
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          {returnError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{returnError}</div>
          )}

          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-xs space-y-1">
            <div className="font-semibold text-blue-900">{targetAssignment?.asset?.asset_name}</div>
            <div className="text-blue-700">
              Returning from Custodian: {targetAssignment?.assigned_to_user?.first_name} {targetAssignment?.assigned_to_user?.last_name}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Actual Return Date *</label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Inspected Condition At Return *</label>
            <Select
              options={[
                { value: 'NEW', label: 'Pristine / Like New' },
                { value: 'GOOD', label: 'Good Working Condition' },
                { value: 'FAIR', label: 'Fair / Minor Wear' },
                { value: 'DAMAGED', label: 'Damaged (Requires Repair)' },
                { value: 'CRITICAL', label: 'Critical / Scrapped' },
              ]}
              value={conditionAtReturn}
              onChange={(e) => setConditionAtReturn(e.target.value as AssetCondition)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Inspection & Return Notes</label>
            <Input
              value={returnRemarks}
              onChange={(e) => setReturnRemarks(e.target.value)}
              placeholder="e.g. Inspected by IT administrator, all components operational"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsReturnModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={returning}>
              {returning ? 'Processing Return...' : 'Confirm Return Check-In'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
