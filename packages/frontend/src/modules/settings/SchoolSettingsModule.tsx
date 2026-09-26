// ========================================================================
// SchoolSettingsModule
// Dynamic Structured School Configuration
// ZERO hardcoded settings - all fetched from database
// ========================================================================

import React, { useEffect, useState } from 'react';
import { Sliders, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { SchoolSetting } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';

interface SchoolSettingsModuleProps {
  tabId: string;
}

export const SchoolSettingsModule: React.FC<SchoolSettingsModuleProps> = ({ tabId: _tabId }) => {
  const { userContext } = useAuth();
  const { hasPermission } = usePermission();

  const [settings, setSettings] = useState<SchoolSetting[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedSuccessKey, setSavedSuccessKey] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.get<SchoolSetting[]>('/config/settings');
      setSettings(data);
      const values: Record<string, string> = {};
      for (const s of data) {
        values[s.setting_key] = s.setting_value;
      }
      setFormValues(values);
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [userContext?.school_id]);

  const handleSave = async (key: string, category: string, dataType: any) => {
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

  // Group settings by category
  const categorized = settings.reduce((acc, s) => {
    acc[s.category] = acc[s.category] || [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, SchoolSetting[]>);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Sliders className="w-5 h-5 text-teal-600" />
          Configurable School Settings
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Structured configuration parameters stored in the database. No school-specific hardcoded values.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">
          Loading school settings...
        </div>
      ) : settings.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-slate-400 text-xs">
            No settings found for this school.
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(categorized).map(([cat, catSettings]) => (
            <Card key={cat} title={`${cat} Configuration`}>
              <div className="space-y-4">
                {catSettings.map(s => {
                  const isSaving = savingKey === s.setting_key;
                  const isSaved = savedSuccessKey === s.setting_key;
                  return (
                    <div
                      key={s.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="sm:w-1/3">
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {s.setting_key}
                        </span>
                        <div className="text-[11px] text-slate-500 capitalize">
                          Type: {s.data_type.toLowerCase()}
                        </div>
                      </div>

                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={formValues[s.setting_key] ?? s.setting_value}
                          onChange={e =>
                            setFormValues({ ...formValues, [s.setting_key]: e.target.value })
                          }
                          disabled={!hasPermission('settings.manage')}
                        />

                        {hasPermission('settings.manage') && (
                          <Button
                            variant={isSaved ? 'secondary' : 'primary'}
                            size="sm"
                            loading={isSaving}
                            onClick={() => handleSave(s.setting_key, s.category, s.data_type)}
                          >
                            {isSaved ? (
                              <span className="flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Save className="w-3.5 h-3.5" /> Save
                              </span>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
