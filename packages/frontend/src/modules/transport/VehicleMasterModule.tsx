// ========================================================================
// Vehicle Master Module
// CRUD for Fleet Vehicles, Maintenance, Document Tracking & Expiries
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Bus,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  ShieldCheck,
  Fuel,
  MapPin,
  X,
  Clock,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { Vehicle, VehicleType, VehicleStatus, Location } from '../../types/index.js';

interface VehicleMasterModuleProps {
  tabId: string;
}

export const VehicleMasterModule: React.FC<VehicleMasterModuleProps> = ({ tabId }) => {
  const { activeBranch, userContext } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermission();
  const canCreateVehicle = isSuperAdmin || hasPermission('transport.vehicle.create');
  const canUpdateVehicle = isSuperAdmin || hasPermission('transport.vehicle.update');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Form fields
  const [formData, setFormData] = useState({
    vehicle_number: '',
    registration_number: '',
    vehicle_type: 'SCHOOL_BUS' as VehicleType,
    location_id: '',
    make: '',
    model: '',
    capacity: 40,
    fuel_type: 'DIESEL',
    purchase_date: '',
    insurance_expiry: '',
    fitness_expiry: '',
    permit_expiry: '',
    puc_expiry: '',
    gps_device_id: '',
    status: 'ACTIVE' as VehicleStatus,
    next_service_due: '',
    remarks: '',
  });

  useEffect(() => {
    loadLocations();
    loadVehicles();
  }, [statusFilter, typeFilter, selectedLocation]);

  const loadLocations = async () => {
    try {
      const res = await api.get<Location[]>('/locations');
      if (res) setLocations(res);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const loadVehicles = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.vehicle_type = typeFilter;
      if (selectedLocation) params.location_id = selectedLocation;
      if (search) params.search = search;

      const res = await api.get<any>('/transport/vehicles', params);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setVehicles(list);
    } catch (err) {
      console.error('Error loading vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setSaving(false);
    setFormError('');
  };

  const handleOpenCreate = () => {
    setEditingVehicle(null);
    setSaving(false);
    const activeLocId =
      activeBranch?.id || userContext?.active_location_id || selectedLocation || (locations.length > 0 ? locations[0].id : '');

    setFormData({
      vehicle_number: '',
      registration_number: '',
      vehicle_type: 'SCHOOL_BUS',
      location_id: activeLocId,
      make: '',
      model: '',
      capacity: 40,
      fuel_type: 'DIESEL',
      purchase_date: '',
      insurance_expiry: '',
      fitness_expiry: '',
      permit_expiry: '',
      puc_expiry: '',
      gps_device_id: '',
      status: 'ACTIVE',
      next_service_due: '',
      remarks: '',
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setSaving(false);
    const activeLocId =
      v.location_id ||
      activeBranch?.id ||
      userContext?.active_location_id ||
      selectedLocation ||
      (locations.length > 0 ? locations[0].id : '');

    setFormData({
      vehicle_number: v.vehicle_number,
      registration_number: v.registration_number,
      vehicle_type: v.vehicle_type,
      location_id: activeLocId,
      make: v.make || '',
      model: v.model || '',
      capacity: v.capacity,
      fuel_type: v.fuel_type || 'DIESEL',
      purchase_date: v.purchase_date || '',
      insurance_expiry: v.insurance_expiry || '',
      fitness_expiry: v.fitness_expiry || '',
      permit_expiry: v.permit_expiry || '',
      puc_expiry: v.puc_expiry || '',
      gps_device_id: v.gps_device_id || '',
      status: v.status,
      next_service_due: v.next_service_due || '',
      remarks: v.remarks || '',
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.vehicle_number.trim()) {
      setFormError('Vehicle Number is required (e.g. BUS-01)');
      return;
    }
    if (!formData.registration_number.trim()) {
      setFormError('Registration Number is required (e.g. UP14AB1234)');
      return;
    }

    const resolvedLocationId =
      formData.location_id ||
      activeBranch?.id ||
      userContext?.active_location_id ||
      selectedLocation ||
      (locations.length > 0 ? locations[0].id : null);

    if (!resolvedLocationId) {
      setFormError('Please select a valid campus/location before registering the vehicle.');
      return;
    }

    const payload = {
      ...formData,
      vehicle_number: formData.vehicle_number.trim(),
      registration_number: formData.registration_number.trim().toUpperCase(),
      location_id: resolvedLocationId,
    };

    try {
      setSaving(true);
      if (editingVehicle) {
        await api.put<Vehicle>(`/transport/vehicles/${editingVehicle.id}`, payload);
      } else {
        await api.post<Vehicle>('/transport/vehicles', payload);
      }
      setIsCreateModalOpen(false);
      loadVehicles();
    } catch (err: any) {
      setFormError(err.message || 'Error saving vehicle');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="emerald">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="slate">Inactive</Badge>;
      case 'MAINTENANCE':
        return <Badge variant="amber">Maintenance</Badge>;
      case 'RETIRED':
        return <Badge variant="rose">Retired</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Vehicle Master</h1>
            <p className="text-xs text-slate-500">
              Manage school bus fleet, vans, seating capacity, and compliance certificates.
            </p>
          </div>
        </div>

        {canCreateVehicle && (
          <Button variant="primary" size="sm" onClick={handleOpenCreate} icon={<Plus className="w-3.5 h-3.5" />}>
            Register Vehicle
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by vehicle no, registration, make, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadVehicles()}
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
          <option value="MAINTENANCE">Maintenance</option>
          <option value="RETIRED">Retired</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 w-full md:w-auto"
        >
          <option value="">All Types</option>
          <option value="SCHOOL_BUS">School Bus</option>
          <option value="VAN">Van</option>
          <option value="MINI_BUS">Mini Bus</option>
          <option value="OTHER">Other</option>
        </select>

        {locations.length > 0 && (
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 w-full md:w-auto"
          >
            <option value="">All Campuses</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.location_name}
              </option>
            ))}
          </select>
        )}

        <Button variant="secondary" size="sm" onClick={loadVehicles}>
          Apply
        </Button>
      </div>

      {/* Vehicles Table */}
      <Card className="bg-white border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                <th className="p-3">Vehicle No</th>
                <th className="p-3">Registration</th>
                <th className="p-3">Type</th>
                <th className="p-3">Capacity / Seating</th>
                <th className="p-3">Assigned Route</th>
                <th className="p-3">Driver</th>
                <th className="p-3">Compliance</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Loading vehicles from database...
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No vehicles found matching the selected filters.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{v.vehicle_number}</div>
                      <div className="text-2xs text-slate-400">
                        {v.make && v.model ? `${v.make} ${v.model}` : 'Standard Fleet'}
                      </div>
                    </td>
                    <td className="p-3 font-mono font-medium text-slate-800">
                      {v.registration_number}
                    </td>
                    <td className="p-3">
                      <Badge variant="indigo">{v.vehicle_type.replace('_', ' ')}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-900">
                        {v.assigned_student_count || 0} / {v.capacity} seats
                      </div>
                      <div className="text-2xs text-slate-400">
                        {v.available_seats || 0} available ({v.utilization_percentage || 0}%)
                      </div>
                    </td>
                    <td className="p-3">
                      {v.current_route ? (
                        <div>
                          <div className="font-medium text-slate-800">{v.current_route.route_name}</div>
                          <div className="text-2xs text-slate-400 font-mono">{v.current_route.route_code}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-2xs">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3">
                      {v.current_driver ? (
                        <div className="font-medium text-slate-800">
                          {`${v.current_driver.first_name || ''} ${v.current_driver.last_name || ''}`.trim() ||
                            v.current_driver.username}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-2xs">No Driver</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="space-y-0.5 text-2xs">
                        {v.insurance_expiry && (
                          <div className="text-slate-500">
                            Ins: <span className="font-mono">{new Date(v.insurance_expiry).toLocaleDateString()}</span>
                          </div>
                        )}
                        {v.fitness_expiry && (
                          <div className="text-slate-500">
                            Fit: <span className="font-mono">{new Date(v.fitness_expiry).toLocaleDateString()}</span>
                          </div>
                        )}
                        {!v.insurance_expiry && !v.fitness_expiry && (
                          <span className="text-slate-400 italic text-2xs">No expiries logged</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{getStatusBadge(v.status)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingVehicle(v)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View
                        </Button>
                        {canUpdateVehicle && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(v)}
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
      {isCreateModalOpen && (
        <Modal
          isOpen={true}
          onClose={handleCloseModal}
          title={editingVehicle ? `Edit Vehicle: ${editingVehicle.vehicle_number}` : 'Register New Vehicle'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Campus Context Indicator (Read-only, automatically inherited) */}
            <div className="flex items-center gap-2 px-3 py-2 bg-teal-50/60 border border-teal-200/80 rounded-lg text-xs text-teal-800">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
              <span>
                Assigned Campus / Branch:{' '}
                <strong className="text-teal-950">
                  {activeBranch?.location_name ||
                    locations.find((l) => l.id === (formData.location_id || activeBranch?.id))?.location_name ||
                    'Dwarka Main Campus'}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. BUS-01"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Registration Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. UP14AB1234"
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Vehicle Type
                </label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as VehicleType })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                >
                  <option value="SCHOOL_BUS">School Bus</option>
                  <option value="VAN">Van</option>
                  <option value="MINI_BUS">Mini Bus</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Seating Capacity *
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Make / Manufacturer</label>
                <input
                  type="text"
                  placeholder="e.g. Tata Motors, Force"
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Model</label>
                <input
                  type="text"
                  placeholder="e.g. Starbus 40"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Fuel Type</label>
                <select
                  value={formData.fuel_type}
                  onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                >
                  <option value="DIESEL">Diesel</option>
                  <option value="CNG">CNG</option>
                  <option value="PETROL">Petrol</option>
                  <option value="ELECTRIC">Electric</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as VehicleStatus })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="RETIRED">Retired</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Insurance Expiry</label>
                <input
                  type="date"
                  value={formData.insurance_expiry}
                  onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Fitness Expiry</label>
                <input
                  type="date"
                  value={formData.fitness_expiry}
                  onChange={(e) => setFormData({ ...formData, fitness_expiry: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">GPS Device ID</label>
                <input
                  type="text"
                  placeholder="Optional GPS IMEI / ID"
                  value={formData.gps_device_id}
                  onChange={(e) => setFormData({ ...formData, gps_device_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Next Service Due</label>
                <input
                  type="date"
                  value={formData.next_service_due}
                  onChange={(e) => setFormData({ ...formData, next_service_due: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Remarks / Notes</label>
              <textarea
                rows={2}
                placeholder="Additional vehicle notes..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" type="button" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingVehicle ? 'Update Vehicle' : 'Register Vehicle'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Vehicle Detail Viewer Modal */}
      {viewingVehicle && (
        <Modal
          isOpen={true}
          onClose={() => setViewingVehicle(null)}
          title={`Vehicle Details: ${viewingVehicle.vehicle_number}`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="text-lg font-bold text-slate-900">{viewingVehicle.vehicle_number}</div>
                <div className="font-mono text-xs text-slate-500">{viewingVehicle.registration_number}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="indigo">{viewingVehicle.vehicle_type.replace('_', ' ')}</Badge>
                {getStatusBadge(viewingVehicle.status)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-2xs text-slate-400 block font-semibold">Make & Model</span>
                <span className="text-slate-800 font-medium">
                  {viewingVehicle.make && viewingVehicle.model
                    ? `${viewingVehicle.make} ${viewingVehicle.model}`
                    : 'N/A'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-2xs text-slate-400 block font-semibold">Seating Capacity</span>
                <span className="text-slate-800 font-medium">
                  {viewingVehicle.capacity} seats ({viewingVehicle.assigned_student_count || 0} assigned)
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-2xs text-slate-400 block font-semibold">Assigned Route</span>
                <span className="text-slate-800 font-medium">
                  {viewingVehicle.current_route?.route_name || 'Unassigned'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-2xs text-slate-400 block font-semibold">Assigned Driver</span>
                <span className="text-slate-800 font-medium">
                  {viewingVehicle.current_driver
                    ? `${viewingVehicle.current_driver.first_name || ''} ${viewingVehicle.current_driver.last_name || ''}`.trim() ||
                      viewingVehicle.current_driver.username
                    : 'Unassigned'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs">
              <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider block">
                Compliance Dates
              </span>
              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div>
                  Insurance Expiry:{' '}
                  <span className="font-mono font-semibold">
                    {viewingVehicle.insurance_expiry ? new Date(viewingVehicle.insurance_expiry).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  Fitness Expiry:{' '}
                  <span className="font-mono font-semibold">
                    {viewingVehicle.fitness_expiry ? new Date(viewingVehicle.fitness_expiry).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  Next Service Due:{' '}
                  <span className="font-mono font-semibold">
                    {viewingVehicle.next_service_due ? new Date(viewingVehicle.next_service_due).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  GPS Device ID:{' '}
                  <span className="font-mono font-semibold">{viewingVehicle.gps_device_id || 'Not Configured'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setViewingVehicle(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
