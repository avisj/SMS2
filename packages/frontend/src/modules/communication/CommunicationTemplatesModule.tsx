import React, { useEffect, useState } from 'react';
import {
  BookmarkCheck,
  Plus,
  Edit2,
  Trash2,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  CommunicationTemplate,
  CommunicationType,
  CommunicationPriority,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Modal } from '../../components/common/Modal.js';

interface CommunicationTemplatesModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
}

export const CommunicationTemplatesModule: React.FC<CommunicationTemplatesModuleProps> = ({ onNavigate }) => {
  const { openTab } = useWorkspace();

  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [commType, setCommType] = useState<CommunicationType>('NOTICE');
  const [subject, setSubject] = useState<string>('');
  const [messageBody, setMessageBody] = useState<string>('');
  const [priority, setPriority] = useState<CommunicationPriority>('NORMAL');
  const [requiresAck, setRequiresAck] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const navigateTo = (moduleKey: string, title: string, icon: string) => {
    if (onNavigate) {
      onNavigate(moduleKey);
    } else {
      openTab(moduleKey, title, icon);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<CommunicationTemplate[]>('/communication/templates/list', {
        search: search || undefined,
      });
      setTemplates(res || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const openCreateModal = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setCommType('NOTICE');
    setSubject('');
    setMessageBody('');
    setPriority('NORMAL');
    setRequiresAck(false);
    setModalOpen(true);
  };

  const openEditModal = (t: CommunicationTemplate) => {
    setEditingTemplateId(t.id);
    setTemplateName(t.template_name);
    setCommType(t.communication_type);
    setSubject(t.subject);
    setMessageBody(t.message_body);
    setPriority(t.priority);
    setRequiresAck(t.requires_acknowledgement);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !subject.trim() || !messageBody.trim()) {
      alert('Template Name, Subject and Message Body are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        template_name: templateName.trim(),
        communication_type: commType,
        subject: subject.trim(),
        message_body: messageBody.trim(),
        priority,
        requires_acknowledgement: requiresAck,
      };

      if (editingTemplateId) {
        await api.put(`/communication/templates/${editingTemplateId}`, payload);
      } else {
        await api.post('/communication/templates', payload);
      }

      setModalOpen(false);
      loadTemplates();
    } catch (err: any) {
      alert(err.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/communication/templates/${id}`);
      loadTemplates();
    } catch (err: any) {
      alert(err.message || 'Failed to delete template.');
    }
  };

  const handleUseTemplate = (tmpl: CommunicationTemplate) => {
    // Navigate to composer and pre-fill
    navigateTo('compose_communication', 'Compose Communication', 'Send');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-50 text-brand-700">
            <BookmarkCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Communication Templates</h1>
            <p className="text-xs text-slate-500">
              Create and manage reusable message blueprints for school communications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadTemplates}
            disabled={loading}
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Create Template
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar */}
      <Card className="p-3 bg-white border-slate-200">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadTemplates()}
            placeholder="Search templates by name or subject (press Enter)..."
            className="pl-9 text-xs"
          />
        </div>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-400">
            No templates found. Click "+ Create Template" to add one.
          </div>
        ) : (
          templates.map((t) => (
            <Card key={t.id} className="p-5 bg-white border-slate-200 flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{t.template_name}</span>
                  <Badge variant="primary">{t.communication_type}</Badge>
                </div>

                <div className="text-xs font-semibold text-slate-700">{t.subject}</div>

                <p className="text-xs text-slate-500 line-clamp-3 bg-slate-50 p-3 rounded border border-slate-100 leading-relaxed">
                  {t.message_body}
                </p>

                {t.requires_acknowledgement && (
                  <span className="inline-block text-2xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                    Acknowledgement Required
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(t)}
                    icon={<Edit2 className="w-3.5 h-3.5 text-slate-600" />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(t.id)}
                    icon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
                  >
                    Delete
                  </Button>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleUseTemplate(t)}
                  icon={<Send className="w-3.5 h-3.5" />}
                >
                  Use Template
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setModalOpen(false)}
          title={editingTemplateId ? 'Edit Template' : 'Create Communication Template'}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Template Name *
              </label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Term Fee Reminder Template"
                className="text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notice Type *
                </label>
                <select
                  value={commType}
                  onChange={(e) => setCommType(e.target.value as CommunicationType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white"
                >
                  <option value="NOTICE">Notice</option>
                  <option value="ANNOUNCEMENT">Announcement</option>
                  <option value="FEE">Fee Advisory</option>
                  <option value="EXAM">Examination</option>
                  <option value="ATTENDANCE">Attendance</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as CommunicationPriority)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Line *
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Default email/notice subject line"
                className="text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Message Body *
              </label>
              <textarea
                rows={6}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type the message template body..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white text-slate-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                required
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-700 font-semibold">
                Acknowledgement Required by Default
              </span>
              <input
                type="checkbox"
                checked={requiresAck}
                onChange={(e) => setRequiresAck(e.target.checked)}
                className="w-4 h-4 text-brand-600 accent-brand-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
