import React from 'react';
import { useAuth } from './context/AuthContext.js';
import { WorkspaceProvider } from './context/WorkspaceContext.js';
import { LoginScreen } from './components/auth/LoginScreen.js';
import { AppShell } from './components/layout/AppShell.js';

export const App: React.FC = () => {
  const { userContext, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs font-medium text-slate-300">Initializing School SaaS Workspace...</span>
        </div>
      </div>
    );
  }

  if (!userContext) {
    return <LoginScreen />;
  }

  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
};
