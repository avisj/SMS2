// ========================================================================
// Driver / Transport Staff Module
// Assign Staff / Faculty Users to Fleet Vehicles with License Validation
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Bus,
  Search,
  Plus,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { usePermission } from '../../hooks/usePermission.js';
import { Vehicle, VehicleDriverAssignment, User } from '../../types/index.js';

interface DriverStaffModuleProps {
  tabId: string;
}

export const DriverStaffModule: React.FC<DriverStaffModuleProps> = ({ tabId }) => {
  const { hasPermission, isSuperAdmin } = usePermission();
  const canAssignDriver = isSuperAdmin || hasPermission('transport.driver.assign');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<VehicleDriverAssignment[]>([]);
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null);

  // Form
  const [driverUserId, setDriverUserId] = useState<string>('');
  const [licenseNumber, setLicenseNumber] = useState<string>('');
  const [licenseExpiry, setLicenseExpiry] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vRes, staffRes] = await Promise.all([
        api.get<any>('/transport/vehicles', { status: 'ACTIVE', limit: 100 }),
        api.get<any[]>('/transport/drivers/available'),
      ]);
      const vList: Vehicle[] = Array.isArray(vRes) ? vRes : (vRes?.data || []);
      setVehicles(vList);
      if (staffRes) setAvailableStaff(staffRes);
    } catch (err) {
      console.error('Error loading driver data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsAssignModalOpen(false);
    setSaving(false);
    setFormError('');
  };

  const handleOpenAssign = (v: Vehicle) => {
    setSelectedVehicle(v);
    setSaving(false);
    setDriverUserId(v.current_driver?.id || '');
    setLicenseNumber(v.current_driver_assignment?.license_number || '');
    setLicenseExpiry(v.current_driver_assignment?.license_expiry || '');
    setStartDate(new Date().toISOString().split('T')[0]);
    setFormError('');
    setIsAssignModalOpen(true);
  };

  const handleViewHistory = async (v: Vehicle) => {
    setHistoryVehicle(v);
    try {
      const res = await api.get<VehicleDriverAssignment[]>(`/transport/vehicles/${v.id}/drivers`);
      if (res) {
        setAssignmentHistory(res);
      }
    } catch (err) {
      console.error('Failed to load driver history:', err);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !driverUserId) {
      setFormError('Please select a driver from the staff directory.');
      return;
    }

    try {
      setSaving(true);
      await api.post<VehicleDriverAssignment>(
        `/transport/vehicles/${selectedVehicle.id}/assign-driver`,
        {
          driver_user_id: driverUserId,
          license_number: licenseNumber,
          license_expiry: licenseExpiry || undefined,
          start_date: startDate,
        }
      );

      setIsAssignModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error assigning driver');
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
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Driver & Transport Staff</h1>
            <p className="text-xs text-slate-500">
              Assign authorized school staff members as drivers to vehicles and track driving licenses.
            </p>
          </div>
        </div>
      </div>

      {/* Fleet Driver Assignments Table */}
      <Card className="bg-white border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                <th className="p-3">Vehicle</th>
                <th className="p-3">Assigned Route</th>
                <th className="p-3">Current Driver</th>
                <th className="p-3">Driving License</th>
                <th className="p-3">License Expiry</th>
                <th className="p-3">Assigned Since</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Loading driver assignments...
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No active vehicles found in fleet.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{v.vehicle_number}</div>
                      <div className="text-2xs font-mono text-slate-400">{v.registration_number}</div>
                    </td>
                    <td className="p-3">
                      {v.current_route ? (
                        <div>
                          <div className="font-medium text-slate-800">{v.current_route.route_name}</div>
                          <div className="text-2xs text-slate-400">{v.current_route.route_code}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-2xs">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3">
                      {v.current_driver ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-2xs">
                            {v.current_driver.first_name?.[0] || 'D'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {`${v.current_driver.first_name || ''} ${v.current_driver.last_name || ''}`.trim() ||
                                v.current_driver.username}
                            </div>
                            <div className="text-2xs text-slate-400">{v.current_driver.email}</div>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="amber">No Driver Assigned</Badge>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-700">
                      {v.current_driver_assignment?.license_number || (
                        <span className="text-slate-400 italic text-2xs">Not specified</span>
                      )}
                    </td>
                    <td className="p-3">
                      {v.current_driver_assignment?.license_expiry ? (
                        <span className="font-mono text-xs">
                          {new Date(v.current_driver_assignment.license_expiry).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-2xs">N/A</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500">
                      {v.current_driver_assignment?.start_date
                        ? new Date(v.current_driver_assignment.start_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canAssignDriver && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenAssign(v)}
                            icon={<UserCheck className="w-3.5 h-3.5" />}
                          >
                            {v.current_driver ? 'Change Driver' : 'Assign Driver'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewHistory(v)}
                          icon={<Clock className="w-3.5 h-3.5" />}
                        >
                          History
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Driver Assignment Modal */}
      {isAssignModalOpen && selectedVehicle && (
        <Modal
          isOpen={true}
          onClose={handleCloseModal}
          title={`Assign Driver to ${selectedVehicle.vehicle_number} (${selectedVehicle.registration_number})`}
        >
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                Select Driver (Eligible Transport Drivers) *
              </label>
              <select
                value={driverUserId}
                onChange={(e) => {
                  const uid = e.target.value;
                  setDriverUserId(uid);
                  const s = availableStaff.find((st) => st.id === uid);
                  if (s?.driver_profile?.license_number) {
                    setLicenseNumber(s.driver_profile.license_number);
                  }
                  if (s?.driver_profile?.license_expiry) {
                    setLicenseExpiry(s.driver_profile.license_expiry);
                  }
                }}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                required
              >
                <option value="">-- Select Driver --</option>
                {availableStaff.length === 0 ? (
                  <option value="" disabled>No eligible transport drivers found.</option>
                ) : (
                  availableStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {`${s.first_name || ''} ${s.last_name || ''}`.trim() || s.username} ({s.employee_code || s.email})
                      {s.driver_profile?.license_number ? ` — Lic: ${s.driver_profile.license_number}` : ''}
                    </option>
                  ))
                )}
              </select>
              {availableStaff.length === 0 && (
                <p className="text-2xs text-amber-600 mt-1">
                  No eligible transport drivers found. Drivers must have a certified transport driver profile.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Driving License Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. DL-0420110012345"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  License Expiry Date
                </label>
                <input
                  type="date"
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                Assignment Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" type="button" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? 'Assigning...' : 'Save Assignment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Driver Assignment History Modal */}
      {historyVehicle && (
        <Modal
          isOpen={true}
          onClose={() => setHistoryVehicle(null)}
          title={`Driver Assignment History: ${historyVehicle.vehicle_number}`}
        >
          <div className="space-y-3">
            {assignmentHistory.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No past driver assignments recorded for this vehicle.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {assignmentHistory.map((h) => (
                  <div key={h.id} className="py-3 flex items-start justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">
                        {h.driver
                          ? `${h.driver.first_name || ''} ${h.driver.last_name || ''}`.trim() || h.driver.username
                          : 'Driver ID: ' + h.driver_user_id}
                      </div>
                      <div className="text-2xs text-slate-500 font-mono">
                        License: {h.license_number || 'N/A'} (Exp: {h.license_expiry || 'N/A'})
                      </div>
                      <div className="text-2xs text-slate-400">
                        Duration: {new Date(h.start_date).toLocaleDateString()} —{' '}
                        {h.end_date ? new Date(h.end_date).toLocaleDateString() : 'Present'}
                      </div>
                    </div>
                    <Badge variant={h.status === 'ACTIVE' ? 'emerald' : 'slate'}>{h.status}</Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setHistoryVehicle(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
