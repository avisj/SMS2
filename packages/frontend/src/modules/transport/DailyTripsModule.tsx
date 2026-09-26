// ========================================================================
// Daily Trips Module
// Schedule, Start, Track and Complete School Transport Trips (Morning Pickup & Afternoon Drop)
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Bus,
  Navigation,
  UserCheck,
  Calendar,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { TransportTrip, TransportRoute, Vehicle, TripType, TripStatus } from '../../types/index.js';

interface DailyTripsModuleProps {
  tabId: string;
}

export const DailyTripsModule: React.FC<DailyTripsModuleProps> = ({ tabId }) => {
  const [trips, setTrips] = useState<TransportTrip[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [tripDate, setTripDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formRouteId, setFormRouteId] = useState<string>('');
  const [formVehicleId, setFormVehicleId] = useState<string>('');
  const [formDriverUserId, setFormDriverUserId] = useState<string>('');
  const [formTripType, setFormTripType] = useState<TripType>('PICKUP');
  const [scheduledStart, setScheduledStart] = useState<string>('07:00');
  const [scheduledEnd, setScheduledEnd] = useState<string>('08:15');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    loadTrips();
  }, [tripDate, statusFilter]);

  const loadMetadata = async () => {
    try {
      const [rRes, vRes, staffRes] = await Promise.all([
        api.get<any>('/transport/routes', { status: 'ACTIVE', limit: 100 }),
        api.get<any>('/transport/vehicles', { status: 'ACTIVE', limit: 100 }),
        api.get<any[]>('/transport/drivers/available'),
      ]);
      const rList: TransportRoute[] = Array.isArray(rRes) ? rRes : (rRes?.data || []);
      const vList: Vehicle[] = Array.isArray(vRes) ? vRes : (vRes?.data || []);
      setRoutes(rList);
      setVehicles(vList);
      if (staffRes) setAvailableStaff(staffRes);
    } catch (err) {
      console.error('Error loading trip metadata:', err);
    }
  };

  const loadTrips = async () => {
    try {
      setLoading(true);
      const params: any = { trip_date: tripDate };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<any>('/transport/trips', params);
      const list: TransportTrip[] = Array.isArray(res) ? res : (res?.data || []);
      setTrips(list);
    } catch (err) {
      console.error('Error loading trips:', err);
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
    setSaving(false);
    setFormRouteId(routes[0]?.id || '');
    const firstRoute = routes[0];
    setFormVehicleId(firstRoute?.assigned_vehicle_id || vehicles[0]?.id || '');
    setFormDriverUserId(firstRoute?.primary_driver_user_id || availableStaff[0]?.id || '');
    setFormTripType('PICKUP');
    setScheduledStart('07:00');
    setScheduledEnd('08:15');
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleRouteChange = (rId: string) => {
    setFormRouteId(rId);
    const r = routes.find((item) => item.id === rId);
    if (r?.assigned_vehicle_id) setFormVehicleId(r.assigned_vehicle_id);
    if (r?.primary_driver_user_id) setFormDriverUserId(r.primary_driver_user_id);
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formRouteId) {
      setFormError('Please select a route');
      return;
    }

    try {
      setSaving(true);
      await api.post<TransportTrip>('/transport/trips', {
        trip_date: tripDate,
        route_id: formRouteId,
        vehicle_id: formVehicleId || undefined,
        driver_user_id: formDriverUserId || undefined,
        trip_type: formTripType,
        scheduled_start_time: scheduledStart,
        scheduled_end_time: scheduledEnd,
        notes: notes || undefined,
      });

      setIsModalOpen(false);
      loadTrips();
    } catch (err: any) {
      setFormError(err.message || 'Error scheduling trip');
    } finally {
      setSaving(false);
    }
  };

  const handleStartTrip = async (tripId: string) => {
    try {
      await api.put(`/transport/trips/${tripId}/start`);
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Error starting trip');
    }
  };

  const handleCompleteTrip = async (tripId: string) => {
    try {
      await api.put(`/transport/trips/${tripId}/complete`);
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Error completing trip');
    }
  };

  const handleCancelTrip = async (tripId: string) => {
    const reason = window.prompt('Enter reason for cancelling trip:');
    if (reason === null) return;
    try {
      await api.put(`/transport/trips/${tripId}/cancel`, { notes: reason });
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Error cancelling trip');
    }
  };

  const getTripStatusBadge = (status: TripStatus) => {
    switch (status) {
      case 'SCHEDULED':
        return <Badge variant="indigo">Scheduled</Badge>;
      case 'STARTED':
        return <Badge variant="amber">In Transit</Badge>;
      case 'COMPLETED':
        return <Badge variant="emerald">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="rose">Cancelled</Badge>;
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
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Daily Trips Dispatch</h1>
            <p className="text-xs text-slate-500">
              Schedule morning pickup and afternoon drop trips, monitor active transit, and log arrival times.
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={handleOpenCreate} icon={<Plus className="w-3.5 h-3.5" />}>
          Schedule Trip
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700">Trip Date:</span>
          <input
            type="date"
            value={tripDate}
            onChange={(e) => setTripDate(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-md font-mono"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 w-full md:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="STARTED">In Transit</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <Button variant="secondary" size="sm" onClick={loadTrips}>
          Refresh
        </Button>
      </div>

      {/* Trips Table */}
      <Card className="bg-white border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                <th className="p-3">Trip Type</th>
                <th className="p-3">Route</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Driver</th>
                <th className="p-3">Scheduled Window</th>
                <th className="p-3">Actual Movement</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Trip Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading trips...
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No transport trips found for {tripDate}. Click "+ Schedule Trip" to generate daily movements.
                  </td>
                </tr>
              ) : (
                trips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3">
                      <Badge variant={t.trip_type === 'PICKUP' ? 'teal' : 'purple'}>{t.trip_type}</Badge>
                      <div className="text-3xs text-slate-400 mt-1">{t.student_count || 0} students assigned</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{t.route?.route_name || 'Route'}</div>
                      <div className="text-2xs font-mono text-slate-400">{t.route?.route_code}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{t.vehicle?.vehicle_number}</div>
                      <div className="text-2xs font-mono text-slate-400">{t.vehicle?.registration_number}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">
                        {t.driver
                          ? `${t.driver.first_name || ''} ${t.driver.last_name || ''}`.trim() || t.driver.username
                          : 'Assigned Driver'}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {t.scheduled_start_time || '—'} - {t.scheduled_end_time || '—'}
                    </td>
                    <td className="p-3">
                      {t.actual_start_at ? (
                        <div className="text-2xs space-y-0.5">
                          <div className="text-emerald-700">
                            Start: {new Date(t.actual_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {t.actual_end_at && (
                            <div className="text-purple-700">
                              End: {new Date(t.actual_end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-2xs">Not started</span>
                      )}
                    </td>
                    <td className="p-3">{getTripStatusBadge(t.status)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {t.status === 'SCHEDULED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStartTrip(t.id)}
                            icon={<Play className="w-3.5 h-3.5" />}
                          >
                            Start Trip
                          </Button>
                        )}
                        {t.status === 'STARTED' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCompleteTrip(t.id)}
                            icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                          >
                            Complete
                          </Button>
                        )}
                        {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelTrip(t.id)}
                            icon={<XCircle className="w-3.5 h-3.5 text-rose-500" />}
                          >
                            Cancel
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

      {/* Schedule Trip Modal */}
      {isModalOpen && (
        <Modal isOpen={true} onClose={handleCloseModal} title="Schedule Daily Transport Trip">
          <form onSubmit={handleSaveTrip} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Select Route *</label>
                <select
                  value={formRouteId}
                  onChange={(e) => handleRouteChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  required
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.route_name} ({r.route_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Trip Type</label>
                <select
                  value={formTripType}
                  onChange={(e) => setFormTripType(e.target.value as TripType)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                >
                  <option value="PICKUP">Morning Pickup</option>
                  <option value="DROP">Afternoon Drop</option>
                  <option value="OTHER">Other / Special Trip</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Assigned Vehicle</label>
                <select
                  value={formVehicleId}
                  onChange={(e) => setFormVehicleId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  required
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} ({v.registration_number}) — {v.capacity} Seats
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Assigned Driver</label>
                <select
                  value={formDriverUserId}
                  onChange={(e) => setFormDriverUserId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  required
                >
                  {availableStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {`${s.first_name || ''} ${s.last_name || ''}`.trim() || s.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Scheduled Start Time</label>
                <input
                  type="time"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Scheduled End Time</label>
                <input
                  type="time"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Trip Instructions / Notes</label>
              <textarea
                rows={2}
                placeholder="Driver notes, escort details, or traffic deviations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" type="button" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? 'Scheduling...' : 'Dispatch Trip'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
