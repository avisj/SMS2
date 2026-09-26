// ========================================================================
// FeeReportsModule
// Executive Financial Reports, Head-wise, Class-wise, and Collection Breakdown
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  Layers,
  CreditCard,
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import { AcademicSession } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { useCurrency } from '../../utils/currency.js';

interface FeeReportsModuleProps {
  tabId?: string;
}

type ReportTab = 'daily_collection' | 'monthly_collection' | 'head_wise' | 'class_wise' | 'payment_mode';

export const FeeReportsModule: React.FC<FeeReportsModuleProps> = () => {
  const { symbol, format } = useCurrency();
  const { activeBranch } = useAuth();

  const [activeTab, setActiveTab] = useState<ReportTab>('daily_collection');
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessRes = await api.get<AcademicSession[]>('/academics/sessions');
        setSessions(sessRes || []);
        const activeSess = sessRes?.find((s) => s.status === 'ACTIVE') || sessRes?.[0];
        if (activeSess) setSelectedSessionId(activeSess.id);
      } catch (err) {
        console.error(err);
      }
    };
    loadSessions();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ report_type: string; data: any[] }>(`/fees/reports/${activeTab}`, {
        academicSessionId: selectedSessionId || undefined,
        locationId: activeBranch?.id || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setReportData(res?.data || []);
    } catch (err) {
      console.error('[FeeReportsModule] Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      loadReport();
    }
  }, [activeTab, selectedSessionId, startDate, endDate, activeBranch?.id]);

  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    const headers = Object.keys(reportData[0]).join(',');
    const rows = reportData.map((row) =>
      Object.values(row)
        .map((v) => `"${v}"`)
        .join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Fee_Report_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            Financial Audit & Analytics Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative financial reports: daily receipts, head breakdown, class-wise receivables, and payment modes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportCSV} className="flex items-center gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()} className="flex items-center gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('daily_collection')}
          className={`pb-3 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'daily_collection'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Daily Collection
        </button>

        <button
          onClick={() => setActiveTab('monthly_collection')}
          className={`pb-3 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'monthly_collection'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Monthly Collection
        </button>

        <button
          onClick={() => setActiveTab('head_wise')}
          className={`pb-3 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'head_wise'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Fee Head Breakdown
        </button>

        <button
          onClick={() => setActiveTab('class_wise')}
          className={`pb-3 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'class_wise'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Class-wise Analysis
        </button>

        <button
          onClick={() => setActiveTab('payment_mode')}
          className={`pb-3 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'payment_mode'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Mode Breakdown
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <select
          value={selectedSessionId}
          onChange={(e) => setSelectedSessionId(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>From:</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="py-1 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>To:</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="py-1 text-xs"
          />
        </div>

        <Button variant="secondary" size="sm" onClick={loadReport} className="flex items-center gap-1 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Report Data Renderers */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          {/* 1. Daily Collection */}
          {activeTab === 'daily_collection' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Collection Date</th>
                  <th className="px-4 py-3 text-right">Cash ({symbol})</th>
                  <th className="px-4 py-3 text-right">UPI / QR ({symbol})</th>
                  <th className="px-4 py-3 text-right">Bank Transfer ({symbol})</th>
                  <th className="px-4 py-3 text-right">Card ({symbol})</th>
                  <th className="px-4 py-3 text-center">Receipts</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-900">Total Day Revenue ({symbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Loading daily collections...
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No collections recorded in this period.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">{row.date}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{format(row.cash)}</td>
                      <td className="px-4 py-3 text-right text-indigo-700 font-medium">
                        {format(row.upi)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{format(row.bank)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{format(row.card)}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.count}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 text-sm">
                        {format(row.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 2. Monthly Collection */}
          {activeTab === 'monthly_collection' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Billing Month</th>
                  <th className="px-4 py-3 text-center">Transactions Count</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-900">Total Realized Revenue ({symbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((row) => (
                  <tr key={row.month} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-indigo-900 text-sm">{row.month}</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.count}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 text-base">
                      {format(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 3. Head-wise Breakdown */}
          {activeTab === 'head_wise' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Fee Head</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3 text-right">Demanded ({symbol})</th>
                  <th className="px-4 py-3 text-right">Collected ({symbol})</th>
                  <th className="px-4 py-3 text-right font-bold text-amber-700">Outstanding ({symbol})</th>
                  <th className="px-4 py-3 text-center">Realization Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((row) => {
                  const pct = row.demand > 0 ? Math.round((row.collected / row.demand) * 100) : 0;
                  return (
                    <tr key={row.head_code} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.head_name}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{row.head_code}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {format(row.demand)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {format(row.collected)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-700">
                        {format(row.outstanding)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 4. Class-wise Analysis */}
          {activeTab === 'class_wise' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Academic Class</th>
                  <th className="px-4 py-3 text-center">Enrolled Students</th>
                  <th className="px-4 py-3 text-right">Invoiced ({symbol})</th>
                  <th className="px-4 py-3 text-right">Collected ({symbol})</th>
                  <th className="px-4 py-3 text-right font-bold text-amber-700">Pending Dues ({symbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((row) => (
                  <tr key={row.class_name} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{row.class_name}</td>
                    <td className="px-4 py-3 text-center font-semibold text-indigo-700">
                      {row.student_count}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {format(row.demand)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {format(row.collected)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700">
                      {format(row.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 5. Payment Mode Breakdown */}
          {activeTab === 'payment_mode' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3">Payment Channel</th>
                  <th className="px-4 py-3 text-center">Receipts Count</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-900">Total Volume ({symbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((row) => (
                  <tr key={row.mode} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{row.mode}</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700">{row.count}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 text-sm">
                      {format(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};
