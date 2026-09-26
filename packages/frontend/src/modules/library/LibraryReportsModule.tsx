// ========================================================================
// Library Reports & Audit Module
// Comprehensive Compliance Registers, Physical Holdings Audit, Circulation
// History, Overdue Aging, and Fine Revenue Exports
// ========================================================================

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  RefreshCw,
  BookOpen,
  Copy,
  RotateCcw,
  IndianRupee,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Badge } from '../../components/common/Badge.js';
import { api } from '../../api/client.js';
import { useCurrency } from '../../utils/currency.js';
import { formatLocationDisplay } from '../../utils/locations.js';
import {
  LibraryBook,
  LibraryBookCopy,
  LibraryIssue,
  LibraryFine,
  LibraryLostDamaged,
  LibraryMember,
} from '../../types/index.js';

type ReportTab = 'BOOKS' | 'COPIES' | 'CIRCULATION' | 'OVERDUE' | 'FINES' | 'LOST_DAMAGED';

export const LibraryReportsModule: React.FC<{ tabId?: string }> = () => {
  const { symbol, format } = useCurrency();

  const [activeTab, setActiveTab] = useState<ReportTab>('BOOKS');
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [copies, setCopies] = useState<LibraryBookCopy[]>([]);
  const [issues, setIssues] = useState<LibraryIssue[]>([]);
  const [fines, setFines] = useState<LibraryFine[]>([]);
  const [lostDamaged, setLostDamaged] = useState<LibraryLostDamaged[]>([]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const [resBooks, resCopies, resIssues, resFines, resLost] = await Promise.all([
        api.get<LibraryBook[]>('/library/books'),
        api.get<LibraryBookCopy[]>('/library/copies'),
        api.get<LibraryIssue[]>('/library/issues'),
        api.get<LibraryFine[]>('/library/fines'),
        api.get<LibraryLostDamaged[]>('/library/lost-damaged'),
      ]);

      if (resBooks) setBooks(resBooks);
      if (resCopies) setCopies(resCopies);
      if (resIssues) setIssues(resIssues);
      if (resFines) setFines(resFines);
      if (resLost) setLostDamaged(resLost);
    } catch (err: any) {
      console.error('Error loading report datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // CSV Export utility
  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isIssueOverdue = (i: LibraryIssue) => {
    return i.status === 'OVERDUE' || (i.status === 'ISSUED' && new Date(i.due_date) < new Date());
  };

  const handleExport = () => {
    if (activeTab === 'BOOKS') {
      const headers = ['Title', 'ISBN', 'Category', 'Publisher', 'Edition', 'Total Copies', 'Available Copies', 'Price'];
      const rows = books.map((b) => [
        b.title,
        b.isbn || '',
        b.category?.name || '',
        b.publisher?.name || '',
        b.edition || '',
        b.total_copies ?? b.total_copies_count ?? 0,
        b.available_copies ?? b.available_copies_count ?? 0,
        b.price ?? 0,
      ]);
      exportToCSV('Library_Book_Master_Report', headers, rows);
    } else if (activeTab === 'COPIES') {
      const headers = ['Accession No', 'Barcode', 'Title', 'ISBN', 'Location', 'Rack/Shelf', 'Status', 'Condition', 'Purchase Date'];
      const rows = copies.map((c) => [
        c.accession_number || '',
        c.barcode || '',
        c.book?.title || '',
        c.book?.isbn || '',
        formatLocationDisplay(c.location) || '',
        c.shelf_location || c.shelf || c.rack || '',
        c.status,
        c.condition,
        c.purchase_date || '',
      ]);
      exportToCSV('Library_Physical_Holdings_Report', headers, rows);
    } else if (activeTab === 'CIRCULATION' || activeTab === 'OVERDUE') {
      const data = activeTab === 'OVERDUE' ? issues.filter(isIssueOverdue) : issues;
      const headers = ['Issue ID', 'Accession No', 'Book Title', 'Borrower Name', 'Borrower Email', 'Issue Date', 'Due Date', 'Return Date', 'Status', 'Overdue Days'];
      const rows = data.map((i) => [
        i.id,
        i.book_copy?.accession_number || '',
        i.book_copy?.book?.title || '',
        i.member_user ? `${i.member_user.first_name} ${i.member_user.last_name}` : '',
        i.member_user?.email || '',
        i.issue_date,
        i.due_date,
        i.return_date || 'Not Returned',
        i.status,
        i.overdue_days || 0,
      ]);
      exportToCSV(activeTab === 'OVERDUE' ? 'Library_Overdue_Report' : 'Library_Circulation_Report', headers, rows);
    } else if (activeTab === 'FINES') {
      const headers = ['Member Name', 'Member Email', 'Fine Date', 'Reason', 'Total Fine', 'Paid', 'Balance', 'Status', 'Payment Ref'];
      const rows = fines.map((f) => [
        f.member_user ? `${f.member_user.first_name} ${f.member_user.last_name}` : '',
        f.member_user?.email || '',
        f.fine_date,
        f.reason,
        f.amount,
        f.paid_amount,
        f.balance_amount,
        f.status,
        f.payment_reference || '',
      ]);
      exportToCSV('Library_Fines_Ledger_Report', headers, rows);
    } else if (activeTab === 'LOST_DAMAGED') {
      const headers = ['Accession No', 'Book Title', 'Record Type', 'Date', 'Description', 'Responsible Borrower', 'Cost Charged'];
      const rows = lostDamaged.map((r) => [
        r.book_copy?.accession_number || '',
        r.book_copy?.book?.title || '',
        r.record_type,
        r.record_date,
        r.description,
        r.responsible_member ? `${r.responsible_member.first_name} ${r.responsible_member.last_name}` : 'N/A',
        r.cost_charged || 0,
      ]);
      exportToCSV('Library_Lost_Damaged_Report', headers, rows);
    }
  };

  const overdueIssues = issues.filter(isIssueOverdue);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Library Reports & Audit Registers
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Accession registers, circulation audit trail, overdue aging reports, and fine financial reconciliation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchReportData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="primary" onClick={handleExport} disabled={loading}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('BOOKS')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'BOOKS'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Book Master Register ({books.length})
        </button>
        <button
          onClick={() => setActiveTab('COPIES')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'COPIES'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Copy className="w-4 h-4" />
          Accession & Holdings ({copies.length})
        </button>
        <button
          onClick={() => setActiveTab('CIRCULATION')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'CIRCULATION'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Circulation History ({issues.length})
        </button>
        <button
          onClick={() => setActiveTab('OVERDUE')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'OVERDUE'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Overdue Aging ({overdueIssues.length})
        </button>
        <button
          onClick={() => setActiveTab('FINES')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'FINES'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          Fine Ledger ({fines.length})
        </button>
        <button
          onClick={() => setActiveTab('LOST_DAMAGED')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'LOST_DAMAGED'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Lost & Damaged ({lostDamaged.length})
        </button>
      </div>

      {/* Filter / Search Bar */}
      <Card className="p-4 border border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder={`Filter ${activeTab.toLowerCase()} records...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {/* Report Table View */}
      <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'BOOKS' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  <th className="py-3 px-4">Title & ISBN</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Publisher & Year</th>
                  <th className="py-3 px-4 text-center">Copies (Avail/Total)</th>
                  <th className="py-3 px-4 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {books
                  .filter((b) => !search || b.title.toLowerCase().includes(search.toLowerCase()) || (b.isbn && b.isbn.includes(search)))
                  .map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{b.title}</div>
                        <div className="text-xs text-slate-500">ISBN: {b.isbn || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{b.category?.name || 'General'}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {b.publisher?.name || 'N/A'} {b.publication_year ? `(${b.publication_year})` : ''}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {b.available_copies ?? b.available_copies_count ?? 0}
                        </span>
                        <span className="text-slate-400"> / {b.total_copies ?? b.total_copies_count ?? 0}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-900 dark:text-white">
                        {b.price ? format(b.price) : '--'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'COPIES' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  <th className="py-3 px-4">Accession No & Barcode</th>
                  <th className="py-3 px-4">Book Title</th>
                  <th className="py-3 px-4">Shelf / Location</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {copies
                  .filter((c) => {
                    if (!search) return true;
                    const term = search.toLowerCase();
                    const acc = (c.accession_number || '').toLowerCase();
                    const bar = (c.barcode || '').toLowerCase();
                    const title = (c.book?.title || '').toLowerCase();
                    return acc.includes(term) || bar.includes(term) || title.includes(term);
                  })
                  .map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-white">{c.accession_number || c.copy_code}</span>
                        <div className="text-xs text-slate-500 font-mono">Barcode: {c.barcode || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{c.book?.title || 'Unknown Title'}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {c.shelf_location || c.shelf || c.rack || 'General Stacks'} {c.location ? `(${formatLocationDisplay(c.location)})` : ''}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={c.status === 'AVAILABLE' ? 'emerald' : c.status === 'ISSUED' ? 'indigo' : 'rose'}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="slate">{c.condition}</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {(activeTab === 'CIRCULATION' || activeTab === 'OVERDUE') && (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  <th className="py-3 px-4">Borrower</th>
                  <th className="py-3 px-4">Book Copy</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Return Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(activeTab === 'OVERDUE' ? overdueIssues : issues)
                  .filter((i) => !search || (i.member_user && `${i.member_user.first_name} ${i.member_user.last_name}`.toLowerCase().includes(search.toLowerCase())) || (i.book_copy?.book?.title && i.book_copy.book.title.toLowerCase().includes(search.toLowerCase())))
                  .map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {i.member_user ? `${i.member_user.first_name} ${i.member_user.last_name}` : 'Unknown'}
                        </div>
                        <div className="text-xs text-slate-500">{i.member_user?.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{i.book_copy?.book?.title}</div>
                        <div className="text-xs text-slate-500">Acc: {i.book_copy?.accession_number}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{new Date(i.issue_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{new Date(i.due_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {i.return_date ? new Date(i.return_date).toLocaleDateString() : <span className="text-amber-600">Pending Return</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={i.status === 'RETURNED' ? 'emerald' : i.status === 'OVERDUE' ? 'rose' : 'indigo'}>
                          {i.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'FINES' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  <th className="py-3 px-4">Borrower</th>
                  <th className="py-3 px-4">Date & Reason</th>
                  <th className="py-3 px-4 text-right">Assessed</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {fines
                  .filter((f) => !search || (f.member_user && `${f.member_user.first_name} ${f.member_user.last_name}`.toLowerCase().includes(search.toLowerCase())) || f.reason.toLowerCase().includes(search.toLowerCase()))
                  .map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {f.member_user ? `${f.member_user.first_name} ${f.member_user.last_name}` : 'Unknown'}
                        </div>
                        <div className="text-xs text-slate-500">{f.member_user?.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{f.reason}</div>
                        <div className="text-xs text-slate-500">{new Date(f.fine_date).toLocaleDateString()}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-white">{format(f.amount)}</td>
                      <td className="py-3 px-4 text-right text-emerald-600">{format(f.paid_amount)}</td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">{format(f.balance_amount)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={f.status === 'PAID' ? 'emerald' : f.status === 'WAIVED' ? 'slate' : 'rose'}>
                          {f.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'LOST_DAMAGED' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  <th className="py-3 px-4">Copy Details</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Incident Date</th>
                  <th className="py-3 px-4">Responsible Borrower</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Cost Charged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {lostDamaged
                  .filter((r) => !search || (r.book_copy?.book?.title && r.book_copy.book.title.toLowerCase().includes(search.toLowerCase())) || r.description.toLowerCase().includes(search.toLowerCase()))
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{r.book_copy?.book?.title}</div>
                        <div className="text-xs text-slate-500">Acc: {r.book_copy?.accession_number}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={r.record_type === 'LOST' ? 'rose' : r.record_type === 'DAMAGED' ? 'amber' : 'slate'}>
                          {r.record_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{new Date(r.record_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {r.responsible_member ? `${r.responsible_member.first_name} ${r.responsible_member.last_name}` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{r.description}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-white">
                        {r.cost_charged ? format(r.cost_charged) : '--'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};
