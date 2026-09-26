// ========================================================================
// Book Categories Module
// Database-Driven Subject & Genre Taxonomy
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { LibraryCategory } from '../../types/index.js';

export const BookCategoriesModule: React.FC<{ tabId?: string }> = () => {
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get<LibraryCategory[]>('/library/categories');
      if (res) setCategories(res);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenAdd = () => {
    setEditingCategoryId(null);
    setName('');
    setCode('');
    setDescription('');
    setStatus('ACTIVE');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: LibraryCategory) => {
    setEditingCategoryId(cat.id);
    setName(cat.name);
    setCode(cat.code || '');
    setDescription(cat.description || '');
    setStatus(cat.status);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (cat: LibraryCategory) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;
    try {
      await api.delete(`/library/categories/${cat.id}`);
      loadCategories();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.message || 'Cannot delete category.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase() || undefined,
        description: description.trim() || undefined,
        status,
      };

      if (editingCategoryId) {
        await api.put(`/library/categories/${editingCategoryId}`, payload);
      } else {
        await api.post('/library/categories', payload);
      }

      setIsModalOpen(false);
      loadCategories();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || err.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = categories.filter((c) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.code && c.code.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Book Categories & Hierarchy</h1>
            <Badge variant="indigo">Subject Classification</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Standard subject disciplines, textbook series, and literary classifications
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadCategories} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search category name, code, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      {/* Categories Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Category Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Titles Count</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading categories...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <FolderTree className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No categories found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-900">{c.name}</td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-600">
                      {c.code || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600 max-w-sm truncate">
                      {c.description || <span className="text-gray-400 italic">No description</span>}
                    </td>
                    <td className="py-3 px-4 text-xs font-bold text-gray-800">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                        {c.book_count ?? 0} titles
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={c.status === 'ACTIVE' ? 'success' : 'slate'}>{c.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(c)}>
                          <Edit2 className="w-3.5 h-3.5 mr-1 text-blue-600" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(c)}
                          className="hover:text-rose-600"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
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

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategoryId ? 'Edit Category' : 'Add New Category'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{formError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Category Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Science & Technology"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Category Code Prefix</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SCI"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Physics, Chemistry, Biology and Computer Science"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Status</label>
            <Select
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingCategoryId ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
