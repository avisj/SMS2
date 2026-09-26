import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Send,
  Clock,
  FileEdit,
  CheckCircle2,
  AlertCircle,
  Users,
  Eye,
  RefreshCw,
  Plus,
  ArrowRight,
  BookmarkCheck,
  TrendingUp,
  Inbox,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  Communication,
  CommunicationDashboardStats,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

interface CommunicationDashboardModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
}

export const CommunicationDashboardModule: React.FC<CommunicationDashboardModuleProps> = ({ onNavigate }) => {
  const { activeBranch } = useAuth();
  const { openTab } = useWorkspace();

  const [stats, setStats] = useState<CommunicationDashboardStats | null>(null);
  const [recentCommunications, setRecentCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const navigateTo = (moduleKey: string, title: string, icon: string) => {
    if (onNavigate) {
      onNavigate(moduleKey);
    } else {
      openTab(moduleKey, title, icon);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, listRes] = await Promise.all([
        api.get<CommunicationDashboardStats>('/communication/dashboard/stats', {
          locationId: activeBranch?.id,
        }),
        api.get<Communication[]>('/communication', {
          locationId: activeBranch?.id,
          pageSize: 6,
        }),
      ]);

      setStats(statsRes || null);
      setRecentCommunications(listRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load communication dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeBranch?.id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
      case 'SENT':
        return <Badge variant="emerald">Published</Badge>;
      case 'DRAFT':
        return <Badge variant="slate">Draft</Badge>;
      case 'SCHEDULED':
        return <Badge variant="indigo">Scheduled</Badge>;
      case 'CANCELLED':
        return <Badge variant="amber">Cancelled</Badge>;
      case 'FAILED':
        return <Badge variant="rose">Failed</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'URGENT':
        return <Badge variant="rose">Urgent</Badge>;
      case 'NOTICE':
        return <Badge variant="indigo">Notice</Badge>;
      case 'ANNOUNCEMENT':
        return <Badge variant="primary">Announcement</Badge>;
      case 'FEE':
        return <Badge variant="amber">Fee</Badge>;
      case 'EXAM':
        return <Badge variant="purple">Exam</Badge>;
      case 'ATTENDANCE':
        return <Badge variant="amber">Attendance</Badge>;
      default:
        return <Badge variant="slate">{type.replace('_', ' ')}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Communication Dashboard</h1>
              <p className="text-xs text-slate-500">
                Create, target, publish, track and review school communications
                {activeBranch ? ` • ${activeBranch.location_name}` : ' • All Branches'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadDashboardData}
            disabled={loading}
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigateTo('communication_templates', 'Communication Templates', 'BookmarkCheck')}
            icon={<BookmarkCheck className="w-4 h-4" />}
          >
            Templates
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigateTo('compose_communication', 'Compose Communication', 'Send')}
            icon={<Plus className="w-4 h-4" />}
          >
            Compose Notice
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Communications */}
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Communications</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-600">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {stats?.total_communications ?? 0}
          </div>
          <p className="mt-1 text-2xs text-slate-400">All created communications</p>
        </Card>

        {/* Published & Sent */}
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Published / Sent</span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {stats?.published_count ?? 0}
          </div>
          <p className="mt-1 text-2xs text-emerald-600 font-medium">
            Delivery Rate: {stats?.delivery_rate ?? 100}%
          </p>
        </Card>

        {/* Scheduled */}
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Scheduled</span>
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700">
            {stats?.scheduled_count ?? 0}
          </div>
          <p className="mt-1 text-2xs text-slate-400">Awaiting scheduled delivery</p>
        </Card>

        {/* Drafts */}
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Drafts</span>
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
              <FileEdit className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">
            {stats?.draft_count ?? 0}
          </div>
          <p className="mt-1 text-2xs text-slate-400">Unpublished draft notices</p>
        </Card>

        {/* Total Recipients Reached */}
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Recipients</span>
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">
            {stats?.total_recipients ?? 0}
          </div>
          <p className="mt-1 text-2xs text-slate-400">Unique delivery snapshots</p>
        </Card>

        {/* Unread Messages */}
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Unread</span>
            <div className="p-1.5 rounded-md bg-rose-50 text-rose-600">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">
            {stats?.unread_count ?? 0}
          </div>
          <p className="mt-1 text-2xs text-slate-400">Awaiting recipient viewing</p>
        </Card>

        {/* Unacknowledged */}
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Unacknowledged</span>
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">
            {stats?.unacknowledged_count ?? 0}
          </div>
          <p className="mt-1 text-2xs text-slate-400">Action pending by recipients</p>
        </Card>

        {/* In-App Delivery Status */}
        <Card className="p-4 bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Delivery Channel</span>
            <div className="p-1.5 rounded-md bg-brand-50 text-brand-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-lg font-bold text-brand-700">IN-APP ACTIVE</div>
          <p className="mt-1 text-2xs text-slate-400">SMS / WhatsApp / Email: Coming Soon</p>
        </Card>
      </div>

      {/* Quick Workflow Navigation Banner */}
      <Card className="p-4 bg-gradient-to-r from-brand-700 to-brand-900 text-white shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold tracking-wide">END-TO-END COMMUNICATION WORKFLOW</h2>
            <p className="text-xs text-brand-100 mt-0.5">
              Create Notice → Target Audience → Compose & Preview → Send/Schedule → In-App Delivery → Track Read & Ack
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigateTo('announcements_notices', 'Announcements & Notices', 'Bell')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-xs font-semibold text-white transition-colors"
            >
              Public Notices
            </button>
            <button
              onClick={() => navigateTo('communication_history', 'Communication History', 'Clock')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-xs font-semibold text-white transition-colors"
            >
              History Ledger
            </button>
            <button
              onClick={() => navigateTo('delivery_reports', 'Delivery Reports', 'TrendingUp')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-md text-xs font-semibold text-white transition-colors"
            >
              Delivery Reports
            </button>
            <button
              onClick={() => navigateTo('communication_inbox', 'My Messages / Inbox', 'Inbox')}
              className="px-3 py-1.5 bg-brand-400 hover:bg-brand-300 text-slate-900 rounded-md text-xs font-bold transition-colors shadow-2xs"
            >
              My Inbox
            </button>
          </div>
        </div>
      </Card>

      {/* Recent Communications Table */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Recent Communications</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateTo('communication_history', 'Communication History', 'Clock')}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            View All History
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
              <tr>
                <th className="px-4 py-3">Communication Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Audience Target</th>
                <th className="px-4 py-3">Branch Scope</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Recipients</th>
                <th className="px-4 py-3 text-center">Read / Ack</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading communications...
                  </td>
                </tr>
              ) : recentCommunications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    No communications found. Start by composing a notice!
                  </td>
                </tr>
              ) : (
                recentCommunications.map((comm) => (
                  <tr key={comm.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{comm.title}</div>
                      <div className="text-2xs text-slate-400 line-clamp-1">{comm.message}</div>
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(comm.communication_type)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">
                        {comm.audience_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {comm.location?.location_name || 'All Branches'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(comm.status)}</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-900">
                      {comm.recipient_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center text-2xs">
                      <span className="text-brand-700 font-semibold">{comm.read_count ?? 0} read</span>
                      {comm.requires_acknowledgement && (
                        <span className="text-purple-700 font-semibold block">
                          {comm.acknowledged_count ?? 0} ack
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            navigateTo('delivery_reports', 'Delivery Reports', 'TrendingUp')
                          }
                        >
                          Delivery
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
    </div>
  );
};
