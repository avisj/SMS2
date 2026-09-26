// ========================================================================
// Asset Categories & Taxonomy Module
// Manage high-level Asset Classifications and Granular Subcategories
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Tag,
  CheckCircle2,
  AlertCircle,
  Boxes,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { Select } from '../../components/common/Select.js';
import { api } from '../../api/client.js';
import { AssetCategory, AssetSubcategory } from '../../types/index.js';

export const AssetCategoriesModule: React.FC<{ tabId?: string }> = () => {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [subcategories, setSubcategories] = useState<AssetSubcategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null);

  // Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState<boolean>(false);
  const [editingCat, setEditingCat] = useState<AssetCategory | null>(null);
  const [catCode, setCatCode] = useState<string>('');
  const [catName, setCatName] = useState<string>('');
  const [catDesc, setCatDesc] = useState<string>('');
  const [savingCat, setSavingCat] = useState<boolean>(false);
  const [catError, setCatError] = useState<string>('');

  // Subcategory Modal
  const [isSubModalOpen, setIsSubModalOpen] = useState<boolean>(false);
  const [editingSub, setEditingSub] = useState<AssetSubcategory | null>(null);
  const [subCode, setSubCode] = useState<string>('');
  const [subName, setSubName] = useState<string>('');
  const [subDesc, setSubDesc] = useState<string>('');
  const [subParentCatId, setSubParentCatId] = useState<string>('');
  const [savingSub, setSavingSub] = useState<boolean>(false);
  const [subError, setSubError] = useState<string>('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const [cats, subs] = await Promise.all([
        api.get<AssetCategory[]>('/assets/categories'),
        api.get<AssetSubcategory[]>('/assets/subcategories'),
      ]);
      setCategories(cats || []);
      setSubcategories(subs || []);
      if (cats && cats.length > 0 && !selectedCategory) {
        setSelectedCategory(cats[0]);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateCategory = () => {
    setEditingCat(null);
    setCatCode('');
    setCatName('');
    setCatDesc('');
    setCatError('');
    setIsCatModalOpen(true);
  };

  const handleOpenEditCategory = (cat: AssetCategory) => {
    setEditingCat(cat);
    setCatCode(cat.code);
    setCatName(cat.name);
    setCatDesc(cat.description || '');
    setCatError('');
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catCode.trim() || !catName.trim()) {
      setCatError('Code and Name are required.');
      return;
    }
    setSavingCat(true);
    setCatError('');
    try {
      if (editingCat) {
        await api.put(`/assets/categories/${editingCat.id}`, {
          code: catCode.trim(),
          name: catName.trim(),
          description: catDesc.trim() || undefined,
        });
      } else {
        await api.post('/assets/categories', {
          code: catCode.trim(),
          name: catName.trim(),
          description: catDesc.trim() || undefined,
        });
      }
      setIsCatModalOpen(false);
      loadCategories();
    } catch (err: any) {
      setCatError(err.message || 'Failed to save category');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (cat: AssetCategory) => {
    if (!window.confirm(`Are you sure you want to delete category '${cat.name}'?`)) return;
    try {
      await api.delete(`/assets/categories/${cat.id}`);
      if (selectedCategory?.id === cat.id) {
        setSelectedCategory(null);
      }
      loadCategories();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  const handleOpenCreateSubcategory = () => {
    setEditingSub(null);
    setSubCode('');
    setSubName('');
    setSubDesc('');
    setSubParentCatId(selectedCategory?.id || categories[0]?.id || '');
    setSubError('');
    setIsSubModalOpen(true);
  };

  const handleOpenEditSubcategory = (sub: AssetSubcategory) => {
    setEditingSub(sub);
    setSubCode(sub.code);
    setSubName(sub.name);
    setSubDesc(sub.description || '');
    setSubParentCatId(sub.category_id);
    setSubError('');
    setIsSubModalOpen(true);
  };

  const handleSaveSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCode.trim() || !subName.trim() || !subParentCatId) {
      setSubError('Category, Code and Name are required.');
      return;
    }
    setSavingSub(true);
    setSubError('');
    try {
      if (editingSub) {
        await api.put(`/assets/subcategories/${editingSub.id}`, {
          category_id: subParentCatId,
          code: subCode.trim(),
          name: subName.trim(),
          description: subDesc.trim() || undefined,
        });
      } else {
        await api.post('/assets/subcategories', {
          category_id: subParentCatId,
          code: subCode.trim(),
          name: subName.trim(),
          description: subDesc.trim() || undefined,
        });
      }
      setIsSubModalOpen(false);
      loadCategories();
    } catch (err: any) {
      setSubError(err.message || 'Failed to save subcategory');
    } finally {
      setSavingSub(false);
    }
  };

  const handleDeleteSubcategory = async (sub: AssetSubcategory) => {
    if (!window.confirm(`Are you sure you want to delete subcategory '${sub.name}'?`)) return;
    try {
      await api.delete(`/assets/subcategories/${sub.id}`);
      loadCategories();
    } catch (err: any) {
      alert(err.message || 'Failed to delete subcategory');
    }
  };

  const currentSubcategories = selectedCategory
    ? subcategories.filter((s) => s.category_id === selectedCategory.id)
    : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Asset Categories & Subcategories</h1>
            <Badge variant="indigo">Taxonomy</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Organize computers, furniture, lab apparatus, and electrical equipment into structured classifications
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadCategories} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="secondary" onClick={handleOpenCreateSubcategory}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Subcategory
          </Button>

          <Button variant="primary" onClick={handleOpenCreateCategory}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Category
          </Button>
        </div>
      </div>

      {/* Main 2-Column Split View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Categories List */}
        <Card className="p-4 md:col-span-1">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Primary Categories</h3>
            <Badge variant="slate">{categories.length}</Badge>
          </div>

          <div className="space-y-1.5">
            {categories.map((cat) => {
              const isSelected = selectedCategory?.id === cat.id;
              const subCount = subcategories.filter((s) => s.category_id === cat.id).length;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/60 shadow-xs'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900 text-sm truncate">{cat.name}</span>
                      <span className="text-xs font-mono text-gray-400">({cat.code})</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {subCount} subcategories
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenEditCategory(cat)}
                      className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-200/50"
                      title="Edit Category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-gray-200/50"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Subcategories Details Table */}
        <Card className="p-5 md:col-span-2">
          {selectedCategory ? (
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Subcategories for {selectedCategory.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedCategory.description || 'No description provided.'}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenCreateSubcategory}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Subcategory
                </Button>
              </div>

              {currentSubcategories.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FolderTree className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm">No subcategories created for this category yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500">
                      <tr>
                        <th className="py-2.5 px-3">Subcategory Name</th>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentSubcategories.map((sub) => (
                        <tr key={sub.id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 font-semibold text-gray-900">{sub.name}</td>
                          <td className="py-2.5 px-3 font-mono text-xs text-blue-600">{sub.code}</td>
                          <td className="py-2.5 px-3 text-xs text-gray-500">{sub.description || '—'}</td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditSubcategory(sub)}
                                className="p-1 text-gray-400 hover:text-gray-700 rounded"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSubcategory(sub)}
                                className="p-1 text-gray-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <FolderTree className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">Select a category on the left to inspect and manage subcategories.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Category Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title={editingCat ? `Edit Category: ${editingCat.name}` : 'Create Asset Category'}
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          {catError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{catError}</div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Code *</label>
            <Input
              value={catCode}
              onChange={(e) => setCatCode(e.target.value.toUpperCase())}
              placeholder="e.g. CAT-IT"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Category Name *</label>
            <Input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. IT Equipment & Hardware"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Description</label>
            <Input
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="e.g. Computers, laptops, interactive boards, and printers"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsCatModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={savingCat}>
              {savingCat ? 'Saving...' : editingCat ? 'Update' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Subcategory Modal */}
      <Modal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        title={editingSub ? `Edit Subcategory: ${editingSub.name}` : 'Create Asset Subcategory'}
      >
        <form onSubmit={handleSaveSubcategory} className="space-y-4">
          {subError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{subError}</div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Parent Category *</label>
            <Select
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              value={subParentCatId}
              onChange={(e) => setSubParentCatId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Subcategory Code *</label>
            <Input
              value={subCode}
              onChange={(e) => setSubCode(e.target.value.toUpperCase())}
              placeholder="e.g. SUB-LAP"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Subcategory Name *</label>
            <Input
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="e.g. Staff & Lab Laptops"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Description</label>
            <Input
              value={subDesc}
              onChange={(e) => setSubDesc(e.target.value)}
              placeholder="e.g. Laptops assigned to faculty and mobile computer carts"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsSubModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={savingSub}>
              {savingSub ? 'Saving...' : editingSub ? 'Update' : 'Create Subcategory'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
