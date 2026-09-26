// ========================================================================
// ClassSectionSetupModule Component
// Dedicated Class & Section Setup / Offerings Management per Academic Session
// ZERO display_order - sorted newest first (created_at DESC)
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Layers,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  Users,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { AcademicSession, ClassItem, SectionItem, AcademicClassSection } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';

interface ClassSectionSetupModuleProps {
  tabId: string;
}

export const ClassSectionSetupModule: React.FC<ClassSectionSetupModuleProps> = () => {
  const { userContext } = useAuth();
  const { hasPermission } = usePermission();

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classSections, setClassSections] = useState<AcademicClassSection[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formClassId, setFormClassId] = useState('');
  const [formSectionId, setFormSectionId] = useState('');
  const [formCapacity, setFormCapacity] = useState('40');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsData, classesData, sectionsData] = await Promise.all([
        api.get<AcademicSession[]>('/academics/sessions?includeInactive=true'),
        api.get<ClassItem[]>('/academics/classes'),
        api.get<SectionItem[]>('/academics/sections'),
      ]);

      setSessions(sessionsData);
      setClasses(classesData);
      setSections(sectionsData);

      let activeSession = sessionsData.find(s => s.is_current) || sessionsData[0];
      const sessionIdToUse = selectedSessionId || activeSession?.id || '';
      if (!selectedSessionId && sessionIdToUse) {
        setSelectedSessionId(sessionIdToUse);
      }

      if (sessionIdToUse) {
        const csData = await api.get<AcademicClassSection[]>(`/academics/class-sections?sessionId=${sessionIdToUse}`);
        setClassSections(csData);
      }
    } catch (err) {
      console.error('Failed to load class-section setup data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userContext?.school_id]);

  useEffect(() => {
    if (selectedSessionId) {
      api.get<AcademicClassSection[]>(`/academics/class-sections?sessionId=${selectedSessionId}`)
        .then(data => setClassSections(data))
        .catch(err => console.error('Failed to load offerings for session', err));
    }
  }, [selectedSessionId]);

  const handleOpenCreate = () => {
    setFormClassId(classes[0]?.id || '');
    setFormSectionId(sections[0]?.id || '');
    setFormCapacity('40');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !formClassId || !formSectionId) {
      setErrorMessage('Please select a class and section');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await api.post('/academics/class-sections', {
        academic_session_id: selectedSessionId,
        class_id: formClassId,
        section_id: formSectionId,
        capacity: parseInt(formCapacity, 10) || 40,
      });
      setIsModalOpen(false);
      const updated = await api.get<AcademicClassSection[]>(`/academics/class-sections?sessionId=${selectedSessionId}`);
      setClassSections(updated);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to setup class section');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Are you sure you want to remove offering "${label}"?`)) return;
    try {
      await api.delete(`/academics/class-sections/${id}`);
      setClassSections(prev => prev.filter(cs => cs.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete class section setup');
    }
  };

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600" />
            Class & Section Setup
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure active class and section offerings per academic session. Sorted newest first.
          </p>
        </div>
        {hasPermission('classes.manage') && (
          <Button
            onClick={handleOpenCreate}
            variant="primary"
            disabled={!selectedSessionId || classes.length === 0 || sections.length === 0}
            className="self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Setup Class Section
          </Button>
        )}
      </div>

      {/* Session Filter Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-700">Academic Session:</span>
            <div className="w-56">
              <Select
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
                options={sessions.map(s => ({
                  value: s.id,
                  label: `${s.name} ${s.is_current ? '(Active Current)' : ''}`,
                }))}
              />
            </div>
            {selectedSession?.is_current && (
              <Badge variant="emerald">Current Session</Badge>
            )}
          </div>

          <Button variant="secondary" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Setup Offerings Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Section</th>
                <th className="py-3 px-4">Combined Code</th>
                <th className="py-3 px-4">Student Capacity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Loading class section setup...
                  </td>
                </tr>
              ) : classSections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No class-section pairings set up for this academic session yet.
                  </td>
                </tr>
              ) : (
                classSections.map(cs => {
                  const cls = classes.find(c => c.id === cs.class_id);
                  const sec = sections.find(s => s.id === cs.section_id);
                  const label = `${cls?.display_name || cls?.name || 'Class'} - ${sec?.name || 'Section'}`;
                  return (
                    <tr key={cs.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {cls?.display_name || cls?.name || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-teal-700">
                        Section {sec?.name || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {cls?.code}-{sec?.code}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {cs.capacity ? `${cs.capacity} seats` : 'No limit'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={cs.status === 'ACTIVE' ? 'emerald' : 'slate'}>
                          {cs.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasPermission('classes.manage') && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(cs.id, label)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Setup Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Setup Class & Section Pairing"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Academic Session</label>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800">
              {selectedSession?.name} ({selectedSession?.code})
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Select Class *</label>
            <Select
              value={formClassId}
              onChange={e => setFormClassId(e.target.value)}
              options={classes.map(c => ({
                value: c.id,
                label: `${c.display_name} (${c.code})`,
              }))}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Select Section *</label>
            <Select
              value={formSectionId}
              onChange={e => setFormSectionId(e.target.value)}
              options={sections.map(s => ({
                value: s.id,
                label: `Section ${s.name} (${s.code})`,
              }))}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Student Capacity</label>
            <Input
              type="number"
              value={formCapacity}
              onChange={e => setFormCapacity(e.target.value)}
              placeholder="e.g. 40"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Setting up...' : 'Setup Offering'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
