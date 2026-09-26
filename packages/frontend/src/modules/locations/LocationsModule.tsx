// ========================================================================
// LocationsModule (Branches Management)
// Multi-Branch Operations within School Tenant
// ========================================================================

import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Building2, Phone, Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { usePermission } from '../../hooks/usePermission.js';
import { api } from '../../api/client.js';
import { Location } from '../../types/index.js';
import { Card } from '../../components/common/Card.js';
import { Badge } from '../../components/common/Badge.js';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';
import { Input } from '../../components/common/Input.js';

interface LocationsModuleProps {
  tabId: string;
}

export const LocationsModule: React.FC<LocationsModuleProps> = ({ tabId: _tabId }) => {
  const { userContext, activeBranch, switchBranch } = useAuth();
  const { hasPermission } = usePermission();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    location_code: '',
    location_name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const data = await api.get<Location[]>('/locations');
      setLocations(data);
    } catch (err) {
      console.error('Failed to load locations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, [userContext?.school_id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/locations', form);
      setIsCreateOpen(false);
      setForm({
        location_code: '',
        location_name: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        phone: '',
        email: '',
      });
      loadLocations();
    } catch (err: any) {
      alert(err.message || 'Failed to create branch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-600" />
            School Branches & Locations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure multi-campus facilities, branch codes, and operational addresses.
          </p>
        </div>

        {hasPermission('locations.manage') && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateOpen(true)}
          >
            Add Branch Campus
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-slate-400 text-xs">
            Loading branches...
          </div>
        ) : locations.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-slate-400 text-xs">
            No branch locations found.
          </div>
        ) : (
          locations.map(loc => {
            const isActive = activeBranch?.id === loc.id;
            return (
              <Card
                key={loc.id}
                className={`transition-all ${
                  isActive ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/20' : 'hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{loc.location_name}</h4>
                      <Badge variant="slate" size="sm" className="font-mono mt-0.5">
                        {loc.location_code}
                      </Badge>
                    </div>
                  </div>
                  {isActive ? (
                    <Badge variant="primary" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Active Session
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => switchBranch(loc.id)}
                    >
                      Switch To
                    </Button>
                  )}
                </div>

                <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                  <p className="line-clamp-2 text-slate-500">{loc.address || 'No address provided'}</p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {[loc.city, loc.state, loc.pincode].filter(Boolean).join(', ')}
                  </p>
                  {loc.phone && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{loc.phone}</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Branch Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Branch Location"
        subtitle="Register a new campus or physical location for this school."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Branch Code"
              required
              placeholder="e.g. DEL-NORTH"
              value={form.location_code}
              onChange={e => setForm({ ...form, location_code: e.target.value.toUpperCase() })}
              helperText="Unique code within school"
            />
            <Input
              label="Campus Name"
              required
              placeholder="e.g. North Delhi Campus"
              value={form.location_name}
              onChange={e => setForm({ ...form, location_name: e.target.value })}
            />
          </div>

          <Input
            label="Street Address"
            placeholder="Plot 10, Sector 2"
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
          />

          <div className="grid grid-cols-3 gap-2">
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
            <Input
              label="Pincode"
              placeholder="110001"
              value={form.pincode}
              onChange={e => setForm({ ...form, pincode: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              placeholder="+91 11 2345 6789"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="branch@dpa.edu"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>
              Create Branch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
