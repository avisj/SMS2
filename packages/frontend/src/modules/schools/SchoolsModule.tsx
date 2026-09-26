// ========================================================================
// SchoolsModule (SaaS Super Admin Tenant Management)
// Platform Governance of Tenant Schools
// ========================================================================

import React, { useEffect, useState } from 'react';
import { Building, Plus, Globe, Mail, Phone, MapPin, CheckCircle } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { School } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface SchoolsModuleProps {
  tabId: string;
}

export const SchoolsModule: React.FC<SchoolsModuleProps> = ({ tabId: _tabId }) => {
  const { hasPermission, isSuperAdmin } = usePermission();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    school_code: '',
    school_name: '',
    legal_name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    state: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadSchools = async () => {
    setLoading(true);
    try {
      const data = await api.get<School[]>('/schools');
      setSchools(data);
    } catch (err) {
      console.error('Failed to load schools', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/schools', form);
      setIsCreateOpen(false);
      setForm({
        school_code: '',
        school_name: '',
        legal_name: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        city: '',
        state: '',
      });
      loadSchools();
    } catch (err: any) {
      alert(err.message || 'Failed to register school');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building className="w-5 h-5 text-brand-600" />
            School Tenants (SaaS Governance)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage educational institutions, subscription boundaries, and tenant keys.
          </p>
        </div>

        {isSuperAdmin && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Onboard New School
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-slate-400 text-xs">
            Loading tenant schools...
          </div>
        ) : schools.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-400 text-xs">
            No schools found.
          </div>
        ) : (
          schools.map(s => (
            <Card key={s.id} className="hover:border-brand-300 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{s.school_name}</h3>
                    <Badge variant="primary" size="sm" className="font-mono">
                      {s.school_code}
                    </Badge>
                  </div>
                  {s.legal_name && (
                    <p className="text-xs text-slate-400 mt-0.5">{s.legal_name}</p>
                  )}
                </div>
                <Badge variant={s.status === 'ACTIVE' ? 'emerald' : 'amber'} size="sm">
                  {s.status}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{s.email}</span>
                </div>
                {s.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{s.phone}</span>
                  </div>
                )}
                {s.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <a href={s.website} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                      {s.website}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{[s.city, s.state, s.country].filter(Boolean).join(', ')}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Onboard School Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Onboard New School Tenant"
        subtitle="Create an isolated tenant environment for a new school."
      >
        <form onSubmit={handleCreateSchool} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="School Code (Tenant Key)"
              required
              placeholder="e.g. DPS-RKP"
              value={form.school_code}
              onChange={e => setForm({ ...form, school_code: e.target.value.toUpperCase() })}
              helperText="Unique uppercase identifier"
            />
            <Input
              label="School Name"
              required
              placeholder="Delhi Public School"
              value={form.school_name}
              onChange={e => setForm({ ...form, school_name: e.target.value })}
            />
          </div>

          <Input
            label="Legal Entity Name"
            placeholder="Delhi Public Society Educational Trust"
            value={form.legal_name}
            onChange={e => setForm({ ...form, legal_name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Official Email"
              type="email"
              required
              placeholder="info@dps.edu"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Phone"
              placeholder="+91 11 2617 1234"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="City"
              placeholder="New Delhi"
              value={form.city}
              onChange={e => setForm({ ...form, city: e.target.value })}
            />
            <Input
              label="State"
              placeholder="Delhi"
              value={form.state}
              onChange={e => setForm({ ...form, state: e.target.value })}
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>
              Register School
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
