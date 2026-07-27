import React from 'react';
import { useAuth } from '../context/AuthContext';

interface NavBarProps {
  onLogoClick: () => void;
  onLogout: () => void;
  onManageUsers?: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({ onLogoClick, onLogout, onManageUsers }) => {
  const { user } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div
            onClick={onLogoClick}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none shrink-0 min-w-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-400 to-emerald-400 via-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/10">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 6a2 2 0 012-2h6a2 2 0 012 2v14H5V6zm3 3h4v3H8V9zm8 2h1.5a1.5 1.5 0 011.5 1.5v3.75c0 .966.534 1.75 1.25 1.75s1.25-.784 1.25-1.75V6M3 20h14" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-emerald-400 via-emerald-600 bg-clip-text text-transparent font-display whitespace-nowrap">
              PumpKhata
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {user && (
              <div className="flex items-center gap-2 sm:gap-3">
                {user.role === 'super_admin' && onManageUsers && (
                  <button
                    onClick={onManageUsers}
                    className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
                    title="User Management"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
                <div className="h-4 w-px bg-slate-300 mx-1"></div>
              </div>
            )}
            <button
              onClick={onLogout}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 hover:border-slate-300 bg-white px-2 sm:px-3 py-1.5 rounded-xl shadow-sm cursor-pointer whitespace-nowrap"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
