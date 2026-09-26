// ========================================================================
// Brands Module
// Manufacturer and brand master for catalog products
// ========================================================================

import React, { useState, useEffect } from 'react';
import { Award, Plus, Search, Edit2, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { InventoryBrand } from '../../types/index.js';

export const BrandsModule: React.FC<{ tabId?: string }> = () => {
  const [brands, setBrands] = useState<InventoryBrand[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryBrand | null>(null);
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      setLoading(true);
      const data = await api.get<InventoryBrand[]>('/inventory/brands');
      setBrands(data || []);
    } catch (err) {
      console.error('Failed to load brands:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormCode('');
    setFormName('');
    setFormDescription('');
    setFormStatus('ACTIVE');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEdit = (brand: InventoryBrand) => {
    setEditingItem(brand);
    setFormCode(brand.code);
    setFormName(brand.name);
    setFormDescription(brand.description || '');
    setFormStatus(brand.status);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');

      if (!formName.trim()) {
        setErrorMsg('Brand name is required');
        return;
      }

      if (editingItem) {
        await api.put(`/inventory/brands/${editingItem.id}`, {
          name: formName,
          description: formDescription,
          status: formStatus,
        });
      } else {
        if (!formCode.trim()) {
          setErrorMsg('Brand code is required');
          return;
        }
        await api.post('/inventory/brands', {
          code: formCode.toUpperCase(),
          name: formName,
          description: formDescription,
          status: formStatus,
        });
      }

      setIsModalOpen(false);
      loadBrands();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save brand');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate/delete this brand?')) return;
    try {
      await api.delete(`/inventory/brands/${id}`);
      loadBrands();
    } catch (err: any) {
      alert(err.message || 'Failed to delete brand');
    }
  };

  const filtered = brands.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-brand-600" />
            Brands Master
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Manufacturers, publishers, and equipment brands.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadBrands} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={openCreate} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Brand
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search brand code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-brand-500"
          />
        </div>
      </Card>

      <Card className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Brand Name</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading brands...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No brands found.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-brand-700">{b.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{b.name}</td>
                    <td className="py-3 px-4 text-slate-500">{b.description || '—'}</td>
                    <td className="py-3 px-4">
                      {b.status === 'ACTIVE' ? (
                        <Badge variant="emerald">Active</Badge>
                      ) : (
                        <Badge variant="slate">Inactive</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => openEdit(b)}
                        className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Brand' : 'Add Brand'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Code *</label>
            <input
              type="text"
              disabled={!!editingItem}
              required
              placeholder="e.g. BR-CLASS"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono uppercase disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Classmate ITC"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Brand details..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? 'Saving...' : editingItem ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
