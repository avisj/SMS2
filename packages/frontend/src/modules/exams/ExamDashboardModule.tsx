import React, { useEffect, useState } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
  Users,
  AlertCircle,
  Layers,
  ChevronRight,
  RefreshCw,
  Edit3,
  Send,
  Printer,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  AcademicSession,
  ExamMaster,
  ExamDashboardStats,
} from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

interface ExamDashboardModuleProps {
  tabId?: string;
  onNavigate?: (moduleKey: string) => void;
}

export const ExamDashboardModule: React.FC<ExamDashboardModuleProps> = ({ onNavigate }) => {
  const { activeBranch } = useAuth();
  const { openTab } = useWorkspace();
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [stats, setStats] = useState<ExamDashboardStats | null>(null);
  const [recentExams, setRecentExams] = useState<ExamMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const navigateTo = (moduleKey: string, title: string, icon: string) => {
    if (onNavigate) {
      onNavigate(moduleKey);
    } else {
      openTab(moduleKey, title, icon);
    }
  };

  // Load Sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessRes = await api.get<AcademicSession[]>('/academics/sessions');
        setSessions(sessRes || []);
        const active = sessRes?.find((s) => s.status === 'ACTIVE') || sessRes?.[0];
        if (active) setSelectedSessionId(active.id);
      } catch (err) {
        console.error('[ExamDashboard] Error loading sessions:', err);
      }
    };
    loadSessions();
  }, []);

  // Load Dashboard Stats & Recent Exams
  const loadDashboardData = async () => {
    if (!selectedSessionId) return;
    try {
      setLoading(true);
      const [statsRes, examsRes] = await Promise.all([
        api.get<ExamDashboardStats>('/exams/analytics/dashboard', {
          academicSessionId: selectedSessionId,
          locationId: activeBranch?.id || undefined,
        }),
        api.get<ExamMaster[]>('/exams', {
          academicSessionId: selectedSessionId,
        }),
      ]);

      setStats(statsRes);
      setRecentExams(examsRes || []);
    } catch (err) {
      console.error('[ExamDashboard] Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedSessionId, activeBranch?.id]);

  const workflowSteps = [
    {
      step: 1,
      title: 'Exam Master',
      desc: 'Define exam codes, dates & academic session',
      moduleKey: 'exam-master',
      icon: 'Calendar',
      iconComponent: Calendar,
      color: 'indigo',
    },
    {
      step: 2,
      title: 'Exam Structure',
      desc: 'Configure classes, subjects, max & pass marks',
      moduleKey: 'exam-structure',
      icon: 'Layers',
      iconComponent: Layers,
      color: 'purple',
    },
    {
      step: 3,
      title: 'Exam Schedule',
      desc: 'Publish timetable papers and exam venues',
      moduleKey: 'exam-schedule',
      icon: 'Clock',
      iconComponent: Clock,
      color: 'blue',
    },
    {
      step: 4,
      title: 'Marks Entry',
      desc: 'Enter scores, attendance & grades per student',
      moduleKey: 'marks-entry',
      icon: 'Edit3',
      iconComponent: Edit3,
      color: 'amber',
    },
    {
      step: 5,
      title: 'Results Ledger',
      desc: 'Review computed percentages & grade allocations',
      moduleKey: 'exam-results',
      icon: 'Award',
      iconComponent: Award,
      color: 'brand',
    },
    {
      step: 6,
      title: 'Publish Results',
      desc: 'Certify & seal official results in database',
      moduleKey: 'exam-results',
      icon: 'Send',
      iconComponent: Send,
      color: 'emerald',
    },
    {
      step: 7,
      title: 'Report Cards',
      desc: 'Print & distribute certified student report cards',
      moduleKey: 'report-cards',
      icon: 'Printer',
      iconComponent: Printer,
      color: 'slate',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Award className="w-6 h-6 text-brand-600" />
            Exams & Results Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            End-to-end examination lifecycle: definition, timetable, marks entry, ledger calculation, publication & certified report cards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold">Session:</span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="bg-transparent font-medium text-slate-900 focus:outline-hidden"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === 'ACTIVE' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            loading={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* 7-Step Workflow Guide Banner */}
      <Card className="p-5 border-brand-200 bg-gradient-to-r from-brand-50/50 via-white to-slate-50/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              Examination Lifecycle & Workflow
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Follow the 7-step connected workflow to configure, administer, and publish examination report cards.
            </p>
          </div>
          <Badge variant="primary">7 Steps to Publish</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {workflowSteps.map((ws) => {
            const IconComp = ws.iconComponent;
            return (
              <button
                key={ws.step}
                onClick={() => navigateTo(ws.moduleKey, ws.title, ws.icon)}
                className="flex flex-col p-3 rounded-lg border border-slate-200/80 bg-white hover:border-brand-400 hover:shadow-xs transition-all text-left group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 font-bold text-[10px] flex items-center justify-center">
                    {ws.step}
                  </span>
                  <IconComp className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" />
                </div>
                <p className="text-xs font-bold text-slate-900 group-hover:text-brand-700 transition-colors">
                  {ws.title}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight line-clamp-2">
                  {ws.desc}
                </p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Exams */}
        <Card className="p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Exams</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {stats ? stats.total_exams : '—'}
          </p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <span className="text-indigo-600 font-semibold">{stats?.scheduled_exams || 0} Scheduled</span>
            <span>•</span>
            <span className="text-amber-600 font-semibold">{stats?.ongoing_exams || 0} Ongoing</span>
          </div>
        </Card>

        {/* Completed Exams */}
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {stats ? stats.completed_exams : '—'}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium mt-2">
            Ready for marks finalization
          </p>
        </Card>

        {/* Results Published */}
        <Card className="p-4 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Published Results</span>
            <Award className="w-4 h-4 text-brand-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {stats ? stats.results_published : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-2">
            Certified report cards accessible
          </p>
        </Card>

        {/* Performance Average */}
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Score</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {stats && stats.average_percentage ? `${stats.average_percentage}%` : 'N/A'}
          </p>
          <p className="text-[11px] text-slate-500 mt-2">
            School-wide assessment aggregate
          </p>
        </Card>
      </div>

      {/* Active & Upcoming Examinations */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-600" />
            Active & Upcoming Examinations
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateTo('exam-master', 'Exam Master', 'Calendar')}
            className="flex items-center gap-1.5 text-xs"
          >
            Manage Exams
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {recentExams.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No exams configured for this Academic Session.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Go to <span className="font-semibold text-indigo-600">Exam Master</span> to define a new examination.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Exam Name</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Date Window</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentExams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-semibold text-slate-900">{ex.exam_name}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{ex.exam_code}</td>
                    <td className="py-3 px-3 text-slate-600">{ex.exam_type}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(ex.start_date).toLocaleDateString()} — {new Date(ex.end_date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge
                        variant={
                          ex.status === 'PUBLISHED'
                            ? 'emerald'
                            : ex.status === 'COMPLETED'
                            ? 'purple'
                            : ex.status === 'ONGOING'
                            ? 'amber'
                            : ex.status === 'SCHEDULED'
                            ? 'indigo'
                            : ex.status === 'CANCELLED'
                            ? 'rose'
                            : 'slate'
                        }
                      >
                        {ex.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigateTo('marks-entry', 'Marks Entry', 'Edit3')}
                          className="h-7 text-[11px] text-slate-600 hover:text-slate-900"
                        >
                          Marks
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigateTo('exam-results', 'Results Ledger', 'Award')}
                          className="h-7 text-[11px] text-brand-700 hover:text-brand-900"
                        >
                          Ledger
                        </Button>
                        {ex.status === 'PUBLISHED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigateTo('report-cards', 'Report Cards', 'FileText')}
                            className="h-7 text-[11px] text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                          >
                            Report Cards
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
