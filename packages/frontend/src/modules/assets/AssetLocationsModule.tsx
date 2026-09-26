// ========================================================================
// Asset Placement & Campus Locations Module
// Hierarchical spatial view of school assets by Campus, Building & Room
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Boxes,
  MapPin,
  RefreshCw,
  Search,
  ArrowRight,
  UserCheck,
  ShieldCheck,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { api } from '../../api/client.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { useCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions, formatLocationDisplay } from '../../utils/locations.js';
import { Asset, Location } from '../../types/index.js';

export const AssetLocationsModule: React.FC<{ tabId?: string }> = () => {
  const { openTab } = useWorkspace();
  const { format } = useCurrency();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadAssets();
  }, [selectedLocationId]);

  const loadLocations = async () => {
    try {
      const data = await api.get<Location[]>('/locations');
      setLocations(data || []);
      if (data && data.length > 0 && !selectedLocationId) {
        setSelectedLocationId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load locations', err);
    }
  };

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await api.get<Asset[]>('/assets/assets', {
        location_id: selectedLocationId || undefined,
      });
      setAssets(data || []);
      setSelectedRoom('');
    } catch (err) {
      console.error('Failed to load assets', err);
    } finally {
      setLoading(false);
    }
  };

  // Group assets by room/building
  const roomsMap = new Map<string, { roomName: string; building: string; count: number; value: number; assets: Asset[] }>();

  assets.forEach((a) => {
    const roomKey = a.room_number || a.room || 'General Storage / Unassigned Room';
    const buildingKey = a.building || 'Main Campus Ground';

    if (!roomsMap.has(roomKey)) {
      roomsMap.set(roomKey, {
        roomName: roomKey,
        building: buildingKey,
        count: 0,
        value: 0,
        assets: [],
      });
    }
    const entry = roomsMap.get(roomKey)!;
    entry.count += 1;
    entry.value += Number(a.purchase_price) || 0;
    entry.assets.push(a);
  });

  const roomsList = Array.from(roomsMap.values());
  const activeRoomData = selectedRoom ? roomsMap.get(selectedRoom) : roomsList[0];

  const locationOptions = getLocationSelectOptions(locations, {
    activeOnly: true,
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Campus Asset Placement</h1>
            <Badge variant="indigo">Locations & Rooms</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Physical room-level breakdown of hardware, furniture, audio-visual gear, and lab inventory
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-72">
            <Select
              options={locationOptions}
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
            />
          </div>

          <Button variant="outline" onClick={loadAssets} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Split View: Room List vs. Placed Assets Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Rooms / Labs Directory */}
        <Card className="p-4 md:col-span-1">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Rooms & Labs</h3>
            <Badge variant="slate">{roomsList.length} Rooms</Badge>
          </div>

          <div className="space-y-2">
            {roomsList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No assets placed in this branch yet.</p>
            ) : (
              roomsList.map((room) => {
                const isSelected = (selectedRoom || roomsList[0]?.roomName) === room.roomName;
                return (
                  <div
                    key={room.roomName}
                    onClick={() => setSelectedRoom(room.roomName)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 shadow-xs'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-900 text-sm truncate">{room.roomName}</div>
                      <Badge variant={isSelected ? 'indigo' : 'slate'}>{room.count}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                      <span className="truncate">{room.building}</span>
                      <span className="font-medium text-gray-700">{format(room.value)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Assets Inside Selected Room */}
        <Card className="p-5 md:col-span-2">
          {activeRoomData ? (
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    {activeRoomData.roomName}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {activeRoomData.building} • Total Assets: {activeRoomData.count} • Value: {format(activeRoomData.value)}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openTab('assets_movement', 'Relocation & Transfers', 'ArrowLeftRight')}
                >
                  Transfer Assets
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                    <tr>
                      <th className="py-2.5 px-3">Asset Code & Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Custodian</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeRoomData.assets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-gray-900">{asset.asset_name}</div>
                          <div className="text-xs font-mono text-blue-600">{asset.asset_code}</div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-700">{asset.category?.name || 'Uncategorized'}</td>
                        <td className="py-2.5 px-3 text-xs">
                          {asset.custodian ? (
                            <span className="font-medium text-gray-900">
                              {asset.custodian.first_name} {asset.custodian.last_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">None</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs">
                          <Badge
                            variant={
                              asset.status === 'AVAILABLE'
                                ? 'success'
                                : asset.status === 'ASSIGNED'
                                ? 'indigo'
                                : asset.status === 'UNDER_MAINTENANCE'
                                ? 'warning'
                                : 'slate'
                            }
                          >
                            {asset.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-xs">
                          <span className="font-medium">{asset.condition}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Boxes className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">Select a room or building on the left to inspect placed assets.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
