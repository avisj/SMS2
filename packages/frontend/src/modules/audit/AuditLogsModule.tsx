// ========================================================================
// AuditLogsModule
// Immutable Security and Operational Audit Trail
// ========================================================================

import React, { useEffect, useState } from 'react';
import { ClipboardList, Filter, Clock, ShieldAlert, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import { AuditLog } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { Select } from '../../components/common/Select.js';

interface AuditLogsModuleProps {
  tabId: string;
}

export const AuditLogsModule: React.FC<AuditLogsModuleProps> = ({ tabId: _tabId }) => {
  const { userContext } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewingLog, setViewingLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ logs: AuditLog[]; total: number }>('/audit', {
        action: selectedAction || undefined,
        module: selectedModule || undefined,
        limit: 100,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [selectedAction, selectedModule, userContext?.school_id]);

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'ACCESS_DENIED':
        return 'rose';
      case 'CREATE':
        return 'emerald';
      case 'UPDATE':
      case 'UPDATE_SETTING':
      case 'UPDATE_FEATURE':
        return 'indigo';
      case 'DELETE':
      case 'ARCHIVE':
        return 'amber';
      case 'LOGIN':
        return 'teal';
      default:
        return 'slate';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-teal-600" />
            Audit Ledger ({total} Records)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tamper-resistant audit trail capturing security events, administrative mutations, and tenant boundary checks.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <Select
            value={selectedAction}
            onChange={e => setSelectedAction(e.target.value)}
            options={[
              { value: '', label: 'All Actions' },
              { value: 'LOGIN', label: 'LOGIN' },
              { value: 'CREATE', label: 'CREATE' },
              { value: 'UPDATE', label: 'UPDATE' },
              { value: 'ACCESS_DENIED', label: 'ACCESS_DENIED' },
              { value: 'ARCHIVE', label: 'ARCHIVE' },
            ]}
          />
          <Select
            value={selectedModule}
            onChange={e => setSelectedModule(e.target.value)}
            options={[
              { value: '', label: 'All Modules' },
              { value: 'AUTH', label: 'AUTH' },
              { value: 'USERS', label: 'USERS' },
              { value: 'RBAC', label: 'RBAC' },
              { value: 'SCHOOLS', label: 'SCHOOLS' },
              { value: 'LOCATIONS', label: 'LOCATIONS' },
              { value: 'CONFIG', label: 'CONFIG' },
              { value: 'SECURITY', label: 'SECURITY' },
            ]}
          />
        </div>
      </Card>

      {/* Audit Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module / Entity</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Record ID</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-sans text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 font-sans">
                      <Badge variant={getActionBadgeVariant(log.action)} size="sm">
                        {log.action}
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{log.module}</span>
                      <span className="text-slate-400"> / {log.entity_name}</span>
                    </td>

                    <td className="py-3 px-4 font-sans text-slate-900 font-medium">
                      {log.username || 'SYSTEM'}
                    </td>

                    <td className="py-3 px-4 text-slate-500 truncate max-w-[140px]">
                      {log.record_id || '—'}
                    </td>

                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => setViewingLog(log)}
                        className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-xs font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Inspect Log Modal */}
      <Modal
        isOpen={!!viewingLog}
        onClose={() => setViewingLog(null)}
        title="Audit Log Record"
        subtitle={`Event ID: ${viewingLog?.id}`}
        maxWidth="lg"
      >
        {viewingLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Action:</span>
                <div className="font-semibold text-slate-900 mt-0.5">{viewingLog.action}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Module / Entity:</span>
                <div className="font-semibold text-slate-900 mt-0.5">{viewingLog.module} / {viewingLog.entity_name}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Actor:</span>
                <div className="font-semibold text-slate-900 mt-0.5">{viewingLog.username}</div>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold">Timestamp:</span>
                <div className="font-semibold text-slate-900 mt-0.5">{new Date(viewingLog.created_at).toLocaleString()}</div>
              </div>
            </div>

            {viewingLog.old_values && (
              <div>
                <span className="font-semibold text-slate-700 text-[11px] block mb-1">Previous Values (Before Mutation):</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto max-h-40">
                  {JSON.stringify(viewingLog.old_values, null, 2)}
                </pre>
              </div>
            )}

            {viewingLog.new_values && (
              <div>
                <span className="font-semibold text-slate-700 text-[11px] block mb-1">New Values (After Mutation):</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto max-h-40">
                  {JSON.stringify(viewingLog.new_values, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
