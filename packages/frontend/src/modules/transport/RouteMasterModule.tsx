// ========================================================================
// Route Master Module
// CRUD for School Transport Routes, Stops, Distance & Vehicle Links
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Navigation,
  Plus,
  Search,
  Eye,
  Edit2,
  MapPin,
  Bus,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { TransportRoute, TransportRouteType, TransportRouteStatus, Vehicle, Location } from '../../types/index.js';

interface RouteMasterModuleProps {
  tabId: string;
}

export const RouteMasterModule: React.FC<RouteMasterModuleProps> = ({ tabId }) => {
  const { activeBranch, userContext } = useAuth();
  const { openTab } = useWorkspace();
  const { hasPermission, isSuperAdmin } = usePermission();
  const canCreateRoute = isSuperAdmin || hasPermission('transport.route.create');
  const canUpdateRoute = isSuperAdmin || hasPermission('transport.route.update');
  const canManageStops = isSuperAdmin || hasPermission('transport.route_stops.manage');

  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingDrivers, setLoadingDrivers] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [viewingRoute, setViewingRoute] = useState<TransportRoute | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    route_name: '',
    route_code: '',
    route_type: 'BOTH' as TransportRouteType,
    location_id: '',
    start_point: '',
    end_point: '',
    estimated_duration_mins: 45,
    distance_km: 15,
    assigned_vehicle_id: '',
    primary_driver_user_id: '',
    status: 'ACTIVE' as TransportRouteStatus,
    notes: '',
  });

  useEffect(() => {
    loadMetadata();
    loadRoutes();
  }, [statusFilter]);

  const loadMetadata = async () => {
    try {
      setLoadingDrivers(true);
      const [vRes, locRes, staffRes] = await Promise.all([
        api.get<any>('/transport/vehicles', { status: 'ACTIVE', limit: 100 }),
        api.get<Location[]>('/locations'),
        api.get<any[]>('/transport/drivers/available'),
      ]);
      const vList = Array.isArray(vRes) ? vRes : (vRes?.data || []);
      setVehicles(vList);
      if (locRes) setLocations(locRes);
      if (staffRes) setAvailableStaff(staffRes);
    } catch (err) {
      console.error('Error loading route metadata:', err);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.get<any>('/transport/routes', params);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setRoutes(list);
    } catch (err) {
      console.error('Error loading routes:', err);
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
    setEditingRoute(null);
    setSaving(false);
    const activeLocId =
      activeBranch?.id || userContext?.active_location_id || (locations.length > 0 ? locations[0].id : '');

    setFormData({
      route_name: '',
      route_code: '',
      route_type: 'BOTH',
      location_id: activeLocId,
      start_point: '',
      end_point: '',
      estimated_duration_mins: 45,
      distance_km: 15,
      assigned_vehicle_id: '',
      primary_driver_user_id: '',
      status: 'ACTIVE',
      notes: '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (r: TransportRoute) => {
    setEditingRoute(r);
    setSaving(false);
    const activeLocId =
      r.location_id || activeBranch?.id || userContext?.active_location_id || (locations.length > 0 ? locations[0].id : '');

    setFormData({
      route_name: r.route_name,
      route_code: r.route_code,
      route_type: r.route_type,
      location_id: activeLocId,
      start_point: r.start_point,
      end_point: r.end_point,
      estimated_duration_mins: r.estimated_duration_mins || 45,
      distance_km: r.distance_km || 15,
      assigned_vehicle_id: r.assigned_vehicle_id || '',
      primary_driver_user_id: r.primary_driver_user_id || '',
      status: r.status,
      notes: r.notes || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.route_name.trim()) {
      setFormError('Route Name is required (e.g. Dwarka Sector Route)');
      return;
    }
    if (!formData.route_code.trim()) {
      setFormError('Route Code is required (e.g. RT-DW-01)');
      return;
    }

    const resolvedLocationId =
      formData.location_id ||
      activeBranch?.id ||
      userContext?.active_location_id ||
      (locations.length > 0 ? locations[0].id : null);

    const payload = {
      ...formData,
      route_name: formData.route_name.trim(),
      route_code: formData.route_code.trim().toUpperCase(),
      location_id: resolvedLocationId,
      assigned_vehicle_id: formData.assigned_vehicle_id || undefined,
      primary_driver_user_id: formData.primary_driver_user_id || undefined,
    };

    try {
      setSaving(true);
      if (editingRoute) {
        await api.put<TransportRoute>(`/transport/routes/${editingRoute.id}`, payload);
      } else {
        await api.post<TransportRoute>('/transport/routes', payload);
      }
      setIsModalOpen(false);
      loadRoutes();
    } catch (err: any) {
      setFormError(err.message || 'Error saving route');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Route Master</h1>
            <p className="text-xs text-slate-500">
              Configure transport itineraries, designated vehicles, primary drivers, and sequential stops.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManageStops && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openTab('route_stops', 'Route Stops', 'MapPin')}
              icon={<MapPin className="w-3.5 h-3.5" />}
            >
              Manage Stops
            </Button>
          )}
          {canCreateRoute && (
            <Button variant="primary" size="sm" onClick={handleOpenCreate} icon={<Plus className="w-3.5 h-3.5" />}>
              Create Route
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search routes by name, code, origin, or destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadRoutes()}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 w-full md:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>

        <Button variant="secondary" size="sm" onClick={loadRoutes}>
          Apply
        </Button>
      </div>

      {/* Routes Table */}
      <Card className="bg-white border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                <th className="p-3">Route Code</th>
                <th className="p-3">Route Name</th>
                <th className="p-3">Origin → Destination</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Stops</th>
                <th className="p-3">Assigned Students</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading routes...
                  </td>
                </tr>
              ) : routes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No routes found matching your criteria.
                  </td>
                </tr>
              ) : (
                routes.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 font-mono font-bold text-teal-700">{r.route_code}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{r.route_name}</div>
                      <div className="text-2xs text-slate-400">
                        {r.distance_km ? `${r.distance_km} km` : ''}{' '}
                        {r.estimated_duration_mins ? `• ~${r.estimated_duration_mins} mins` : ''}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-slate-800 font-medium">
                        {r.start_point} <span className="text-slate-400">→</span> {r.end_point}
                      </div>
                    </td>
                    <td className="p-3">
                      {r.assigned_vehicle ? (
                        <div>
                          <div className="font-bold text-slate-800">{r.assigned_vehicle.vehicle_number}</div>
                          <div className="text-2xs font-mono text-slate-400">
                            {r.assigned_vehicle.registration_number}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-2xs">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-slate-800">{r.stops_count ?? r.stops?.length ?? 0}</span>
                        <span className="text-slate-500">stops</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-900">
                        {r.assigned_student_count || 0} students
                      </div>
                      <div className="text-2xs text-slate-400">
                        {r.available_seats !== undefined ? `${r.available_seats} seats free` : ''}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={r.status === 'ACTIVE' ? 'emerald' : r.status === 'SUSPENDED' ? 'rose' : 'slate'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingRoute(r)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View
                        </Button>
                        {canUpdateRoute && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(r)}
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          onClose={handleCloseModal}
          title={editingRoute ? `Edit Route: ${editingRoute.route_code}` : 'Create New Transport Route'}
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
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Route Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dwarka Sector Route"
                  value={formData.route_name}
                  onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Route Code *</label>
                <input
                  type="text"
                  placeholder="e.g. RT-DW-01"
                  value={formData.route_code}
                  onChange={(e) => setFormData({ ...formData, route_code: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Start Point (Origin) *</label>
                <input
                  type="text"
                  placeholder="e.g. Dwarka Main Campus"
                  value={formData.start_point}
                  onChange={(e) => setFormData({ ...formData, start_point: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">End Point (Destination) *</label>
                <input
                  type="text"
                  placeholder="e.g. Dwarka Sector 22"
                  value={formData.end_point}
                  onChange={(e) => setFormData({ ...formData, end_point: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Assigned Vehicle</label>
                <select
                  value={formData.assigned_vehicle_id}
                  onChange={(e) => setFormData({ ...formData, assigned_vehicle_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                >
                  <option value="">-- No Vehicle Assigned --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} ({v.registration_number}) — {v.capacity} Seats
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Primary Driver</label>
                <select
                  value={formData.primary_driver_user_id}
                  onChange={(e) => setFormData({ ...formData, primary_driver_user_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  disabled={loadingDrivers}
                >
                  <option value="">-- No Driver Assigned --</option>
                  {loadingDrivers ? (
                    <option value="" disabled>Loading eligible drivers...</option>
                  ) : availableStaff.length === 0 ? (
                    <option value="" disabled>No eligible transport drivers found.</option>
                  ) : (
                    availableStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {`${s.first_name || ''} ${s.last_name || ''}`.trim() || s.username}
                        {s.driver_profile?.license_number ? ` (Lic: ${s.driver_profile.license_number})` : ''}
                      </option>
                    ))
                  )}
                </select>
                {availableStaff.length === 0 && !loadingDrivers && (
                  <p className="text-2xs text-amber-600 mt-1">
                    No eligible transport drivers found.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Est. Duration (Mins)</label>
                <input
                  type="number"
                  value={formData.estimated_duration_mins}
                  onChange={(e) => setFormData({ ...formData, estimated_duration_mins: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Distance (Km)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.distance_km}
                  onChange={(e) => setFormData({ ...formData, distance_km: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Notes / Route Instructions</label>
              <textarea
                rows={2}
                placeholder="Specific instructions or landmark details..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" type="button" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingRoute ? 'Update Route' : 'Create Route'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Route Detail Modal */}
      {viewingRoute && (
        <Modal
          isOpen={true}
          onClose={() => setViewingRoute(null)}
          title={`Route Overview: ${viewingRoute.route_name} (${viewingRoute.route_code})`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-2xs text-slate-400 block font-semibold">Origin & Destination</span>
                <span className="text-slate-800 font-medium">
                  {viewingRoute.start_point} → {viewingRoute.end_point}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-2xs text-slate-400 block font-semibold">Assigned Fleet Bus</span>
                <span className="text-slate-800 font-medium">
                  {viewingRoute.assigned_vehicle
                    ? `${viewingRoute.assigned_vehicle.vehicle_number} (${viewingRoute.assigned_vehicle.capacity} seats)`
                    : 'Unassigned'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-2xs text-slate-400 block font-semibold">Stops Configured</span>
                <span className="text-slate-800 font-medium">
                  {viewingRoute.stops_count || viewingRoute.stops?.length || 0} stops
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-2xs text-slate-400 block font-semibold">Assigned Students</span>
                <span className="text-slate-800 font-medium">
                  {viewingRoute.assigned_student_count || 0} students assigned
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setViewingRoute(null);
                  openTab('route_stops', 'Route Stops', 'MapPin');
                }}
                icon={<MapPin className="w-3.5 h-3.5" />}
              >
                Open Route Stops Editor
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setViewingRoute(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
