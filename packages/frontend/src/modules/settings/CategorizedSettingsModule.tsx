// ========================================================================
// CategorizedSettingsModule
// Two-pane Settings Architecture: Left Category Nav, Right Configuration Panel
// ZERO hardcoded business configuration - Automatic Academic Session Lifecycle
// Centralized School Currency & Localization under General & Localization
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Calendar,
  Settings,
  Activity,
  Palette,
  Server,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Info,
  Globe,
  Coins,
  Clock,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { SchoolSetting, AcademicSessionSetting, LocalizationSetting } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';
import { Badge } from '../../components/common/Badge.js';
import { formatCurrency } from '../../utils/currency.js';

interface CategorizedSettingsModuleProps {
  tabId: string;
}

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const CURRENCY_PRESETS = [
  { code: 'INR', symbol: '₹', position: 'BEFORE' as const, decimals: 2, locale: 'en-IN', label: 'INR - Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', position: 'BEFORE' as const, decimals: 2, locale: 'en-US', label: 'USD - US Dollar ($)' },
  { code: 'EUR', symbol: '€', position: 'AFTER' as const, decimals: 2, locale: 'de-DE', label: 'EUR - Euro (€)' },
  { code: 'GBP', symbol: '£', position: 'BEFORE' as const, decimals: 2, locale: 'en-GB', label: 'GBP - British Pound (£)' },
  { code: 'AED', symbol: 'د.إ', position: 'BEFORE' as const, decimals: 2, locale: 'ar-AE', label: 'AED - UAE Dirham (د.إ)' },
  { code: 'SGD', symbol: 'S$', position: 'BEFORE' as const, decimals: 2, locale: 'en-SG', label: 'SGD - Singapore Dollar (S$)' },
  { code: 'AUD', symbol: 'A$', position: 'BEFORE' as const, decimals: 2, locale: 'en-AU', label: 'AUD - Australian Dollar (A$)' },
  { code: 'CAD', symbol: 'C$', position: 'BEFORE' as const, decimals: 2, locale: 'en-CA', label: 'CAD - Canadian Dollar (C$)' },
  { code: 'JPY', symbol: '¥', position: 'BEFORE' as const, decimals: 0, locale: 'ja-JP', label: 'JPY - Japanese Yen (¥)' },
];

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST +05:30)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST +04:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT +08:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g., 26/09/2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g., 09/26/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO 8601 e.g., 2026-09-26)' },
  { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (e.g., 26-09-2026)' },
];

const TIME_FORMATS = [
  { value: '12h', label: '12-Hour (e.g., 02:30 PM)' },
  { value: '24h', label: '24-Hour (e.g., 14:30)' },
];

