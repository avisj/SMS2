// ========================================================================
// Library Lost / Damaged / Disposed Module
// Incident Logging, De-accessioning, Scrapping, and Cost Recovery
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  FileWarning,
  DollarSign,
  User,
  Barcode,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { Modal } from '../../components/common/Modal.js';
import { api } from '../../api/client.js';
import { useCurrency } from '../../utils/currency.js';
import {
  LibraryLostDamaged,
  LibraryBookCopy,
  LibraryMember,
} from '../../types/index.js';

export const LibraryLostDamagedModule: React.FC<{ tabId?: string }> = () => {
  const { symbol, format } = useCurrency();

  const [records, setRecords] = useState<LibraryLostDamaged[]>([]);
  const [copies, setCopies] = useState<LibraryBookCopy[]>([]);
  const [members, setMembers] = useState<LibraryMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal states: 'LOST' | 'DAMAGED' | 'DISPOSE' | null
  const [activeModal, setActiveModal] = useState<'LOST' | 'DAMAGED' | 'DISPOSE' | null>(null);
  const [selectedCopyId, setSelectedCopyId] = useState<string>('');
  const [responsibleMemberId, setResponsibleMemberId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [cost, setCost] = useState<number>(0);
  const [chargeFine, setChargeFine] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resRec, resCopies, resMembers] = await Promise.all([
        api.get<LibraryLostDamaged[]>('/library/lost-damaged'),
        api.get<LibraryBookCopy[]>('/library/copies'),
        api.get<LibraryMember[]>('/library/members'),
      ]);

      if (resRec) setRecords(resRec);
      if (resCopies) setCopies(resCopies);
      if (resMembers) setMembers(resMembers);
    } catch (err: any) {
      console.error('Error fetching lost/damaged records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (type: 'LOST' | 'DAMAGED' | 'DISPOSE') => {
    setActiveModal(type);
    setSelectedCopyId('');
    setResponsibleMemberId('');
    setDescription('');
    setCost(0);
    setChargeFine(true);
    setError(null);
  };

  const handleCopyChange = (copyId: string) => {
    setSelectedCopyId(copyId);
    const copy = copies.find((c) => c.id === copyId);
    if (copy && copy.book?.price) {
      setCost(copy.book.price);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCopyId) {
      setError('Please select a book copy.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a description or reason.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (activeModal === 'LOST') {
        await api.post('/library/lost-damaged/lost', {
          book_copy_id: selectedCopyId,
          responsible_member_id: responsibleMemberId || undefined,
          description: description.trim(),
          replacement_cost: Number(cost) || 0,
          charge_fine: chargeFine,
        });
      } else if (activeModal === 'DAMAGED') {
        await api.post('/library/lost-damaged/damaged', {
          book_copy_id: selectedCopyId,
          responsible_member_id: responsibleMemberId || undefined,
          description: description.trim(),
          repair_cost: Number(cost) || 0,
          charge_fine: chargeFine,
        });
      } else if (activeModal === 'DISPOSE') {
        await api.post('/library/lost-damaged/dispose', {
          book_copy_id: selectedCopyId,
          reason: description.trim(),
        });
      }

      setActiveModal(null);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  // KPIs
  const lostCount = records.filter((r) => r.record_type === 'LOST').length;
  const damagedCount = records.filter((r) => r.record_type === 'DAMAGED').length;
  const disposedCount = records.filter((r) => r.record_type === 'DISPOSED').length;
  const totalCostAssessed = records.reduce((sum, r) => sum + (r.cost_charged || 0), 0);

  // Filtered
  const filtered = records.filter((r) => {
    if (typeFilter !== 'ALL' && r.record_type !== typeFilter) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const title = r.book_copy?.book?.title?.toLowerCase() || '';
    const acc = r.book_copy?.accession_number?.toLowerCase() || '';
    const barcode = r.book_copy?.barcode?.toLowerCase() || '';
    const desc = r.description?.toLowerCase() || '';
    return title.includes(term) || acc.includes(term) || barcode.includes(term) || desc.includes(term);
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'LOST':
        return <Badge variant="rose">Reported Lost</Badge>;
      case 'DAMAGED':
        return <Badge variant="amber">Damaged</Badge>;
      case 'DISPOSED':
        return <Badge variant="slate">De-accessioned / Scrapped</Badge>;
      default:
        return <Badge variant="slate">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Lost, Damaged & Weeded Books
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track de-accessioning, patron damage assessments, loss billing, and obsolete book disposals
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            className="text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={() => openModal('DAMAGED')}
          >
            <FileWarning className="w-4 h-4 mr-1.5" />
            Report Damaged
          </Button>
          <Button
            variant="outline"
            className="text-rose-600 border-rose-300 hover:bg-rose-50"
            onClick={() => openModal('LOST')}
          >
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Report Lost
          </Button>
          <Button
            variant="primary"
            onClick={() => openModal('DISPOSE')}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Weed / Dispose Copy
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Reported Lost</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{lostCount}</h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Damaged Items</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{damagedCount}</h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-lg">
              <FileWarning className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Weeded / Scrapped</p>
              <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1">{disposedCount}</h3>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg">
              <Trash2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-medium text-slate-500">Total Billed / Assessed</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {format(totalCostAssessed)}
              </h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Search by title, barcode, accession number, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-56 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Record Types' },
                { value: 'LOST', label: 'Lost Only' },
                { value: 'DAMAGED', label: 'Damaged Only' },
                { value: 'DISPOSED', label: 'Disposed Only' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                <th className="py-3 px-4">Book & Copy</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Incident Date</th>
                <th className="py-3 px-4">Responsible Borrower</th>
                <th className="py-3 px-4">Description / Findings</th>
                <th className="py-3 px-4 text-right">Cost Charged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No lost or damaged records found.
                  </td>
                </tr>
              ) : (
                filtered.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                        {record.book_copy?.book?.title || 'Book Title'}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Acc: {record.book_copy?.accession_number || 'N/A'}</span>
                        <span>•</span>
                        <span>Barcode: {record.book_copy?.barcode || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getTypeBadge(record.record_type)}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {new Date(record.record_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {record.responsible_member ? (
                        <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {record.responsible_member.first_name} {record.responsible_member.last_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">None / General</span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-700 dark:text-slate-300">
                      {record.description}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-white">
                      {record.cost_charged && record.cost_charged > 0
                        ? format(record.cost_charged)
                        : '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Action Modal (Lost / Damaged / Dispose) */}
      <Modal
        isOpen={!!activeModal}
        onClose={() => {
          setActiveModal(null);
          setError(null);
        }}
        title={
          activeModal === 'LOST'
            ? 'Report Book Copy as Lost'
            : activeModal === 'DAMAGED'
            ? 'Report Book Copy Damage'
            : 'De-accession / Dispose Copy'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Book Copy <span className="text-rose-500">*</span>
            </label>
            <Select
              value={selectedCopyId}
              onChange={(e) => handleCopyChange(e.target.value)}
              options={[
                { value: '', label: '-- Select Copy (Accession # / Title) --' },
                ...copies
                  .filter((c) => activeModal === 'DISPOSE' || c.status !== 'LOST')
                  .map((c) => ({
                    value: c.id,
                    label: `${c.accession_number} — ${c.book?.title} [Status: ${c.status}, Cond: ${c.condition}]`,
                  })),
              ]}
              required
            />
          </div>

          {activeModal !== 'DISPOSE' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Responsible Borrower (Optional)
              </label>
              <Select
                value={responsibleMemberId}
                onChange={(e) => setResponsibleMemberId(e.target.value)}
                options={[
                  { value: '', label: '-- None (Institutional / Unattributed) --' },
                  ...members.map((m) => ({
                    value: m.user_id,
                    label: `${m.user ? `${m.user.first_name} ${m.user.last_name}` : m.membership_number} (${m.membership_type})`,
                  })),
                ]}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {activeModal === 'DISPOSE' ? 'Disposal / Weeding Reason' : 'Incident Details / Damage Notes'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder={
                activeModal === 'LOST'
                  ? 'e.g. Left in laboratory or mislaid during transit'
                  : activeModal === 'DAMAGED'
                  ? 'e.g. Torn cover, spine detachment, water damage to pages 50-80'
                  : 'e.g. Outdated syllabus edition, pages disintegrating beyond rebinding'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {activeModal !== 'DISPOSE' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {activeModal === 'LOST' ? 'Replacement Cost' : 'Repair / Rebinding Cost'} ({symbol})
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                />
              </div>

              {responsibleMemberId && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="chargeFine"
                    checked={chargeFine}
                    onChange={(e) => setChargeFine(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                  />
                  <label htmlFor="chargeFine" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Automatically create pending fine entry in Borrower's account
                  </label>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveModal(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              className={
                activeModal === 'LOST'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : activeModal === 'DAMAGED'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : undefined
              }
            >
              {saving ? 'Processing...' : 'Submit Record'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
