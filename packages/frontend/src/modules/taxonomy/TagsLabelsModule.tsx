// ========================================================================
// TagsLabelsModule Component
// Dedicated Tags & Labels Taxonomy Management
// ZERO display_order - sorted newest first (created_at DESC)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Tag,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  Palette
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import { UserTag, UserLabel } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface TagsLabelsModuleProps {
  tabId: string;
}

const PRESET_COLORS = [
  '#3b82f6', '#0d9488', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#64748b', '#06b6d4', '#84cc16'
];

export const TagsLabelsModule: React.FC<TagsLabelsModuleProps> = () => {
  const { userContext } = useAuth();

  const [activeTab, setActiveTab] = useState<'TAGS' | 'LABELS'>('TAGS');
  const [tags, setTags] = useState<UserTag[]>([]);
  const [labels, setLabels] = useState<UserLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    color: '#3b82f6',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tagsData, labelsData] = await Promise.all([
        api.get<UserTag[]>('/people/tags'),
        api.get<UserLabel[]>('/people/labels'),
      ]);
      setTags(tagsData);
      setLabels(labelsData);
    } catch (err) {
      console.error('Failed to load tags & labels', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userContext?.school_id]);

  const handleOpenCreate = () => {
    setFormData({
      code: '',
      name: '',
      color: '#3b82f6',
      description: '',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const endpoint = activeTab === 'TAGS' ? '/people/tags' : '/people/labels';
      await api.post(endpoint, formData);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to save ${activeTab === 'TAGS' ? 'tag' : 'label'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const endpoint = activeTab === 'TAGS' ? `/people/tags/${id}` : `/people/labels/${id}`;
      await api.delete(endpoint);
      await loadData();
    } catch (err: any) {
      alert(err.message || `Failed to delete ${activeTab === 'TAGS' ? 'tag' : 'label'}`);
    }
  };

  const currentList = activeTab === 'TAGS' ? tags : labels;
  const filtered = currentList.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-5 h-5 text-teal-600" />
            Tags & Labels Master
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable visual markers for user profiling, transport, class teachers, and flags. Zero display_order.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          variant="primary"
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add {activeTab === 'TAGS' ? 'Tag' : 'Label'}
        </Button>
      </div>

      {/* Tabs & Search Filter */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('TAGS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'TAGS'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tags ({tags.length})
            </button>
            <button
              onClick={() => setActiveTab('LABELS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'LABELS'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Labels ({labels.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                className="pl-9"
              />
            </div>
            <Button variant="secondary" onClick={loadData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Preview Badge</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Color Hex</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Loading {activeTab.toLowerCase()}...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No {activeTab.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-xs"
                        style={{ backgroundColor: item.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white/70"></span>
                        {item.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-teal-700">
                      {item.code}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.color}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-sm">
                      {item.description || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(item.id, item.name)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Add New ${activeTab === 'TAGS' ? 'Tag' : 'Label'}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              {activeTab === 'TAGS' ? 'Tag' : 'Label'} Name *
            </label>
            <Input
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Class Teacher or Bus Incharge"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
            <Input
              required
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. TAG-CT"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Badge Accent Color</label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                className="w-9 h-9 rounded-lg border border-slate-300 p-0.5 cursor-pointer"
              />
              <Input
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                className="font-mono text-xs w-32"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c })}
                  className="w-5 h-5 rounded-full border border-black/10 transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
            <Input
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Operational context or usage purpose"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : `Create ${activeTab === 'TAGS' ? 'Tag' : 'Label'}`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
