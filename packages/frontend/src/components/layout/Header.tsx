// ========================================================================
// Header Component
// Top navigation bar with active tenant context & branch switcher
// ========================================================================

import React, { useEffect, useState } from 'react';
import { School, Building2, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { api } from '../../api/client.js';
import { BranchSelector } from './BranchSelector.js';
import { UserMenu } from './UserMenu.js';
import { Badge } from '../common/Badge.js';

export const Header: React.FC = () => {
  const { userContext } = useAuth();
  const { openTab } = useWorkspace();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const checkUnread = async () => {
      try {
        const res = await api.get<any[]>('/communication/inbox/me', { readStatus: 'UNREAD' });
        if (Array.isArray(res)) {
          setUnreadCount(res.length);
        }
      } catch (err) {
        // quiet fallback
      }
    };
    checkUnread();
  }, []);

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 sticky top-0 z-40 shadow-2xs">
      {/* Left: Active School & Tenant Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            <School className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs md:text-sm text-slate-900 leading-tight">
                {userContext?.school_name || 'eSchool Platform'}
              </span>
              {userContext?.school_code && (
                <Badge variant="primary" size="sm">
                  {userContext.school_code}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Notifications, Branch Switcher & User Menu */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button
          onClick={() => openTab('communication_inbox', 'My Messages & Inbox', 'Inbox')}
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Open Communication Inbox"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-teal-600 ring-2 ring-white"></span>
          )}
        </button>

        <div className="h-5 w-px bg-slate-200" />
        <BranchSelector />
        <div className="h-5 w-px bg-slate-200" />
        <UserMenu />
      </div>
    </header>
  );
};
