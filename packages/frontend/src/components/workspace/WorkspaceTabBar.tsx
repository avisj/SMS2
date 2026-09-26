// ========================================================================
// WorkspaceTabBar Component
// Renders active tabs / bubbles (up to 10) with quick switching, overflow, & close
// ========================================================================

import React, { useState, useRef, useEffect } from 'react';
import { X, Layers, ChevronDown, Check } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { IconHelper } from '../common/IconHelper.js';
import { FloatingPortal } from '../common/FloatingPortal.js';

export const WorkspaceTabBar: React.FC = () => {
  const { tabs, activeTabId, activateTab, closeTab, maxTabs } = useWorkspace();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view when activeTabId changes
  useEffect(() => {
    const activeEl = scrollContainerRef.current?.querySelector(`[data-tab-id="${activeTabId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  return (
    <div className="bg-white border-b border-slate-200 px-3 md:px-4 flex items-center justify-between gap-2 select-none shadow-2xs relative z-10">
      {/* Scrollable Tabs Row */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1.5 py-1.5 overflow-x-auto min-w-0 flex-1 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => activateTab(tab.id)}
              className={`group shrink-0 flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                isActive
                  ? 'bg-teal-50 border-teal-300 text-teal-900 shadow-xs font-semibold ring-1 ring-teal-200/50'
                  : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-teal-50/60 hover:border-teal-200/60 hover:text-teal-900'
              }`}
            >
              {isActive ? (
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
              ) : null}
              <span className={`shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600'}`}>
                <IconHelper name={tab.icon} className="w-3.5 h-3.5" />
              </span>
              <span className="truncate max-w-[110px] sm:max-w-[135px]">{tab.title}</span>

              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 transition-colors opacity-70 group-hover:opacity-100 shrink-0"
                  title="Close module"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Tab Switcher & Count Indicator */}
      <div className="shrink-0 flex items-center gap-1">
        {/* Quick Dropdown Toggle for Many Tabs */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsDropdownOpen(prev => !prev)}
          className={`flex items-center gap-1 py-1 px-2 rounded-md text-xs font-medium transition-colors border ${
            isDropdownOpen
              ? 'bg-teal-50 border-teal-200 text-teal-900'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="List all open tabs"
        >
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-mono">{tabs.length}/{maxTabs}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180 text-teal-600' : 'text-slate-400'}`} />
        </button>

        {/* Dropdown Menu rendered via Portal */}
        <FloatingPortal
          isOpen={isDropdownOpen}
          onClose={() => setIsDropdownOpen(false)}
          triggerRef={triggerRef}
          width={260}
        >
          <div className="px-3.5 py-2 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Open Workspaces</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
              {tabs.length} of {maxTabs}
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {tabs.map(tab => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => {
                    activateTab(tab.id);
                    setIsDropdownOpen(false);
                  }}
                  className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-teal-50 text-teal-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className={`shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-400'}`}>
                      <IconHelper name={tab.icon} className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate">{tab.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isActive && <Check className="w-3.5 h-3.5 text-teal-600" />}
                    {tabs.length > 1 && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          closeTab(tab.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                        title="Close tab"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500 rounded-b-xl flex items-center justify-between">
            <span>Multitasking Workspace</span>
            <span className="font-mono font-medium text-teal-900 font-semibold">{tabs.length} / {maxTabs} open</span>
          </div>
        </FloatingPortal>
      </div>
    </div>
  );
};
