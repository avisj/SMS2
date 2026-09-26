// ========================================================================
// FeeOutstandingModule
// Outstanding Receivables, Aging Dues Roster & Student Ledger Drawer
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Search,
  Calendar,
  Layers,
  FileText,
  CreditCard,
  Eye,
  RefreshCw,
  Clock,
  CheckCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  StudentFeeDemand,
  StudentFeeLedgerItem,
  ClassItem,
  SectionItem,
  AcademicClassSection,
  AcademicSession,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { useCurrency } from '../../utils/currency.js';

interface FeeOutstandingModuleProps {
  tabId?: string;
}

interface StudentDuesSummary {
  student_user_id: string;
  student_name: string;
  admission_number?: string;
  roll_number?: string;
  class_name: string;
  section_name: string;
  academic_session_id: string;
  total_invoiced: number;
  total_paid: number;
  total_outstanding: number;
  overdue_amount: number;
  has_overdue: boolean;
  unpaid_demands_count: number;
}

export const FeeOutstandingModule: React.FC<FeeOutstandingModuleProps> = () => {
  const { symbol, format } = useCurrency();
  const { activeBranch } = useAuth();
  const { openTab } = useWorkspace();

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classSections, setClassSections] = useState<AcademicClassSection[]>([]);

  // Filter state
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Aggregated dues list
  const [duesList, setDuesList] = useState<StudentDuesSummary[]>([]);

  // Student Ledger Modal
  const [selectedStudentForLedger, setSelectedStudentForLedger] = useState<StudentDuesSummary | null>(null);
  const [ledgerItems, setLedgerItems] = useState<StudentFeeLedgerItem[]>([]);
  const [loadingLedger, setLoadingLedger] = useState<boolean>(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState<boolean>(false);

  // 1. Load Initial Sessions
  useEffect(() => {
    const loadMasters = async () => {
      try {
        const sessRes = await api.get<AcademicSession[]>('/academics/sessions');
        setSessions(sessRes || []);

        const activeSess = sessRes?.find((s) => s.status === 'ACTIVE') || sessRes?.[0];
        if (activeSess) setSelectedSessionId(activeSess.id);
      } catch (err) {
        console.error('[FeeOutstandingModule] Error loading masters:', err);
      }
    };
    loadMasters();
  }, []);

  // 2. Load Class-Sections for Selected Academic Session
  useEffect(() => {
    if (!selectedSessionId) return;

    const loadClassSections = async () => {
      try {
        const csRes = await api.get<AcademicClassSection[]>(
          `/academics/class-sections?sessionId=${selectedSessionId}`
        );
        const validCS = csRes || [];
        setClassSections(validCS);

        // Derive unique classes from class_sections setup
        const mappedClasses: ClassItem[] = Array.from(
          new Map(
            validCS
              .filter((cs) => cs.class && cs.class_id)
              .map((cs) => {
                const c = cs.class!;
                const displayName =
                  c.display_name ||
                  (c as any).display_label ||
                  (c.name.toLowerCase().startsWith('class') ? c.name : `Class ${c.name}`);
                return [cs.class_id, { ...c, display_name: displayName }];
              })
          ).values()
        ).sort(
          (a, b) =>
            (a.numeric_order ?? 99) - (b.numeric_order ?? 99) ||
            a.name.localeCompare(b.name)
        );

        setClasses(mappedClasses);

        if (selectedClassId && !mappedClasses.some((c) => c.id === selectedClassId)) {
          setSelectedClassId('');
          setSelectedSectionId('');
        }
      } catch (err) {
        console.error('[FeeOutstandingModule] Error loading class sections:', err);
      }
    };

    loadClassSections();
  }, [selectedSessionId]);

  // 3. Update Available Sections When Selected Class Changes
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      setSelectedSectionId('');
      return;
    }

    const classSectionsForSelectedClass = (classSections || []).filter(
      (cs) => cs.class_id === selectedClassId && cs.section
    );
    const derivedSections = classSectionsForSelectedClass.map((cs) => cs.section!);
    setSections(derivedSections);

    if (selectedSectionId && !derivedSections.some((s) => s.id === selectedSectionId)) {
      setSelectedSectionId('');
    }
  }, [selectedClassId, classSections]);

  // Load demands and aggregate student balances
  const loadDues = async () => {
    try {
      setLoading(true);
      const demands = await api.get<StudentFeeDemand[]>('/fees/demands', {
        academicSessionId: selectedSessionId || undefined,
        locationId: activeBranch?.id || undefined,
        classId: selectedClassId || undefined,
        sectionId: selectedSectionId || undefined,
      });

      const today = new Date().toISOString().split('T')[0];
      const studentMap = new Map<string, StudentDuesSummary>();

      for (const d of demands || []) {
        if (d.status === 'CANCELLED' || d.status === 'WAIVED') continue;

        const due = Math.max(0, d.net_amount - d.paid_amount);
        const isOverdue = d.status === 'OVERDUE' || (due > 0 && d.due_date < today);

        const existing = studentMap.get(d.student_user_id) || {
          student_user_id: d.student_user_id,
          student_name: d.student?.full_name || d.student?.first_name || 'Student',
          admission_number: d.admission_number,
          roll_number: d.roll_number,
          class_name: d.class?.name || 'Class',
          section_name: d.section?.name || 'A',
          academic_session_id: d.academic_session_id,
          total_invoiced: 0,
          total_paid: 0,
          total_outstanding: 0,
          overdue_amount: 0,
          has_overdue: false,
          unpaid_demands_count: 0,
        };

        existing.total_invoiced += d.net_amount;
        existing.total_paid += d.paid_amount;
        existing.total_outstanding += due;
        if (due > 0) {
          existing.unpaid_demands_count += 1;
        }
        if (isOverdue) {
          existing.overdue_amount += due;
          existing.has_overdue = true;
        }

        studentMap.set(d.student_user_id, existing);
      }

      // Filter only students with outstanding balance > 0
      let list = Array.from(studentMap.values()).filter((s) => s.total_outstanding > 0);

      if (onlyOverdue) {
        list = list.filter((s) => s.has_overdue);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        list = list.filter(
          (s) =>
            s.student_name.toLowerCase().includes(q) ||
            (s.admission_number && s.admission_number.toLowerCase().includes(q))
        );
      }

      list.sort((a, b) => b.total_outstanding - a.total_outstanding);
      setDuesList(list);
    } catch (err) {
      console.error('[FeeOutstandingModule] Error loading dues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      loadDues();
    }
  }, [selectedSessionId, selectedClassId, selectedSectionId, onlyOverdue, searchQuery, activeBranch?.id]);

  const handleOpenLedger = async (student: StudentDuesSummary) => {
    setSelectedStudentForLedger(student);
    setIsLedgerOpen(true);
    try {
      setLoadingLedger(true);
      const items = await api.get<StudentFeeLedgerItem[]>(`/fees/ledger/${student.student_user_id}`);
      setLedgerItems(items || []);
    } catch (err) {
      console.error('[FeeOutstandingModule] Error loading student ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  const totalOutstandingSum = duesList.reduce((acc, s) => acc + s.total_outstanding, 0);
  const totalOverdueSum = duesList.reduce((acc, s) => acc + s.overdue_amount, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-amber-600" />
            Outstanding Receivables & Defaulters
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time aging analysis, student fee ledgers, and accounts with pending dues.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={loadDues} className="flex items-center gap-1.5 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-amber-500">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Outstanding Receivables</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {format(totalOutstandingSum)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">{duesList.length} students with active dues</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-rose-500">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Overdue Amount</span>
          <p className="text-2xl font-bold text-rose-600 mt-1">
            {format(totalOverdueSum)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Past scheduled payment deadlines</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-indigo-500 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase">Quick Actions</span>
          <Button
            size="sm"
            onClick={() => openTab('fee_collection', 'Fee Collection', 'CreditCard')}
            className="w-full mt-2 text-xs flex items-center justify-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Open Collection Counter
          </Button>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or admission no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={selectedSessionId}
          onChange={(e) => setSelectedSessionId(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={selectedClassId}
          onChange={(e) => {
            setSelectedClassId(e.target.value);
            setSelectedSectionId('');
          }}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name || (c as any).display_label || c.name}
            </option>
          ))}
        </select>

        <select
          value={selectedSectionId}
          onChange={(e) => setSelectedSectionId(e.target.value)}
          disabled={!selectedClassId}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-50"
        >
          <option value="">All Sections</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              Section {s.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer ml-2">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOnlyOverdue(e.target.checked)}
            className="rounded text-rose-600 focus:ring-rose-500"
          />
          Only Overdue Defaulters
        </label>
      </div>

      {/* Dues Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Adm #</th>
                <th className="px-4 py-3">Class & Sec</th>
                <th className="px-4 py-3 text-right">Invoiced ({symbol})</th>
                <th className="px-4 py-3 text-right">Paid ({symbol})</th>
                <th className="px-4 py-3 text-right">Outstanding ({symbol})</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Calculating student dues balances...
                  </td>
                </tr>
              ) : duesList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-emerald-600 font-medium">
                    No outstanding dues found matching this filter criteria!
                  </td>
                </tr>
              ) : (
                duesList.map((st) => (
                  <tr key={st.student_user_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{st.student_name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {st.admission_number || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {st.class_name} ({st.section_name})
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {format(st.total_invoiced)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                      {format(st.total_paid)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700 text-sm">
                      {format(st.total_outstanding)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {st.has_overdue ? (
                        <Badge variant="danger" size="sm">
                          OVERDUE
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          PENDING
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenLedger(st)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px] transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Student Ledger
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Student Ledger Drawer / Modal */}
      <Modal
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        title={selectedStudentForLedger ? `Financial Ledger: ${selectedStudentForLedger.student_name}` : 'Student Ledger'}
      >
        {selectedStudentForLedger && (
          <div className="space-y-4 text-xs">
            {/* Student Context Header */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 gap-2">
              <div>
                <span className="text-[11px] text-slate-400">Class & Section:</span>
                <p className="font-semibold text-slate-800">
                  {selectedStudentForLedger.class_name} ({selectedStudentForLedger.section_name})
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Admission No:</span>
                <p className="font-semibold font-mono text-slate-800">
                  {selectedStudentForLedger.admission_number || '—'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Net Receivable Balance:</span>
                <p className="font-bold text-amber-700 text-sm">
                  {format(selectedStudentForLedger.total_outstanding)}
                </p>
              </div>
            </div>

            {/* Ledger Transactions Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 font-semibold text-slate-600 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Ref #</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Debit ({symbol})</th>
                    <th className="px-3 py-2 text-right">Credit ({symbol})</th>
                    <th className="px-3 py-2 text-right">Balance ({symbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLedger ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Loading financial ledger entries...
                      </td>
                    </tr>
                  ) : ledgerItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No financial transactions on record.
                      </td>
                    </tr>
                  ) : (
                    ledgerItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{item.date}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.type === 'DEMAND'
                                ? 'bg-blue-50 text-blue-700'
                                : item.type === 'PAYMENT'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-purple-50 text-purple-700'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-slate-600">{item.reference_no}</td>
                        <td className="px-3 py-2 max-w-xs truncate text-slate-800">{item.description}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">
                          {item.debit > 0 ? format(item.debit) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-700">
                          {item.credit > 0 ? format(item.credit) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {format(item.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-400">
                Audited ledger powered by double-entry relational accounting.
              </span>
              <Button onClick={() => setIsLedgerOpen(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
