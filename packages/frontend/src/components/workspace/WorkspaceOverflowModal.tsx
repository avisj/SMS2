// ========================================================================
// WorkspaceOverflowModal Component
// Provides clear UX when user attempts to open an 11th concurrent module
// ========================================================================

import React from 'react';
import { Layers, AlertCircle, ArrowRight } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { IconHelper } from '../common/IconHelper.js';

export const WorkspaceOverflowModal: React.FC = () => {
  const {
    isOverflowModalOpen,
    tabs,
    activeTabId,
    pendingTab,
    resolveOverflowReplace,
    cancelOverflow,
    maxTabs,
  } = useWorkspace();

  if (!pendingTab) return null;

  return (
    <Modal
      isOpen={isOverflowModalOpen}
      onClose={cancelOverflow}
      title="Workspace Limit Reached"
      subtitle={`Maximum limit of ${maxTabs} open tabs reached. Select a module to replace or cancel.`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-950 block mb-0.5">Maximum limit of 10 open tabs reached.</span>
            <span>You are attempting to open </span>
            <strong className="font-semibold text-amber-950">"{pendingTab.title}"</strong>
            <span>. Please select an existing module to close and replace, or cancel.</span>
          </div>
        </div>

        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Select a module to replace:
          </div>
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => resolveOverflowReplace(tab.id)}
                className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition-colors group ${
                  isActive
                    ? 'border-teal-300 bg-teal-50/50 hover:bg-teal-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-600">
                    <IconHelper name={tab.icon} className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                      {tab.title}
                      {isActive && (
                        <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-normal">
                          Current Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-teal-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Replace</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={cancelOverflow}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => resolveOverflowReplace(activeTabId)}
          >
            Replace Current Active Tab
          </Button>
        </div>
      </div>
    </Modal>
  );
};
