// ========================================================================
// WorkspaceContext (Multitasking Workspace Architecture)
// Supports up to 10 concurrently open tabs with state preservation
// Provides clean overflow modal when 11th module is attempted
// ========================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { WorkspaceTab } from '../types/index.js';

const MAX_WORKSPACE_TABS = 10;

interface PendingTabRequest {
  moduleKey: string;
  title: string;
  icon: string;
  params?: Record<string, any>;
  initialState?: Partial<WorkspaceTab['state']>;
}

interface WorkspaceContextType {
  tabs: WorkspaceTab[];
  activeTabId: string;
  isOverflowModalOpen: boolean;
  pendingTab: PendingTabRequest | null;
  maxTabs: number;
  openTab: (
    moduleKey: string,
    title: string,
    icon: string,
    params?: Record<string, any>,
    initialState?: Partial<WorkspaceTab['state']>
  ) => void;
  closeTab: (tabId: string) => void;
  activateTab: (tabId: string) => void;
  updateTabState: (tabId: string, partialState: Partial<WorkspaceTab['state']>) => void;
  resolveOverflowReplace: (tabIdToReplace: string) => void;
  cancelOverflow: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const DEFAULT_TAB: WorkspaceTab = {
  id: 'tab-dashboard',
  moduleKey: 'dashboard',
  title: 'Dashboard',
  icon: 'LayoutDashboard',
  state: {},
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([DEFAULT_TAB]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-dashboard');
  const [isOverflowModalOpen, setIsOverflowModalOpen] = useState<boolean>(false);
  const [pendingTab, setPendingTab] = useState<PendingTabRequest | null>(null);

  const openTab = (
    moduleKey: string,
    title: string,
    icon: string,
    params?: Record<string, any>,
    initialState?: Partial<WorkspaceTab['state']>
  ) => {
    // Check if matching tab already exists
    const existingIndex = tabs.findIndex(
      t => t.moduleKey === moduleKey && JSON.stringify(t.params || {}) === JSON.stringify(params || {})
    );

    if (existingIndex !== -1) {
      // Activate existing tab
      setActiveTabId(tabs[existingIndex].id);
      return;
    }

    // Check if we reached the maximum 8 tabs
    if (tabs.length >= MAX_WORKSPACE_TABS) {
      // Trigger overflow modal
      setPendingTab({
        moduleKey,
        title,
        icon,
        params,
        initialState,
      });
      setIsOverflowModalOpen(true);
      return;
    }

    // Create new tab
    const newTabId = `tab-${moduleKey}-${Date.now()}`;
    const newTab: WorkspaceTab = {
      id: newTabId,
      moduleKey,
      title,
      icon,
      params,
      state: initialState || {},
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  const closeTab = (tabId: string) => {
    // Don't close if only 1 tab left (unless it gets replaced)
    if (tabs.length <= 1) return;

    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    // If closing active tab, switch to adjacent tab
    if (activeTabId === tabId) {
      const nextIndex = Math.max(0, tabIndex - 1);
      setActiveTabId(newTabs[nextIndex].id);
    }
  };

  const activateTab = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const updateTabState = (tabId: string, partialState: Partial<WorkspaceTab['state']>) => {
    setTabs(prev =>
      prev.map(tab => {
        if (tab.id === tabId) {
          return {
            ...tab,
            state: {
              ...tab.state,
              ...partialState,
            },
          };
        }
        return tab;
      })
    );
  };

  const resolveOverflowReplace = (tabIdToReplace: string) => {
    if (!pendingTab) return;

    const newTabId = `tab-${pendingTab.moduleKey}-${Date.now()}`;
    const newTab: WorkspaceTab = {
      id: newTabId,
      moduleKey: pendingTab.moduleKey,
      title: pendingTab.title,
      icon: pendingTab.icon,
      params: pendingTab.params,
      state: pendingTab.initialState || {},
    };

    setTabs(prev => prev.map(t => (t.id === tabIdToReplace ? newTab : t)));
    setActiveTabId(newTabId);
    setIsOverflowModalOpen(false);
    setPendingTab(null);
  };

  const cancelOverflow = () => {
    setIsOverflowModalOpen(false);
    setPendingTab(null);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        tabs,
        activeTabId,
        isOverflowModalOpen,
        pendingTab,
        maxTabs: MAX_WORKSPACE_TABS,
        openTab,
        closeTab,
        activateTab,
        updateTabState,
        resolveOverflowReplace,
        cancelOverflow,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
