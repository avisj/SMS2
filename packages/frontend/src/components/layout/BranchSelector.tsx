// ========================================================================
// BranchSelector Component
// Dropdown to switch active branch location seamlessly
// ========================================================================

import React, { useState, useRef } from 'react';
import { MapPin, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { FloatingPortal } from '../common/FloatingPortal.js';

export const BranchSelector: React.FC = () => {
  const { branches, activeBranch, switchBranch, userContext } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!userContext?.school_id || branches.length === 0) {
    return null;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        <span className="truncate max-w-[150px]">
          {activeBranch ? activeBranch.location_name : 'Select Branch'}
        </span>
        {branches.length > 1 && <ChevronDown className="w-3 h-3 text-slate-400" />}
      </button>

      {branches.length > 1 && (
        <FloatingPortal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          triggerRef={triggerRef}
          width={240}
        >
          <div className="px-3 py-2 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Switch Branch Location
          </div>
          <div className="py-1 max-h-56 overflow-y-auto">
            {branches.map(b => {
              const isSelected = activeBranch?.id === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    switchBranch(b.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="font-medium">{b.location_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{b.location_code}</div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};
