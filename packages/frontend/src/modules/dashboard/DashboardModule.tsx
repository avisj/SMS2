// ========================================================================
// DashboardModule
// System overview, active tenant metrics, and workspace shortcuts
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Users,
  MapPin,
  ShieldCheck,
  ToggleRight,
  School,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

export const DashboardModule: React.FC = () => {
  const { userContext, activeBranch } = useAuth();
  const { openTab } = useWorkspace();
  const [stats, setStats] = useState({
    userCount: 0,
    locationCount: 0,
    featureCount: 0,
    auditCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [users, locs, audit] = await Promise.all([
          api.get<any[]>('/users').catch(() => []),
          api.get<any[]>('/locations').catch(() => []),
          api.get<{ total: number }>('/audit', { limit: 1 }).catch(() => ({ total: 0 })),
        ]);
        setStats({
          userCount: users.length,
          locationCount: locs.length,
          featureCount: 8,
          auditCount: audit.total,
        });
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [userContext?.school_id, activeBranch?.id]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div
        className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0F766E 0%, #134E4A 50%, #0F172A 100%)',
        }}
      >
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-teal-200 border border-white/15 text-xs font-semibold mb-3 backdrop-blur-xs shadow-xs">
            <School className="w-3.5 h-3.5 text-teal-300" />
            <span>{userContext?.school_name || 'SaaS Platform Core'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome, {userContext?.username}!
          </h1>
          <p className="text-slate-200 text-xs mt-1.5 leading-relaxed">
            Multi-Tenant School Management System with strict tenant isolation, universal users, dynamic RBAC, and multitasking workspace.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 px-3 py-1.5 rounded-lg backdrop-blur-xs text-white">
              <MapPin className="w-3.5 h-3.5 text-teal-300 shrink-0" />
              <span>Branch: <strong className="font-semibold text-white">{activeBranch?.location_name || 'All Locations'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 px-3 py-1.5 rounded-lg backdrop-blur-xs text-white">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-300 shrink-0" />
              <span>Roles: <strong className="font-semibold text-white">{userContext?.roles.map(r => r.name).join(', ') || 'Super Admin'}</strong></span>
            </div>
          </div>
        </div>

        <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none select-none" aria-hidden="true">
          <School className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Universal Users</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? '...' : stats.userCount}</h3>
              <p className="text-[11px] text-teal-600 font-medium mt-1">Multi-role directory</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Branches / Locations</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? '...' : stats.locationCount}</h3>
              <p className="text-[11px] text-teal-600 font-medium mt-1">Multi-branch scope</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Effective Permissions</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {userContext?.is_super_admin ? 'ALL' : userContext?.permissions.length || 0}
              </h3>
              <p className="text-[11px] text-teal-600 font-medium mt-1">Dynamic data scopes</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="hover:border-teal-300 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Audit Trail Records</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{loading ? '...' : stats.auditCount}</h3>
              <p className="text-[11px] text-teal-600 font-medium mt-1">Immutable security log</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Launch & Multitasking Workspace Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Quick Module Launcher" description="Open modules in the tab workspace without losing context">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                onClick={() => openTab('users', 'Universal Users', 'Users')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <div className="font-semibold text-xs text-slate-900">Users Directory</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Manage students, teachers, staff</div>
              </button>

              <button
                onClick={() => openTab('roles', 'Roles & Permissions', 'ShieldCheck')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="font-semibold text-xs text-slate-900">Access Control</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Roles & scope matrices</div>
              </button>

              <button
                onClick={() => openTab('locations', 'Branches', 'MapPin')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="font-semibold text-xs text-slate-900">Branches</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Locations & campuses</div>
              </button>

              <button
                onClick={() => openTab('settings', 'School Settings', 'Sliders')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <ToggleRight className="w-4 h-4" />
                </div>
                <div className="font-semibold text-xs text-slate-900">Settings</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Dynamic school configurations</div>
              </button>

              <button
                onClick={() => openTab('features', 'Feature Flags', 'ToggleRight')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <ToggleRight className="w-4 h-4" />
                </div>
                <div className="font-semibold text-xs text-slate-900">Feature Flags</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Toggle active modules</div>
              </button>

              <button
                onClick={() => openTab('audit', 'Audit Ledger', 'ClipboardList')}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="font-semibold text-xs text-slate-900">Audit Logs</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Security & operational trail</div>
              </button>
            </div>
          </Card>
        </div>

        <div>
          <Card title="Multitasking Workspace" description="Productivity feature details">
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">Up to 10 Open Tabs</strong>: Keep multiple screens active simultaneously.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">Full State Preservation</strong>: Form inputs, filters, and searches are preserved when switching tabs.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">Overflow Protection</strong>: An interactive modal allows choosing which tab to replace upon attempting to open an 11th module.
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] text-slate-500 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <span>Try clicking several modules in the sidebar to test tab multitasking!</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
