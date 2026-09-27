// ========================================================================
// LoginScreen Component
// Modern SaaS Sign-in with multi-persona test accounts selector
// ========================================================================

import React, { useState } from 'react';
import { School, Lock, ArrowRight, UserCheck, Shield, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { Button } from '../common/Button.js';
import { Input } from '../common/Input.js';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [schoolId, setSchoolId] = useState('DPA-DEL-001');
  const [userId, setUserId] = useState('rajesh.sharma');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(schoolId.trim(), userId.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickSwitch = (sId: string, uId: string) => {
    setSchoolId(sId);
    setUserId(uId);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/30">
            <School className="w-6 h-6" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          eSchool
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Multi-Tenant School Management Platform • Foundation
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                SCHOOL ID
              </label>
              <Input
                required
                value={schoolId}
                onChange={e => setSchoolId(e.target.value)}
                placeholder="e.g. DPA-DEL-001"
                className="uppercase tracking-wide font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Unique identifier for your school campus context
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                USER ID
              </label>
              <Input
                required
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="e.g. rajesh.sharma"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                PASSWORD
              </label>
              <Input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              loading={loading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Workspace
            </Button>
          </form>

          {/* Quick Demo Personas */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Quick Test Personas:
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => quickSwitch('DPA-DEL-001', 'rajesh.sharma')}
                className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors flex items-center justify-between text-xs text-slate-700"
              >
                <div>
                  <span className="font-semibold text-slate-900">Rajesh Sharma</span>
                  <span className="text-[10px] text-teal-700 font-medium ml-1.5 bg-teal-50 px-1.5 py-0.5 rounded">
                    School A Director
                  </span>
                  <div className="text-[10px] text-slate-400">School ID: DPA-DEL-001</div>
                </div>
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => quickSwitch('DPA-DEL-001', 'sunita.rao')}
                className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors flex items-center justify-between text-xs text-slate-700"
              >
                <div>
                  <span className="font-semibold text-slate-900">Sunita Rao</span>
                  <span className="text-[10px] text-indigo-700 font-medium ml-1.5 bg-indigo-50 px-1.5 py-0.5 rounded">
                    Branch Admin
                  </span>
                  <div className="text-[10px] text-slate-400">School ID: DPA-DEL-001 (Delhi Main)</div>
                </div>
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => quickSwitch('GWI-MUM-001', 'anita.desai')}
                className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors flex items-center justify-between text-xs text-slate-700"
              >
                <div>
                  <span className="font-semibold text-slate-900">Anita Desai</span>
                  <span className="text-[10px] text-purple-700 font-medium ml-1.5 bg-purple-50 px-1.5 py-0.5 rounded">
                    School B Director
                  </span>
                  <div className="text-[10px] text-slate-400">School ID: GWI-MUM-001 (Mumbai)</div>
                </div>
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => quickSwitch('DPA-DEL-001', 'superadmin')}
                className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors flex items-center justify-between text-xs text-slate-700"
              >
                <div>
                  <span className="font-semibold text-slate-900">Delhi SuperAdmin</span>
                  <span className="text-[10px] text-amber-800 font-medium ml-1.5 bg-amber-50 px-1.5 py-0.5 rounded">
                    School Super Admin
                  </span>
                  <div className="text-[10px] text-slate-400">School ID: DPA-DEL-001 (Disaster Recovery)</div>
                </div>
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
