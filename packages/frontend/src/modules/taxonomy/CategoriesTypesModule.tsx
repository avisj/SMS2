// ========================================================================
// CategoriesTypesModule Component
// Dedicated Categories & Subcategories Management
// ZERO display_order - sorted newest first (created_at DESC)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  FolderTree,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Tag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import { UserCategory, UserSubcategory } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';

interface CategoriesTypesModuleProps {
  tabId: string;
}

export const CategoriesTypesModule: React.FC<CategoriesTypesModuleProps> = () => {
  const { userContext } = useAuth();

  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catFormData, setCatFormData] = useState({
    code: '',
    name: '',
    applicable_user_type: 'STAFF',
    description: '',
  });

  // Subcategory Modal
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [subFormData, setSubFormData] = useState({
    code: '',
    name: '',
    description: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.get<UserCategory[]>('/people/categories');
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userContext?.school_id]);

  const handleOpenCreateCategory = () => {
    setEditingCatId(null);
    setCatFormData({
      code: '',
      name: '',
      applicable_user_type: 'STAFF',
      description: '',
    });
    setErrorMessage(null);
    setIsCatModalOpen(true);
  };

  const handleOpenCreateSubcategory = (catId: string) => {
    setSelectedCatId(catId);
    setSubFormData({
      code: '',
      name: '',
      description: '',
    });
    setErrorMessage(null);
    setIsSubModalOpen(true);
  };

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingCatId) {
        await api.put(`/people/categories/${editingCatId}`, catFormData);
      } else {
        await api.post('/people/categories', catFormData);
      }
      setIsCatModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await api.post(`/people/categories/${selectedCatId}/subcategories`, subFormData);
      setIsSubModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save subcategory');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await api.delete(`/people/categories/${id}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  const handleDeleteSubcategory = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete subcategory "${name}"?`)) return;
    try {
      await api.delete(`/people/subcategories/${id}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete subcategory');
    }
  };

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.applicable_user_type && c.applicable_user_type.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-teal-600" />
            Categories & Subcategories
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable demographic and functional categories. Zero display_order - sorted newest first.
          </p>
        </div>
        <Button
          onClick={handleOpenCreateCategory}
          variant="primary"
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search categories by name, code, or user type..."
              className="pl-9"
            />
          </div>
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Categories Cards List */}
      {loading ? (
        <Card>
          <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
            Loading categories and subcategories...
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-slate-400 text-xs">
            No categories found.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(cat => (
            <Card key={cat.id} className="overflow-hidden border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{cat.name}</h3>
                      <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-medium">
                        {cat.code}
                      </span>
                      {cat.applicable_user_type && (
                        <Badge variant="indigo" className="text-[10px]">
                          {cat.applicable_user_type}
                        </Badge>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleOpenCreateSubcategory(cat.id)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Subcategory</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Subcategories */}
              <div className="pt-3">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Subcategories ({cat.subcategories?.length || 0})
                </div>

                {cat.subcategories && cat.subcategories.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {cat.subcategories.map(sub => (
                      <div
                        key={sub.id}
                        className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-xs hover:bg-white transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-slate-800">{sub.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{sub.code}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSubcategory(sub.id, sub.name)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-1">
                    No subcategories defined for this category.
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Category Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCatId ? 'Edit Category' : 'Create Category'}
      >
        <form onSubmit={handleCatSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Category Name *</label>
            <Input
              required
              value={catFormData.name}
              onChange={e => setCatFormData({ ...catFormData, name: e.target.value })}
              placeholder="e.g. Teaching Faculty"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
              <Input
                required
                disabled={!!editingCatId}
                value={catFormData.code}
                onChange={e => setCatFormData({ ...catFormData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CAT-TEACH"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Applicable User Type</label>
              <Select
                value={catFormData.applicable_user_type}
                onChange={e => setCatFormData({ ...catFormData, applicable_user_type: e.target.value })}
                options={[
                  { value: 'STAFF', label: 'Staff' },
                  { value: 'STUDENT', label: 'Student' },
                  { value: 'PARENT', label: 'Parent' },
                  { value: 'ALL', label: 'All Users' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
            <Input
              value={catFormData.description}
              onChange={e => setCatFormData({ ...catFormData, description: e.target.value })}
              placeholder="Classification notes"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCatModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingCatId ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Subcategory Modal */}
      <Modal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        title="Add Subcategory"
      >
        <form onSubmit={handleSubSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Subcategory Name *</label>
            <Input
              required
              value={subFormData.name}
              onChange={e => setSubFormData({ ...subFormData, name: e.target.value })}
              placeholder="e.g. Senior Secondary Faculty"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
            <Input
              required
              value={subFormData.code}
              onChange={e => setSubFormData({ ...subFormData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. SUB-SR"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
            <Input
              value={subFormData.description}
              onChange={e => setSubFormData({ ...subFormData, description: e.target.value })}
              placeholder="Notes or scope"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsSubModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Create Subcategory'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
