// ========================================================================
// FeeStructuresModule
// Class/Section Fee Blueprints and Pricing Rules
// ========================================================================

import React, { useEffect, useState } from 'react';
import { Layers, Plus, Search, Filter, Edit2, Trash2, Calendar, MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import {
  FeeStructure,
  FeeHead,
  AcademicSession,
  AcademicClassSection,
  ClassItem,
  SectionItem,
  FeeFrequency,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { useCurrency } from '../../utils/currency.js';

interface FeeStructuresModuleProps {
  tabId?: string;
}

const FREQUENCIES: FeeFrequency[] = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME'];

export const FeeStructuresModule: React.FC<FeeStructuresModuleProps> = () => {
  const { symbol, format } = useCurrency();
  const { activeBranch } = useAuth();

  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classSections, setClassSections] = useState<AcademicClassSection[]>([]);

  // Filter state
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedHeadId, setSelectedHeadId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
  const [formData, setFormData] = useState({
    academic_session_id: '',
    location_id: '',
    class_id: '',
    section_id: '',
    fee_head_id: '',
    frequency: 'MONTHLY' as FeeFrequency,
    amount: 0,
    due_day_of_month: 10,
    notes: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // 1. Load Initial Reference Masters (Sessions & Fee Heads)
  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [sessRes, headsRes] = await Promise.all([
          api.get<AcademicSession[]>('/academics/sessions'),
          api.get<FeeHead[]>('/fees/heads'),
        ]);

        setSessions(sessRes || []);
        setHeads(headsRes || []);

        const activeSess = sessRes?.find((s) => s.status === 'ACTIVE') || sessRes?.[0];
        if (activeSess) {
          setSelectedSessionId(activeSess.id);
        }
      } catch (err) {
        console.error('[FeeStructuresModule] Error loading masters:', err);
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
        console.error('[FeeStructuresModule] Error loading class sections:', err);
      }
    };

    loadClassSections();
  }, [selectedSessionId]);

  // Derived sections for current selected class in filter
  const filterSections: SectionItem[] = selectedClassId
    ? classSections
        .filter((cs) => cs.class_id === selectedClassId && cs.section)
        .map((cs) => cs.section!)
    : [];

  // Derived sections for modal selected class
  const modalSections: SectionItem[] = formData.class_id
    ? classSections
        .filter((cs) => cs.class_id === formData.class_id && cs.section)
        .map((cs) => cs.section!)
    : [];

  const loadStructures = async () => {
    try {
      setLoading(true);
      const data = await api.get<FeeStructure[]>('/fees/structures', {
        academicSessionId: selectedSessionId || undefined,
        locationId: activeBranch?.id || undefined,
        classId: selectedClassId || undefined,
        sectionId: selectedSectionId || undefined,
        feeHeadId: selectedHeadId || undefined,
        status: statusFilter || undefined,
      });
      setStructures(data || []);
    } catch (err) {
      console.error('[FeeStructuresModule] Error loading structures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      loadStructures();
    }
  }, [selectedSessionId, selectedClassId, selectedSectionId, selectedHeadId, statusFilter, activeBranch?.id]);

  const handleOpenAdd = () => {
    setEditingStructure(null);
    setFormData({
      academic_session_id: selectedSessionId || (sessions[0]?.id || ''),
      location_id: activeBranch?.id || '',
      class_id: selectedClassId || (classes[0]?.id || ''),
      section_id: selectedSectionId || '',
      fee_head_id: heads[0]?.id || '',
      frequency: 'MONTHLY',
      amount: 0,
      due_day_of_month: 10,
      notes: '',
      status: 'ACTIVE',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (struct: FeeStructure) => {
    setEditingStructure(struct);
    setFormData({
      academic_session_id: struct.academic_session_id,
      location_id: struct.location_id || '',
      class_id: struct.class_id,
      section_id: struct.section_id || '',
      fee_head_id: struct.fee_head_id,
      frequency: struct.frequency,
      amount: struct.amount,
      due_day_of_month: struct.due_day_of_month,
      notes: struct.notes || '',
      status: struct.status,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.academic_session_id) {
      setFormError('Academic session is required');
      return;
    }
    if (!formData.class_id) {
      setFormError('Class is required');
      return;
    }
    if (!formData.fee_head_id) {
      setFormError('Fee head is required');
      return;
    }
    if (formData.amount <= 0) {
      setFormError('Valid fee amount greater than zero is required');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      const payload = {
        ...formData,
        section_id: formData.section_id || null,
        location_id: formData.location_id || null,
      };

      if (editingStructure) {
        await api.put(`/fees/structures/${editingStructure.id}`, payload);
      } else {
        await api.post('/fees/structures', payload);
      }
      setIsModalOpen(false);
      loadStructures();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save fee structure');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (struct: FeeStructure) => {
    if (
      !window.confirm(
        `Are you sure you want to delete this Fee Structure for ${struct.class?.name || 'Class'} - ${struct.fee_head?.name || 'Fee'}? (Past demands will not be affected).`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/fees/structures/${struct.id}`);
      loadStructures();
    } catch (err: any) {
      alert(err.message || 'Failed to delete fee structure');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Fee Structures Blueprint
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Define grade/class-specific fee amounts, payment frequencies, and monthly due dates.
          </p>
        </div>

        <Button onClick={handleOpenAdd} className="flex items-center gap-1.5 text-xs">
          <Plus className="w-4 h-4" />
          Add Structure
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
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
          {filterSections.map((s) => (
            <option key={s.id} value={s.id}>
              Section {s.name}
            </option>
          ))}
        </select>

        <select
          value={selectedHeadId}
          onChange={(e) => setSelectedHeadId(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
        >
          <option value="">All Fee Heads</option>
          {heads.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} ({h.code})
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <Button variant="secondary" size="sm" onClick={loadStructures} className="flex items-center gap-1 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Structures Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Class / Section</th>
                <th className="px-4 py-3">Fee Head</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3 text-right">Amount ({symbol})</th>
                <th className="px-4 py-3 text-center">Due Day</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && structures.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Loading fee structures...
                  </td>
                </tr>
              ) : structures.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No fee structures defined for this criteria. Click "Add Structure" to create one.
                  </td>
                </tr>
              ) : (
                structures.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>
                          {s.class?.display_name ||
                            (s.class as any)?.display_label ||
                            (s.class?.name
                              ? s.class.name.toLowerCase().startsWith('class')
                                ? s.class.name
                                : `Class ${s.class.name}`
                              : 'Class')}
                        </span>
                        {s.section?.name ? (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Section {s.section.name}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            All Sections
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-indigo-700">
                      {s.fee_head?.name || 'Fee Head'}
                      <span className="ml-1 text-[10px] text-slate-400 font-mono">[{s.fee_head?.code}]</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {s.frequency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {format(s.amount)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-600">
                      Day {s.due_day_of_month}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{s.notes || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={s.status === 'ACTIVE' ? 'success' : 'default'} size="sm">
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100"
                          title="Edit Structure"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(s)}
                          className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100"
                          title="Delete Structure"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
        title={editingStructure ? 'Edit Fee Structure' : 'Add Fee Structure'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Session *</label>
              <select
                value={formData.academic_session_id}
                onChange={(e) => setFormData({ ...formData, academic_session_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                required
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Head *</label>
              <select
                value={formData.fee_head_id}
                onChange={(e) => setFormData({ ...formData, fee_head_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                required
              >
                {heads.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class *</label>
              <select
                value={formData.class_id}
                onChange={(e) => setFormData({ ...formData, class_id: e.target.value, section_id: '' })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                required
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name || (c as any).display_label || c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Section (Optional)</label>
              <select
                value={formData.section_id}
                onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Sections (Entire Class)</option>
                {modalSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency *</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as FeeFrequency })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({symbol}) *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="4500"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Day of Month</label>
              <Input
                type="number"
                min="1"
                max="31"
                value={formData.due_day_of_month}
                onChange={(e) => setFormData({ ...formData, due_day_of_month: Number(e.target.value) })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Instructions</label>
            <textarea
              rows={2}
              placeholder="Internal pricing notes or conditions..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingStructure ? 'Save Changes' : 'Create Structure'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
