// ========================================================================
// Vendors / Suppliers Module
// Suppliers master with contact, address, GSTIN and payment terms
// ========================================================================

import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Edit2, Trash2, RefreshCw, AlertCircle, Phone, Mail, MapPin } from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { InventoryVendor } from '../../types/index.js';

export const VendorsModule: React.FC<{ tabId?: string }> = () => {
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryVendor | null>(null);
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formContactPerson, setFormContactPerson] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formTaxId, setFormTaxId] = useState<string>('');
  const [formPaymentTerms, setFormPaymentTerms] = useState<string>('Net 30');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await api.get<InventoryVendor[]>('/inventory/vendors');
      setVendors(data || []);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setFormCode('');
    setFormName('');
    setFormContactPerson('');
    setFormEmail('');
    setFormPhone('');
    setFormAddress('');
    setFormTaxId('');
    setFormPaymentTerms('Net 30');
    setFormStatus('ACTIVE');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEdit = (v: InventoryVendor) => {
    setEditingItem(v);
    setFormCode(v.code);
    setFormName(v.name);
    setFormContactPerson(v.contact_person || '');
    setFormEmail(v.email || '');
    setFormPhone(v.phone || '');
    setFormAddress(v.address || '');
    setFormTaxId(v.tax_id || '');
    setFormPaymentTerms(v.payment_terms || 'Net 30');
    setFormStatus(v.status);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');

      if (!formName.trim()) {
        setErrorMsg('Vendor name is required');
        return;
      }

      if (editingItem) {
        await api.put(`/inventory/vendors/${editingItem.id}`, {
          name: formName,
          contact_person: formContactPerson,
          email: formEmail,
          phone: formPhone,
          address: formAddress,
          tax_id: formTaxId,
          payment_terms: formPaymentTerms,
          status: formStatus,
        });
      } else {
        if (!formCode.trim()) {
          setErrorMsg('Vendor code is required');
          return;
        }
        await api.post('/inventory/vendors', {
          code: formCode.toUpperCase(),
          name: formName,
          contact_person: formContactPerson,
          email: formEmail,
          phone: formPhone,
          address: formAddress,
          tax_id: formTaxId,
          payment_terms: formPaymentTerms,
          status: formStatus,
        });
      }

      setIsModalOpen(false);
      loadVendors();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate/delete this vendor?')) return;
    try {
      await api.delete(`/inventory/vendors/${id}`);
      loadVendors();
    } catch (err: any) {
      alert(err.message || 'Failed to delete vendor');
    }
  };

  const filtered = vendors.filter((v) => {
    if (statusFilter && v.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        (v.contact_person || '').toLowerCase().includes(q) ||
        (v.email || '').toLowerCase().includes(q) ||
        (v.phone || '').includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-600" />
            Vendors & Suppliers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered suppliers for books, stationery, uniforms, and classroom supplies.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadVendors} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={openCreate} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Vendor
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search vendor code, name, phone, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-brand-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="flex justify-end items-center text-xs text-slate-400">
            Showing {filtered.length} of {vendors.length} vendors
          </div>
        </div>
      </Card>

      <Card className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Vendor Name</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">GSTIN / Tax ID</th>
                <th className="py-3 px-4">Payment Terms</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading vendors...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No vendors found.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-brand-700">{v.code}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{v.name}</div>
                      {v.address && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-xs">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {v.address}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-700">{v.contact_person || '—'}</div>
                      <div className="text-[11px] text-slate-400 space-y-0.5 mt-0.5">
                        {v.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" /> {v.phone}
                          </div>
                        )}
                        {v.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" /> {v.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{v.tax_id || '—'}</td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{v.payment_terms || 'Net 30'}</td>
                    <td className="py-3 px-4">
                      {v.status === 'ACTIVE' ? (
                        <Badge variant="emerald">Active</Badge>
                      ) : (
                        <Badge variant="slate">Inactive</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => openEdit(v)}
                        className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(v.id)}
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
        title={editingItem ? 'Edit Vendor' : 'Add New Vendor'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Code *</label>
              <input
                type="text"
                disabled={!!editingItem}
                required
                placeholder="e.g. VEND-ABC"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono uppercase disabled:bg-slate-50 disabled:text-slate-400"
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Vendor Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. ABC Educational Supplies Ltd."
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Virendra Sachdeva"
                value={formContactPerson}
                onChange={(e) => setFormContactPerson(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="e.g. +91 98110 54321"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="e.g. sales@abcsupplies.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN / Tax ID</label>
              <input
                type="text"
                placeholder="e.g. 07AAAAA0000A1Z5"
                value={formTaxId}
                onChange={(e) => setFormTaxId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
              <input
                type="text"
                placeholder="e.g. Net 30, COD, Advance"
                value={formPaymentTerms}
                onChange={(e) => setFormPaymentTerms(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
              <input
                type="text"
                placeholder="e.g. Okhla Phase 2, New Delhi"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200"
              />
            </div>
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
