import React, { useEffect, useState } from 'react';
import {
  Clock,
  Search,
  RefreshCw,
  Eye,
  Copy,
  TrendingUp,
  Trash2,
  XCircle,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import { Communication } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Modal } from '../../components/common/Modal.js';

interface CommunicationHistoryModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
}

export const CommunicationHistoryModule: React.FC<CommunicationHistoryModuleProps> = ({ onNavigate }) => {
  const { activeBranch, branches } = useAuth();
  const { openTab } = useWorkspace();

  const [communications, setCommunications] = useState<Communication[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [communicationType, setCommunicationType] = useState<string>('');
  const [locationId, setLocationId] = useState<string>(activeBranch?.id || '');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [viewingComm, setViewingComm] = useState<Communication | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigateTo = (moduleKey: string, title: string, icon: string) => {
    if (onNavigate) {
      onNavigate(moduleKey);
    } else {
      openTab(moduleKey, title, icon);
    }
  };

  const loadHistory = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Communication[]>('/communication', {
        locationId: locationId || undefined,
        status: status || undefined,
        communicationType: communicationType || undefined,
        search: search || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: targetPage,
        pageSize,
      });

      setCommunications(res || []);
      setPage(targetPage);
    } catch (err: any) {
      setError(err.message || 'Failed to load communication history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(1);
  }, [locationId, status, communicationType]);

  const handleCancelScheduled = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled communication?')) return;
    try {
      await api.post(`/communication/${id}/cancel`);
      loadHistory();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel communication.');
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm('Delete this draft communication? This action cannot be undone.')) return;
    try {
      await api.delete(`/communication/${id}/draft`);
      loadHistory();
    } catch (err: any) {
      alert(err.message || 'Failed to delete draft.');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/communication/${id}/duplicate`);
      loadHistory();
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate communication.');
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
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
        return <Badge variant="slate">{st}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Communication History</h1>
            <p className="text-xs text-slate-500">
              Audit ledger and historical delivery status of all outgoing school communications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadHistory(page)}
            disabled={loading}
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigateTo('compose_communication', 'Compose Communication', 'Send')}
            icon={<Plus className="w-4 h-4" />}
          >
            Compose
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Advanced Filter Bar */}
      <Card className="p-4 bg-white border-slate-200 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadHistory(1)}
              placeholder="Search title/message (Enter)..."
              className="pl-9 text-xs"
            />
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800"
            >
              <option value="">All Statuses</option>
              <option value="DELIVERED">Published / Delivered</option>
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <select
              value={communicationType}
              onChange={(e) => setCommunicationType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800"
            >
              <option value="">All Types</option>
              <option value="NOTICE">Notice</option>
              <option value="ANNOUNCEMENT">Announcement</option>
              <option value="ACADEMIC">Academic</option>
              <option value="FEE">Fee</option>
              <option value="EXAM">Exam</option>
              <option value="ATTENDANCE">Attendance</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.location_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filter row */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium">Date Range:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-700"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-xs bg-white text-slate-700"
          />
          <Button variant="secondary" size="sm" onClick={() => loadHistory(1)}>
            Apply Dates
          </Button>
          {(startDate || endDate || search) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSearch('');
                loadHistory(1);
              }}
              className="text-2xs text-slate-500 hover:text-slate-800 underline ml-2"
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* History Table */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
              <tr>
                <th className="px-4 py-3">Notice Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Audience Target</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Recipients</th>
                <th className="px-4 py-3 text-center">Interactions</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading communications...
                  </td>
                </tr>
              ) : communications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No communication history records match your filters.
                  </td>
                </tr>
              ) : (
                communications.map((comm) => (
                  <tr key={comm.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 max-w-xs">
                      <div className="truncate">{comm.title}</div>
                      <div className="text-2xs text-slate-400 truncate">{comm.message}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {comm.communication_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {comm.audience_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {comm.published_at
                        ? new Date(comm.published_at).toLocaleDateString()
                        : new Date(comm.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(comm.status)}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">
                      {comm.recipient_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center text-2xs">
                      <span className="text-brand-700 font-bold">{comm.read_count ?? 0} read</span>
                      {comm.requires_acknowledgement && (
                        <span className="text-purple-700 font-bold block">
                          {comm.acknowledged_count ?? 0} ack
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingComm(comm)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View
                        </Button>

                        {comm.status === 'SCHEDULED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelScheduled(comm.id)}
                            icon={<XCircle className="w-3.5 h-3.5 text-amber-600" />}
                          >
                            Cancel
                          </Button>
                        )}

                        {comm.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDraft(comm.id)}
                            icon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
                          >
                            Delete
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(comm.id)}
                          icon={<Copy className="w-3.5 h-3.5" />}
                        >
                          Copy
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            navigateTo('delivery_reports', 'Delivery Reports', 'TrendingUp')
                          }
                          icon={<TrendingUp className="w-3.5 h-3.5" />}
                        >
                          Report
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <span>Page {page}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => loadHistory(page - 1)}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={communications.length < pageSize}
              onClick={() => loadHistory(page + 1)}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* View Detail Modal */}
      {viewingComm && (
        <Modal
          isOpen={true}
          onClose={() => setViewingComm(null)}
          title={viewingComm.title}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Badge variant="primary">{viewingComm.communication_type}</Badge>
                {getStatusBadge(viewingComm.status)}
              </div>
              <div className="text-xs text-slate-400">
                Created: {new Date(viewingComm.created_at).toLocaleString()}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                {viewingComm.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg text-slate-600">
              <div>
                <strong>Target Audience:</strong> {viewingComm.audience_type.replace('_', ' ')}
              </div>
              <div>
                <strong>Campus Scope:</strong> {viewingComm.location?.location_name || 'All Branches'}
              </div>
              <div>
                <strong>Recipients:</strong> {viewingComm.recipient_count ?? 0}
              </div>
              <div>
                <strong>Read Status:</strong> {viewingComm.read_count ?? 0} recipients read
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button variant="secondary" size="sm" onClick={() => setViewingComm(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
