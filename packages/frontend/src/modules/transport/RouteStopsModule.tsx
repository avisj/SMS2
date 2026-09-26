// ========================================================================
// Route Stops Module
// Manage Sequential Route Pickup & Drop Points with Timings & Lat/Long Coordinates
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  ArrowUpDown,
  Trash2,
  Edit2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { usePermission } from '../../hooks/usePermission.js';
import { TransportRoute, TransportRouteStop } from '../../types/index.js';

interface RouteStopsModuleProps {
  tabId: string;
}

export const RouteStopsModule: React.FC<RouteStopsModuleProps> = ({ tabId }) => {
  const { hasPermission, isSuperAdmin } = usePermission();
  const canManageStops = isSuperAdmin || hasPermission('transport.route_stops.manage');

  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [stops, setStops] = useState<TransportRouteStop[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStop, setEditingStop] = useState<TransportRouteStop | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    stop_name: '',
    stop_code: '',
    address_landmark: '',
    sequence_number: 1,
    pickup_time: '07:30',
    drop_time: '14:30',
    latitude: '' as any,
    longitude: '' as any,
    notes: '',
  });

  useEffect(() => {
    loadRoutes();
  }, []);

  useEffect(() => {
    if (selectedRouteId) {
      loadStops(selectedRouteId);
    } else {
      setStops([]);
    }
  }, [selectedRouteId]);

  const loadRoutes = async () => {
    try {
      const res = await api.get<any>('/transport/routes', { limit: 100 });
      const list: TransportRoute[] = Array.isArray(res) ? res : (res?.data || []);
      setRoutes(list);
      if (list.length > 0 && !selectedRouteId) {
        setSelectedRouteId(list[0].id);
      }
    } catch (err) {
      console.error('Error loading routes:', err);
    }
  };

  const loadStops = async (routeId: string) => {
    try {
      setLoading(true);
      const res = await api.get<any>(`/transport/routes/${routeId}/stops`);
      const list: TransportRouteStop[] = Array.isArray(res) ? res : (res?.data || []);
      setStops(list);
    } catch (err) {
      console.error('Error loading stops:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSaving(false);
    setFormError('');
  };

  const handleOpenCreate = () => {
    setEditingStop(null);
    setSaving(false);
    setFormData({
      stop_name: '',
      stop_code: '',
      address_landmark: '',
      sequence_number: stops.length + 1,
      pickup_time: '07:30',
      drop_time: '14:30',
      latitude: '',
      longitude: '',
      notes: '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: TransportRouteStop) => {
    setEditingStop(s);
    setSaving(false);
    setFormData({
      stop_name: s.stop_name,
      stop_code: s.stop_code || '',
      address_landmark: s.address_landmark || '',
      sequence_number: s.sequence_number,
      pickup_time: s.pickup_time || '07:30',
      drop_time: s.drop_time || '14:30',
      latitude: s.latitude !== null && s.latitude !== undefined ? s.latitude : '',
      longitude: s.longitude !== null && s.longitude !== undefined ? s.longitude : '',
      notes: s.notes || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.stop_name.trim()) {
      setFormError('Stop Name is required (e.g. Dwarka Sector 12)');
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        stop_name: formData.stop_name,
        stop_code: formData.stop_code || undefined,
        address_landmark: formData.address_landmark || undefined,
        sequence_number: formData.sequence_number,
        pickup_time: formData.pickup_time || undefined,
        drop_time: formData.drop_time || undefined,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        notes: formData.notes || undefined,
      };

      if (editingStop) {
        await api.put<TransportRouteStop>(
          `/transport/routes/${selectedRouteId}/stops/${editingStop.id}`,
          payload
        );
      } else {
        await api.post<TransportRouteStop>(
          `/transport/routes/${selectedRouteId}/stops`,
          payload
        );
      }

      setIsModalOpen(false);
      loadStops(selectedRouteId);
    } catch (err: any) {
      setFormError(err.message || 'Error saving route stop');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (stopId: string) => {
    if (!window.confirm('Are you sure you want to remove this stop from the route?')) return;
    try {
      await api.delete(`/transport/routes/${selectedRouteId}/stops/${stopId}`);
      loadStops(selectedRouteId);
    } catch (err) {
      console.error('Failed to delete stop:', err);
    }
  };

  const handleMove = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stops.length) return;

    const newOrder = [...stops];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setStops(newOrder);

    try {
      const stopIds = newOrder.map((s) => s.id);
      await api.put(`/transport/routes/${selectedRouteId}/stops/reorder`, {
        stop_ids: stopIds,
      });
      loadStops(selectedRouteId);
    } catch (err) {
      console.error('Failed to persist stop sequence:', err);
    }
  };

  const activeRoute = routes.find((r) => r.id === selectedRouteId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Route Stops & Timings</h1>
            <p className="text-xs text-slate-500">
              Configure ordered sequence of pickup and drop stops with arrival times for each route.
            </p>
          </div>
        </div>

        {selectedRouteId && canManageStops && (
          <Button variant="primary" size="sm" onClick={handleOpenCreate} icon={<Plus className="w-3.5 h-3.5" />}>
            Add Route Stop
          </Button>
        )}
      </div>

      {/* Route Selector Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Select Transport Route:</label>
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            className="w-full md:w-80 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-800"
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.route_name} ({r.route_code}) — {r.start_point} to {r.end_point}
              </option>
            ))}
          </select>
        </div>

        {activeRoute && (
          <div className="flex items-center gap-3 text-2xs bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
            <span>
              Origin: <strong className="text-slate-800">{activeRoute.start_point}</strong>
            </span>
            <span>•</span>
            <span>
              Destination: <strong className="text-slate-800">{activeRoute.end_point}</strong>
            </span>
            <span>•</span>
            <span>
              Stops: <strong className="text-teal-700">{stops.length}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Stops Sequence Table */}
      <Card className="bg-white border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                <th className="p-3 w-16">Seq #</th>
                <th className="p-3">Stop Name</th>
                <th className="p-3">Address / Landmark</th>
                <th className="p-3">Morning Pickup</th>
                <th className="p-3">Evening Drop</th>
                <th className="p-3">GPS Coordinates</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Loading stops...
                  </td>
                </tr>
              ) : stops.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div className="font-semibold text-slate-800 text-sm">No stops configured for this route yet</div>
                      <p className="text-xs text-slate-500">
                        {canManageStops
                          ? 'Add sequential pickup and drop stops with arrival times to establish this route itinerary.'
                          : 'You do not have permission to manage route stops for this route.'}
                      </p>
                      {canManageStops && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleOpenCreate}
                          icon={<Plus className="w-3.5 h-3.5" />}
                          className="mt-2"
                        >
                          Add Route Stop
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                stops.map((s, index) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3">
                      <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-2xs">
                        {s.sequence_number}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{s.stop_name}</div>
                      {s.stop_code && <div className="text-2xs font-mono text-slate-400">{s.stop_code}</div>}
                    </td>
                    <td className="p-3 text-slate-600">
                      {s.address_landmark || <span className="text-slate-400 italic text-2xs">Not specified</span>}
                    </td>
                    <td className="p-3 font-mono font-medium text-emerald-700">
                      {s.pickup_time || '07:30'}
                    </td>
                    <td className="p-3 font-mono font-medium text-indigo-700">
                      {s.drop_time || '14:30'}
                    </td>
                    <td className="p-3 font-mono text-2xs text-slate-500">
                      {s.latitude && s.longitude ? (
                        <span>
                          {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {canManageStops ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={index === 0}
                            onClick={() => handleMove(index, 'UP')}
                            title="Move Stop Earlier in Sequence"
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={index === stops.length - 1}
                            onClick={() => handleMove(index, 'DOWN')}
                            title="Move Stop Later in Sequence"
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(s)}
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(s.id)}
                            icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <span className="text-2xs text-slate-400 italic">View only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Stop Form Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={handleCloseModal}
          title={editingStop ? `Edit Stop: ${editingStop.stop_name}` : 'Add Route Stop'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Stop Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dwarka Sector 12"
                  value={formData.stop_name}
                  onChange={(e) => setFormData({ ...formData, stop_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Stop Code</label>
                <input
                  type="text"
                  placeholder="e.g. STP-DW-12"
                  value={formData.stop_code}
                  onChange={(e) => setFormData({ ...formData, stop_code: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Morning Pickup Time</label>
                <input
                  type="time"
                  value={formData.pickup_time}
                  onChange={(e) => setFormData({ ...formData, pickup_time: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Evening Drop Time</label>
                <input
                  type="time"
                  value={formData.drop_time}
                  onChange={(e) => setFormData({ ...formData, drop_time: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Latitude (Optional)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 28.5921"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Longitude (Optional)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 77.0460"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Address Landmark</label>
              <input
                type="text"
                placeholder="e.g. Near Metro Station Gate 2"
                value={formData.address_landmark}
                onChange={(e) => setFormData({ ...formData, address_landmark: e.target.value })}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" type="button" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingStop ? 'Update Stop' : 'Save Stop'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
