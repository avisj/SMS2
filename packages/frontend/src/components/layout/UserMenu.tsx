// ========================================================================
// UserMenu Component
// Profile details, assigned roles, permissions count, and logout
// ========================================================================

import React, { useState, useRef } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { Badge } from '../common/Badge.js';
import { FloatingPortal } from '../common/FloatingPortal.js';

export const UserMenu: React.FC = () => {
  const { userContext, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!userContext) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs">
          {userContext.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="hidden md:block text-left">
          <div className="text-xs font-semibold text-slate-800 leading-tight">
            {userContext.username}
          </div>
          <div className="text-[10px] text-slate-500 capitalize">
            {userContext.user_type_code.toLowerCase().replace('_', ' ')}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      <FloatingPortal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        width={280}
      >
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="font-semibold text-xs text-slate-900">{userContext.username}</div>
          <div className="text-[11px] text-slate-500 truncate">{userContext.email}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {userContext.roles.map(r => (
              <Badge key={r.id} variant="primary" size="sm">
                {r.name}
              </Badge>
            ))}
            {userContext.is_super_admin && (
              <Badge variant="indigo" size="sm">
                Platform Admin
              </Badge>
            )}
          </div>
        </div>

        <div className="px-4 py-2 border-b border-slate-100 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">School:</span>
            <span className="font-medium text-slate-700 truncate max-w-[150px]">
              {userContext.school_name || 'Global Platform'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Effective Permissions:</span>
            <span className="font-mono text-slate-700">
              {userContext.is_super_admin ? 'Full Access' : `${userContext.permissions.length} granted`}
            </span>
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors font-medium rounded-b-xl"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </FloatingPortal>
    </>
  );
};
