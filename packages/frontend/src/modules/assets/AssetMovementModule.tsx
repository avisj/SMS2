// ========================================================================
// Asset Movement & Relocation Module
// Inter-branch transfers, classroom reassignment, and historical chain of custody
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Plus,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  AlertCircle,
  Boxes,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { getLocationSelectOptions, formatLocationDisplay } from '../../utils/locations.js';
import { Asset, AssetMovement, AssetCondition, Location } from '../../types/index.js';

export const AssetMovementModule: React.FC<{ tabId?: string }> = () => {
  const [movements, setMovements] = useState<AssetMovement[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [toLocationId, setToLocationId] = useState<string>('');
  const [toBuilding, setToBuilding] = useState<string>('');
  const [toRoom, setToRoom] = useState<string>('');
  const [movementDate, setMovementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('');
  const [condition, setCondition] = useState<AssetCondition>('GOOD');
  const [remarks, setRemarks] = useState<string>('');
  const [transferring, setTransferring] = useState<boolean>(false);
  const [transferError, setTransferError] = useState<string>('');

  useEffect(() => {
    loadPrerequisites();
    loadMovements();
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [assetsData, locsData] = await Promise.all([
        api.get<Asset[]>('/assets/assets'),
        api.get<Location[]>('/locations'),
      ]);
      setAssets(assetsData || []);
      setLocations(locsData || []);
    } catch (err) {
      console.error('Failed to load assets or locations', err);
    }
  };

  const loadMovements = async () => {
    setLoading(true);
    try {
      const data = await api.get<AssetMovement[]>('/assets/movements');
      setMovements(data || []);
    } catch (err) {
      console.error('Failed to load movements', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTransferModal = async () => {
    await loadPrerequisites();
    setSelectedAssetId(assets[0]?.id || '');
    setToLocationId(locations[0]?.id || '');
    setToBuilding('');
    setToRoom('');
    setMovementDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setCondition('GOOD');
    setRemarks('');
    setTransferError('');
    setIsTransferModalOpen(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setTransferError('Please select an asset to relocate.');
      return;
    }
    if (!toLocationId) {
      setTransferError('Please select a destination campus/branch.');
      return;
    }
    if (!reason.trim()) {
      setTransferError('Reason for relocation is required.');
      return;
    }

    setTransferring(true);
    setTransferError('');
    try {
      await api.post('/assets/movements', {
        asset_id: selectedAssetId,
        to_location_id: toLocationId,
        to_building: toBuilding.trim() || undefined,
        to_room: toRoom.trim() || undefined,
        movement_date: movementDate,
        reason: reason.trim(),
        condition,
        remarks: remarks.trim() || undefined,
      });

      setIsTransferModalOpen(false);
      loadMovements();
      loadPrerequisites();
    } catch (err: any) {
      setTransferError(err.message || 'Failed to transfer asset.');
    } finally {
      setTransferring(false);
    }
  };

  const selectedAssetObj = assets.find((a) => a.id === selectedAssetId);

  const filteredMovements = movements.filter((m) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const code = (m.asset?.asset_code || '').toLowerCase();
    const name = (m.asset?.asset_name || '').toLowerCase();
    const r = (m.reason || '').toLowerCase();
    return code.includes(term) || name.includes(term) || r.includes(term);
  });

  const locationModalOptions = getLocationSelectOptions(locations, {
    activeOnly: true,
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Asset Movement & Transfers</h1>
            <Badge variant="indigo">Relocations</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Track spatial relocations across school campuses, wings, laboratories, and storage vaults
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadMovements} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenTransferModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Transfer Asset
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

      {/* Movements Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Asset Details</th>
                <th className="py-3 px-4">Origin Placement</th>
                <th className="py-3 px-4">Destination Placement</th>
                <th className="py-3 px-4">Transfer Date</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4 text-right">Authorized By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading movement records...
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <Boxes className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No relocation history logged.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{mov.asset?.asset_name || 'Asset Item'}</div>
                      <div className="text-xs font-mono text-blue-600">{mov.asset?.asset_code}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-gray-800">{formatLocationDisplay(mov.from_location)}</div>
                      <div className="text-gray-400">{mov.from_room || mov.from_building || 'Storage'}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-blue-700">{formatLocationDisplay(mov.to_location)}</div>
                      <div className="text-blue-500 font-semibold">{mov.to_room || mov.to_building || 'New Placement'}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-800">{mov.movement_date}</td>
                    <td className="py-3 px-4 text-xs text-gray-600 max-w-xs truncate">
                      {mov.reason}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-medium">{mov.condition || 'GOOD'}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-right text-gray-500">
                      {mov.moved_by_user ? `${mov.moved_by_user.first_name} ${mov.moved_by_user.last_name}` : 'System'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Relocate Asset Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Relocate Asset (Inter-Campus or Room Transfer)"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          {transferError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{transferError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Select Asset to Move *</label>
            <Select
              options={assets.map((a) => ({
                value: a.id,
                label: `${a.asset_code} — ${a.asset_name} (Current: ${formatLocationDisplay(a.location)} / ${a.room_number || a.room || 'Store'})`,
              }))}
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            />
          </div>

          {selectedAssetObj && (
            <div className="p-3 bg-gray-50 border rounded-lg text-xs space-y-1">
              <span className="text-gray-500 block">Current Placement:</span>
              <div className="font-semibold text-gray-800">
                {formatLocationDisplay(selectedAssetObj.location)} — {selectedAssetObj.building || ''} {selectedAssetObj.room_number || selectedAssetObj.room || 'Storage'}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Destination Campus *</label>
              <Select
                options={locationModalOptions}
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Destination Wing / Building</label>
              <Input
                value={toBuilding}
                onChange={(e) => setToBuilding(e.target.value)}
                placeholder="e.g. Science Block, 1st Floor"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Destination Room / Lab</label>
              <Input
                value={toRoom}
                onChange={(e) => setToRoom(e.target.value)}
                placeholder="e.g. Room 204 / Physics Lab"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Transfer Date *</label>
              <Input
                type="date"
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Condition At Relocation</label>
              <Select
                options={[
                  { value: 'NEW', label: 'New' },
                  { value: 'GOOD', label: 'Good' },
                  { value: 'FAIR', label: 'Fair' },
                  { value: 'DAMAGED', label: 'Damaged' },
                ]}
                value={condition}
                onChange={(e) => setCondition(e.target.value as AssetCondition)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Reason for Relocation *</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Reassigned for Senior Physics practical batch or smart classroom upgrade"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={transferring}>
              {transferring ? 'Relocating...' : 'Confirm Relocation'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
