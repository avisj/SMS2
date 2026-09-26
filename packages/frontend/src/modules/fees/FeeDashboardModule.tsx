// ========================================================================
// FeeDashboardModule
// Executive Financial Overview, Real-Time Collection Analytics & Dues Breakdown
// ========================================================================

import React, { useEffect, useState, useTransition } from 'react';
import {
  TrendingUp,
  DollarSign,
  AlertCircle,
  Calendar,
  CreditCard,
  Receipt,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import { FeeDashboardMetrics, AcademicSession, Location, FeePayment } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { useCurrency } from '../../utils/currency.js';

interface FeeDashboardModuleProps {
  tabId?: string;
}

export const FeeDashboardModule: React.FC<FeeDashboardModuleProps> = () => {
  const { activeBranch } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const { openTab } = useWorkspace();
  const [, startTransition] = useTransition();

  const [metrics, setMetrics] = useState<FeeDashboardMetrics | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [recentPayments, setRecentPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Load sessions
      const sessionsRes = await api.get<AcademicSession[]>('/academics/sessions');
      setSessions(sessionsRes || []);
      const activeSess = sessionsRes?.find((s) => s.status === 'ACTIVE') || sessionsRes?.[0];
      const sessId = selectedSessionId || activeSess?.id || '';
      if (!selectedSessionId && activeSess) {
        setSelectedSessionId(activeSess.id);
      }

      // Load metrics
      const metricsRes = await api.get<FeeDashboardMetrics>('/fees/dashboard', {
        academicSessionId: sessId || undefined,
        locationId: activeBranch?.id || undefined,
      });
      setMetrics(metricsRes);

      // Load recent payments
      const paymentsRes = await api.get<FeePayment[]>('/fees/payments', {
        academicSessionId: sessId || undefined,
        locationId: activeBranch?.id || undefined,
      });
      setRecentPayments((paymentsRes || []).slice(0, 8));
    } catch (err) {
      console.error('[FeeDashboardModule] Error loading dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedSessionId, activeBranch?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            Fees Management Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative financial analytics, receivable status, and real-time collection metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-600">Session:</span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => openTab('fee_collection', 'Collect Fees', 'CreditCard')}
            className="flex items-center gap-1 text-xs"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Collect Fees
          </Button>
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced Demands */}
        <Card className="p-4 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Invoiced</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(metrics?.total_demand)}
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>Authoritative Receivables</span>
            <span className="font-semibold text-blue-600">100% Demand</span>
          </div>
        </Card>

        {/* Total Collected */}
        <Card className="p-4 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Collected</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {formatCurrency(metrics?.total_collected)}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>Realized Revenue</span>
            <span className="font-semibold text-emerald-600">
              {metrics?.total_demand
                ? `${Math.round(((metrics.total_collected || 0) / metrics.total_demand) * 100)}% Collected`
                : '0%'}
            </span>
          </div>
        </Card>

        {/* Outstanding Dues */}
        <Card className="p-4 border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding Dues</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {formatCurrency(metrics?.total_outstanding)}
              </p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>Active Receivables</span>
            <button
              onClick={() => openTab('fee_outstanding', 'Outstanding Dues', 'AlertCircle')}
              className="text-amber-600 font-semibold hover:underline"
            >
              View Roster →
            </button>
          </div>
        </Card>

        {/* Overdue Amount */}
        <Card className="p-4 border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Overdue</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {formatCurrency(metrics?.total_overdue)}
              </p>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>{metrics?.students_overdue_count || 0} overdue accounts</span>
            <span className="text-rose-600 font-semibold">Immediate Action</span>
          </div>
        </Card>
      </div>

      {/* Secondary Velocity KPIs & Student Counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's & Month's Velocity */}
        <Card className="p-4 bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-xl col-span-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-200">Collection Velocity</h3>
          <div className="mt-4 space-y-4">
            <div>
              <span className="text-xs text-indigo-300">Today's Collections:</span>
              <p className="text-xl font-bold text-white mt-0.5">{formatCurrency(metrics?.today_collection)}</p>
            </div>
            <div className="pt-3 border-t border-indigo-800/80">
              <span className="text-xs text-indigo-300">This Month's Collections:</span>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">{formatCurrency(metrics?.month_collection)}</p>
            </div>
          </div>
        </Card>

        {/* Student Account Breakdown */}
        <Card className="p-4 md:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-400" />
            Student Accounts Status Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
              <p className="text-2xl font-bold text-emerald-700">{metrics?.students_fully_paid_count || 0}</p>
              <p className="text-xs font-medium text-emerald-800 mt-0.5">Fully Paid</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-center">
              <p className="text-2xl font-bold text-amber-700">{metrics?.students_partially_paid_count || 0}</p>
              <p className="text-xs font-medium text-amber-800 mt-0.5">Partially Paid</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
              <p className="text-2xl font-bold text-blue-700">{metrics?.students_with_dues_count || 0}</p>
              <p className="text-xs font-medium text-blue-800 mt-0.5">With Pending Dues</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-lg border border-rose-100 text-center">
              <p className="text-2xl font-bold text-rose-700">{metrics?.students_overdue_count || 0}</p>
              <p className="text-xs font-medium text-rose-800 mt-0.5">Overdue Accounts</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Launchpad */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => openTab('fee_collection', 'Fee Collection', 'CreditCard')}
          className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-sm transition-all text-left group"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-800 group-hover:text-indigo-600">Collect Fees</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Accept payments and generate instant vouchers</p>
        </button>

        <button
          onClick={() => openTab('fee_assignment', 'Student Fee Demands', 'FileText')}
          className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-sm transition-all text-left group"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-800 group-hover:text-indigo-600">Generate Invoices</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Batch generate demands for classes/sections</p>
        </button>

        <button
          onClick={() => openTab('fee_receipts', 'Fee Receipts', 'Receipt')}
          className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-sm transition-all text-left group"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-800 group-hover:text-indigo-600">Receipts Archive</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Search, view, print and reprint receipts</p>
        </button>

        <button
          onClick={() => openTab('fee_reports', 'Financial Reports', 'FileSpreadsheet')}
          className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-sm transition-all text-left group"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-800 group-hover:text-indigo-600">Executive Reports</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Daily, monthly, class-wise and head-wise reports</p>
        </button>
      </div>

      {/* Recent Collections Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent Fee Collections</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Latest transactional payments processed</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openTab('fee_receipts', 'Fee Receipts', 'Receipt')}
            className="text-xs"
          >
            View All Receipts
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Voucher #</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Ref #</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No payment records found for this period.
                  </td>
                </tr>
              ) : (
                recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{p.payment_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {p.student?.full_name || p.student?.first_name || 'Student'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.payment_date}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {p.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {p.transaction_reference || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatCurrency(p.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={p.status === 'SUCCESS' ? 'success' : 'warning'} size="sm">
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
