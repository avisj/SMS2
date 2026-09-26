// ========================================================================
// RoleRightsModule Component
// Dedicated Interactive Role-Rights Mapping Matrix
// M:N mapping between Role and Rights (Permissions) with Data Scopes
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Key,
  Save,
  CheckCircle2,
  Lock,
  RefreshCw,
  Sliders,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { Role, Permission, DataScope } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Select } from '../../components/common/Select.js';

interface RoleRightsModuleProps {
  tabId: string;
}

export const RoleRightsModule: React.FC<RoleRightsModuleProps> = () => {
  const { userContext } = useAuth();
  const { isSuperAdmin } = usePermission();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [dataScopes, setDataScopes] = useState<DataScope[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [rolePermissions, setRolePermissions] = useState<Map<string, string>>(new Map()); // permId -> scopeId
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesData, permsData, scopesData] = await Promise.all([
        api.get<Role[]>('/roles'),
        api.get<Permission[]>('/permissions'),
        api.get<DataScope[]>('/permissions/scopes'),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
      setDataScopes(scopesData);

      const targetId = selectedRoleId || rolesData[0]?.id || '';
      if (!selectedRoleId && targetId) {
        setSelectedRoleId(targetId);
      }

      if (targetId) {
        const activeRole = rolesData.find(r => r.id === targetId);
        const map = new Map<string, string>();
        activeRole?.permissions?.forEach(p => {
          map.set(p.id, p.scope?.id || scopesData[0]?.id || '');
        });
        setRolePermissions(map);
      }
    } catch (err) {
      console.error('Failed to load role-rights matrix data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userContext?.school_id]);

  useEffect(() => {
    if (selectedRoleId && roles.length > 0) {
      const activeRole = roles.find(r => r.id === selectedRoleId);
      const map = new Map<string, string>();
      activeRole?.permissions?.forEach(p => {
        map.set(p.id, p.scope?.id || dataScopes[0]?.id || '');
      });
      setRolePermissions(map);
      setSavedSuccess(false);
    }
  }, [selectedRoleId]);

  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const isSystemRole = selectedRole?.is_system && !isSuperAdmin;

  const toggleRight = (permId: string) => {
    if (isSystemRole) return;
    setRolePermissions(prev => {
      const next = new Map(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        const defaultScope = dataScopes[0]?.id || '';
        next.set(permId, defaultScope);
      }
      return next;
    });
  };

  const setRightScope = (permId: string, scopeId: string) => {
    if (isSystemRole) return;
    setRolePermissions(prev => {
      const next = new Map(prev);
      if (next.has(permId)) {
        next.set(permId, scopeId);
      }
      return next;
    });
  };

  const handleSaveMatrix = async () => {
    if (!selectedRoleId || isSystemRole) return;
    setSaving(true);
    try {
      const payload = Array.from(rolePermissions.entries()).map(([permId, scopeId]) => ({
        permissionId: permId,
        dataScopeId: scopeId,
      }));

      await api.put(`/roles/${selectedRoleId}/permissions`, {
        permissions: payload,
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save role-rights matrix');
    } finally {
      setSaving(false);
    }
  };

  // Group rights by module
  const modules = Array.from(new Set(permissions.map(p => p.module)));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            Role-Rights Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure which rights (permissions) are granted to each role, along with their granular data access scope.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="primary"
            disabled={isSystemRole || saving || !selectedRoleId}
            onClick={handleSaveMatrix}
          >
            {saving ? (
              'Saving...'
            ) : savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Role Rights
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Role Selector & Info Bar */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">Select Role:</span>
            <div className="w-64">
              <Select
                value={selectedRoleId}
                onChange={e => setSelectedRoleId(e.target.value)}
                options={roles.map(r => ({
                  value: r.id,
                  label: `${r.name} (${r.code})`,
                }))}
              />
            </div>
            {selectedRole?.is_system ? (
              <Badge variant="indigo" className="flex items-center gap-1">
                <Lock className="w-3 h-3" /> System Role
              </Badge>
            ) : (
              <Badge variant="slate">Custom Role</Badge>
            )}
          </div>

          <div className="text-xs font-medium text-slate-500">
            <span className="font-bold text-teal-700">{rolePermissions.size}</span> of {permissions.length} rights enabled
          </div>
        </div>

        {isSystemRole && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>This is a protected system template role. To customize permissions, create a custom role under Roles Master.</span>
          </div>
        )}
      </Card>

      {/* Rights Matrix by Module */}
      {loading ? (
        <Card>
          <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
            Loading role rights matrix...
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {modules.map(moduleName => {
            const modulePerms = permissions.filter(p => p.module === moduleName);
            const activeInModule = modulePerms.filter(p => rolePermissions.has(p.id)).length;

            return (
              <Card key={moduleName} className="overflow-hidden p-0">
                <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {moduleName} Module
                    </span>
                    <Badge variant={activeInModule > 0 ? 'teal' : 'slate'} className="text-[10px]">
                      {activeInModule} / {modulePerms.length}
                    </Badge>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {modulePerms.map(perm => {
                    const isChecked = rolePermissions.has(perm.id);
                    const currentScopeId = rolePermissions.get(perm.id) || dataScopes[0]?.id;

                    return (
                      <div
                        key={perm.id}
                        className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isChecked ? 'bg-teal-50/20' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            disabled={isSystemRole}
                            checked={isChecked}
                            onChange={() => toggleRight(perm.id)}
                            className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:opacity-50"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${isChecked ? 'text-slate-900' : 'text-slate-600'}`}>
                                {perm.name}
                              </span>
                              <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                                {perm.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {perm.description || `Permits ${perm.action} action on ${perm.module}`}
                            </div>
                          </div>
                        </div>

                        {isChecked && (
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <span className="text-[11px] font-semibold text-slate-500">Data Scope:</span>
                            <div className="w-48">
                              <Select
                                disabled={isSystemRole}
                                value={currentScopeId}
                                onChange={e => setRightScope(perm.id, e.target.value)}
                                options={dataScopes.map(s => ({
                                  value: s.id,
                                  label: s.name,
                                }))}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
