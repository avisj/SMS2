// ========================================================================
// FeeReceiptsModule
// Searchable Receipts Ledger & Printable Payment Vouchers
// ========================================================================

import React, { useEffect, useState } from 'react';
import { Receipt, Search, Calendar, Printer, Eye, RefreshCw, FileText, Download } from 'lucide-react';
import { api } from '../../api/client.js';
import { FeeReceipt } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { useCurrency } from '../../utils/currency.js';

interface FeeReceiptsModuleProps {
  tabId?: string;
}

export const FeeReceiptsModule: React.FC<FeeReceiptsModuleProps> = () => {
  const { symbol, format } = useCurrency();
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Selected receipt for voucher viewing
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceipt | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const data = await api.get<FeeReceipt[]>('/fees/receipts', {
        search: searchQuery || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setReceipts(data || []);
    } catch (err) {
      console.error('[FeeReceiptsModule] Error loading receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [searchQuery, startDate, endDate]);

  const handleOpenVoucher = (r: FeeReceipt) => {
    setSelectedReceipt(r);
    setIsModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" />
            Fee Receipts & Vouchers Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative transactional receipts archive. View, print, and audit past payment vouchers.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={loadReceipts} className="flex items-center gap-1.5 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Ledger
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by receipt # or student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>From:</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="py-1 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>To:</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="py-1 text-xs"
          />
        </div>

        {(startDate || endDate || searchQuery) && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setSearchQuery('');
            }}
            className="text-xs"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Receipts Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Receipt #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Adm #</th>
                <th className="px-4 py-3">Class & Sec</th>
                <th className="px-4 py-3">Payment Mode</th>
                <th className="px-4 py-3 text-right">Amount ({symbol})</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && receipts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Loading receipts archive...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No payment receipts found matching the filters.
                  </td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{r.receipt_number}</td>
                    <td className="px-4 py-3 text-slate-600">{r.receipt_date}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {r.student?.full_name || r.student?.first_name || 'Student'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {r.admission_number || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.class_name ? `${r.class_name} (${r.section_name || 'A'})` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {r.payment?.payment_mode || 'Cash'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {format(r.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={r.status === 'ACTIVE' ? 'success' : 'default'} size="sm">
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenVoucher(r)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Voucher
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Voucher Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Payment Voucher Details"
      >
        {selectedReceipt && (
          <div className="space-y-5 text-xs">
            {/* Printable Box */}
            <div className="p-6 border border-slate-300 rounded-xl bg-white space-y-4 shadow-xs">
              <div className="text-center border-b pb-4 border-slate-200">
                <h2 className="text-base font-bold text-slate-900 uppercase">
                  {selectedReceipt.school?.name || 'School Management System'}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Official Student Fee Payment Receipt
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400">Receipt Voucher #:</span>
                  <p className="font-mono font-bold text-indigo-700 text-sm">
                    {selectedReceipt.receipt_number}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Date of Payment:</span>
                  <p className="font-semibold text-slate-900">{selectedReceipt.receipt_date}</p>
                </div>
                <div>
                  <span className="text-slate-400">Student Name:</span>
                  <p className="font-bold text-slate-900">
                    {selectedReceipt.student?.full_name || selectedReceipt.student?.first_name}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Admission / Roll No:</span>
                  <p className="font-mono font-semibold text-slate-900">
                    {selectedReceipt.admission_number || '—'}{' '}
                    {selectedReceipt.roll_number ? `(${selectedReceipt.roll_number})` : ''}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Class & Section:</span>
                  <p className="font-semibold text-slate-900">
                    {selectedReceipt.class_name || 'Class'} ({selectedReceipt.section_name || 'A'})
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Payment Tender:</span>
                  <p className="font-semibold text-slate-900">
                    {selectedReceipt.payment?.payment_mode || 'Cash'}{' '}
                    {selectedReceipt.payment?.transaction_reference ? (
                      <span className="font-mono text-[11px] text-slate-500">
                        [{selectedReceipt.payment.transaction_reference}]
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="font-bold text-slate-800 text-sm">Total Paid Amount:</span>
                <span className="text-emerald-700 font-bold text-lg">
                  {format(selectedReceipt.total_amount)}
                </span>
              </div>

              <div className="pt-8 flex justify-between text-[11px] text-slate-400 border-t border-slate-100">
                <div>
                  <div className="w-32 border-b border-slate-300 mb-1"></div>
                  <span>Cashier / Collector</span>
                </div>
                <div className="text-right">
                  <div className="w-32 border-b border-slate-300 mb-1 ml-auto"></div>
                  <span>Authorized Seal</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={handlePrint} className="flex items-center gap-1.5 text-xs">
                <Printer className="w-3.5 h-3.5" />
                Print Voucher
              </Button>
              <Button onClick={() => setIsModalOpen(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
