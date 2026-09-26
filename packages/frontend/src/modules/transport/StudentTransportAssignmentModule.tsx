// ========================================================================
// Student Transport Assignment Module
// Operational Assignment Linking Student Academic Enrollment to Route & Stops
// Does NOT modify or overwrite student academic enrollments.
// Enforces vehicle capacity warnings and historical continuity.
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Bus,
  MapPin,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import {
  StudentTransportAssignment,
  TransportRoute,
  TransportRouteStop,
  Vehicle,
  AcademicSession,
  Location,
} from '../../types/index.js';

interface StudentTransportAssignmentModuleProps {
  tabId: string;
}

export const StudentTransportAssignmentModule: React.FC<StudentTransportAssignmentModuleProps> = ({ tabId }) => {
  const { activeBranch, userContext } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermission();
  const canAssignStudent = isSuperAdmin || hasPermission('transport.student_assignment.create');
  const canManageAssignment = isSuperAdmin || hasPermission('transport.student_assignment.manage');

  const [assignments, setAssignments] = useState<StudentTransportAssignment[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [search, setSearch] = useState<string>('');

  // Modal: New Assignment
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [searchingStudents, setSearchingStudents] = useState<boolean>(false);
  const [selectedStudentUserId, setSelectedStudentUserId] = useState<string>('');
  const [selectedStudentEnrollment, setSelectedStudentEnrollment] = useState<any>(null);

  const [formRouteId, setFormRouteId] = useState<string>('');
  const [formStops, setFormStops] = useState<TransportRouteStop[]>([]);
  const [formPickupStopId, setFormPickupStopId] = useState<string>('');
  const [formDropStopId, setFormDropStopId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    loadPrerequisites();
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [selectedSessionId, selectedLocationId, selectedRouteId, statusFilter]);

  useEffect(() => {
    if (formRouteId) {
      loadRouteStops(formRouteId);
    } else {
      setFormStops([]);
    }
  }, [formRouteId]);

  const loadPrerequisites = async () => {
    try {
      const [sessRes, locRes, routeRes] = await Promise.all([
        api.get<AcademicSession[]>('/academics/sessions'),
        api.get<Location[]>('/locations'),
        api.get<any>('/transport/routes', { status: 'ACTIVE', limit: 100 }),
      ]);

      if (sessRes) {
        setSessions(sessRes);
        const cur = sessRes.find((s: AcademicSession) => s.is_current);
        if (cur) {
          setSelectedSessionId(cur.id);
        } else if (sessRes.length > 0) {
          setSelectedSessionId(sessRes[0].id);
        }
      }
      if (locRes) {
        setLocations(locRes);
        if (locRes.length > 0) setSelectedLocationId(locRes[0].id);
      }
      const rList: TransportRoute[] = Array.isArray(routeRes) ? routeRes : (routeRes?.data || []);
      setRoutes(rList);
    } catch (err) {
      console.error('Error loading prerequisites:', err);
    }
  };

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (selectedSessionId) params.academic_session_id = selectedSessionId;
      if (selectedLocationId) params.location_id = selectedLocationId;
      if (selectedRouteId) params.route_id = selectedRouteId;
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const res = await api.get<any>('/transport/student-assignments', params);
      const list: StudentTransportAssignment[] = Array.isArray(res) ? res : (res?.data || []);
      setAssignments(list);
    } catch (err) {
      console.error('Error loading student assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRouteStops = async (routeId: string) => {
    try {
      const res = await api.get<any>(`/transport/routes/${routeId}/stops`);
      const list: TransportRouteStop[] = Array.isArray(res) ? res : (res?.data || []);
      setFormStops(list);
      if (list.length > 0) {
        setFormPickupStopId(list[0].id);
        setFormDropStopId(list[list.length - 1].id);
      }
    } catch (err) {
      console.error('Error loading route stops:', err);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSaving(false);
    setFormError('');
  };

  const handleOpenAssignModal = async () => {
    setSaving(false);
    setFormError('');
    setSelectedStudentUserId('');
    setSelectedStudentEnrollment(null);
    setFormRouteId(routes[0]?.id || '');
    setStartDate(new Date().toISOString().split('T')[0]);
    setRemarks('');

    // Fetch active student enrollments for the selected session
    try {
      setSearchingStudents(true);
      const queryParams: Record<string, string> = {};
      const activeSession = selectedSessionId || sessions.find((s) => s.is_current)?.id || sessions[0]?.id;
      if (activeSession) queryParams.session_id = activeSession;
      const res = await api.get<any[]>(
        '/transport/students/enrollment-lookup',
        queryParams
      );
      if (res) {
        setEnrolledStudents(res);
      }
    } catch (err) {
      console.error('Error loading enrollments:', err);
    } finally {
      setSearchingStudents(false);
    }

    setIsModalOpen(true);
  };

  const handleSelectStudent = (studentUserId: string) => {
    setSelectedStudentUserId(studentUserId);
    const found = enrolledStudents.find((e) => e.student_user_id === studentUserId);
    setSelectedStudentEnrollment(found || null);
    if (found?.academic_session_id && !selectedSessionId) {
      setSelectedSessionId(found.academic_session_id);
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedStudentUserId) {
      setFormError('Please select a student from academic enrollments.');
      return;
    }
    if (!formRouteId) {
      setFormError('Please select an active route.');
      return;
    }

    const targetLocationId =
      selectedLocationId ||
      activeBranch?.id ||
      userContext?.active_location_id ||
      (locations.length > 0 ? locations[0].id : null);

    if (!targetLocationId) {
      setFormError('Please select a campus/branch before assigning transport.');
      return;
    }

    const targetSessionId =
      selectedStudentEnrollment?.academic_session_id ||
      selectedSessionId ||
      sessions.find((s) => s.is_current)?.id ||
      sessions[0]?.id;

    if (!targetSessionId) {
      setFormError('Academic session is required. Please ensure an academic session exists.');
      return;
    }

    if (selectedRouteObj?.assigned_vehicle) {
      const cap = selectedRouteObj.capacity || selectedRouteObj.assigned_vehicle.capacity || 0;
      const assigned = selectedRouteObj.assigned_student_count ?? 0;
      if (cap > 0 && assigned >= cap) {
        setFormError(`Cannot assign student: Vehicle ${selectedRouteObj.assigned_vehicle.vehicle_number} has reached maximum capacity (${assigned}/${cap} seats taken).`);
        return;
      }
    }

    try {
      setSaving(true);
      await api.post<StudentTransportAssignment>('/transport/student-assignments', {
        academic_session_id: targetSessionId,
        location_id: targetLocationId,
        student_user_id: selectedStudentUserId,
        route_id: formRouteId,
        pickup_stop_id: formPickupStopId || undefined,
        drop_stop_id: formDropStopId || undefined,
        start_date: startDate,
        remarks: remarks || undefined,
      });

      setIsModalOpen(false);
      loadAssignments();
    } catch (err: any) {
      setFormError(err.message || 'Error assigning student to transport');
    } finally {
      setSaving(false);
    }
  };

  const handleEndAssignment = async (id: string) => {
    if (!window.confirm('End this student transport assignment? It will be marked as COMPLETED and preserved in history.'))
      return;
    try {
      await api.put(`/transport/student-assignments/${id}/end`, {
        end_date: new Date().toISOString().split('T')[0],
      });
      loadAssignments();
    } catch (err) {
      console.error('Failed to end assignment:', err);
    }
  };

  const selectedRouteObj = routes.find((r) => r.id === formRouteId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Student Transport Assignment</h1>
            <p className="text-xs text-slate-500">
              Assign enrolled students to routes, pickup & drop stops with real-time fleet capacity enforcement.
            </p>
          </div>
        </div>

        {canAssignStudent && (
          <Button variant="primary" size="sm" onClick={handleOpenAssignModal} icon={<Plus className="w-3.5 h-3.5" />}>
            Assign Student Transport
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search assigned student name or admission number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadAssignments()}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <select
          value={selectedSessionId}
          onChange={(e) => setSelectedSessionId(e.target.value)}
          className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 w-full md:w-auto"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.is_current ? '(Current)' : ''}
            </option>
          ))}
        </select>

        <select
          value={selectedRouteId}
          onChange={(e) => setSelectedRouteId(e.target.value)}
          className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 w-full md:w-auto"
        >
          <option value="">All Routes</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.route_name} ({r.route_code})
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-700 w-full md:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="SUSPENDED">Suspended</option>
        </select>

        <Button variant="secondary" size="sm" onClick={loadAssignments}>
          Filter
        </Button>
      </div>

      {/* Assignments Table */}
      <Card className="bg-white border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                <th className="p-3">Student</th>
                <th className="p-3">Academic Placement</th>
                <th className="p-3">Route</th>
                <th className="p-3">Pickup Stop</th>
                <th className="p-3">Drop Stop</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Loading student transport assignments...
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No students currently assigned to transport for the selected filters.
                  </td>
                </tr>
              ) : (
                assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">
                        {a.student
                          ? `${a.student.first_name || ''} ${a.student.last_name || ''}`.trim() || a.student.username
                          : 'Student User'}
                      </div>
                      <div className="text-2xs font-mono text-slate-400">
                        Adm: {a.admission_number || a.student?.username || '—'}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">
                        {a.class_name ? `${a.class_name} - ${a.section_name || 'A'}` : 'Academic Enrolled'}
                      </div>
                      <div className="text-2xs text-slate-400">{a.session?.name}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{a.route?.route_name || 'Assigned Route'}</div>
                      <div className="text-2xs font-mono text-slate-400">{a.route?.route_code}</div>
                    </td>
                    <td className="p-3 text-slate-700">
                      {a.pickup_stop ? (
                        <div>
                          <div className="font-medium text-slate-800">{a.pickup_stop.stop_name}</div>
                          <div className="text-2xs text-emerald-700 font-mono">
                            Pickup: {a.pickup_stop.pickup_time || '07:30'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-2xs">Route Origin</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-700">
                      {a.drop_stop ? (
                        <div>
                          <div className="font-medium text-slate-800">{a.drop_stop.stop_name}</div>
                          <div className="text-2xs text-indigo-700 font-mono">
                            Drop: {a.drop_stop.drop_time || '14:30'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-2xs">Route Terminus</span>
                      )}
                    </td>
                    <td className="p-3">
                      {a.vehicle ? (
                        <div>
                          <div className="font-bold text-slate-800">{a.vehicle.vehicle_number}</div>
                          <div className="text-2xs font-mono text-slate-400">{a.vehicle.registration_number}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-2xs">Standard Route Bus</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant={a.status === 'ACTIVE' ? 'emerald' : a.status === 'COMPLETED' ? 'slate' : 'rose'}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {a.status === 'ACTIVE' && canManageAssignment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEndAssignment(a.id)}
                          icon={<XCircle className="w-3.5 h-3.5 text-rose-500" />}
                        >
                          End Route
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Assignment Modal */}
      {isModalOpen && (
        <Modal isOpen={true} onClose={handleCloseModal} title="Assign Student to Transport Route">
          <form onSubmit={handleSaveAssignment} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Select Enrolled Student */}
            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                Select Student from Academic Enrollment *
              </label>
              {searchingStudents ? (
                <div className="text-xs text-slate-400 py-2">Loading enrolled students...</div>
              ) : (
                <>
                  <select
                    value={selectedStudentUserId}
                    onChange={(e) => handleSelectStudent(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-teal-500"
                    required
                  >
                    <option value="">-- Choose Student --</option>
                    {enrolledStudents.length === 0 ? (
                      <option value="" disabled>No eligible enrolled students found.</option>
                    ) : (
                      enrolledStudents.map((enr) => {
                        const name = enr.student
                          ? `${enr.student.first_name || ''} ${enr.student.last_name || ''}`.trim() || enr.student.username
                          : enr.student_user_id;
                        const cName = enr.class?.name || enr.class?.display_name || enr.class_name;
                        const sName = enr.section?.name || enr.section_name;
                        const placement = cName && sName ? `Class: ${cName} (${sName})` : cName ? `Class: ${cName}` : 'Enrolled';
                        return (
                          <option key={enr.student_user_id} value={enr.student_user_id}>
                            {name} — Adm: {enr.admission_number || 'N/A'} — {placement}
                          </option>
                        );
                      })
                    )}
                  </select>
                  {enrolledStudents.length === 0 && (
                    <p className="text-2xs text-amber-600 mt-1">
                      No eligible enrolled students found for the active academic session.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Selected Student Confirmation Card */}
            {selectedStudentEnrollment && (
              <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-teal-900">
                    {selectedStudentEnrollment.student
                      ? `${selectedStudentEnrollment.student.first_name || ''} ${selectedStudentEnrollment.student.last_name || ''}`.trim() || selectedStudentEnrollment.student.username
                      : selectedStudentEnrollment.student_user_id}
                  </div>
                  <div className="text-2xs text-teal-700">
                    Academic Placement:{' '}
                    {(() => {
                      const c = selectedStudentEnrollment.class?.name || selectedStudentEnrollment.class?.display_name || selectedStudentEnrollment.class_name;
                      const s = selectedStudentEnrollment.section?.name || selectedStudentEnrollment.section_name;
                      if (c && s) return `${c} — Section ${s}`;
                      if (c) return c;
                      if (selectedStudentEnrollment.session?.session_name) return `Enrolled in ${selectedStudentEnrollment.session.session_name}`;
                      return 'Active Academic Placement';
                    })()}
                  </div>
                  <div className="text-2xs text-teal-600 mt-0.5">
                    Admission No: {selectedStudentEnrollment.admission_number || 'N/A'}
                    {selectedStudentEnrollment.roll_number ? ` • Roll No: ${selectedStudentEnrollment.roll_number}` : ''}
                  </div>
                </div>
                <Badge variant="emerald">Enrolled</Badge>
              </div>
            )}

            {/* Route & Vehicle Capacity Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Transport Route *</label>
                <select
                  value={formRouteId}
                  onChange={(e) => setFormRouteId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  required
                >
                  <option value="">-- Select Route --</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.route_name} ({r.route_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Pickup Stop</label>
                <select
                  value={formPickupStopId}
                  onChange={(e) => setFormPickupStopId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                >
                  <option value="">-- Origin / Start Point --</option>
                  {formStops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sequence_number}. {s.stop_name} ({s.pickup_time || '07:30'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Drop Stop</label>
                <select
                  value={formDropStopId}
                  onChange={(e) => setFormDropStopId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                >
                  <option value="">-- Terminus / End Point --</option>
                  {formStops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sequence_number}. {s.stop_name} ({s.drop_time || '14:30'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vehicle Capacity Meter */}
            {selectedRouteObj?.assigned_vehicle && (() => {
              const vehicle = selectedRouteObj.assigned_vehicle;
              const routeCapacity = selectedRouteObj.capacity || vehicle.capacity || 0;
              const assignedCount = selectedRouteObj.assigned_student_count ?? 0;
              const availableSeats = selectedRouteObj.available_seats ?? Math.max(0, routeCapacity - assignedCount);
              const isFull = routeCapacity > 0 && assignedCount >= routeCapacity;

              return (
                <div className={`p-3 border rounded-lg space-y-1.5 ${isFull ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between text-2xs">
                    <span className="font-bold text-slate-700">
                      Vehicle: {vehicle.vehicle_number} {vehicle.make ? `(${vehicle.make})` : ''}
                    </span>
                    <span className={`font-bold ${isFull ? 'text-rose-700' : 'text-slate-900'}`}>
                      {assignedCount} / {routeCapacity} seats taken ({availableSeats} available)
                    </span>
                  </div>
                  {routeCapacity > 0 && (
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isFull ? 'bg-rose-600' : assignedCount / routeCapacity > 0.8 ? 'bg-amber-500' : 'bg-teal-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.round((assignedCount / routeCapacity) * 100))}%` }}
                      />
                    </div>
                  )}
                  {isFull && (
                    <div className="text-2xs text-rose-600 font-bold flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Warning: Vehicle capacity has been reached ({assignedCount}/{routeCapacity} seats taken).
                    </div>
                  )}
                </div>
              );
            })()}

            <div>
              <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">Remarks</label>
              <input
                type="text"
                placeholder="Parent pickup notes or special instructions..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" type="button" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={
                  saving ||
                  (selectedRouteObj?.assigned_vehicle
                    ? ((selectedRouteObj.capacity || selectedRouteObj.assigned_vehicle.capacity || 0) > 0 &&
                        (selectedRouteObj.assigned_student_count ?? 0) >=
                          (selectedRouteObj.capacity || selectedRouteObj.assigned_vehicle.capacity || 0))
                    : false)
                }
              >
                {saving ? 'Assigning...' : 'Confirm Transport Assignment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
