// ========================================================================
// AuthContext
// Authentication state, user context, and multi-branch switching
// ========================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setApiAuthToken, setApiActiveBranchId } from '../api/client.js';
import { UserContext, Location } from '../types/index.js';

interface AuthContextType {
  userContext: UserContext | null;
  loading: boolean;
  branches: Location[];
  activeBranch: Location | null;
  login: (schoolId: string, userId: string, password: string) => Promise<void>;
  logout: () => void;
  switchBranch: (branchId: string) => Promise<void>;
  refreshContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [branches, setBranches] = useState<Location[]>([]);
  const [activeBranch, setActiveBranch] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranches = async (schoolId: string | null) => {
    if (!schoolId) {
      setBranches([]);
      setActiveBranch(null);
      return;
    }
    try {
      const list = await api.get<Location[]>('/locations', { school_id: schoolId });
      setBranches(list);
      return list;
    } catch (err) {
      console.error('Failed to load branches', err);
      return [];
    }
  };

  const refreshContext = async () => {
    try {
      const context = await api.get<UserContext>('/auth/me');
      setUserContext(context);
      setApiActiveBranchId(context.active_location_id || null);

      if (context.school_id) {
        const branchList = await fetchBranches(context.school_id);
        if (branchList && context.active_location_id) {
          const matched = branchList.find(b => b.id === context.active_location_id);
          setActiveBranch(matched || branchList[0] || null);
        } else if (branchList && branchList.length > 0) {
          setActiveBranch(branchList[0]);
        }
      }
    } catch (err) {
      console.warn('Session expired or invalid', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('sms_auth_token');
    if (savedToken) {
      setApiAuthToken(savedToken);
      refreshContext();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (schoolId: string, userId: string, password: string) => {
    const res = await api.post<{ token: string; context: UserContext }>('/auth/login', {
      schoolId,
      userId,
      password,
    });
    setApiAuthToken(res.token);
    setUserContext(res.context);
    setApiActiveBranchId(res.context.active_location_id || null);

    if (res.context.school_id) {
      const branchList = await fetchBranches(res.context.school_id);
      if (branchList && res.context.active_location_id) {
        const matched = branchList.find(b => b.id === res.context.active_location_id);
        setActiveBranch(matched || branchList[0] || null);
      } else if (branchList && branchList.length > 0) {
        setActiveBranch(branchList[0]);
      }
    }
  };

  const logout = () => {
    setApiAuthToken(null);
    setApiActiveBranchId(null);
    setUserContext(null);
    setBranches([]);
    setActiveBranch(null);
  };

  const switchBranch = async (branchId: string) => {
    const updated = await api.post<UserContext>('/auth/switch-branch', { locationId: branchId });
    setUserContext(updated);
    setApiActiveBranchId(branchId);
    const matched = branches.find(b => b.id === branchId);
    if (matched) setActiveBranch(matched);
  };

  return (
    <AuthContext.Provider
      value={{
        userContext,
        loading,
        branches,
        activeBranch,
        login,
        logout,
        switchBranch,
        refreshContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
