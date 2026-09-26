// ========================================================================
// FeeHeadsModule
// Authoritative Master Catalog for Fee Categories & Heads
// ========================================================================

import React, { useEffect, useState } from 'react';
import { Tag, Plus, Search, Filter, Edit2, Trash2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../api/client.js';
import { FeeHead, FeeHeadCategory, FeeHeadStatus } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';

interface FeeHeadsModuleProps {
  tabId?: string;
}

const CATEGORIES: FeeHeadCategory[] = [
  'ACADEMIC',
  'FACILITY',
  'OPTIONAL',
  'ONE_TIME',
  'TRANSPORT',
  'MISC',
];

export const FeeHeadsModule: React.FC<FeeHeadsModuleProps> = () => {
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingHead, setEditingHead] = useState<FeeHead | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'ACADEMIC' as FeeHeadCategory,
    description: '',
    is_taxable: false,
    tax_rate: 0,
    display_order: 1,
    status: 'ACTIVE' as FeeHeadStatus,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const loadHeads = async () => {
    try {
      setLoading(true);
      const data = await api.get<FeeHead[]>('/fees/heads', {
        search: searchQuery || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
      });
      setHeads(data || []);
    } catch (err: any) {
      console.error('[FeeHeadsModule] Error loading heads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHeads();
  }, [searchQuery, categoryFilter, statusFilter]);

  const handleOpenAdd = () => {
    setEditingHead(null);
    setFormData({
      code: '',
      name: '',
      category: 'ACADEMIC',
      description: '',
      is_taxable: false,
      tax_rate: 0,
      display_order: heads.length + 1,
      status: 'ACTIVE',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (head: FeeHead) => {
    setEditingHead(head);
    setFormData({
      code: head.code,
      name: head.name,
      category: head.category,
      description: head.description || '',
      is_taxable: head.is_taxable,
      tax_rate: head.tax_rate,
      display_order: head.display_order,
      status: head.status,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Fee Head name is required');
      return;
    }
    if (!formData.code.trim()) {
      setFormError('Fee Head code is required');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      if (editingHead) {
        await api.put(`/fees/heads/${editingHead.id}`, formData);
      } else {
        await api.post('/fees/heads', formData);
      }
      setIsModalOpen(false);
      loadHeads();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save fee head');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (head: FeeHead) => {
    if (!window.confirm(`Are you sure you want to delete Fee Head "${head.name}" (${head.code})?`)) {
      return;
    }
    try {
      await api.delete(`/fees/heads/${head.id}`);
      loadHeads();
    } catch (err: any) {
      alert(err.message || 'Failed to delete fee head');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-indigo-600" />
            Fee Heads Master
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure fee heads, categories, tax liabilities, and billing display order.
          </p>
        </div>

        <Button onClick={handleOpenAdd} className="flex items-center gap-1.5 text-xs">
          <Plus className="w-4 h-4" />
          Add Fee Head
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <Button variant="secondary" size="sm" onClick={loadHeads} className="flex items-center gap-1 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Heads Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Head Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Tax Details</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && heads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Loading fee heads catalog...
                  </td>
                </tr>
              ) : heads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No fee heads found matching your filters.
                  </td>
                </tr>
              ) : (
                heads.map((head) => (
                  <tr key={head.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-500">{head.display_order}</td>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{head.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{head.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {head.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {head.is_taxable ? (
                        <span className="text-amber-700 font-semibold">{head.tax_rate}% GST</span>
                      ) : (
                        <span className="text-slate-400">Exempt</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{head.description || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={head.status === 'ACTIVE' ? 'success' : 'default'} size="sm">
                        {head.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(head)}
                          className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100"
                          title="Edit Fee Head"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(head)}
                          className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100"
                          title="Delete Fee Head"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingHead ? `Edit Fee Head: ${editingHead.name}` : 'Add New Fee Head'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Code *</label>
              <Input
                type="text"
                placeholder="e.g. TUI-FEE"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as FeeHeadCategory })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Head Name *</label>
            <Input
              type="text"
              placeholder="e.g. Tuition Fee"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Short explanation of this fee head..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Taxable?</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="is_taxable"
                  checked={formData.is_taxable}
                  onChange={(e) => setFormData({ ...formData, is_taxable: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="is_taxable" className="text-xs text-slate-700 cursor-pointer">
                  Yes, GST applies
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Rate (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                disabled={!formData.is_taxable}
                value={formData.tax_rate}
                onChange={(e) => setFormData({ ...formData, tax_rate: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Display Order</label>
              <Input
                type="number"
                min="1"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as FeeHeadStatus })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingHead ? 'Save Changes' : 'Create Fee Head'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
