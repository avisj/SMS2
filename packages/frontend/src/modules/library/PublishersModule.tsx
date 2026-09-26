// ========================================================================
// Publishers Module
// Master Register of Book Publishing Houses
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Globe,
  Mail,
  Phone,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { LibraryPublisher } from '../../types/index.js';

export const PublishersModule: React.FC<{ tabId?: string }> = () => {
  const [publishers, setPublishers] = useState<LibraryPublisher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPublisherId, setEditingPublisherId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [contact, setContact] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadPublishers = async () => {
    setLoading(true);
    try {
      const res = await api.get<LibraryPublisher[]>('/library/publishers');
      if (res) setPublishers(res);
    } catch (err: any) {
      console.error('Failed to load publishers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublishers();
  }, []);

  const handleOpenAdd = () => {
    setEditingPublisherId(null);
    setName('');
    setContact('');
    setEmail('');
    setPhone('');
    setAddress('');
    setWebsite('');
    setRemarks('');
    setStatus('ACTIVE');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pub: LibraryPublisher) => {
    setEditingPublisherId(pub.id);
    setName(pub.name);
    setContact(pub.contact || '');
    setEmail(pub.email || '');
    setPhone(pub.phone || '');
    setAddress(pub.address || '');
    setWebsite(pub.website || '');
    setRemarks(pub.remarks || '');
    setStatus(pub.status);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Publisher name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        contact: contact.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        website: website.trim() || undefined,
        remarks: remarks.trim() || undefined,
        status,
      };

      if (editingPublisherId) {
        await api.put(`/library/publishers/${editingPublisherId}`, payload);
      } else {
        await api.post('/library/publishers', payload);
      }

      setIsModalOpen(false);
      loadPublishers();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || err.message || 'Failed to save publisher.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = publishers.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.email && p.email.toLowerCase().includes(term)) ||
      (p.contact && p.contact.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Publishers & Imprints</h1>
            <Badge variant="indigo">Master Register</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Maintain publishing houses, textbook distribution contacts, and editorial imprints
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadPublishers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Publisher
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search publisher name, email, or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      {/* Publishers Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Publisher Name</th>
                <th className="py-3 px-4">Contact Person / Desk</th>
                <th className="py-3 px-4">Communication Details</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading publisher records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No publishers recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-900">{p.name}</td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-700">
                      {p.contact || <span className="text-gray-400 italic">Direct Desk</span>}
                    </td>
                    <td className="py-3 px-4 text-xs space-y-0.5">
                      {p.email && (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <span>{p.email}</span>
                        </div>
                      )}
                      {p.phone && (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{p.phone}</span>
                        </div>
                      )}
                      {p.website && (
                        <div className="flex items-center gap-1.5 text-blue-600">
                          <Globe className="w-3.5 h-3.5 text-gray-400" />
                          <span className="truncate max-w-xs">{p.website}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={p.status === 'ACTIVE' ? 'success' : 'slate'}>{p.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEdit(p)}>
                        <Edit2 className="w-3.5 h-3.5 mr-1 text-blue-600" />
                        Edit
                      </Button>
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
        title={editingPublisherId ? 'Edit Publisher Profile' : 'Add New Publisher'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{formError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Publisher Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oxford University Press"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Contact Person / Division</label>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. Educational Sales Desk"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Contact Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. sales@oup.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Phone Number</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 11 2656 0464"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Website URL</label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. https://global.oup.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Physical Address</label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Ansari Road, Daryaganj, New Delhi"
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
              {saving ? 'Saving...' : editingPublisherId ? 'Save Changes' : 'Create Publisher'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
