import React from 'react';
import { Search, UserCheck, Clock, Shield, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header({ title, subtitle, onSearch, searchQuery }) {
  const { user, switchUser } = useAuth();

  const demoAccounts = [
    { label: 'Admin (Marcus)', email: 'admin@arvo.com', role: 'ADMIN' },
    { label: 'Agent Lead (Meera)', email: 'meera@arvo.com', role: 'AGENT' },
    { label: 'Agent (Rohan)', email: 'rohan@arvo.com', role: 'AGENT' },
    { label: 'Customer (Rahul)', email: 'rahul@apexlogistics.com', role: 'CUSTOMER' },
  ];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      {/* Title & Context */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 font-normal">{subtitle}</p>}
      </div>

      {/* Middle & Right Tools */}
      <div className="flex items-center gap-4">
        {/* Working Schedule Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600 border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>Working Hours: Mon–Fri, 9:30 AM – 6:30 PM</span>
        </div>

        {/* Global Search Bar */}
        {onSearch && (
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tickets, IDs, subjects..."
              value={searchQuery || ''}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        )}

        {/* Quick Demo Role Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase px-2">Role:</span>
          {demoAccounts.map((acc) => {
            const isCurrent = user?.email === acc.email;
            return (
              <button
                key={acc.email}
                onClick={() => switchUser(acc.email)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title={`Switch to ${acc.label}`}
              >
                {acc.label.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