export const CategorizedSettingsModule: React.FC<CategorizedSettingsModuleProps> = () => {
  const { userContext, refreshContext } = useAuth();
  const { hasPermission } = usePermission();

  const [activeCategory, setActiveCategory] = useState<string>('ACADEMIC');
  const [settings, setSettings] = useState<SchoolSetting[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [sessionSetting, setSessionSetting] = useState<AcademicSessionSetting | null>(null);
  const [sessionStartMonth, setSessionStartMonth] = useState<string>('4');
  const [sessionEndMonth, setSessionEndMonth] = useState<string>('3');

  // Localization state
  const [locData, setLocData] = useState<LocalizationSetting>({
    currency: userContext?.currency || 'INR',
    currency_symbol: userContext?.currency_symbol || '₹',
    currency_position: userContext?.currency_position || 'BEFORE',
    decimal_places: typeof userContext?.decimal_places === 'number' ? userContext.decimal_places : 2,
    date_format: userContext?.date_format || 'DD/MM/YYYY',
    time_format: userContext?.time_format || '12h',
    timezone: userContext?.timezone || 'Asia/Kolkata',
    locale: userContext?.locale || 'en-IN',
  });
  const [locSaving, setLocSaving] = useState(false);
  const [locSavedSuccess, setLocSavedSuccess] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedSuccessKey, setSavedSuccessKey] = useState<string | null>(null);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionSavedSuccess, setSessionSavedSuccess] = useState(false);

  // Navigation Presentation Mode
  const [navMode, setNavMode] = useState<string>(() => {
    return localStorage.getItem('sms_navigation_mode') || 'hover_dual_rail';
  });

  const handleNavModeChange = (mode: string) => {
    setNavMode(mode);
    localStorage.setItem('sms_navigation_mode', mode);
    window.dispatchEvent(new CustomEvent('sms_nav_mode_change', { detail: mode }));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsData, sessionData, localizationRes] = await Promise.all([
        api.get<SchoolSetting[]>('/config/settings'),
        api.get<AcademicSessionSetting>('/config/settings/academic-session').catch(() => null),
        api.get<LocalizationSetting>('/config/settings/localization').catch(() => null),
      ]);
      setSettings(settingsData);
      const values: Record<string, string> = {};
      for (const s of settingsData) {
        values[s.setting_key] = s.setting_value;
      }
      setFormValues(values);

      if (sessionData) {
        setSessionSetting(sessionData);
        setSessionStartMonth(sessionData.start_month.toString());
        setSessionEndMonth(sessionData.end_month.toString());
      }

      if (localizationRes) {
        setLocData(localizationRes);
      }
    } catch (err) {
      console.error('Failed to load settings data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userContext?.school_id]);

  const handleSaveSetting = async (key: string, category: string, dataType: any) => {
    setSavingKey(key);
    try {
      await api.put(`/config/settings/${key}`, {
        value: formValues[key],
        category,
        dataType,
      });
      setSavedSuccessKey(key);
      setTimeout(() => setSavedSuccessKey(null), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to update setting');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAcademicSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionSaving(true);
    try {
      const updated = await api.put<AcademicSessionSetting>('/config/settings/academic-session', {
        start_month: parseInt(sessionStartMonth, 10),
        end_month: parseInt(sessionEndMonth, 10),
      });
      setSessionSetting(updated);
      setSessionSavedSuccess(true);
      setTimeout(() => setSessionSavedSuccess(false), 3000);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update academic session configuration');
    } finally {
      setSessionSaving(false);
    }
  };

  const handleCurrencyPresetChange = (currencyCode: string) => {
    const preset = CURRENCY_PRESETS.find(p => p.code === currencyCode);
    if (preset) {
      setLocData(prev => ({
        ...prev,
        currency: preset.code,
        currency_symbol: preset.symbol,
        currency_position: preset.position,
        decimal_places: preset.decimals,
        locale: preset.locale,
      }));
    } else {
      setLocData(prev => ({ ...prev, currency: currencyCode }));
    }
  };

  const handleSaveLocalization = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocSaving(true);
    try {
      const updated = await api.put<LocalizationSetting>('/config/settings/localization', locData);
      setLocData(updated);
      setLocSavedSuccess(true);
      setTimeout(() => setLocSavedSuccess(false), 3000);
      await refreshContext();
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update localization settings');
    } finally {
      setLocSaving(false);
    }
  };

  const categories = [
    { key: 'ACADEMIC', label: 'Academic Settings', icon: <Calendar className="w-4 h-4" />, description: 'Session cycle, grading rules & calendar configuration' },
    { key: 'GENERAL', label: 'General & Localization', icon: <Settings className="w-4 h-4" />, description: 'Currency, timezone, date formats & school identity' },
    { key: 'OPERATIONS', label: 'Operations & Cutoffs', icon: <Activity className="w-4 h-4" />, description: 'Attendance cutoff times & daily schedules' },
    { key: 'BRANDING', label: 'Branding & Identity', icon: <Palette className="w-4 h-4" />, description: 'Portal logo, institute title & identity settings' },
    { key: 'SYSTEM', label: 'Platform & System', icon: <Server className="w-4 h-4" />, description: 'Audit retention & multi-tenant environment flags' },
  ];

  const currentCategorySettings = settings.filter(s => s.category === activeCategory && s.setting_key !== 'brand_color');

  // Filter out mirrored keys from generic setting rows in GENERAL
  const localizationMirroredKeys = [
    'currency_code',
    'currency_symbol',
    'currency_position',
    'decimal_places',
    'date_format',
    'time_format',
    'timezone',
    'locale',
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Sliders className="w-5 h-5 text-teal-600" />
          School Configuration & Settings
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Tenant-isolated operational parameters, centralized currency formatting, and automated academic lifecycle.
        </p>
      </div>

      {/* Two-Pane Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Pane: Category Navigation */}
        <div className="md:col-span-4 lg:col-span-3 space-y-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Settings Categories
          </div>
          {categories.map(cat => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-start gap-3 border ${
                  isActive
                    ? 'bg-teal-50 border-teal-200 text-teal-900 shadow-xs'
                    : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isActive ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {cat.icon}
                </div>
                <div className="min-w-0">
                  <div className={`text-xs font-semibold ${isActive ? 'text-teal-900' : 'text-slate-800'}`}>
                    {cat.label}
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                    {cat.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Pane: Configuration Panel */}
        <div className="md:col-span-8 lg:col-span-9">
          {loading ? (
            <Card>
              <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                Loading settings configuration...
              </div>
            </Card>
          ) : (
            <div className="space-y-5">
              {/* ACADEMIC CATEGORY PANEL */}
              {activeCategory === 'ACADEMIC' && (
                <div className="space-y-5">
                  <Card className="border-teal-200 bg-linear-to-br from-teal-50/50 via-white to-slate-50">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-teal-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-teal-50 text-teal-800 rounded-lg">
                            <Sparkles className="w-4 h-4" />
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">
                            Automatic Academic Session Management
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 max-w-xl">
                          No manual yearly CRUD required. Academic sessions are automatically computed from the start and end months. Historical sessions are permanently preserved in the database.
                        </p>
                      </div>

                      {sessionSetting && (
                        <div className="bg-white border border-teal-200 px-4 py-2.5 rounded-xl shadow-xs shrink-0">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Active Academic Session
                          </div>
                          <div className="text-base font-extrabold text-teal-800 flex items-center gap-2 mt-0.5">
                            {sessionSetting.calculated_session_name}
                            <Badge variant="emerald">Live & Active</Badge>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                            {sessionSetting.start_date} → {sessionSetting.end_date}
                          </div>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSaveAcademicSession} className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Session Start Month *
                          </label>
                          <Select
                            value={sessionStartMonth}
                            onChange={e => setSessionStartMonth(e.target.value)}
                            options={MONTHS}
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            Month when the school's new academic calendar begins (e.g., April).
                          </p>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Session End Month *
                          </label>
                          <Select
                            value={sessionEndMonth}
                            onChange={e => setSessionEndMonth(e.target.value)}
                            options={MONTHS}
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            Month when the academic calendar concludes (e.g., March).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Info className="w-3.5 h-3.5 text-teal-600" />
                          <span>Student admissions and class setups automatically bind to the active session.</span>
                        </div>

                        <Button
                          type="submit"
                          variant="primary"
                          disabled={sessionSaving}
                          className="shrink-0"
                        >
                          {sessionSaving ? (
                            'Saving...'
                          ) : sessionSavedSuccess ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-white" />
                              Saved Successfully!
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Save Session Cycle
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Card>

                  {/* Additional Academic Settings */}
                  {currentCategorySettings.filter(s => !s.setting_key.startsWith('academic_session_start_month') && !s.setting_key.startsWith('academic_session_end_month')).length > 0 && (
                    <Card title="Additional Academic Parameters">
                      <div className="divide-y divide-slate-100">
                        {currentCategorySettings
                          .filter(s => !s.setting_key.startsWith('academic_session_start_month') && !s.setting_key.startsWith('academic_session_end_month'))
                          .map(s => renderSettingRow(s))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* GENERAL & LOCALIZATION PANEL */}
              {activeCategory === 'GENERAL' && (
                <div className="space-y-5">
                  {/* Centralized Currency & Regional Localization */}
                  <Card className="border-teal-200 bg-linear-to-br from-teal-50/50 via-white to-slate-50">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-teal-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-teal-50 text-teal-800 rounded-lg">
                            <Globe className="w-4 h-4" />
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">
                            General & Localization Settings
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 max-w-xl">
                          Configure institutional currency, currency symbol positioning, decimal precision, timezone, and calendar date formats. Used across all fee structures, invoices, and reports.
                        </p>
                      </div>

                      {/* Live Formatting Preview Pill */}
                      <div className="bg-white border border-teal-200 px-4 py-3 rounded-xl shadow-xs shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <Eye className="w-3 h-3 text-teal-600" />
                          Live Display Preview
                        </div>
                        <div className="text-lg font-black text-teal-800 tracking-tight mt-0.5">
                          {formatCurrency(125450.75, {
                            symbol: locData.currency_symbol,
                            position: locData.currency_position,
                            decimalPlaces: locData.decimal_places,
                            locale: locData.locale,
                          })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                          <span>{locData.currency}</span>
                          <span>•</span>
                          <span>{locData.date_format}</span>
                          <span>•</span>
                          <span>{locData.timezone}</span>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleSaveLocalization} className="pt-4 space-y-4">
                      {/* Currency Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Currency Code & Preset */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Currency Preset *
                          </label>
                          <Select
                            value={locData.currency}
                            onChange={e => handleCurrencyPresetChange(e.target.value)}
                            options={[
                              ...CURRENCY_PRESETS.map(c => ({ value: c.code, label: c.label })),
                              { value: 'OTHER', label: 'Other / Custom Currency' },
                            ]}
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            Standard ISO 4217 Currency Code.
                          </p>
                        </div>

                        {/* Currency Symbol */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Currency Symbol *
                          </label>
                          <Input
                            value={locData.currency_symbol}
                            onChange={e => setLocData({ ...locData, currency_symbol: e.target.value })}
                            placeholder="e.g. ₹ or $"
                            required
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            Symbol rendered on cards, receipts & statements.
                          </p>
                        </div>

                        {/* Symbol Position */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Symbol Position *
                          </label>
                          <Select
                            value={locData.currency_position}
                            onChange={e => setLocData({ ...locData, currency_position: e.target.value as 'BEFORE' | 'AFTER' })}
                            options={[
                              { value: 'BEFORE', label: 'Before Amount (e.g. ₹ 100.00)' },
                              { value: 'AFTER', label: 'After Amount (e.g. 100.00 €)' },
                            ]}
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            Placement relative to the numerical quantity.
                          </p>
                        </div>

                        {/* Decimal Places */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Decimal Places *
                          </label>
                          <Select
                            value={String(locData.decimal_places)}
                            onChange={e => setLocData({ ...locData, decimal_places: parseInt(e.target.value, 10) })}
                            options={[
                              { value: '0', label: '0 (e.g. ₹ 1,000)' },
                              { value: '2', label: '2 (Standard e.g. ₹ 1,000.00)' },
                              { value: '3', label: '3 (e.g. ₹ 1,000.000)' },
                              { value: '4', label: '4 (e.g. ₹ 1,000.0000)' },
                            ]}
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            Monetary fractional digits precision.
                          </p>
                        </div>
                      </div>

                      {/* Regional Formats Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 border-t border-slate-100">
                        {/* Date Format */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Date Format *
                          </label>
                          <Select
                            value={locData.date_format}
                            onChange={e => setLocData({ ...locData, date_format: e.target.value })}
                            options={DATE_FORMATS}
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            Default date presentation format.
                          </p>
                        </div>

                        {/* Time Format */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Time Format *
                          </label>
                          <Select
                            value={locData.time_format}
                            onChange={e => setLocData({ ...locData, time_format: e.target.value })}
                            options={TIME_FORMATS}
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            12-Hour (AM/PM) or 24-Hour clock.
                          </p>
                        </div>

                        {/* Timezone */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            System Timezone *
                          </label>
                          <Select
                            value={locData.timezone}
                            onChange={e => setLocData({ ...locData, timezone: e.target.value })}
                            options={TIMEZONES}
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            School operational timezone.
                          </p>
                        </div>

                        {/* Number Locale */}
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Number Formatting Locale *
                          </label>
                          <Input
                            value={locData.locale}
                            onChange={e => setLocData({ ...locData, locale: e.target.value })}
                            placeholder="en-IN, en-US, de-DE, etc."
                            required
                          />
                          <p className="text-[11px] text-slate-400 mt-1">
                            BCP 47 language tag for grouping separators.
                          </p>
                        </div>
                      </div>

                      {/* Non-Destructive Ledger Notice */}
                      <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-teal-900">
                        <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Zero Historical Conversion Guarantee:</span> Previous fee payments, invoice vouchers, asset ledgers, and transactions retain their exact numerical ledger values. Changing currency settings updates UI rendering and voucher notation without recalculating accounting data.
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="text-[11px] text-slate-400">
                          Changes apply instantaneously across all school staff and parent interfaces.
                        </div>

                        <Button
                          type="submit"
                          variant="primary"
                          disabled={locSaving}
                          className="shrink-0"
                        >
                          {locSaving ? (
                            'Saving...'
                          ) : locSavedSuccess ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-white" />
                              Saved & Applied!
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Save General & Localization
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Card>

                  {/* Navigation Presentation Mode Card */}
                  <Card title="Navigation & Workspace Layout Mode">
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">
                        Choose your preferred navigation presentation style. Controlled strictly from Settings — clicking a module opens it without altering or locking your navigation mode.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div
                          onClick={() => handleNavModeChange('hover_dual_rail')}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                            navMode === 'hover_dual_rail'
                              ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold text-xs">
                            <span>Hover Flyout Mode</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold">Default</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Permanent 68px icon rail. Submenus appear as an opaque floating panel on hover and do not affect workspace width.
                          </p>
                        </div>

                        <div
                          onClick={() => handleNavModeChange('expanded_sidebar')}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                            navMode === 'expanded_sidebar'
                              ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="font-bold text-xs">
                            Expanded Menu Mode
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Permanent ~250px categorized sidebar. Module groups expand/collapse inside the sidebar and the workspace reserves the sidebar width.
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Additional General Settings */}
                  {currentCategorySettings.filter(s => !localizationMirroredKeys.includes(s.setting_key)).length > 0 && (
                    <Card title="Additional General Parameters">
                      <div className="divide-y divide-slate-100">
                        {currentCategorySettings
                          .filter(s => !localizationMirroredKeys.includes(s.setting_key))
                          .map(s => renderSettingRow(s))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* OTHER CATEGORIES PANEL */}
              {activeCategory !== 'ACADEMIC' && activeCategory !== 'GENERAL' && (
                <Card
                  title={categories.find(c => c.key === activeCategory)?.label || 'Category Settings'}
                  description={categories.find(c => c.key === activeCategory)?.description}
                >
                  {currentCategorySettings.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No parameters configured in this category yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {currentCategorySettings.map(s => renderSettingRow(s))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function renderSettingRow(s: SchoolSetting) {
    const isSaving = savingKey === s.setting_key;
    const isSaved = savedSuccessKey === s.setting_key;

    return (
      <div key={s.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 max-w-sm">
          <div className="text-xs font-semibold text-slate-800">
            {formatSettingKey(s.setting_key)}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
            {s.setting_key}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-80">
          <Input
            value={formValues[s.setting_key] ?? ''}
            onChange={e => setFormValues({ ...formValues, [s.setting_key]: e.target.value })}
            placeholder="Configuration value"
            className="flex-1"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={isSaving}
            onClick={() => handleSaveSetting(s.setting_key, s.category, s.data_type)}
            className="shrink-0"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : isSaved ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
    );
  }

  function formatSettingKey(key: string): string {
    return key
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
};
