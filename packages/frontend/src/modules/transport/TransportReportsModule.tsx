// ========================================================================
// Transport Reports Module
// Fleet Capacity Utilization, Student Manifests, Expiry Audits, and Trips Ledger
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Bus,
  Navigation,
  Users,
  ShieldAlert,
  Activity,
  Download,
  Search,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { api } from '../../api/client.js';
import { TransportCapacityReportItem, Vehicle, StudentTransportAssignment, TransportTrip } from '../../types/index.js';

interface TransportReportsModuleProps {
  tabId: string;
}

type ReportTab = 'CAPACITY' | 'VEHICLES' | 'STUDENTS' | 'TRIPS' | 'EXPIRIES';

export const TransportReportsModule: React.FC<TransportReportsModuleProps> = ({ tabId }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('CAPACITY');
  const [loading, setLoading] = useState<boolean>(true);

  // Report datasets
  const [capacityReport, setCapacityReport] = useState<TransportCapacityReportItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignments, setAssignments] = useState<StudentTransportAssignment[]>([]);
  const [trips, setTrips] = useState<TransportTrip[]>([]);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    loadReportData();
  }, [activeTab]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'CAPACITY') {
        const res = await api.get<any>('/transport/reports/capacity');
        const list: TransportCapacityReportItem[] = Array.isArray(res) ? res : (res?.data || []);
        setCapacityReport(list);
      } else if (activeTab === 'VEHICLES' || activeTab === 'EXPIRIES') {
        const res = await api.get<any>('/transport/vehicles', { limit: 200 });
        const list: Vehicle[] = Array.isArray(res) ? res : (res?.data || []);
        setVehicles(list);
      } else if (activeTab === 'STUDENTS') {
        const res = await api.get<any>(
          '/transport/student-assignments',
          { limit: 200 }
        );
        const list: StudentTransportAssignment[] = Array.isArray(res) ? res : (res?.data || []);
        setAssignments(list);
      } else if (activeTab === 'TRIPS') {
        const res = await api.get<any>('/transport/trips', { limit: 200 });
        const list: TransportTrip[] = Array.isArray(res) ? res : (res?.data || []);
        setTrips(list);
      }
    } catch (err) {
      console.error('Error loading report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `transport_${activeTab.toLowerCase()}_report.csv`;

    if (activeTab === 'CAPACITY') {
      headers = ['Vehicle No', 'Registration', 'Route', 'Route Code', 'Capacity', 'Assigned Students', 'Available Seats', 'Utilization %', 'Status'];
      rows = capacityReport.map((c) => [
        c.vehicle_number,
        c.registration_number,
        c.route_name || 'Unassigned',
        c.route_code || 'N/A',
        c.capacity.toString(),
        c.assigned_students.toString(),
        c.available_seats.toString(),
        `${c.utilization_percentage}%`,
        c.status,
      ]);
    } else if (activeTab === 'VEHICLES') {
      headers = ['Vehicle No', 'Registration', 'Type', 'Capacity', 'Make/Model', 'Status', 'Driver', 'Route'];
      rows = vehicles.map((v) => [
        v.vehicle_number,
        v.registration_number,
        v.vehicle_type,
        v.capacity.toString(),
        `${v.make || ''} ${v.model || ''}`.trim() || 'N/A',
        v.status,
        v.current_driver ? v.current_driver.username : 'Unassigned',
        v.current_route ? v.current_route.route_name : 'Unassigned',
      ]);
    } else if (activeTab === 'STUDENTS') {
      headers = ['Student Name', 'Admission No', 'Class', 'Section', 'Route', 'Pickup Stop', 'Drop Stop', 'Vehicle', 'Status', 'Start Date'];
      rows = assignments.map((a) => [
        a.student ? `${a.student.first_name || ''} ${a.student.last_name || ''}`.trim() || a.student.username : 'Student',
        a.admission_number || a.student?.username || '',
        a.class_name || '',
        a.section_name || '',
        a.route?.route_name || '',
        a.pickup_stop?.stop_name || 'Origin',
        a.drop_stop?.stop_name || 'Terminus',
        a.vehicle?.vehicle_number || '',
        a.status,
        a.start_date,
      ]);
    } else if (activeTab === 'EXPIRIES') {
      headers = ['Vehicle No', 'Registration', 'Insurance Expiry', 'Fitness Expiry', 'Permit Expiry', 'PUC Expiry', 'Next Service Due'];
      rows = vehicles.map((v) => [
        v.vehicle_number,
        v.registration_number,
        v.insurance_expiry || 'N/A',
        v.fitness_expiry || 'N/A',
        v.permit_expiry || 'N/A',
        v.puc_expiry || 'N/A',
        v.next_service_due || 'N/A',
      ]);
    } else if (activeTab === 'TRIPS') {
      headers = ['Trip Date', 'Route', 'Vehicle', 'Trip Type', 'Scheduled Window', 'Actual Start', 'Actual End', 'Status'];
      rows = trips.map((t) => [
        t.trip_date,
        t.route?.route_name || '',
        t.vehicle?.vehicle_number || '',
        t.trip_type,
        `${t.scheduled_start_time || ''} - ${t.scheduled_end_time || ''}`,
        t.actual_start_at || '—',
        t.actual_end_at || '—',
        t.status,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((field) => `"${(field || '').replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Transport Reports & Analytics</h1>
            <p className="text-xs text-slate-500">
              Audit seating capacity utilization, student transport manifests, vehicle compliance expiries, and trips.
            </p>
          </div>
        </div>

        <Button variant="secondary" size="sm" onClick={handleExportCSV} icon={<Download className="w-3.5 h-3.5" />}>
          Export CSV
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('CAPACITY')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
            activeTab === 'CAPACITY' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bus className="w-3.5 h-3.5" />
          <span>Capacity Utilization</span>
        </button>

        <button
          onClick={() => setActiveTab('STUDENTS')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
            activeTab === 'STUDENTS' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Student Transport Manifest</span>
        </button>

        <button
          onClick={() => setActiveTab('VEHICLES')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
            activeTab === 'VEHICLES' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Fleet Vehicles Master</span>
        </button>

        <button
          onClick={() => setActiveTab('EXPIRIES')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
            activeTab === 'EXPIRIES' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Document Expiries</span>
        </button>

        <button
          onClick={() => setActiveTab('TRIPS')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
            activeTab === 'TRIPS' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Daily Trips Log</span>
        </button>
      </div>

      {/* Report Table Card */}
      <Card className="bg-white border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading report metrics...</div>
        ) : activeTab === 'CAPACITY' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Assigned Route</th>
                  <th className="p-3">Total Capacity</th>
                  <th className="p-3">Assigned Students</th>
                  <th className="p-3">Available Seats</th>
                  <th className="p-3">Seating Utilization</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {capacityReport.map((c) => (
                  <tr key={c.vehicle_id} className="hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{c.vehicle_number}</div>
                      <div className="text-2xs font-mono text-slate-400">{c.registration_number}</div>
                    </td>
                    <td className="p-3 font-medium text-slate-800">
                      {c.route_name ? `${c.route_name} (${c.route_code})` : 'Unassigned'}
                    </td>
                    <td className="p-3 font-bold text-slate-900">{c.capacity} seats</td>
                    <td className="p-3 font-medium text-teal-700">{c.assigned_students} students</td>
                    <td className="p-3 font-medium text-slate-600">{c.available_seats} seats</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              c.utilization_percentage >= 100
                                ? 'bg-rose-500'
                                : c.utilization_percentage >= 80
                                ? 'bg-amber-500'
                                : 'bg-teal-600'
                            }`}
                            style={{ width: `${Math.min(100, c.utilization_percentage)}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-2xs">{c.utilization_percentage}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={c.status === 'ACTIVE' ? 'emerald' : 'slate'}>{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'STUDENTS' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                  <th className="p-3">Student Name</th>
                  <th className="p-3">Admission No</th>
                  <th className="p-3">Academic Placement</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Pickup Stop</th>
                  <th className="p-3">Drop Stop</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-900">
                      {a.student
                        ? `${a.student.first_name || ''} ${a.student.last_name || ''}`.trim() || a.student.username
                        : 'Student'}
                    </td>
                    <td className="p-3 font-mono text-slate-600">{a.admission_number || a.student?.username || '—'}</td>
                    <td className="p-3 text-slate-800">
                      {a.class_name ? `${a.class_name} - ${a.section_name || 'A'}` : 'Enrolled'}
                    </td>
                    <td className="p-3 font-medium text-teal-700">{a.route?.route_name || 'Route'}</td>
                    <td className="p-3 text-slate-700">{a.pickup_stop?.stop_name || 'Origin'}</td>
                    <td className="p-3 text-slate-700">{a.drop_stop?.stop_name || 'Terminus'}</td>
                    <td className="p-3 font-mono text-slate-700">{a.vehicle?.vehicle_number || 'Standard Fleet'}</td>
                    <td className="p-3">
                      <Badge variant={a.status === 'ACTIVE' ? 'emerald' : 'slate'}>{a.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'EXPIRIES' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Registration</th>
                  <th className="p-3">Insurance Expiry</th>
                  <th className="p-3">Fitness Expiry</th>
                  <th className="p-3">Permit Expiry</th>
                  <th className="p-3">PUC Expiry</th>
                  <th className="p-3">Next Service Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-900">{v.vehicle_number}</td>
                    <td className="p-3 font-mono text-slate-800">{v.registration_number}</td>
                    <td className="p-3 font-mono">
                      {v.insurance_expiry ? new Date(v.insurance_expiry).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3 font-mono">
                      {v.fitness_expiry ? new Date(v.fitness_expiry).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3 font-mono">
                      {v.permit_expiry ? new Date(v.permit_expiry).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3 font-mono">
                      {v.puc_expiry ? new Date(v.puc_expiry).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3 font-mono font-medium text-amber-700">
                      {v.next_service_due ? new Date(v.next_service_due).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold">
                  <th className="p-3">Date</th>
                  <th className="p-3">Trip Type</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Driver</th>
                  <th className="p-3">Scheduled</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {trips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono">{t.trip_date}</td>
                    <td className="p-3">
                      <Badge variant={t.trip_type === 'PICKUP' ? 'teal' : 'purple'}>{t.trip_type}</Badge>
                    </td>
                    <td className="p-3 font-medium text-slate-900">{t.route?.route_name}</td>
                    <td className="p-3 font-mono text-slate-800">{t.vehicle?.vehicle_number}</td>
                    <td className="p-3">
                      {t.driver
                        ? `${t.driver.first_name || ''} ${t.driver.last_name || ''}`.trim() || t.driver.username
                        : 'Driver'}
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {t.scheduled_start_time} - {t.scheduled_end_time}
                    </td>
                    <td className="p-3">
                      <Badge variant={t.status === 'COMPLETED' ? 'emerald' : t.status === 'STARTED' ? 'amber' : 'indigo'}>
                        {t.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
