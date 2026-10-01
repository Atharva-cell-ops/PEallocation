import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, GraduationCap, ShieldCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            {user.role === 'ADMIN' ? <ShieldCheck className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight">ElectiveHub</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase">
              {user.role}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">
              {user.student ? user.student.name : 'Administrator'}
            </p>
            <p className="text-xs text-slate-500">
              {user.student ? `${user.student.rollNumber} • ${user.student.department}` : user.email}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex items-center space-x-1.5 text-sm text-slate-600 hover:text-rose-600 font-medium px-3 py-1.5 rounded-md hover:bg-slate-100 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
