// ========================================================================
// Timetable Configuration Module
// Dynamic schedule period generation, 7-day working calendar,
// period duration, and lunch window setup.
// Produces versioned timetable master configurations.
// ========================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Layers,
  Save,
  AlertCircle,
  CheckCircle2,
  CalendarRange,
  ArrowRight,
  Info,
  Utensils,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import {
  AcademicSession,
  Location,
  GeneratedPeriod,
  TimetableMaster,
  TimetableConfigInput,
  TimetableDetail,
} from '../../types/index.js';

interface TimetableConfigModuleProps {
  tabId: string;
}

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const TimetableConfigModule: React.FC<TimetableConfigModuleProps> = ({ tabId }) => {
  const { openTab, tabs, activeTabId } = useWorkspace();
  const currentTab = tabs.find((t) => t.id === tabId);

  // Scope selectors
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Form state
  const [workingDays, setWorkingDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [firstPeriodStart, setFirstPeriodStart] = useState<string>('08:00');
  const [lastPeriodEnd, setLastPeriodEnd] = useState<string>('14:00');
  const [periodDuration, setPeriodDuration] = useState<number>(45);
  const [lunchStart, setLunchStart] = useState<string>('11:00');
  const [lunchEnd, setLunchEnd] = useState<string>('11:45');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('');
  const [effectiveTo, setEffectiveTo] = useState<string>('');

  // Status & Data
  const [activeMaster, setActiveMaster] = useState<TimetableMaster | null>(null);
  const [previewPeriods, setPreviewPeriods] = useState<GeneratedPeriod[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load Sessions and Locations on mount
  useEffect(() => {
    async function loadMasterData() {
      try {
        setLoading(true);
        const [sessList, locList] = await Promise.all([
          api.get<AcademicSession[]>('/academics/sessions'),
          api.get<Location[]>('/locations'),
        ]);

        setSessions(sessList || []);
        setLocations(locList || []);

        const paramSession = currentTab?.params?.sessionId;
        const paramLocation = currentTab?.params?.locationId;

        const currentSess =
          (sessList || []).find((s) => s.id === paramSession) ||
          (sessList || []).find((s) => s.is_current) ||
          (sessList || [])[0];
        if (currentSess) setSelectedSessionId(currentSess.id);

        const targetLoc =
          (locList || []).find((l) => l.id === paramLocation) || (locList || [])[0];
        if (targetLoc) setSelectedLocationId(targetLoc.id);
      } catch (err: any) {
        console.error('Failed to load sessions/locations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMasterData();
  }, []);

  // Fetch Active Timetable for selected session + location
  const loadActiveTimetable = async () => {
    if (!selectedSessionId || !selectedLocationId) return;

    try {
      const data = await api.get<{
        master: TimetableMaster | null;
        periods: GeneratedPeriod[];
        details: TimetableDetail[];
      }>('/timetables/active', {
        sessionId: selectedSessionId,
        locationId: selectedLocationId,
      });

      if (data?.master) {
        const m: TimetableMaster = data.master;
        setActiveMaster(m);
        // Canonicalize working days to standard calendar order
        const orderedDays = ALL_DAYS.filter((d) =>
          m.working_days.some((wd) => wd.toLowerCase() === d.toLowerCase())
        );
        setWorkingDays(orderedDays);
        setFirstPeriodStart(m.first_period_start_time);
        setLastPeriodEnd(m.last_period_end_time);
        setPeriodDuration(m.period_duration_minutes);
        setLunchStart(m.lunch_start_time);
        setLunchEnd(m.lunch_end_time);
        if (m.effective_from) setEffectiveFrom(m.effective_from.split('T')[0]);
        if (m.effective_to) setEffectiveTo(m.effective_to.split('T')[0]);
      } else {
        setActiveMaster(null);
        setWorkingDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
        setFirstPeriodStart('08:00');
        setLastPeriodEnd('14:00');
        setPeriodDuration(45);
        setLunchStart('11:00');
        setLunchEnd('11:45');
        setEffectiveFrom('');
        setEffectiveTo('');
      }
    } catch (err) {
      console.error('Failed to load active timetable:', err);
    }
  };

  useEffect(() => {
    loadActiveTimetable();
  }, [selectedSessionId, selectedLocationId]);

  // Reactive cross-tab listener for timetable updates
  useEffect(() => {
    const handleTimetableUpdated = (e: Event) => {
      const custom = e as CustomEvent;
      if (
        !custom.detail?.sessionId ||
        (custom.detail.sessionId === selectedSessionId && custom.detail.locationId === selectedLocationId)
      ) {
        loadActiveTimetable();
      }
    };
    window.addEventListener('sms:timetable-updated', handleTimetableUpdated);
    return () => window.removeEventListener('sms:timetable-updated', handleTimetableUpdated);
  }, [selectedSessionId, selectedLocationId]);

  // Refetch when tab becomes active in workspace to avoid stale cache
  const isTabActive = activeTabId === tabId;
  useEffect(() => {
    if (isTabActive && selectedSessionId && selectedLocationId) {
      loadActiveTimetable();
    }
  }, [isTabActive]);

  // Preview periods calculation whenever timings change
  useEffect(() => {
    if (!firstPeriodStart || !lastPeriodEnd || !periodDuration || !lunchStart || !lunchEnd) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const periodList = await api.get<GeneratedPeriod[]>('/timetables/preview-periods', {
          first_period_start_time: firstPeriodStart,
          last_period_end_time: lastPeriodEnd,
          period_duration_minutes: periodDuration,
          lunch_start_time: lunchStart,
          lunch_end_time: lunchEnd,
        });

        setPreviewPeriods(periodList || []);
        setPreviewError(null);
      } catch (err: any) {
        setPreviewError(err.message || 'Invalid period configuration');
        setPreviewPeriods([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [firstPeriodStart, lastPeriodEnd, periodDuration, lunchStart, lunchEnd]);

  // Toggle Day with canonical order preservation
  const handleToggleDay = (day: string) => {
    let next: string[];
    if (workingDays.includes(day)) {
      if (workingDays.length === 1) return; // Must keep at least 1 day
      next = workingDays.filter((d) => d !== day);
    } else {
      next = [...workingDays, day];
    }
    setWorkingDays(ALL_DAYS.filter((d) => next.includes(d)));
  };

  // Submit Save Configuration
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    if (workingDays.length === 0) {
      setSaveError('Please select at least one working day.');
      return;
    }

    if (previewError) {
      setSaveError(previewError);
      return;
    }

    try {
      setSaving(true);
      const orderedWorkingDays = ALL_DAYS.filter((d) => workingDays.includes(d));
      const payload: TimetableConfigInput = {
        academic_session_id: selectedSessionId,
        location_id: selectedLocationId,
        working_days: orderedWorkingDays,
        first_period_start_time: firstPeriodStart,
        last_period_end_time: lastPeriodEnd,
        period_duration_minutes: Number(periodDuration),
        lunch_start_time: lunchStart,
        lunch_end_time: lunchEnd,
        effective_from: effectiveFrom || null,
        effective_to: effectiveTo || null,
      };

      const result = await api.post<{ master: TimetableMaster; periods: GeneratedPeriod[] }>(
        '/timetables/config',
        payload
      );

      const newMaster: TimetableMaster = result.master;
      setActiveMaster(newMaster);
      setSaveSuccess(
        `Successfully saved timetable configuration! Version ${newMaster.version_no} (${newMaster.timetable_id}) is now ACTIVE.`
      );

      // Broadcast reactive update event so Student Timetable immediately reflects new version
      window.dispatchEvent(
        new CustomEvent('sms:timetable-updated', {
          detail: {
            sessionId: selectedSessionId,
            locationId: selectedLocationId,
            masterId: newMaster.id,
            timetableId: newMaster.timetable_id,
            versionNo: newMaster.version_no,
          },
        })
      );
    } catch (err: any) {
      setSaveError(err.message || 'Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const teachingCount = useMemo(() => previewPeriods.filter((p) => !p.is_lunch).length, [previewPeriods]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="ml-3 text-sm font-medium text-slate-600">Loading timetable configuration...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Timetable Configuration</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full">
              Authoritative Schedule Engine
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure dynamic period durations, lunch windows, and 7-day working schedules. Every change generates an immutable versioned snapshot.
          </p>
        </div>

        {activeMaster && (
          <button
            onClick={() =>
              openTab('student_timetable', 'Student Timetable', 'CalendarRange', {
                sessionId: selectedSessionId,
                locationId: selectedLocationId,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-brand-foreground text-sm font-semibold rounded-lg hover:bg-brand-700 shadow-sm transition-colors"
          >
            <CalendarRange className="w-4 h-4" />
            Open Student Timetable
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Scope Selectors: Academic Session and Branch */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Academic Session
          </label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.is_current ? '(Current Session)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Branch / Campus Location
          </label>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.location_name} ({l.location_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Version Status Card if exists */}
      {activeMaster && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
              V{activeMaster.version_no}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-900 font-mono">{activeMaster.timetable_id}</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-200 text-emerald-800">
                  {activeMaster.status}
                </span>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Active schedule: {activeMaster.working_days.length} days/week • {activeMaster.period_duration_minutes}m periods • Lunch: {activeMaster.lunch_start_time} - {activeMaster.lunch_end_time}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-emerald-600 font-mono">
            {activeMaster.effective_from ? `Effective: ${activeMaster.effective_from}` : 'Always Effective'}
          </div>
        </div>
      )}

      {/* Success / Error Messages */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-center gap-3 text-sm text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex items-center gap-3 text-sm text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Working Days Selector */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Working Days Selection</h2>
            </div>
            <span className="text-xs text-slate-500">
              Select all 7 calendar days as active or rest days
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {ALL_DAYS.map((day) => {
              const active = workingDays.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => handleToggleDay(day)}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center ${
                    active
                      ? 'bg-brand-600 border-brand-600 text-brand-foreground shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {day}
                  <span className="block text-[10px] mt-0.5 opacity-90">
                    {active ? 'Active' : 'Off'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timings Configuration */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Daily Periods & Interval Timings (24-Hour Format)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">First Period Start</label>
              <input
                type="text"
                value={firstPeriodStart}
                onChange={(e) => setFirstPeriodStart(e.target.value)}
                placeholder="08:00"
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
              <span className="text-[11px] text-slate-400">HH:MM e.g. 08:00</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Last Period End</label>
              <input
                type="text"
                value={lastPeriodEnd}
                onChange={(e) => setLastPeriodEnd(e.target.value)}
                placeholder="14:00"
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
              <span className="text-[11px] text-slate-400">HH:MM e.g. 14:00</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Period Duration (Minutes)</label>
              <input
                type="number"
                min={15}
                max={180}
                value={periodDuration}
                onChange={(e) => setPeriodDuration(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
              <span className="text-[11px] text-slate-400">15 to 180 minutes</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lunch Start Time</label>
              <input
                type="text"
                value={lunchStart}
                onChange={(e) => setLunchStart(e.target.value)}
                placeholder="11:00"
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
              <span className="text-[11px] text-slate-400">HH:MM e.g. 11:00</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lunch End Time</label>
              <input
                type="text"
                value={lunchEnd}
                onChange={(e) => setLunchEnd(e.target.value)}
                placeholder="11:45"
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
              <span className="text-[11px] text-slate-400">HH:MM e.g. 11:45</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Effective From (Optional)</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Effective To (Optional)</label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Period Preview Engine */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Dynamic Period Generation Preview</h2>
            </div>
            {!previewError && previewPeriods.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="px-2 py-0.5 bg-slate-100 rounded font-semibold text-slate-700">
                  {teachingCount} Teaching Periods
                </span>
                <span className="px-2 py-0.5 bg-amber-100 rounded font-semibold text-amber-800">
                  1 Lunch Interval
                </span>
                <span className="px-2 py-0.5 bg-indigo-100 rounded font-semibold text-indigo-800">
                  {previewPeriods.length} Total Slots
                </span>
              </div>
            )}
          </div>

          {previewError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wide">Timing Alignment Error</h3>
                <p className="text-xs text-rose-700 mt-1">{previewError}</p>
                <p className="text-[11px] text-rose-600 mt-1">
                  Adjust duration or interval times so teaching slots fit cleanly into the morning and afternoon blocks.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2">
                {previewPeriods.map((p) => {
                  if (p.is_lunch) {
                    return (
                      <div
                        key={p.period_no}
                        className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 text-center shadow-xs"
                      >
                        <div className="flex items-center justify-center text-amber-600 mb-1">
                          <Utensils className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-amber-900 block">Lunch Break</span>
                        <span className="text-[11px] font-mono text-amber-700 mt-0.5 block">
                          {p.start_time} - {p.end_time}
                        </span>
                        <span className="text-[10px] text-amber-600 block mt-1 uppercase font-semibold">
                          Non-Teaching
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={p.period_no}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center hover:bg-indigo-50/50 hover:border-indigo-300 transition-colors"
                    >
                      <span className="text-xs font-bold text-slate-800 block">{p.label}</span>
                      <span className="text-[11px] font-mono text-indigo-600 font-semibold mt-0.5 block">
                        {p.start_time} - {p.end_time}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                        Slot #{p.period_no}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Save & Version Notice */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>
              Saving will create a <strong>new timetable version</strong> (e.g. V{activeMaster ? activeMaster.version_no + 1 : 1}) and mark it ACTIVE.
            </span>
          </div>

          <button
            type="submit"
            disabled={saving || Boolean(previewError)}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 text-brand-foreground text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating Version...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Timetable Configuration
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
