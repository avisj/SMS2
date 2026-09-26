// ========================================================================
// Book Copies Module
// Physical Holdings Register: Individual Copy Codes, Accession Numbers,
// Barcodes, Spatial Shelf/Rack Placement, Condition, and Status
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  Copy,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Barcode,
  Building2,
  CheckCircle,
  AlertTriangle,
  Edit2,
  Trash2,
  Layers,
  MapPin,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useCurrency } from '../../utils/currency.js';
import { getLocationSelectOptions, formatLocationDisplay } from '../../utils/locations.js';
import {
  LibraryBookCopy,
  LibraryBook,
  Location,
  BookCopyStatus,
  BookCopyCondition,
} from '../../types/index.js';

export const BookCopiesModule: React.FC<{ tabId?: string }> = () => {
  const { symbol, format } = useCurrency();

  const [copies, setCopies] = useState<LibraryBookCopy[]>([]);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCopyId, setEditingCopyId] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [copyCode, setCopyCode] = useState<string>('');
  const [accessionNumber, setAccessionNumber] = useState<string>('');
  const [barcode, setBarcode] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<string>('0');
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [room, setRoom] = useState<string>('Main Library');
  const [rack, setRack] = useState<string>('R1');
  const [shelf, setShelf] = useState<string>('S1');
  const [condition, setCondition] = useState<BookCopyCondition>('GOOD');
  const [status, setStatus] = useState<BookCopyStatus>('AVAILABLE');
  const [batchCount, setBatchCount] = useState<number>(1);
  const [remarks, setRemarks] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, bRes, lRes] = await Promise.all([
        api.get<LibraryBookCopy[]>('/library/copies'),
        api.get<LibraryBook[]>('/library/books'),
        api.get<Location[]>('/locations'),
      ]);

      if (cRes) setCopies(cRes);
      if (bRes) setBooks(bRes);
      if (lRes) setLocations(lRes);
    } catch (err: any) {
      console.error('Failed to load library copies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const locationOptions = getLocationSelectOptions(locations, {
    includeAll: true,
    allLabel: 'All Branches / Campuses',
  });

  const locationModalOptions = getLocationSelectOptions(locations, {
    includeAll: false,
  });

  const handleOpenAddModal = () => {
    setEditingCopyId(null);
    setBookId(books.length > 0 ? books[0].id : '');
    setLocationId(locations.length > 0 ? locations[0].id : '');
    setCopyCode('');
    setAccessionNumber('');
    setBarcode('');
    setPurchasePrice('0');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setRoom('Main Library');
    setRack('R1');
    setShelf('S1');
    setCondition('GOOD');
    setStatus('AVAILABLE');
    setBatchCount(1);
    setRemarks('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (copy: LibraryBookCopy) => {
    setEditingCopyId(copy.id);
    setBookId(copy.book_id);
    setLocationId(copy.location_id);
    setCopyCode(copy.copy_code);
    setAccessionNumber(copy.accession_number || '');
    setBarcode(copy.barcode || '');
    setPurchasePrice(String(copy.purchase_price || 0));
    setPurchaseDate(copy.purchase_date || new Date().toISOString().split('T')[0]);
    setRoom(copy.room || '');
    setRack(copy.rack || '');
    setShelf(copy.shelf || '');
    setCondition(copy.condition);
    setStatus(copy.status);
    setBatchCount(1);
    setRemarks(copy.remarks || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!bookId) {
      setFormError('Please select a book title.');
      return;
    }
    if (!locationId) {
      setFormError('Please select a campus location.');
      return;
    }

    setSaving(true);
    try {
      if (editingCopyId) {
        await api.put(`/library/copies/${editingCopyId}`, {
          location_id: locationId,
          copy_code: copyCode.trim() || undefined,
          accession_number: accessionNumber.trim() || undefined,
          barcode: barcode.trim() || undefined,
          purchase_price: parseFloat(purchasePrice) || 0,
          purchase_date: purchaseDate,
          room: room.trim() || undefined,
          rack: rack.trim() || undefined,
          shelf: shelf.trim() || undefined,
          condition,
          status,
          remarks: remarks.trim() || undefined,
        });
      } else {
        await api.post('/library/copies', {
          book_id: bookId,
          location_id: locationId,
          copy_code: copyCode.trim() || undefined,
          accession_number: accessionNumber.trim() || undefined,
          barcode: barcode.trim() || undefined,
          purchase_price: parseFloat(purchasePrice) || 0,
          purchase_date: purchaseDate,
          room: room.trim() || undefined,
          rack: rack.trim() || undefined,
          shelf: shelf.trim() || undefined,
          condition,
          status,
          count: batchCount,
          remarks: remarks.trim() || undefined,
        });
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || err.message || 'Failed to save copy.');
    } finally {
      setSaving(false);
    }
  };

  const filteredCopies = copies.filter((c) => {
    if (selectedStatus && c.status !== selectedStatus) return false;
    if (selectedLocation && c.location_id !== selectedLocation) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    const code = c.copy_code.toLowerCase();
    const bCode = (c.barcode || '').toLowerCase();
    const acc = (c.accession_number || '').toLowerCase();
    const title = (c.book?.title || '').toLowerCase();
    return code.includes(term) || bCode.includes(term) || acc.includes(term) || title.includes(term);
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Physical Book Copies</h1>
            <Badge variant="indigo">Holdings Ledger</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Track individual barcodes, accession numbers, spatial locations, and conditions of library copies
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenAddModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Copies
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Scan barcode or search copy code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:w-56">
            <Select
              options={locationOptions}
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'AVAILABLE', label: 'Available' },
                { value: 'ISSUED', label: 'Issued' },
                { value: 'RESERVED', label: 'Reserved' },
                { value: 'LOST', label: 'Lost' },
                { value: 'DAMAGED', label: 'Damaged' },
                { value: 'DISPOSED', label: 'Disposed' },
              ]}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Copies Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Copy Code & Barcode</th>
                <th className="py-3 px-4">Book Title</th>
                <th className="py-3 px-4">Branch Placement</th>
                <th className="py-3 px-4">Shelf / Rack</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading physical book copies...
                  </td>
                </tr>
              ) : filteredCopies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <Copy className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No book copies found matching filters.
                  </td>
                </tr>
              ) : (
                filteredCopies.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs">
                      <div className="font-bold text-blue-600">{c.copy_code}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <Barcode className="w-3 h-3" />
                        {c.barcode || 'No barcode'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{c.book?.title || 'Unknown Title'}</div>
                      <div className="text-xs text-gray-400">{c.book?.category?.name || 'Uncategorized'}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-800">
                      {formatLocationDisplay(c.location)}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-medium text-gray-800">{c.room || 'Library'}</span>
                      <div className="text-gray-400 text-[11px]">
                        Rack: {c.rack || '—'} • Shelf: {c.shelf || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span
                        className={`font-semibold ${
                          c.condition === 'NEW'
                            ? 'text-emerald-700'
                            : c.condition === 'GOOD'
                            ? 'text-blue-700'
                            : c.condition === 'FAIR'
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {c.condition}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          c.status === 'AVAILABLE'
                            ? 'success'
                            : c.status === 'ISSUED'
                            ? 'indigo'
                            : c.status === 'RESERVED'
                            ? 'purple'
                            : c.status === 'LOST' || c.status === 'DAMAGED'
                            ? 'danger'
                            : 'slate'
                        }
                      >
                        {c.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditModal(c)}
                        title="Edit Copy Details"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-600 mr-1" />
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

      {/* Add / Edit Copy Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCopyId ? 'Edit Physical Book Copy' : 'Add Physical Book Copies'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{formError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Select Book Title *</label>
            <Select
              options={books.map((b) => ({ value: b.id, label: `${b.title} (${b.isbn || 'No ISBN'})` }))}
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              disabled={!!editingCopyId}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Campus / Branch Location *</label>
            <Select
              options={locationModalOptions}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              required
            />
          </div>

          {!editingCopyId && (
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                Number of Copies to Create (Batch)
              </label>
              <Input
                type="number"
                min="1"
                max="50"
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value, 10) || 1)}
                placeholder="1"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Sequential copy codes (e.g. LIB-2026-XXXXXX) and barcodes will be automatically generated.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Room / Hall</label>
              <Input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. Central Library"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Rack</label>
              <Input
                value={rack}
                onChange={(e) => setRack(e.target.value)}
                placeholder="e.g. M1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Shelf</label>
              <Input
                value={shelf}
                onChange={(e) => setShelf(e.target.value)}
                placeholder="e.g. S2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Condition</label>
              <Select
                options={[
                  { value: 'NEW', label: 'New / Pristine' },
                  { value: 'GOOD', label: 'Good' },
                  { value: 'FAIR', label: 'Fair' },
                  { value: 'DAMAGED', label: 'Damaged' },
                  { value: 'POOR', label: 'Poor' },
                ]}
                value={condition}
                onChange={(e) => setCondition(e.target.value as BookCopyCondition)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Status</label>
              <Select
                options={[
                  { value: 'AVAILABLE', label: 'Available' },
                  { value: 'ISSUED', label: 'Issued' },
                  { value: 'RESERVED', label: 'Reserved' },
                  { value: 'LOST', label: 'Lost' },
                  { value: 'DAMAGED', label: 'Damaged' },
                  { value: 'UNDER_REPAIR', label: 'Under Repair' },
                  { value: 'DISPOSED', label: 'Disposed' },
                ]}
                value={status}
                onChange={(e) => setStatus(e.target.value as BookCopyStatus)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Purchase Price ({symbol})</label>
              <Input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Purchase Date</label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Remarks / Accession Notes</label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. CBSE 2026 inspection reference copy"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingCopyId ? 'Update Copy' : `Create ${batchCount} Copy(s)`}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
