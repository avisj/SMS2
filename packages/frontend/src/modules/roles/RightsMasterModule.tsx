// ========================================================================
// RightsMasterModule Component
// Dedicated Rights Master Catalog (Rights = Permissions)
// ZERO hardcoded rights lists - dynamic catalog from API
// ========================================================================

import React, { useEffect, useState } from 'react';
import {
  Key,
  Search,
  RefreshCw,
  Filter,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../api/client.js';
import { Permission, DataScope } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';

interface RightsMasterModuleProps {
  tabId: string;
}

export const RightsMasterModule: React.FC<RightsMasterModuleProps> = () => {
  const [rights, setRights] = useState<Permission[]>([]);
  const [scopes, setScopes] = useState<DataScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const [rightsData, scopesData] = await Promise.all([
        api.get<Permission[]>('/permissions'),
        api.get<DataScope[]>('/permissions/scopes'),
      ]);
      setRights(rightsData);
      setScopes(scopesData);
    } catch (err) {
      console.error('Failed to load rights master catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const modules = ['ALL', ...Array.from(new Set(rights.map(r => r.module.toUpperCase())))];

  const filtered = rights.filter(r => {
    const matchesModule = selectedModule === 'ALL' || r.module.toUpperCase() === selectedModule;
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase())) ||
      r.action.toLowerCase().includes(search.toLowerCase());
    return matchesModule && matchesSearch;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Key className="w-5 h-5 text-teal-600" />
            Rights Master Catalog
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Catalog of granular operational rights (permissions) in the system. Roles are constructed from these rights.
          </p>
        </div>
        <Button variant="secondary" onClick={loadData}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rights by code, name, action or description..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {modules.map(mod => (
              <button
                key={mod}
                onClick={() => setSelectedModule(mod)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  selectedModule === mod
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mod}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Rights Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Right Name</th>
                <th className="py-3 px-4">Right Code</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Default Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Loading rights catalog...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No rights found matching filter.
                  </td>
                </tr>
              ) : (
                filtered.map(r => {
                  const scope = scopes.find(s => s.id === r.default_scope_id);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <Badge variant="slate">{r.module.toUpperCase()}</Badge>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {r.name}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-teal-700">
                        {r.code}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {r.action}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-sm">
                        {r.description || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="indigo">
                          {scope?.name || 'School / Tenant'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
