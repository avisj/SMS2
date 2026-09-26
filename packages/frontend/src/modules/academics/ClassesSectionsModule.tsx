// ========================================================================
// ClassesSectionsModule Component
// Unified Management for Classes Master, Sections Master, and
// Academic Class-Section Offerings per Session
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  ArrowUpDown,
  Edit2,
  Trash2,
  FolderTree,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import {
  ClassItem,
  SectionItem,
  AcademicClassSection,
  AcademicSession,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface ClassesSectionsModuleProps {
  tabId: string;
}

export const ClassesSectionsModule: React.FC<ClassesSectionsModuleProps> = () => {
  const { activeBranch } = useAuth();
  const { hasPermission } = usePermission();

  const [activeTab, setActiveTab] = useState<'classes' | 'sections' | 'offerings'>('offerings');

  // Master Data
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [offerings, setOfferings] = useState<AcademicClassSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({
    name: '',
    code: '',
    display_name: '',
    numeric_order: 1,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState({
    name: '',
    code: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [isOfferingModalOpen, setIsOfferingModalOpen] = useState(false);
  const [offeringForm, setOfferingForm] = useState({
    class_id: '',
    section_id: '',
    capacity: 40,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canManage = hasPermission('classes.manage') || hasPermission('sections.manage') || hasPermission('academics.manage');

  const loadData = async () => {
    setLoading(true);
    try {
      const [clsData, secData, sessData] = await Promise.all([
        api.get<ClassItem[]>('/academics/classes?includeInactive=true'),
        api.get<SectionItem[]>('/academics/sections?includeInactive=true'),
        api.get<AcademicSession[]>('/academics/sessions?includeInactive=true'),
      ]);
      setClasses(clsData);
      setSections(secData);
      setSessions(sessData);

      const current = sessData.find(s => s.is_current) || sessData[0];
      if (current && !selectedSessionId) {
        setSelectedSessionId(current.id);
      }
    } catch (err) {
      console.error('Failed to load classes and sections:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOfferings = async () => {
    if (!selectedSessionId) return;
    try {
      const data = await api.get<AcademicClassSection[]>(`/academics/class-sections?sessionId=${selectedSessionId}`);
      setOfferings(data);
    } catch (err) {
      console.error('Failed to load offerings:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranch]);

  useEffect(() => {
    if (selectedSessionId) {
      loadOfferings();
    }
  }, [selectedSessionId]);

  // Class Actions
  const handleOpenCreateClass = () => {
    setEditingClassId(null);
    setClassForm({
      name: '',
      code: '',
      display_name: '',
      numeric_order: classes.length + 1,
      status: 'ACTIVE',
    });
    setErrorMessage(null);
    setIsClassModalOpen(true);
  };

  const handleOpenEditClass = (c: ClassItem) => {
    setEditingClassId(c.id);
    setClassForm({
      name: c.name,
      code: c.code,
      display_name: c.display_name,
      numeric_order: c.numeric_order || 1,
      status: c.status,
    });
    setErrorMessage(null);
    setIsClassModalOpen(true);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (editingClassId) {
        await api.put(`/academics/classes/${editingClassId}`, classForm);
      } else {
        await api.post('/academics/classes', classForm);
      }
      setIsClassModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save class');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (!confirm(`Delete class [${name}]?`)) return;
    try {
      await api.delete(`/academics/classes/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete class');
    }
  };

  // Section Actions
  const handleOpenCreateSection = () => {
    setEditingSectionId(null);
    setSectionForm({
      name: '',
      code: '',
      status: 'ACTIVE',
    });
    setErrorMessage(null);
    setIsSectionModalOpen(true);
  };

  const handleOpenEditSection = (s: SectionItem) => {
    setEditingSectionId(s.id);
    setSectionForm({
      name: s.name,
      code: s.code,
      status: s.status,
    });
    setErrorMessage(null);
    setIsSectionModalOpen(true);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (editingSectionId) {
        await api.put(`/academics/sections/${editingSectionId}`, sectionForm);
      } else {
        await api.post('/academics/sections', sectionForm);
      }
      setIsSectionModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save section');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSection = async (id: string, name: string) => {
    if (!confirm(`Delete section [${name}]?`)) return;
    try {
      await api.delete(`/academics/sections/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete section');
    }
  };

  // Offering Actions
  const handleOpenCreateOffering = () => {
    setOfferingForm({
      class_id: classes[0]?.id || '',
      section_id: sections[0]?.id || '',
      capacity: 40,
    });
    setErrorMessage(null);
    setIsOfferingModalOpen(true);
  };

  const handleSaveOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.post('/academics/class-sections', {
        ...offeringForm,
        academic_session_id: selectedSessionId,
      });
      setIsOfferingModalOpen(false);
      loadOfferings();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to configure class section');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOffering = async (id: string) => {
    if (!confirm('Remove this section configuration from the academic session?')) return;
    try {
      await api.delete(`/academics/class-sections/${id}`);
      loadOfferings();
    } catch (err: any) {
      alert(err.message || 'Failed to remove configuration');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600" />
            Classes & Sections Governance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage configurable school classes, section names, and session-specific class-section offerings.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-200/70 p-1 rounded-lg self-start">
          <button
            onClick={() => setActiveTab('offerings')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'offerings' ? 'bg-white text-teal-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Class-Section Offerings
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'classes' ? 'bg-white text-teal-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Class Master ({classes.length})
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'sections' ? 'bg-white text-teal-700 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Section Master ({sections.length})
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIEW 1: CLASS-SECTION OFFERINGS                                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'offerings' && (
        <div className="space-y-4">
          {/* Controls */}
          <Card className="p-4 bg-white border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <label className="text-xs font-semibold text-slate-700">Academic Session:</label>
                <select
                  value={selectedSessionId}
                  onChange={e => setSelectedSessionId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_current ? '(Current Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {canManage && (
                <Button onClick={handleOpenCreateOffering} className="flex items-center gap-1.5 self-start">
                  <Plus className="w-4 h-4" />
                  Configure Section for Class
                </Button>
              )}
            </div>
          </Card>

          {/* Grouped Class Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(cls => {
              const classOfferings = offerings.filter(o => o.class_id === cls.id);
              return (
                <Card key={cls.id} className="p-4 bg-white border-slate-200 hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{cls.display_name}</h3>
                      <span className="text-[11px] font-mono text-slate-400">{cls.code}</span>
                    </div>
                    <Badge variant={classOfferings.length > 0 ? 'emerald' : 'slate'}>
                      {classOfferings.length} {classOfferings.length === 1 ? 'Section' : 'Sections'}
                    </Badge>
                  </div>

                  <div className="pt-3">
                    {classOfferings.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        No sections configured in this session.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {classOfferings.map(o => (
                          <div
                            key={o.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/80 border border-slate-200 rounded-md text-xs font-semibold text-slate-800"
                          >
                            <span>Section {o.section?.name}</span>
                            {o.capacity && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({o.capacity} cap)
                              </span>
                            )}
                            {canManage && (
                              <button
                                onClick={() => handleDeleteOffering(o.id)}
                                className="ml-1 text-slate-400 hover:text-rose-600"
                                title="Remove section"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 2: CLASS MASTER                                            */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Classes configured for this school. Drag or reorder numeric values to define progression.
            </p>
            {canManage && (
              <Button onClick={handleOpenCreateClass} className="flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                Add Class
              </Button>
            )}
          </div>

          <Card className="overflow-hidden border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Numeric Order</th>
                    <th className="py-3 px-4">Display Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Raw Name</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {classes.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-500">{c.numeric_order}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{c.display_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{c.code}</td>
                      <td className="py-3 px-4 text-slate-600">{c.name}</td>
                      <td className="py-3 px-4">
                        <Badge variant={c.status === 'ACTIVE' ? 'emerald' : 'slate'}>{c.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditClass(c)}
                              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClass(c.id, c.display_name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VIEW 3: SECTION MASTER                                          */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'sections' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Reusable school sections catalogue (e.g. A, B, C, or color-based sections).
            </p>
            {canManage && (
              <Button onClick={handleOpenCreateSection} className="flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                Add Section
              </Button>
            )}
          </div>

          <Card className="overflow-hidden border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Section Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {sections.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{s.code}</td>
                      <td className="py-3 px-4">
                        <Badge variant={s.status === 'ACTIVE' ? 'emerald' : 'slate'}>{s.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditSection(s)}
                              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSection(s.id, s.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Class Master */}
      <Modal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        title={editingClassId ? 'Edit Class' : 'Add School Class'}
      >
        <form onSubmit={handleSaveClass} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Class Name"
              required
              value={classForm.name}
              onChange={e => setClassForm({ ...classForm, name: e.target.value })}
              placeholder="e.g. 10 or Kindergarten"
            />
            <Input
              label="Code"
              required
              value={classForm.code}
              onChange={e => setClassForm({ ...classForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. CLS-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Display Name"
              required
              value={classForm.display_name}
              onChange={e => setClassForm({ ...classForm, display_name: e.target.value })}
              placeholder="e.g. Class 10"
            />
            <Input
              type="number"
              label="Numeric Progression Order"
              value={classForm.numeric_order.toString()}
              onChange={e => setClassForm({ ...classForm, numeric_order: parseInt(e.target.value, 10) || 0 })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={classForm.status}
              onChange={e => setClassForm({ ...classForm, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsClassModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingClassId ? 'Update Class' : 'Create Class'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Section Master */}
      <Modal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        title={editingSectionId ? 'Edit Section' : 'Add School Section'}
      >
        <form onSubmit={handleSaveSection} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Section Name"
              required
              value={sectionForm.name}
              onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })}
              placeholder="e.g. A or Blue"
            />
            <Input
              label="Code"
              required
              value={sectionForm.code}
              onChange={e => setSectionForm({ ...sectionForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. SEC-A"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={sectionForm.status}
              onChange={e => setSectionForm({ ...sectionForm, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsSectionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingSectionId ? 'Update Section' : 'Create Section'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Configure Section for Class (Offering) */}
      <Modal
        isOpen={isOfferingModalOpen}
        onClose={() => setIsOfferingModalOpen(false)}
        title="Configure Section for Class in Session"
      >
        <form onSubmit={handleSaveOffering} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Class</label>
            <select
              value={offeringForm.class_id}
              onChange={e => setOfferingForm({ ...offeringForm, class_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              required
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.display_name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
            <select
              value={offeringForm.section_id}
              onChange={e => setOfferingForm({ ...offeringForm, section_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              required
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  Section {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <Input
            type="number"
            label="Section Capacity (Max Students)"
            value={offeringForm.capacity.toString()}
            onChange={e => setOfferingForm({ ...offeringForm, capacity: parseInt(e.target.value, 10) || 0 })}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setIsOfferingModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Configuration'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
