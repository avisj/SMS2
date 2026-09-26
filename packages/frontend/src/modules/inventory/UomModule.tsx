// ========================================================================
// Units of Measure (UOM) Module
// Quantity measurement units (pcs, box, pkt, kg, meters, etc.)
// ========================================================================

import React, { useState, useEffect } from 'react';
import { Scale, Plus, Search, Edit2, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { InventoryUOM } from '../../types/index.js';

export const UomModule: React.FC<{ tabId?: string }> = () => {
  const [uoms, setUoms] = useState<InventoryUOM[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryUOM | null>(null);
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formSymbol, setFormSymbol] = useState<string>('');
  const [formIsFractional, setFormIsFractional] = useState<boolean>(false);
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    loadUoms();
  }, []);

  const loadUoms = async () => {
    try {
      setLoading(true);
      const data = await api.get<InventoryUOM[]>('/inventory/uoms');
      setUoms(data || []);
    } catch (err) {
      console.error('Failed to load UOMs:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormCode('');
    setFormName('');
    setFormSymbol('');
    setFormIsFractional(false);
    setFormStatus('ACTIVE');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEdit = (uom: InventoryUOM) => {
    setEditingItem(uom);
    setFormCode(uom.code);
    setFormName(uom.name);
    setFormSymbol(uom.symbol);
    setFormIsFractional(uom.is_fractional);
    setFormStatus(uom.status);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');

      if (!formName.trim() || !formSymbol.trim()) {
        setErrorMsg('UOM name and symbol are required');
        return;
      }

      if (editingItem) {
        await api.put(`/inventory/uoms/${editingItem.id}`, {
          name: formName,
          symbol: formSymbol,
          is_fractional: formIsFractional,
          status: formStatus,
        });
      } else {
        if (!formCode.trim()) {
          setErrorMsg('UOM code is required');
          return;
        }
        await api.post('/inventory/uoms', {
          code: formCode.toUpperCase(),
          name: formName,
          symbol: formSymbol,
          is_fractional: formIsFractional,
          status: formStatus,
        });
      }

      setIsModalOpen(false);
      loadUoms();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save UOM');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate/delete this UOM?')) return;
    try {
      await api.delete(`/inventory/uoms/${id}`);
      loadUoms();
    } catch (err: any) {
      alert(err.message || 'Failed to delete UOM');
    }
  };

  const filtered = uoms.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.code.toLowerCase().includes(q) || u.symbol.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand-600" />
            Units of Measure (UOM)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Physical quantity measurement units across inventory.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadUoms} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={openCreate} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add UOM
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search code, name or symbol..."
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
                <th className="py-3 px-4">Unit Name</th>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Fractional?</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading UOMs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No units of measure found.
                  </td>
                </tr>
              ) : (
                filtered.map((uom) => (
                  <tr key={uom.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-brand-700">{uom.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{uom.name}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">{uom.symbol}</td>
                    <td className="py-3 px-4">
                      {uom.is_fractional ? (
                        <span className="text-[11px] text-brand-600 font-medium">Yes (Decimals allowed)</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">No (Whole numbers)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {uom.status === 'ACTIVE' ? (
                        <Badge variant="emerald">Active</Badge>
                      ) : (
                        <Badge variant="slate">Inactive</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => openEdit(uom)}
                        className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(uom.id)}
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit UOM' : 'Add UOM'}>
        <form onSubmit={handleSave} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">UOM Code *</label>
              <input
                type="text"
                disabled={!!editingItem}
                required
                placeholder="e.g. UOM-PCS"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono uppercase disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Symbol *</label>
              <input
                type="text"
                required
                placeholder="e.g. pcs, box, kg"
                value={formSymbol}
                onChange={(e) => setFormSymbol(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Pieces, Kilograms, Metres"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="fractional"
              checked={formIsFractional}
              onChange={(e) => setFormIsFractional(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="fractional" className="text-xs font-medium text-slate-700">
              Allow fractional / decimal quantities (e.g. 2.5 kg)
            </label>
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
