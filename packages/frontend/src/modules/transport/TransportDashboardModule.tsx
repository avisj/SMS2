// ========================================================================
// Transport Dashboard Module
// High-Level Fleet KPIs, Vehicle Utilization Cards, Document Expiry Alerts,
// and Quick Action Workflows
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Bus,
  MapPin,
  Users,
  Navigation,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Radio,
  FileSpreadsheet,
  Activity,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { api } from '../../api/client.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { TransportDashboardStats, Vehicle } from '../../types/index.js';

interface TransportDashboardModuleProps {
  tabId: string;
}

export const TransportDashboardModule: React.FC<TransportDashboardModuleProps> = ({ tabId }) => {
  const { openTab } = useWorkspace();
  const [stats, setStats] = useState<TransportDashboardStats | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [statsRes, vehiclesRes] = await Promise.all([
        api.get<TransportDashboardStats>('/transport/dashboard'),
        api.get<any>('/transport/vehicles', { limit: 6 }),
      ]);

      if (statsRes) {
        setStats(statsRes);
      }
      const vList: Vehicle[] = Array.isArray(vehiclesRes) ? vehiclesRes : (vehiclesRes?.data || []);
      setVehicles(vList);
    } catch (err) {
      console.error('Failed to load transport dashboard:', err);
    } finally {
      setLoading(false);
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
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Transport & Fleet Dashboard</h1>
            <p className="text-xs text-slate-500">
              Live fleet tracking, route allocation, capacity management, and student transport operations.
            </p>
          </div>
        </div>

        {/* Quick Action Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openTab('vehicle_master', 'Vehicle Master', 'Bus')}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Vehicle
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openTab('route_master', 'Route Master', 'Navigation')}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Create Route
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openTab('student_transport', 'Student Transport', 'Users')}
            icon={<Users className="w-3.5 h-3.5" />}
          >
            Assign Student
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openTab('daily_trips', 'Daily Trips', 'Clock')}
            icon={<Activity className="w-3.5 h-3.5" />}
          >
            Create Trip
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="p-4 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Total Vehicles</span>
            <Bus className="w-4 h-4 text-teal-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? '—' : stats?.total_vehicles ?? 0}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-2xs text-slate-500">
            <span className="text-emerald-600 font-bold">{stats?.active_vehicles ?? 0} Active</span>
            <span>•</span>
            <span className="text-amber-600 font-bold">{stats?.maintenance_vehicles ?? 0} Maint</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Active Routes</span>
            <Navigation className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? '—' : stats?.active_routes ?? 0}
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            Total {stats?.total_routes ?? 0} configured
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Transport Students</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? '—' : stats?.students_using_transport ?? 0}
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            {stats?.available_seats ?? 0} seats available
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Today's Trips</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? '—' : stats?.today_trips_count ?? 0}
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            <span className="text-purple-600 font-bold">{stats?.active_trips_count ?? 0} In Progress</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Total Capacity</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {loading ? '—' : stats?.total_capacity ?? 0}
          </div>
          <div className="mt-1 text-2xs text-slate-500">
            Seating across active fleet
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider">GPS Live Status</span>
            <Radio className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-sm font-bold text-slate-700">
            Not Configured
          </div>
          <div className="mt-1 text-2xs text-slate-400">
            Hardware interface ready
          </div>
        </Card>
      </div>

      {/* Document Expiry Alerts Banner */}
      <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-900">Compliance & Document Expiries</div>
            <div className="text-2xs text-amber-700">
              {stats?.document_alerts.expired_count ?? 0} expired documents, {stats?.document_alerts.expiring_soon_count ?? 0} expiring within 30 days, and {stats?.maintenance_due_count ?? 0} vehicles due for service.
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openTab('transport_reports', 'Transport Reports', 'FileSpreadsheet')}
          icon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          View Expiry Report
        </Button>
      </div>

      {/* Fleet Overview Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Active Fleet & Seating Utilization</h2>
            <p className="text-2xs text-slate-500">Real-time seat occupancy and driver allocation by vehicle.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openTab('vehicle_master', 'Vehicle Master', 'Bus')}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Manage All Vehicles
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading transport fleet...</div>
        ) : vehicles.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
            No vehicles have been added yet. Click "+ Add Vehicle" to register your school fleet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <Card key={v.id} className="p-4 bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-2xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{v.vehicle_number}</span>
                      {getStatusBadge(v.status)}
                    </div>
                    <div className="text-2xs text-slate-500 font-mono mt-0.5">{v.registration_number}</div>
                  </div>
                  <Badge variant="indigo">{v.vehicle_type.replace('_', ' ')}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-2xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block">Assigned Route</span>
                    <span className="font-semibold text-slate-700">
                      {v.current_route ? `${v.current_route.route_name} (${v.current_route.route_code})` : 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Primary Driver</span>
                    <span className="font-semibold text-slate-700">
                      {v.current_driver
                        ? `${v.current_driver.first_name || ''} ${v.current_driver.last_name || ''}`.trim() || v.current_driver.username
                        : 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Seating Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-2xs">
                    <span className="text-slate-500">Seat Occupancy</span>
                    <span className="font-bold text-slate-800">
                      {v.assigned_student_count || 0} / {v.capacity} ({v.utilization_percentage || 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        (v.utilization_percentage || 0) >= 100
                          ? 'bg-rose-500'
                          : (v.utilization_percentage || 0) >= 80
                          ? 'bg-amber-500'
                          : 'bg-teal-600'
                      }`}
                      style={{ width: `${Math.min(100, v.utilization_percentage || 0)}%` }}
                    />
                  </div>
                  <div className="text-3xs text-slate-400 text-right">
                    {v.available_seats || 0} seats remaining
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
