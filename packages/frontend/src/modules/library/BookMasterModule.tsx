// ========================================================================
// Book Master Module
// Bibliographic Master Records: Title, ISBN, Authors, Publisher,
// Classification, Subject, and Aggregated Physical Copies
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Layers,
  Building2,
  Calendar,
  DollarSign,
  Tag,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit2,
  X,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { useCurrency } from '../../utils/currency.js';
import {
  LibraryBook,
  LibraryCategory,
  LibraryAuthor,
  LibraryPublisher,
} from '../../types/index.js';

export const BookMasterModule: React.FC<{ tabId?: string }> = () => {
  const { openTab } = useWorkspace();
  const { symbol, format } = useCurrency();

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [authors, setAuthors] = useState<LibraryAuthor[]>([]);
  const [publishers, setPublishers] = useState<LibraryPublisher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Drawer / Details State
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [publisherId, setPublisherId] = useState<string>('');
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<string[]>([]);
  const [isbn, setIsbn] = useState<string>('');
  const [accessionRef, setAccessionRef] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [classLevel, setClassLevel] = useState<string>('All Classes');
  const [price, setPrice] = useState<string>('0');
  const [publicationYear, setPublicationYear] = useState<string>('2024');
  const [edition, setEdition] = useState<string>('1st Edition');
  const [language, setLanguage] = useState<string>('English');
  const [pages, setPages] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bRes, cRes, aRes, pRes] = await Promise.all([
        api.get<LibraryBook[]>('/library/books'),
        api.get<LibraryCategory[]>('/library/categories'),
        api.get<LibraryAuthor[]>('/library/authors'),
        api.get<LibraryPublisher[]>('/library/publishers'),
      ]);

      if (bRes) setBooks(bRes);
      if (cRes) setCategories(cRes);
      if (aRes) setAuthors(aRes);
      if (pRes) setPublishers(pRes);
    } catch (err: any) {
      console.error('Failed to load library catalog data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingBookId(null);
    setTitle('');
    setSubtitle('');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setPublisherId(publishers.length > 0 ? publishers[0].id : '');
    setSelectedAuthorIds(authors.length > 0 ? [authors[0].id] : []);
    setIsbn('');
    setAccessionRef('');
    setSubject('');
    setClassLevel('All Classes');
    setPrice('0');
    setPublicationYear(String(new Date().getFullYear()));
    setEdition('1st Edition');
    setLanguage('English');
    setPages('');
    setDescription('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (book: LibraryBook) => {
    setEditingBookId(book.id);
    setTitle(book.title);
    setSubtitle(book.subtitle || '');
    setCategoryId(book.category_id);
    setPublisherId(book.publisher_id || '');
    setSelectedAuthorIds((book.authors || []).map((a) => a.id));
    setIsbn(book.isbn || '');
    setAccessionRef(book.accession_reference || '');
    setSubject(book.subject || '');
    setClassLevel(book.class_level || 'All Classes');
    setPrice(String(book.price || 0));
    setPublicationYear(book.publication_year ? String(book.publication_year) : '');
    setEdition(book.edition || '');
    setLanguage(book.language || 'English');
    setPages(book.pages ? String(book.pages) : '');
    setDescription(book.description || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleAuthorToggle = (authorId: string) => {
    setSelectedAuthorIds((prev) =>
      prev.includes(authorId) ? prev.filter((id) => id !== authorId) : [...prev, authorId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Book title is required.');
      return;
    }
    if (!categoryId) {
      setFormError('Category selection is mandatory.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        category_id: categoryId,
        publisher_id: publisherId || undefined,
        author_ids: selectedAuthorIds,
        isbn: isbn.trim() || undefined,
        accession_reference: accessionRef.trim() || undefined,
        subject: subject.trim() || undefined,
        class_level: classLevel.trim() || undefined,
        price: parseFloat(price) || 0,
        publication_year: parseInt(publicationYear, 10) || undefined,
        edition: edition.trim() || undefined,
        language: language.trim() || 'English',
        pages: parseInt(pages, 10) || undefined,
        description: description.trim() || undefined,
      };

      if (editingBookId) {
        await api.put(`/library/books/${editingBookId}`, payload);
      } else {
        await api.post('/library/books', payload);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || err.message || 'Failed to save book.');
    } finally {
      setSaving(false);
    }
  };

  const filteredBooks = books.filter((b) => {
    if (selectedCategory && b.category_id !== selectedCategory) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    const t = b.title.toLowerCase();
    const isbnCode = (b.isbn || '').toLowerCase();
    const acc = (b.accession_reference || '').toLowerCase();
    const auths = (b.authors || []).map((a) => a.name.toLowerCase()).join(' ');
    return t.includes(term) || isbnCode.includes(term) || acc.includes(term) || auths.includes(term);
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Book Master Register</h1>
            <Badge variant="indigo">Bibliographic Master</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Authoritative definition of library titles, editions, authors, and classification metadata
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="primary" onClick={handleOpenCreateModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add New Book
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, author, or ISBN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="w-full sm:w-64">
          <Select
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          />
        </div>
      </Card>

      {/* Books Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-xs uppercase font-semibold text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-3 px-4">Book Details</th>
                <th className="py-3 px-4">Authors</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Publisher / Year</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Holdings / Copies</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading catalog titles...
                  </td>
                </tr>
              ) : filteredBooks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <BookOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    No books found matching the current search criteria.
                  </td>
                </tr>
              ) : (
                filteredBooks.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{b.title}</div>
                      {b.subtitle && <div className="text-xs text-gray-500">{b.subtitle}</div>}
                      <div className="flex items-center gap-2 mt-0.5">
                        {b.isbn && (
                          <span className="text-[11px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            ISBN: {b.isbn}
                          </span>
                        )}
                        {b.class_level && (
                          <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {b.class_level}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {(b.authors || []).length > 0 ? (
                        b.authors!.map((a) => a.name).join(', ')
                      ) : (
                        <span className="text-gray-400 italic">No author assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-800">
                      {b.category?.name || 'Uncategorized'}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-gray-800">{b.publisher?.name || 'Standard'}</div>
                      <div className="text-gray-400 text-[11px]">{b.publication_year || '—'}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900 text-xs">
                      {format(b.price || 0)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            (b.available_copies_count ?? 0) > 0 ? 'success' : 'slate'
                          }
                        >
                          {b.available_copies_count ?? 0} / {b.total_copies_count ?? 0} Available
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBook(b)}
                          title="View Copies & Details"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(b)}
                          title="Edit Book Master"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-600" />
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

      {/* Book Detail & Physical Copies Drawer */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <Badge variant="indigo" className="mb-1">
                  {selectedBook.category?.name || 'Book'}
                </Badge>
                <h2 className="text-xl font-bold text-gray-900">{selectedBook.title}</h2>
                {selectedBook.subtitle && (
                  <p className="text-xs text-gray-500 mt-0.5">{selectedBook.subtitle}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedBook(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Bibliographic Specs */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-400 block mb-0.5">Authors:</span>
                  <span className="font-semibold text-gray-800">
                    {(selectedBook.authors || []).map((a) => a.name).join(', ') || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Publisher:</span>
                  <span className="font-semibold text-gray-800">
                    {selectedBook.publisher?.name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">ISBN:</span>
                  <span className="font-mono text-gray-800">{selectedBook.isbn || 'No ISBN'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Standard Price:</span>
                  <span className="font-semibold text-gray-900">{format(selectedBook.price)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Language / Edition:</span>
                  <span className="text-gray-800">
                    {selectedBook.language} • {selectedBook.edition || '1st'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Pages / Subject:</span>
                  <span className="text-gray-800">
                    {selectedBook.pages ? `${selectedBook.pages} pp.` : '—'} • {selectedBook.subject || 'General'}
                  </span>
                </div>
              </div>

              {/* Physical Holdings (Copies) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Copy className="w-4 h-4 text-blue-600" />
                    Physical Copies ({selectedBook.copies?.length || 0})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedBook(null);
                      openTab('library_copies', 'Book Copies', 'Copy');
                    }}
                  >
                    Manage Copies
                  </Button>
                </div>

                <div className="space-y-2">
                  {(selectedBook.copies || []).length === 0 ? (
                    <div className="p-4 bg-gray-50 text-center rounded-lg text-xs text-gray-400">
                      No physical copies registered for this title yet.
                    </div>
                  ) : (
                    (selectedBook.copies || []).map((copy) => (
                      <div
                        key={copy.id}
                        className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-blue-600">{copy.copy_code}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Barcode: {copy.barcode || '—'} • Rack: {copy.rack || '—'} / Shelf: {copy.shelf || '—'}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              copy.status === 'AVAILABLE'
                                ? 'success'
                                : copy.status === 'ISSUED'
                                ? 'indigo'
                                : copy.status === 'RESERVED'
                                ? 'purple'
                                : 'slate'
                            }
                          >
                            {copy.status}
                          </Badge>
                          <div className="text-[10px] text-gray-400 mt-0.5">Cond: {copy.condition}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end">
              <Button variant="outline" onClick={() => setSelectedBook(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Book Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBookId ? 'Edit Book Master Record' : 'Register New Book Title'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{formError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Book Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mathematics for Class 10"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Subtitle / Series</label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. CBSE Textbook with Practice Papers"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Category *</label>
              <Select
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Publisher</label>
              <Select
                options={[
                  { value: '', label: 'Select Publisher' },
                  ...publishers.map((p) => ({ value: p.id, label: p.name })),
                ]}
                value={publisherId}
                onChange={(e) => setPublisherId(e.target.value)}
              />
            </div>
          </div>

          {/* Multiple Authors Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
              Select Authors ({selectedAuthorIds.length} selected)
            </label>
            <div className="max-h-28 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 text-xs">
              {authors.map((auth) => (
                <label key={auth.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedAuthorIds.includes(auth.id)}
                    onChange={() => handleAuthorToggle(auth.id)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{auth.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">ISBN (Optional)</label>
              <Input
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="e.g. 978-8174507006"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Accession Reference</label>
              <Input
                value={accessionRef}
                onChange={(e) => setAccessionRef(e.target.value)}
                placeholder="e.g. REF-MTH-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Price ({symbol})</label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Class Level</label>
              <Input
                value={classLevel}
                onChange={(e) => setClassLevel(e.target.value)}
                placeholder="e.g. Class 10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Language</label>
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g. English"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Brief Description / Synopsis</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Standard secondary board curriculum"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingBookId ? 'Save Changes' : 'Create Book'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
