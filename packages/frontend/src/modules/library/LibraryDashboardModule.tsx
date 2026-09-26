// ========================================================================
// Library Management Dashboard Module
// Real-time KPI metrics, circulation trends, category breakdown,
// overdue alerts, and quick actions for School Library
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Copy,
  CheckCircle2,
  BookMarked,
  Clock,
  BookmarkCheck,
  AlertTriangle,
  Users,
  IndianRupee,
  RefreshCw,
  Plus,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  FileSpreadsheet,
  Building2,
  FolderTree,
  UserCheck,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { api } from '../../api/client.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { useCurrency } from '../../utils/currency.js';
import { LibraryDashboardMetrics } from '../../types/index.js';

export const LibraryDashboardModule: React.FC<{ tabId?: string }> = () => {
  const { openTab } = useWorkspace();
  const { symbol, format } = useCurrency();

  const [metrics, setMetrics] = useState<LibraryDashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<LibraryDashboardMetrics>('/library/dashboard');
      if (res) {
        setMetrics(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load library dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Library Circulation & Catalog</h1>
            <Badge variant="emerald">Live Operations</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time bibliographic catalog, physical copy tracking, member circulation, and fine ledger
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            onClick={() => openTab('library_circulation', 'Issue / Return', 'RotateCcw')}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Issue / Return Book
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            Retry
          </Button>
        </div>
      )}

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Book Titles */}
        <Card className="p-5 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Book Titles</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : metrics?.total_books ?? 0}
              </h3>
              <p className="text-xs text-gray-500 mt-1">Bibliographic master titles</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Total Physical Copies */}
        <Card className="p-5 border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Total Copies</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : metrics?.total_copies ?? 0}
              </h3>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                {loading ? '...' : `${metrics?.available_copies ?? 0} Available in Stacks`}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Copy className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Issued Copies */}
        <Card className="p-5 border-l-4 border-l-teal-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Issued on Loan</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : metrics?.issued_copies ?? 0}
              </h3>
              <p className="text-xs text-gray-500 mt-1">Circulating with students & staff</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
              <BookMarked className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Overdue Books */}
        <Card className="p-5 border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Overdue Books</p>
              <h3 className="text-2xl font-bold text-rose-600 mt-1">
                {loading ? '...' : metrics?.overdue_books ?? 0}
              </h3>
              <p className="text-xs text-rose-500 font-medium mt-1">Requires return reminder</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Secondary Financial & Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Members */}
        <Card className="p-4 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100/70 text-blue-700 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Active Members</div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">
                {loading ? '...' : metrics?.active_members ?? 0}
              </div>
            </div>
          </div>
        </Card>

        {/* Reserved Books */}
        <Card className="p-4 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100/70 text-purple-700 rounded-lg">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Pending Reservations</div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">
                {loading ? '...' : metrics?.reserved_books ?? 0}
              </div>
            </div>
          </div>
        </Card>

        {/* Outstanding Fines */}
        <Card className="p-4 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100/70 text-amber-700 rounded-lg">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Outstanding Fines</div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">
                {loading ? '...' : format(metrics?.outstanding_fines ?? 0)}
              </div>
            </div>
          </div>
        </Card>

        {/* Fine Collected */}
        <Card className="p-4 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100/70 text-emerald-700 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Fines Collected</div>
              <div className="text-lg font-bold text-emerald-700 mt-0.5">
                {loading ? '...' : format(metrics?.total_fine_collected ?? 0)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Breakdown Row: Categories and Copy Statuses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Books by Category */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Books by Category</h2>
              <p className="text-xs text-gray-500">Catalog distribution across academic and literary disciplines</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openTab('library_categories', 'Categories', 'FolderTree')}
            >
              Manage
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(metrics?.by_category || []).length === 0 ? (
              <p className="text-xs text-gray-400 col-span-2 text-center py-6">No categories configured</p>
            ) : (
              (metrics?.by_category || []).map((cat) => (
                <div
                  key={cat.category_id}
                  className="flex items-center justify-between p-3 bg-gray-50/80 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold text-gray-800">{cat.category_name}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {cat.count} titles
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Copies by Status */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Physical Copy Status</h2>
              <p className="text-xs text-gray-500">Holdings condition and availability</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openTab('library_copies', 'Book Copies', 'Copy')}
            >
              All Copies
            </Button>
          </div>

          <div className="space-y-2.5">
            {(metrics?.by_status || []).map((st) => {
              const variant =
                st.status === 'AVAILABLE'
                  ? 'success'
                  : st.status === 'ISSUED'
                  ? 'indigo'
                  : st.status === 'RESERVED'
                  ? 'purple'
                  : st.status === 'LOST' || st.status === 'DAMAGED'
                  ? 'danger'
                  : 'slate';

              return (
                <div key={st.status} className="flex items-center justify-between text-xs">
                  <Badge variant={variant}>{st.status.replace('_', ' ')}</Badge>
                  <span className="font-bold text-gray-900">{st.count} copies</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Tables: Most Issued Books & Overdue Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Issued Books */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Most Issued Books</h2>
              <p className="text-xs text-gray-500">High circulation curriculum and literary materials</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="divide-y divide-gray-100">
            {(metrics?.most_issued_books || []).length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">No circulation history recorded</p>
            ) : (
              (metrics?.most_issued_books || []).map((b, idx) => (
                <div key={b.book_id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-gray-800">{b.title}</span>
                  </div>
                  <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {b.issue_count} times
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Circulation Activity */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Recent Circulation Activity</h2>
              <p className="text-xs text-gray-500">Latest issues and check-in transactions</p>
            </div>
            <RotateCcw className="w-4 h-4 text-blue-600" />
          </div>

          <div className="divide-y divide-gray-100">
            {(metrics?.recent_issues || []).length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">No recent issues</p>
            ) : (
              (metrics?.recent_issues || []).map((i) => (
                <div key={i.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-gray-900">{i.book?.title}</div>
                    <div className="text-[11px] text-gray-500">
                      Member: {i.member_user?.first_name} {i.member_user?.last_name} ({i.book_copy?.copy_code})
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={i.status === 'ISSUED' ? 'indigo' : 'success'}>
                      {i.status}
                    </Badge>
                    <div className="text-[10px] text-gray-400 mt-0.5">Due: {i.due_date}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Quick Launchpad Navigation */}
      <Card className="p-5 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white border-blue-100">
        <h3 className="text-sm font-bold text-gray-900 mb-2">Library Workspace Modules</h3>
        <p className="text-xs text-gray-600 mb-4">
          Open dedicated operational modules in multi-tab workspace:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <button
            onClick={() => openTab('library_books', 'Book Master', 'BookOpen')}
            className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition-all text-left flex flex-col items-center justify-center gap-1.5 text-center"
          >
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-semibold text-gray-800">Book Master</span>
          </button>

          <button
            onClick={() => openTab('library_copies', 'Book Copies', 'Copy')}
            className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition-all text-left flex flex-col items-center justify-center gap-1.5 text-center"
          >
            <Copy className="w-5 h-5 text-indigo-600" />
            <span className="text-xs font-semibold text-gray-800">Book Copies</span>
          </button>

          <button
            onClick={() => openTab('library_members', 'Members', 'Users')}
            className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition-all text-left flex flex-col items-center justify-center gap-1.5 text-center"
          >
            <Users className="w-5 h-5 text-teal-600" />
            <span className="text-xs font-semibold text-gray-800">Members</span>
          </button>

          <button
            onClick={() => openTab('library_circulation', 'Issue / Return', 'RotateCcw')}
            className="p-3 bg-white rounded-lg border border-blue-300 bg-blue-50/50 hover:border-blue-500 hover:shadow-xs transition-all text-left flex flex-col items-center justify-center gap-1.5 text-center"
          >
            <RotateCcw className="w-5 h-5 text-blue-700" />
            <span className="text-xs font-bold text-blue-900">Issue / Return</span>
          </button>

          <button
            onClick={() => openTab('library_fines', 'Fines & Payments', 'IndianRupee')}
            className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition-all text-left flex flex-col items-center justify-center gap-1.5 text-center"
          >
            <IndianRupee className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-semibold text-gray-800">Fines & Pay</span>
          </button>

          <button
            onClick={() => openTab('library_reports', 'Library Reports', 'FileSpreadsheet')}
            className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-xs transition-all text-left flex flex-col items-center justify-center gap-1.5 text-center"
          >
            <FileSpreadsheet className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-semibold text-gray-800">Audit Reports</span>
          </button>
        </div>
      </Card>
    </div>
  );
};
