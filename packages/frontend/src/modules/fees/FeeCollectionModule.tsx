// ========================================================================
// FeeCollectionModule
// Real-Time Fee Collection POS, Line-Item Allocation & Instant Voucher Generation
// ========================================================================

import React, { useEffect, useState, useTransition } from 'react';
import {
  CreditCard,
  Search,
  UserCheck,
  CheckCircle,
  AlertCircle,
  Receipt,
  Printer,
  X,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import {
  StudentFeeDemand,
  FeePayment,
  FeeReceipt,
  PaymentMode,
  User,
  AcademicSession,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { useCurrency } from '../../utils/currency.js';

interface FeeCollectionModuleProps {
  tabId?: string;
}

interface StudentSearchResult {
  id: string;
  full_name: string;
  admission_number?: string;
  roll_number?: string;
  class_name?: string;
  section_name?: string;
  academic_session_id?: string;
  location_id?: string;
}

export const FeeCollectionModule: React.FC<FeeCollectionModuleProps> = () => {
  const { symbol, format } = useCurrency();
  const { activeBranch } = useAuth();
  const [, startTransition] = useTransition();

  // Search State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);

  // Student Demands
  const [studentDemands, setStudentDemands] = useState<StudentFeeDemand[]>([]);
  const [loadingDemands, setLoadingDemands] = useState<boolean>(false);

  // Payment Form State
  const [allocations, setAllocations] = useState<{ [demandId: string]: number }>({});
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Receipt Modal State
  const [completedReceipt, setCompletedReceipt] = useState<FeeReceipt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Handle student search
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        // Query enrollments or users
        const enrollments = await api.get<any[]>('/academics/student-enrollments', {
          search: searchTerm.trim(),
          locationId: activeBranch?.id || undefined,
          status: 'ENROLLED',
        });

        if (enrollments && enrollments.length > 0) {
          const mapped: StudentSearchResult[] = enrollments.map((enr) => ({
            id: enr.student_user_id,
            full_name: enr.student ? `${enr.student.first_name} ${enr.student.last_name || ''}`.trim() : (enr.student?.full_name || 'Student'),
            admission_number: enr.admission_number,
            roll_number: enr.roll_number,
            class_name: enr.class?.name,
            section_name: enr.section?.name,
            academic_session_id: enr.academic_session_id,
            location_id: enr.location_id,
          }));
          setSearchResults(mapped);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('[FeeCollectionModule] Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, activeBranch?.id]);

  // Load demands when student is selected
  const handleSelectStudent = async (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setSearchTerm('');
    setSearchResults([]);
    setAllocations({});
    setErrorMessage(null);

    try {
      setLoadingDemands(true);
      const demands = await api.get<StudentFeeDemand[]>('/fees/demands', {
        studentUserId: student.id,
      });

      // Filter to active unpaid or partially paid
      const activeUnpaid = (demands || []).filter(
        (d) => d.status === 'UNPAID' || d.status === 'PARTIALLY_PAID' || d.status === 'OVERDUE'
      );
      setStudentDemands(activeUnpaid);
    } catch (err) {
      console.error('[FeeCollectionModule] Error loading student demands:', err);
    } finally {
      setLoadingDemands(false);
    }
  };

  const handleAllocationChange = (demandId: string, amount: number) => {
    const next = { ...allocations };
    if (amount <= 0 || isNaN(amount)) {
      delete next[demandId];
    } else {
      next[demandId] = amount;
    }
    setAllocations(next);
  };

  const handlePayFull = (demand: StudentFeeDemand) => {
    const outstanding = Math.max(0, demand.net_amount - demand.paid_amount);
    handleAllocationChange(demand.id, outstanding);
  };

  const handlePayAllOutstanding = () => {
    const next: { [demandId: string]: number } = {};
    for (const d of studentDemands) {
      const outstanding = Math.max(0, d.net_amount - d.paid_amount);
      if (outstanding > 0) {
        next[d.id] = outstanding;
      }
    }
    setAllocations(next);
  };

  const totalPaymentAmount = Object.values(allocations).reduce((acc, val) => acc + (val || 0), 0);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (totalPaymentAmount <= 0) {
      setErrorMessage('Please allocate an amount to at least one fee invoice.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const allocationPayload = Object.entries(allocations).map(([demand_id, amount]) => ({
        demand_id,
        amount: Math.round(amount * 100) / 100,
      }));

      const res = await api.post<{ payment: FeePayment; receipt: FeeReceipt }>('/fees/payments', {
        student_user_id: selectedStudent.id,
        academic_session_id: selectedStudent.academic_session_id || studentDemands[0]?.academic_session_id,
        location_id: selectedStudent.location_id || activeBranch?.id,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        transaction_reference: transactionRef || undefined,
        remarks: remarks || undefined,
        allocations: allocationPayload,
      });

      setCompletedReceipt(res.receipt);
      setIsReceiptModalOpen(true);

      // Refresh student's demands
      handleSelectStudent(selectedStudent);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment collection failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-600" />
            Fee Collection Point of Sale
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Accept student fee payments, allocate funds against line items, and generate instant vouchers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Student Search & Account Details */}
        <div className="space-y-6">
          <Card className="p-4 space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Search Enrolled Student
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name or adm #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
              />
              {searching && (
                <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-3 animate-spin text-slate-400" />
              )}
            </div>

            {/* Live Autocomplete Results */}
            {searchResults.length > 0 && (
              <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white shadow-lg">
                {searchResults.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => handleSelectStudent(st)}
                    className="p-2.5 hover:bg-indigo-50 cursor-pointer text-xs transition-colors"
                  >
                    <p className="font-bold text-slate-900">{st.full_name}</p>
                    <p className="text-[11px] text-slate-500">
                      Class: {st.class_name} ({st.section_name}) | Adm: {st.admission_number || '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Selected Student Card */}
          {selectedStudent ? (
            <Card className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 text-white space-y-3 rounded-xl">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                    Selected Student
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">{selectedStudent.full_name}</h3>
                </div>
                <div className="p-2 bg-indigo-800/60 rounded-lg text-indigo-200">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-indigo-800/60">
                <div>
                  <span className="text-slate-400">Class & Section:</span>
                  <p className="font-semibold text-white">
                    {selectedStudent.class_name} - {selectedStudent.section_name}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Admission No:</span>
                  <p className="font-semibold font-mono text-white">{selectedStudent.admission_number || '—'}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-indigo-800/60 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-[11px]">Active Invoices:</span>
                  <p className="font-bold text-lg text-amber-400">{studentDemands.length} Pending</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-xs text-indigo-300 hover:text-white underline"
                >
                  Clear Selection
                </button>
              </div>
            </Card>
          ) : (
            <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
              Search and select an active enrolled student above to begin payment collection.
            </div>
          )}
        </div>

        {/* Right Column: Pending Invoices & Collection POS */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  2. Select Fee Invoices to Settle
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allocate exact payment amount per line item (overpayments strictly protected)
                </p>
              </div>

              {studentDemands.length > 0 && (
                <Button variant="secondary" size="sm" onClick={handlePayAllOutstanding} className="text-xs">
                  Pay All Outstanding
                </Button>
              )}
            </div>

            {loadingDemands ? (
              <p className="text-xs text-slate-400 py-8 text-center">Loading pending fee demands...</p>
            ) : !selectedStudent ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                Select a student on the left to view active fee dues.
              </p>
            ) : studentDemands.length === 0 ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                <p className="font-bold text-sm">All Clear! No Pending Dues.</p>
                <p className="text-emerald-700 mt-1">This student has cleared all issued fee invoices.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
                      <tr>
                        <th className="px-3 py-2.5">Invoice #</th>
                        <th className="px-3 py-2.5">Head & Period</th>
                        <th className="px-3 py-2.5 text-right">Net Amount</th>
                        <th className="px-3 py-2.5 text-right">Paid</th>
                        <th className="px-3 py-2.5 text-right">Due</th>
                        <th className="px-3 py-2.5 text-right w-36">Pay Amount ({symbol})</th>
                        <th className="px-3 py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentDemands.map((d) => {
                        const due = Math.max(0, d.net_amount - d.paid_amount);
                        const allocated = allocations[d.id] || 0;
                        return (
                          <tr key={d.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-mono font-bold text-indigo-600">
                              {d.demand_number}
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="font-semibold text-slate-900">{d.fee_head?.name || 'Fee'}</p>
                              <p className="text-[10px] text-slate-500">{d.billing_period}</p>
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-700 font-medium">
                              {format(d.net_amount)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-emerald-700">
                              {format(d.paid_amount)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-amber-700">
                              {format(due)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                min="0"
                                max={due}
                                step="0.01"
                                placeholder="0.00"
                                value={allocated || ''}
                                onChange={(e) => handleAllocationChange(d.id, Number(e.target.value))}
                                className={`w-full px-2.5 py-1 text-right text-xs font-bold rounded border ${
                                  allocated > due
                                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                                    : allocated > 0
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                                    : 'border-slate-200 text-slate-900'
                                }`}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handlePayFull(d)}
                                className="text-[11px] text-indigo-600 font-semibold hover:underline"
                              >
                                Full
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Settlement Form */}
                <form onSubmit={handleSubmitPayment} className="pt-4 border-t border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode *</label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 font-medium"
                      >
                        <option value="UPI">UPI / QR Code</option>
                        <option value="CASH">Cash</option>
                        <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                        <option value="CARD">Debit / Credit Card</option>
                        <option value="CHEQUE">Cheque / Demand Draft</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Transaction Ref / Cheque #
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. UPI-998811 or CHQ-0012"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks (Optional)</label>
                    <Input
                      type="text"
                      placeholder="e.g. Paid by father via Google Pay"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>

                  {errorMessage && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Summary Bar & Button */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-900 text-white rounded-xl">
                    <div>
                      <span className="text-xs text-slate-400">Total Tendered Amount:</span>
                      <p className="text-2xl font-bold text-emerald-400 mt-0.5">
                        {format(totalPaymentAmount)}
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting || totalPaymentAmount <= 0}
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 text-xs flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {submitting ? 'Processing Payment...' : 'Collect Fee & Generate Receipt'}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Success Voucher Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Fee Payment Voucher Generated"
      >
        {completedReceipt && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Payment Successful!</p>
                <p className="text-xs text-emerald-700">
                  Voucher #{completedReceipt.receipt_number} has been recorded permanently.
                </p>
              </div>
            </div>

            {/* Printable Voucher Box */}
            <div className="p-5 border border-slate-300 rounded-xl bg-white space-y-4 print:border-none">
              <div className="text-center border-b pb-3 border-slate-200">
                <h3 className="text-base font-bold text-slate-900 uppercase">
                  {completedReceipt.school?.name || 'School Management System'}
                </h3>
                <p className="text-[11px] text-slate-500">Official Fee Receipt Voucher</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400">Receipt No:</span>
                  <p className="font-bold font-mono text-slate-900">{completedReceipt.receipt_number}</p>
                </div>
                <div>
                  <span className="text-slate-400">Date:</span>
                  <p className="font-bold text-slate-900">{completedReceipt.receipt_date}</p>
                </div>
                <div>
                  <span className="text-slate-400">Student:</span>
                  <p className="font-bold text-slate-900">
                    {completedReceipt.student?.full_name || completedReceipt.student?.first_name}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Admission No:</span>
                  <p className="font-bold font-mono text-slate-900">
                    {completedReceipt.admission_number || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Class & Section:</span>
                  <p className="font-bold text-slate-900">
                    {completedReceipt.class_name || 'Class'} ({completedReceipt.section_name || 'A'})
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Payment Mode:</span>
                  <p className="font-bold text-slate-900">
                    {completedReceipt.payment?.payment_mode || 'Cash'}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-sm font-bold">
                <span>Total Amount Received:</span>
                <span className="text-emerald-700 text-base">
                  {format(completedReceipt.total_amount)}
                </span>
              </div>

              <div className="pt-6 flex justify-between text-[10px] text-slate-400 border-t border-slate-100">
                <span>Authorized Signatory</span>
                <span>System Generated Receipt</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Voucher
              </Button>
              <Button onClick={() => setIsReceiptModalOpen(false)} className="text-xs">
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
