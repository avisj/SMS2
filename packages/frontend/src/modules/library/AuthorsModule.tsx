// ========================================================================
// Authors Module
// Master Register of Book Authors & Contributors
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  BookOpen,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { LibraryAuthor } from '../../types/index.js';

export const AuthorsModule: React.FC<{ tabId?: string }> = () => {
  const [authors, setAuthors] = useState<LibraryAuthor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAuthorId, setEditingAuthorId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [biography, setBiography] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadAuthors = async () => {
    setLoading(true);
    try {
      const res = await api.get<LibraryAuthor[]>('/library/authors');
      if (res) setAuthors(res);
    } catch (err: any) {
      console.error('Failed to load authors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuthors();
  }, []);

  const handleOpenAdd = () => {
    setEditingAuthorId(null);
    setName('');
    setBiography('');
    setRemarks('');
    setStatus('ACTIVE');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (author: LibraryAuthor) => {
    setEditingAuthorId(author.id);
    setName(author.name);
    setBiography(author.biography || '');
    setRemarks(author.remarks || '');
    setStatus(author.status);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Author name is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingAuthorId) {
        await api.put(`/library/authors/${editingAuthorId}`, {
          name: name.trim(),
          biography: biography.trim() || undefined,
          remarks: remarks.trim() || undefined,
          status,
        });
      } else {
        await api.post('/library/authors', {
          name: name.trim(),
          biography: biography.trim() || undefined,
          remarks: remarks.trim() || undefined,
          status,
        });
      }

      setIsModalOpen(false);
      loadAuthors();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || err.message || 'Failed to save author.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = authors.filter((a) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return a.name.toLowerCase().includes(term) || (a.biography && a.biography.toLowerCase().includes(term));
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Authors & Contributors</h1>
            <Badge variant="indigo">Master Register</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Maintain author profiles, co-authors, and biographical details
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadAuthors} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Author
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search author name or biography..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </Card>

      {/* Authors Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Author Name</th>
                <th className="py-3 px-4">Biography / Notes</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading author records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No authors recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-900">{a.name}</td>
                    <td className="py-3 px-4 text-xs text-gray-600 max-w-md">
                      {a.biography || <span className="text-gray-400 italic">No biographical details</span>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={a.status === 'ACTIVE' ? 'success' : 'slate'}>{a.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEdit(a)}>
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
        title={editingAuthorId ? 'Edit Author Profile' : 'Add New Author'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{formError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Author Full Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. R.D. Sharma"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Biography / Credentials</label>
            <Input
              value={biography}
              onChange={(e) => setBiography(e.target.value)}
              placeholder="e.g. Renowned mathematician and author of CBSE textbooks"
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
              {saving ? 'Saving...' : editingAuthorId ? 'Save Changes' : 'Create Author'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
