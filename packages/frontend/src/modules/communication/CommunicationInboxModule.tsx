import React, { useEffect, useState } from 'react';
import {
  Inbox,
  CheckCircle2,
  Clock,
  Eye,
  AlertCircle,
  RefreshCw,
  Search,
  Bell,
  Check,
  Send,
  Building2,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import { CommunicationRecipient } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';

interface CommunicationInboxModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
}

export const CommunicationInboxModule: React.FC<CommunicationInboxModuleProps> = () => {
  const { userContext } = useAuth();

  const [inboxItems, setInboxItems] = useState<CommunicationRecipient[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [tabFilter, setTabFilter] = useState<'ALL' | 'UNREAD' | 'ACKNOWLEDGED'>('ALL');
  const [selectedNotice, setSelectedNotice] = useState<CommunicationRecipient | null>(null);
  const [acknowledging, setAcknowledging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<CommunicationRecipient[]>('/communication/inbox/me', {
        readStatus: tabFilter === 'UNREAD' ? 'UNREAD' : undefined,
        acknowledgementStatus: tabFilter === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : undefined,
      });

      const list = res || [];
      setInboxItems(list);
      setUnreadCount(list.filter((i) => i.read_status === 'UNREAD').length);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [tabFilter]);

  const handleOpenNotice = async (item: CommunicationRecipient) => {
    setSelectedNotice(item);

    // If unread, mark as read on backend
    if (item.read_status === 'UNREAD') {
      try {
        await api.post(`/communication/inbox/${item.id}/read`);
        // Update locally
        setInboxItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, read_status: 'READ', read_at: new Date().toISOString() } : i))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    }
  };

  const handleAcknowledge = async (item: CommunicationRecipient) => {
    setAcknowledging(true);
    try {
      await api.post(`/communication/inbox/${item.id}/acknowledge`);
      const now = new Date().toISOString();
      setInboxItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, acknowledgement_status: 'ACKNOWLEDGED', acknowledged_at: now } : i
        )
      );
      if (selectedNotice && selectedNotice.id === item.id) {
        setSelectedNotice({
          ...selectedNotice,
          acknowledgement_status: 'ACKNOWLEDGED',
          acknowledged_at: now,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge notice.');
    } finally {
      setAcknowledging(false);
    }
  };

  const getTypeBadge = (type?: string) => {
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
        return <Badge variant="slate">{type || 'General'}</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Messages & Inbox</h1>
            <p className="text-xs text-slate-500">
              Personal in-app notices, academic announcements, and circulars for {userContext?.username || 'User'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadInbox}
            disabled={loading}
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

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTabFilter('ALL')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            tabFilter === 'ALL'
              ? 'bg-brand-600 text-brand-foreground shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Notices ({inboxItems.length})
        </button>

        <button
          onClick={() => setTabFilter('UNREAD')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            tabFilter === 'UNREAD'
              ? 'bg-brand-600 text-brand-foreground shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Unread {unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-2xs">{unreadCount}</span>}
        </button>

        <button
          onClick={() => setTabFilter('ACKNOWLEDGED')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            tabFilter === 'ACKNOWLEDGED'
              ? 'bg-brand-600 text-brand-foreground shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Acknowledged
        </button>
      </div>

      {/* Messages List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
            Checking your inbox...
          </div>
        ) : inboxItems.length === 0 ? (
          <Card className="p-12 text-center text-slate-400 bg-white border-slate-200">
            <Inbox className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No messages found.</p>
            <p className="text-xs text-slate-400 mt-1">
              {tabFilter === 'UNREAD'
                ? 'You have caught up with all school communications!'
                : 'No notices or announcements in your inbox yet.'}
            </p>
          </Card>
        ) : (
          inboxItems.map((item) => {
            const comm = item.communication;
            const isUnread = item.read_status === 'UNREAD';
            return (
              <Card
                key={item.id}
                onClick={() => handleOpenNotice(item)}
                className={`p-4 bg-white border cursor-pointer transition-all hover:shadow-xs ${
                  isUnread
                    ? 'border-brand-400 bg-brand-50/20 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse"></span>
                      )}
                      {getTypeBadge(comm?.communication_type)}
                      {comm?.priority && comm.priority !== 'NORMAL' && (
                        <Badge variant="rose">{comm.priority}</Badge>
                      )}
                      <span className="text-xs font-bold text-slate-900">
                        {comm?.title || 'Notice'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {comm?.message}
                    </p>

                    <div className="flex items-center gap-4 text-2xs text-slate-400 pt-1">
                      <span>Received: {new Date(item.sent_at).toLocaleDateString()}</span>
                      {comm?.location?.location_name && (
                        <span>Campus: {comm.location.location_name}</span>
                      )}
                      {item.read_status === 'READ' && (
                        <span className="text-brand-600 font-medium">Read</span>
                      )}
                      {item.acknowledgement_status === 'ACKNOWLEDGED' && (
                        <span className="text-purple-600 font-bold">Acknowledged</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {item.acknowledgement_status === 'PENDING' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcknowledge(item);
                        }}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-2xs font-bold shadow-2xs transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}

                    <span className="text-2xs text-slate-400">
                      {new Date(item.sent_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Notice Detail Reader Modal */}
      {selectedNotice && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedNotice(null)}
          title={selectedNotice.communication?.title || 'Notice Details'}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {getTypeBadge(selectedNotice.communication?.communication_type)}
                {selectedNotice.communication?.priority && (
                  <Badge variant="rose">{selectedNotice.communication.priority}</Badge>
                )}
              </div>
              <div className="text-xs text-slate-400">
                {new Date(selectedNotice.sent_at).toLocaleString()}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                {selectedNotice.communication?.message}
              </p>
            </div>

            {selectedNotice.communication?.requires_acknowledgement && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-purple-900">
                    Official Acknowledgement Required
                  </div>
                  <div className="text-2xs text-purple-700">
                    {selectedNotice.acknowledgement_status === 'ACKNOWLEDGED'
                      ? `Acknowledged by you on ${selectedNotice.acknowledged_at ? new Date(selectedNotice.acknowledged_at).toLocaleString() : 'Record'}`
                      : 'Please acknowledge that you have read and understood this notice.'}
                  </div>
                </div>

                {selectedNotice.acknowledgement_status === 'ACKNOWLEDGED' ? (
                  <Badge variant="purple">ACKNOWLEDGED</Badge>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={acknowledging}
                    onClick={() => handleAcknowledge(selectedNotice)}
                    icon={<Check className="w-4 h-4" />}
                  >
                    {acknowledging ? 'Recording...' : 'Acknowledge Now'}
                  </Button>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3">
              <Button variant="secondary" size="sm" onClick={() => setSelectedNotice(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
