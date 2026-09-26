// ========================================================================
// RolesPermissionsModule
// Configurable Role-Permission Matrices & Data Scopes
// ZERO hardcoded business configuration
// ========================================================================

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Check, X, Layers, Lock, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { Role, Permission, DataScope } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';
import { Select } from '../../components/common/Select.js';

interface RolesPermissionsModuleProps {
  tabId: string;
}

export const RolesPermissionsModule: React.FC<RolesPermissionsModuleProps> = ({ tabId: _tabId }) => {
  const { userContext } = useAuth();
  const { hasPermission } = usePermission();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [dataScopes, setDataScopes] = useState<DataScope[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // Create role modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({ code: '', name: '', description: '' });
  const [createSubmitting, setCreateSubmitting] = useState(false);

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

      if (!selectedRole && rolesData.length > 0) {
        setSelectedRole(rolesData[0]);
      } else if (selectedRole) {
        const refreshed = rolesData.find(r => r.id === selectedRole.id);
        if (refreshed) setSelectedRole(refreshed);
      }
    } catch (err) {
      console.error('Failed to load RBAC configuration', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      const created = await api.post<Role>('/roles', newRoleForm);
      setIsCreateOpen(false);
      setNewRoleForm({ code: '', name: '', description: '' });
      await loadData();
      setSelectedRole(created);
    } catch (err: any) {
      alert(err.message || 'Failed to create role');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleTogglePermission = async (permId: string, currentScopeId?: string) => {
    if (!selectedRole) return;
    if (selectedRole.is_system && !userContext?.is_super_admin) {
      alert('System template roles cannot be altered by school administrators. Create a custom role to customize permissions.');
      return;
    }

    const hasIt = selectedRole.permissions?.some(p => p.id === permId);

    try {
      if (hasIt) {
        // Revoke
        await api.delete(`/roles/${selectedRole.id}/permissions/${permId}`);
      } else {
        // Assign with default or first scope
        const scopeToUse = currentScopeId || dataScopes[0]?.id;
        await api.post(`/roles/${selectedRole.id}/permissions`, {
          permissionId: permId,
          dataScopeId: scopeToUse,
        });
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update role permission');
    }
  };

  const handleUpdateScope = async (permId: string, newScopeId: string) => {
    if (!selectedRole) return;
    if (selectedRole.is_system && !userContext?.is_super_admin) {
      alert('System template roles cannot be altered.');
      return;
    }
    try {
      await api.post(`/roles/${selectedRole.id}/permissions`, {
        permissionId: permId,
        dataScopeId: newScopeId,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update scope');
    }
  };

  // Group master permissions by module
  const permsByModule = permissions.reduce((acc, perm) => {
    acc[perm.module] = acc[perm.module] || [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            Roles & Permission Scopes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable role-based access control with granular data scoping (school, multi-branch, classroom).
          </p>
        </div>

        {hasPermission('roles.manage') && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Create Custom Role
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Roles List Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Configured Roles ({roles.length})
          </div>
          <div className="space-y-1.5">
            {roles.map(r => {
              const isSelected = selectedRole?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRole(r)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/80 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-xs text-slate-900">{r.name}</div>
                    {r.is_system ? (
                      <Badge variant="slate" size="sm">
                        <Lock className="w-2.5 h-2.5 mr-1" /> Template
                      </Badge>
                    ) : (
                      <Badge variant="indigo" size="sm">
                        Custom
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">{r.description}</div>
                  <div className="text-[10px] text-teal-700 font-mono mt-2">
                    {r.permissions?.length || 0} permissions assigned
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Permission Matrix Editor */}
        <div className="lg:col-span-3">
          {selectedRole ? (
            <Card
              title={`Permission Matrix: ${selectedRole.name}`}
              description={selectedRole.description || 'Module permissions and operational scopes'}
              headerAction={
                selectedRole.is_system ? (
                  <Badge variant="amber">
                    <Lock className="w-3 h-3 mr-1" /> System Role (Protected)
                  </Badge>
                ) : (
                  <Badge variant="emerald">
                    Custom School Role (Editable)
                  </Badge>
                )
              }
            >
              <div className="space-y-6">
                {Object.entries(permsByModule).map(([moduleName, modulePerms]) => (
                  <div key={moduleName} className="border border-slate-200/80 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
                        {moduleName} Module
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {modulePerms.length} actions
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {modulePerms.map(perm => {
                        const assignedMapping = selectedRole.permissions?.find(p => p.code === perm.code);
                        const isGranted = !!assignedMapping;

                        return (
                          <div
                            key={perm.id}
                            className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                disabled={selectedRole.is_system && !userContext?.is_super_admin}
                                onClick={() => handleTogglePermission(perm.id, assignedMapping?.scope?.id)}
                                className={`w-5 h-5 rounded flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                                  isGranted
                                    ? 'bg-teal-600 text-white'
                                    : 'border border-slate-300 bg-white hover:border-slate-400'
                                }`}
                              >
                                {isGranted && <Check className="w-3.5 h-3.5" />}
                              </button>
                              <div>
                                <div className="text-xs font-semibold text-slate-900">{perm.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{perm.code} • {perm.description}</div>
                              </div>
                            </div>

                            {isGranted && (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-slate-400 font-medium">Data Scope:</span>
                                <select
                                  disabled={selectedRole.is_system && !userContext?.is_super_admin}
                                  value={assignedMapping.scope.id}
                                  onChange={e => handleUpdateScope(perm.id, e.target.value)}
                                  className="text-xs border border-slate-200 rounded-md py-1 px-2 bg-white text-slate-700 font-medium focus:ring-teal-500 focus:border-teal-500"
                                >
                                  {dataScopes.map(ds => (
                                    <option key={ds.id} value={ds.id}>
                                      {ds.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-12 text-slate-400 text-xs">
                Select a role from the left to view and configure permissions.
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create Custom Role Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Custom School Role"
        subtitle="Define a custom role such as Exam Coordinator, Admission Officer, or Accountant."
      >
        <form onSubmit={handleCreateRole} className="space-y-4">
          <Input
            label="Role Code (Identifier)"
            required
            placeholder="e.g. ADMISSION_OFFICER"
            value={newRoleForm.code}
            onChange={e => setNewRoleForm({ ...newRoleForm, code: e.target.value.toUpperCase() })}
            helperText="Uppercase alphanumeric string"
          />
          <Input
            label="Role Display Name"
            required
            placeholder="e.g. Admission Officer"
            value={newRoleForm.name}
            onChange={e => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
          />
          <Input
            label="Description"
            placeholder="e.g. Handles student onboarding, document verification, and seat allocation."
            value={newRoleForm.description}
            onChange={e => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
          />

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={createSubmitting}>
              Create Role
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
