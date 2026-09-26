import React, { useEffect, useState } from 'react';
import {
  Bell,
  Search,
  RefreshCw,
  Plus,
  Eye,
  Copy,
  TrendingUp,
  Calendar,
  Building2,
  Users,
  AlertCircle,
  FileText,
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

interface AnnouncementsNoticesModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
}

export const AnnouncementsNoticesModule: React.FC<AnnouncementsNoticesModuleProps> = ({ onNavigate }) => {
  const { activeBranch } = useAuth();
  const { openTab } = useWorkspace();

  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [viewingComm, setViewingComm] = useState<Communication | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigateTo = (moduleKey: string, title: string, icon: string) => {
    if (onNavigate) {
      onNavigate(moduleKey);
    } else {
      openTab(moduleKey, title, icon);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Communication[]>('/communication', {
        locationId: activeBranch?.id,
        communicationType: selectedType || undefined,
        search: search || undefined,
        pageSize: 50,
      });

      setCommunications(res || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch?.id, selectedType]);

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/communication/${id}/duplicate`);
      navigateTo('communication_history', 'Communication History', 'Clock');
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate communication.');
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
        return <Badge variant="slate">{type}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Announcements & Notices</h1>
            <p className="text-xs text-slate-500">
              Published school notices, circulars, and announcements bulletin board
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
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
            New Notice
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="p-4 bg-white border-slate-200 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
            placeholder="Search notices by title or content (press Enter)..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="w-full md:w-48">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800"
          >
            <option value="">All Notice Types</option>
            <option value="ANNOUNCEMENT">Announcement</option>
            <option value="NOTICE">Official Notice</option>
            <option value="ACADEMIC">Academic</option>
            <option value="FEE">Fee Advisory</option>
            <option value="EXAM">Examination</option>
            <option value="ATTENDANCE">Attendance</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-2xs">
              <tr>
                <th className="px-4 py-3">Notice Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Published Date</th>
                <th className="px-4 py-3 text-center">Recipients</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading notices...
                  </td>
                </tr>
              ) : communications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No announcements or notices found.
                  </td>
                </tr>
              ) : (
                communications.map((comm) => (
                  <tr key={comm.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 max-w-xs">
                      <div className="truncate">{comm.title}</div>
                      <div className="text-2xs text-slate-400 line-clamp-1">{comm.message}</div>
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(comm.communication_type)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {comm.audience_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {comm.location?.location_name || 'All Branches'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {comm.published_at ? new Date(comm.published_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">
                      {comm.recipient_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={comm.status === 'DELIVERED' ? 'emerald' : 'slate'}>
                        {comm.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingComm(comm)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          View
                        </Button>
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
                          onClick={() => navigateTo('delivery_reports', 'Delivery Reports', 'TrendingUp')}
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
      </Card>

      {/* View Notice Detail Modal */}
      {viewingComm && (
        <Modal
          isOpen={true}
          onClose={() => setViewingComm(null)}
          title={viewingComm.title}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {getTypeBadge(viewingComm.communication_type)}
                <Badge variant={viewingComm.priority === 'URGENT' ? 'rose' : 'indigo'}>
                  {viewingComm.priority}
                </Badge>
              </div>
              <div className="text-xs text-slate-400">
                {viewingComm.published_at
                  ? new Date(viewingComm.published_at).toLocaleString()
                  : new Date(viewingComm.created_at).toLocaleString()}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                {viewingComm.message}
              </p>
            </div>

            {viewingComm.requires_acknowledgement && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-center justify-between">
                <span>Acknowledgement was requested for this notice</span>
                <span className="font-bold">{viewingComm.acknowledged_count ?? 0} Acknowledged</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg text-slate-600">
              <div>
                <strong>Target Audience:</strong> {viewingComm.audience_type.replace('_', ' ')}
              </div>
              <div>
                <strong>Campus Scope:</strong> {viewingComm.location?.location_name || 'All Branches'}
              </div>
              <div>
                <strong>Total Recipients:</strong> {viewingComm.recipient_count ?? 0}
              </div>
              <div>
                <strong>Channel:</strong> In-App Delivery
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
