import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  FileSpreadsheet,
  Check,
  Building2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  Communication,
  DeliveryReportSummary,
  CommunicationRecipient,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';

interface DeliveryReportsModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
  selectedCommunicationId?: string;
}

export const DeliveryReportsModule: React.FC<DeliveryReportsModuleProps> = ({
  onNavigate,
  selectedCommunicationId,
}) => {
  const { activeBranch } = useAuth();
  const { openTab } = useWorkspace();

  const [communications, setCommunications] = useState<Communication[]>([]);
  const [selectedCommId, setSelectedCommId] = useState<string>(selectedCommunicationId || '');
  const [report, setReport] = useState<DeliveryReportSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Recipient search filter inside report
  const [recipientSearch, setRecipientSearch] = useState<string>('');

  // 1. Load Published Communications
  useEffect(() => {
    const loadComms = async () => {
      setLoadingList(true);
      try {
        const res = await api.get<Communication[]>('/communication', {
          locationId: activeBranch?.id,
          pageSize: 100,
        });

        const list = res || [];
        setCommunications(list);

        if (!selectedCommId && list.length > 0) {
          // Select first published communication
          const firstPublished = list.find((c) => c.status === 'DELIVERED' || c.status === 'SENT') || list[0];
          setSelectedCommId(firstPublished.id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load communications list.');
      } finally {
        setLoadingList(false);
      }
    };
    loadComms();
  }, [activeBranch?.id]);

  // 2. Load Delivery Report for Selected Communication
  const loadDeliveryReport = async (commId: string) => {
    if (!commId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DeliveryReportSummary>(`/communication/${commId}/delivery-report`);
      setReport(res || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load delivery report for selected communication.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCommId) {
      loadDeliveryReport(selectedCommId);
    }
  }, [selectedCommId]);

  const filteredRecipients = report?.recipients.filter((r) => {
    if (!recipientSearch.trim()) return true;
    const q = recipientSearch.toLowerCase();
    const name = (
      `${r.recipient?.first_name || ''} ${r.recipient?.last_name || ''}`.trim() ||
      r.recipient?.username ||
      ''
    ).toLowerCase();
    const email = (r.recipient?.email || '').toLowerCase();
    const type = (r.recipient_type || '').toLowerCase();
    return name.includes(q) || email.includes(q) || type.includes(q);
  }) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Communication Delivery Reports</h1>
            <p className="text-xs text-slate-500">
              Audit delivery status, individual read timestamps, and acknowledgments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadDeliveryReport(selectedCommId)}
            disabled={loading || !selectedCommId}
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Select Communication Dropdown Bar */}
      <Card className="p-4 bg-white border-slate-200 flex flex-col md:flex-row items-center gap-4">
        <div className="w-full md:w-1/3">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Select Communication Notice:
          </label>
          <select
            value={selectedCommId}
            onChange={(e) => setSelectedCommId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 font-medium focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
          >
            {communications.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.communication_type}] {c.title} ({new Date(c.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        {report?.communication && (
          <div className="flex-1 text-xs text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-200">
            <div className="font-semibold text-slate-800">{report.communication.title}</div>
            <div className="text-2xs text-slate-500 mt-0.5 line-clamp-1">
              {report.communication.message}
            </div>
            <div className="flex items-center gap-4 mt-2 text-2xs">
              <span>Audience: <strong>{report.communication.audience_type.replace('_', ' ')}</strong></span>
              <span>Scope: <strong>{report.communication.location?.location_name || 'All Branches'}</strong></span>
              <span>Status: <strong className="text-emerald-700">{report.communication.status}</strong></span>
            </div>
          </div>
        )}
      </Card>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-white border-slate-200">
          <span className="text-xs font-medium text-slate-500">Total Recipients</span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {report?.total_recipients ?? 0}
          </div>
          <p className="mt-1 text-2xs text-slate-400">Targeted individuals</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <span className="text-xs font-medium text-slate-500">Delivered</span>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {report?.delivered_count ?? 0}
          </div>
          <p className="mt-1 text-2xs text-emerald-600 font-medium">
            Channel: IN_APP Delivery
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <span className="text-xs font-medium text-slate-500">Read Receipts</span>
          <div className="mt-2 text-2xl font-bold text-brand-700">
            {report?.read_count ?? 0}
          </div>
          <p className="mt-1 text-2xs text-brand-600 font-medium">
            {report?.read_percentage ?? 0}% Read Rate
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <span className="text-xs font-medium text-slate-500">Acknowledged</span>
          <div className="mt-2 text-2xl font-bold text-purple-700">
            {report?.acknowledged_count ?? 0}
          </div>
          <p className="mt-1 text-2xs text-purple-600 font-medium">
            {report?.acknowledged_percentage ?? 0}% Ack Rate
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-200">
          <span className="text-xs font-medium text-slate-500">Failed / Pending</span>
          <div className="mt-2 text-2xl font-bold text-slate-700">
            {(report?.failed_count ?? 0) + (report?.pending_count ?? 0)}
          </div>
          <p className="mt-1 text-2xs text-slate-400">Undelivered records</p>
        </Card>
      </div>

      {/* Recipient Drilldown Table */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Recipient Delivery & Interaction Ledger
            </h2>
            <p className="text-xs text-slate-500">
              Per-recipient delivery timestamps, read state, and acknowledgment status
            </p>
          </div>

          <div className="w-full md:w-64 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
              placeholder="Search recipient name..."
              className="pl-9 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
              <tr>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Role / Type</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Delivery Status</th>
                <th className="px-4 py-3">Read Status</th>
                <th className="px-4 py-3">Read Timestamp</th>
                <th className="px-4 py-3">Acknowledgement</th>
                <th className="px-4 py-3">Ack Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading delivery records...
                  </td>
                </tr>
              ) : filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No recipient records found for this communication.
                  </td>
                </tr>
              ) : (
                filteredRecipients.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div>
                        {`${rec.recipient?.first_name || ''} ${rec.recipient?.last_name || ''}`.trim() ||
                          rec.recipient?.username ||
                          'User'}
                      </div>
                      <div className="text-2xs text-slate-400 font-normal">
                        {rec.recipient?.email || rec.recipient?.phone || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {rec.recipient_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{rec.delivery_channel}</td>
                    <td className="px-4 py-3">
                      <Badge variant={rec.delivery_status === 'DELIVERED' ? 'emerald' : 'rose'}>
                        {rec.delivery_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={rec.read_status === 'READ' ? 'primary' : 'slate'}>
                        {rec.read_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {rec.read_at ? new Date(rec.read_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {rec.acknowledgement_status === 'ACKNOWLEDGED' ? (
                        <Badge variant="purple">ACKNOWLEDGED</Badge>
                      ) : rec.acknowledgement_status === 'PENDING' ? (
                        <Badge variant="amber">PENDING</Badge>
                      ) : (
                        <span className="text-slate-400">Not Required</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {rec.acknowledged_at ? new Date(rec.acknowledged_at).toLocaleString() : '—'}
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
