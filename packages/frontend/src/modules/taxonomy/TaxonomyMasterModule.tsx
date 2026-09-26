// ========================================================================
// TaxonomyMasterModule Component
// Governance for Categories, Subcategories, Tags, and Color-Coded Labels
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Tag,
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  Bookmark,
  CheckCircle,
  Folder,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { UserCategory, UserSubcategory, UserTag, UserLabel } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface TaxonomyMasterModuleProps {
  tabId: string;
}

export const TaxonomyMasterModule: React.FC<TaxonomyMasterModuleProps> = () => {
  const { activeBranch } = useAuth();
  const { hasPermission } = usePermission();

  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'tags' | 'labels'>('categories');

  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [subcategories, setSubcategories] = useState<UserSubcategory[]>([]);
  const [tags, setTags] = useState<UserTag[]>([]);
  const [labels, setLabels] = useState<UserLabel[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catFormData, setCatFormData] = useState({ code: '', name: '', applicable_user_type: 'STAFF', description: '' });

  const [isSubcatModalOpen, setIsSubcatModalOpen] = useState(false);
  const [subcatFormData, setSubcatFormData] = useState({ category_id: '', code: '', name: '', description: '' });

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagFormData, setTagFormData] = useState({ code: '', name: '', color: '#3b82f6', description: '' });

  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelFormData, setLabelFormData] = useState({ code: '', name: '', color: '#10b981', description: '' });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [catsData, subcatsData, tagsData, labelsData] = await Promise.all([
        api.get<UserCategory[]>('/people/categories'),
        api.get<UserSubcategory[]>('/people/subcategories'),
        api.get<UserTag[]>('/people/tags'),
        api.get<UserLabel[]>('/people/labels'),
      ]);
      setCategories(catsData);
      setSubcategories(subcatsData);
      setTags(tagsData);
      setLabels(labelsData);

      if (catsData.length > 0 && !subcatFormData.category_id) {
        setSubcatFormData(prev => ({ ...prev, category_id: catsData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load taxonomy:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  // Handlers for Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post('/people/categories', catFormData);
      setIsCatModalOpen(false);
      setCatFormData({ code: '', name: '', applicable_user_type: 'STAFF', description: '' });
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
      await api.delete(`/people/categories/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  // Handlers for Subcategory
  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post('/people/subcategories', subcatFormData);
      setIsSubcatModalOpen(false);
      setSubcatFormData({ category_id: categories[0]?.id || '', code: '', name: '', description: '' });
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create subcategory');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!confirm('Delete this subcategory?')) return;
    try {
      await api.delete(`/people/subcategories/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete subcategory');
    }
  };

  // Handlers for Tag
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post('/people/tags', tagFormData);
      setIsTagModalOpen(false);
      setTagFormData({ code: '', name: '', color: '#3b82f6', description: '' });
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create tag');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    try {
      await api.delete(`/people/tags/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete tag');
    }
  };

  // Handlers for Label
  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post('/people/labels', labelFormData);
      setIsLabelModalOpen(false);
      setLabelFormData({ code: '', name: '', color: '#10b981', description: '' });
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create label');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLabel = async (id: string) => {
    if (!confirm('Delete this status label?')) return;
    try {
      await api.delete(`/people/labels/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete label');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Taxonomy & Tags Master</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
              Tenant Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure flexible classification dimensions, multi-level categories, user tags, and alert labels.
          </p>
        </div>

        <div className="flex gap-2">
          {activeSubTab === 'categories' && hasPermission('users.create') && (
            <>
              <Button variant="secondary" onClick={() => setIsSubcatModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Subcategory
              </Button>
              <Button variant="primary" onClick={() => setIsCatModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Create Category
              </Button>
            </>
          )}

          {activeSubTab === 'tags' && hasPermission('users.create') && (
            <Button variant="primary" onClick={() => setIsTagModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Tag
            </Button>
          )}

          {activeSubTab === 'labels' && hasPermission('users.create') && (
            <Button variant="primary" onClick={() => setIsLabelModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Status Label
            </Button>
          )}
        </div>
      </div>

      {/* Subtab Navigation */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveSubTab('categories')}
          className={`py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeSubTab === 'categories'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          Categories & Subcategories ({categories.length})
        </button>

        <button
          onClick={() => setActiveSubTab('tags')}
          className={`py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeSubTab === 'tags'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Tag className="w-4 h-4" />
          User Tags ({tags.length})
        </button>

        <button
          onClick={() => setActiveSubTab('labels')}
          className={`py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeSubTab === 'labels'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          Status Labels ({labels.length})
        </button>
      </div>

      {/* SUBTAB 1: CATEGORIES & SUBCATEGORIES */}
      {activeSubTab === 'categories' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map(cat => {
              const catSubcats = subcategories.filter(s => s.category_id === cat.id);
              return (
                <Card key={cat.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                        <Folder className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{cat.name}</h3>
                        <span className="text-[11px] font-mono text-teal-600">{cat.code}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="slate">{cat.applicable_user_type || 'ALL'}</Badge>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">{cat.description || 'No description provided.'}</p>

                  <div>
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Subcategories ({catSubcats.length})
                    </h5>
                    <div className="space-y-1.5">
                      {catSubcats.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No subcategories under this category.</span>
                      ) : (
                        catSubcats.map(sub => (
                          <div key={sub.id} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-slate-800">{sub.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 block">{sub.code}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteSubcategory(sub.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: TAGS */}
      {activeSubTab === 'tags' && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2.5">
            {tags.map(tag => (
              <div
                key={tag.id}
                style={{ backgroundColor: `${tag.color}15`, borderColor: `${tag.color}40`, color: tag.color }}
                className="px-3 py-1.5 rounded-full border flex items-center gap-2 text-xs font-semibold shadow-2xs"
              >
                <span>{tag.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({tag.code})</span>
                <button
                  onClick={() => handleDeleteTag(tag.id)}
                  className="opacity-60 hover:opacity-100 transition-opacity ml-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
            Tags can be attached to any user identity to denote operational responsibilities (e.g., Class Teacher, Bus Incharge, Hosteler).
          </div>
        </Card>
      )}

      {/* SUBTAB 3: LABELS */}
      {activeSubTab === 'labels' && (
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {labels.map(lbl => (
              <div
                key={lbl.id}
                className="p-3 rounded-xl border border-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: lbl.color }} />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{lbl.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">{lbl.code}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteLabel(lbl.id)}
                  className="text-slate-400 hover:text-rose-600 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Create Category Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title="Create User Category"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
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
                value={catFormData.code}
                onChange={e => setCatFormData({ ...catFormData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CAT-TEACH"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Applicable User Type</label>
              <select
                value={catFormData.applicable_user_type}
                onChange={e => setCatFormData({ ...catFormData, applicable_user_type: e.target.value })}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
              >
                <option value="STAFF">Staff & Faculty</option>
                <option value="STUDENT">Students</option>
                <option value="PARENT">Parents</option>
                <option value="ALL">All Personas</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Description</label>
            <Input
              value={catFormData.description}
              onChange={e => setCatFormData({ ...catFormData, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="secondary" type="button" onClick={() => setIsCatModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Create Category
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Subcategory Modal */}
      <Modal
        isOpen={isSubcatModalOpen}
        onClose={() => setIsSubcatModalOpen(false)}
        title="Create Subcategory"
      >
        <form onSubmit={handleCreateSubcategory} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Parent Category *</label>
            <select
              value={subcatFormData.category_id}
              onChange={e => setSubcatFormData({ ...subcatFormData, category_id: e.target.value })}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Subcategory Name *</label>
            <Input
              required
              value={subcatFormData.name}
              onChange={e => setSubcatFormData({ ...subcatFormData, name: e.target.value })}
              placeholder="e.g. Senior Secondary Faculty"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
            <Input
              required
              value={subcatFormData.code}
              onChange={e => setSubcatFormData({ ...subcatFormData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. SUB-SR"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="secondary" type="button" onClick={() => setIsSubcatModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Create Subcategory
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Tag Modal */}
      <Modal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title="Create User Tag"
      >
        <form onSubmit={handleCreateTag} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Tag Name *</label>
            <Input
              required
              value={tagFormData.name}
              onChange={e => setTagFormData({ ...tagFormData, name: e.target.value })}
              placeholder="e.g. Class Teacher"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
              <Input
                required
                value={tagFormData.code}
                onChange={e => setTagFormData({ ...tagFormData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. TAG-CT"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Badge Color *</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tagFormData.color}
                  onChange={e => setTagFormData({ ...tagFormData, color: e.target.value })}
                  className="w-8 h-8 rounded border border-slate-300 p-0 cursor-pointer"
                />
                <Input
                  value={tagFormData.color}
                  onChange={e => setTagFormData({ ...tagFormData, color: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="secondary" type="button" onClick={() => setIsTagModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Create Tag
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Label Modal */}
      <Modal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        title="Create Status Label"
      >
        <form onSubmit={handleCreateLabel} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Label Name *</label>
            <Input
              required
              value={labelFormData.name}
              onChange={e => setLabelFormData({ ...labelFormData, name: e.target.value })}
              placeholder="e.g. Fee Due Alert"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Code *</label>
              <Input
                required
                value={labelFormData.code}
                onChange={e => setLabelFormData({ ...labelFormData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. LBL-DUE"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Color Indicator *</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={labelFormData.color}
                  onChange={e => setLabelFormData({ ...labelFormData, color: e.target.value })}
                  className="w-8 h-8 rounded border border-slate-300 p-0 cursor-pointer"
                />
                <Input
                  value={labelFormData.color}
                  onChange={e => setLabelFormData({ ...labelFormData, color: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="secondary" type="button" onClick={() => setIsLabelModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Create Status Label
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
