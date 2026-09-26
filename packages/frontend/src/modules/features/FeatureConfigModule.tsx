// ========================================================================
// FeatureConfigModule
// Dynamic Feature Flags & Module Configuration
// ZERO hardcoded module lists - loaded from platform features catalog
// ========================================================================

import React, { useEffect, useState } from 'react';
import { ToggleRight, Check, X, Shield, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { SchoolFeature } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';

interface FeatureConfigModuleProps {
  tabId: string;
}

export const FeatureConfigModule: React.FC<FeatureConfigModuleProps> = ({ tabId: _tabId }) => {
  const { userContext } = useAuth();
  const { hasPermission } = usePermission();

  const [features, setFeatures] = useState<SchoolFeature[]>([]);
  const [platformCatalog, setPlatformCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeatures = async () => {
    setLoading(true);
    try {
      const [featData, catalogData] = await Promise.all([
        api.get<SchoolFeature[]>('/config/features'),
        api.get<{ features: any[] }>('/config/platform-catalog'),
      ]);
      setFeatures(featData);
      setPlatformCatalog(catalogData.features);
    } catch (err) {
      console.error('Failed to load feature flags', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeatures();
  }, [userContext?.school_id]);

  const handleToggle = async (key: string, currentEnabled: boolean, config: any) => {
    try {
      await api.put(`/config/features/${key}`, {
        isEnabled: !currentEnabled,
        configuration: config || {},
      });
      loadFeatures();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle feature');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ToggleRight className="w-5 h-5 text-teal-600" />
          School Module Feature Flags
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Enable or disable modular subsystems (Admissions, Fees, Attendance, WhatsApp, Transport) dynamically.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">
          Loading features catalog...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {platformCatalog.map(pf => {
            const schoolFeat = features.find(sf => sf.feature_key === pf.feature_key);
            const isEnabled = schoolFeat ? schoolFeat.is_enabled : false;

            return (
              <Card key={pf.id} className="hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{pf.name}</h4>
                      <Badge variant={pf.plan_tier === 'ENTERPRISE' ? 'purple' : pf.plan_tier === 'PREMIUM' ? 'indigo' : 'slate'} size="sm">
                        {pf.plan_tier}
                      </Badge>
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 mt-0.5">{pf.feature_key}</div>
                  </div>

                  <button
                    disabled={!hasPermission('features.manage')}
                    onClick={() => handleToggle(pf.feature_key, isEnabled, schoolFeat?.configuration)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isEnabled ? 'bg-teal-600' : 'bg-slate-200'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 mt-1">{pf.description}</p>

                {schoolFeat?.configuration && Object.keys(schoolFeat.configuration).length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Module Config:
                    </span>
                    <pre className="text-[11px] font-mono bg-slate-50 p-2 rounded-md mt-1 text-slate-600 overflow-x-auto">
                      {JSON.stringify(schoolFeat.configuration, null, 2)}
                    </pre>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
