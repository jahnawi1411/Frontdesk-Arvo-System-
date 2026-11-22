import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import TicketList from './pages/TicketList';
import TicketDetail from './pages/TicketDetail';
import CustomerPortal from './pages/CustomerPortal';
import AgentsView from './pages/AgentsView';
import AuditLogsView from './pages/AuditLogsView';
import SettingsView from './pages/SettingsView';
import { api } from './api';

export default function App() {
  const { user, loading, isCustomer, isStaff, isAdmin } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);

  // Load stats periodically for sidebar badge counters
  const refreshStats = async () => {
    if (isStaff) {
      try {
        const data = await api.getStats();
        setStats(data.summary);
      } catch (e) {
        // non-blocking
      }
    }
  };

  useEffect(() => {
    refreshStats();
  }, [currentView, selectedTicketId, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-300">Loading Frontdesk...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated -> Login Page
  if (!user) {
    return <Login />;
  }

  // Customer Portal -> Strictly isolated customer interface
  if (isCustomer) {
    return <CustomerPortal />;
  }

  // Staff / Admin Dashboard Experience
  const handleSelectTicket = (id) => {
    setSelectedTicketId(id);
    setCurrentView('detail');
  };

  const handleBackToList = () => {
    setSelectedTicketId(null);
    setCurrentView('all');
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Support Operations Dashboard';
      case 'all': return 'All Support Tickets';
      case 'my': return 'My Assigned Tickets';
      case 'unassigned': return 'Unassigned Queue';
      case 'waiting': return 'Waiting for Customer Feedback';
      case 'overdue': return 'Overdue SLA Breaches';
      case 'resolved': return 'Resolved Tickets';
      case 'detail': return `Ticket Detail: ${selectedTicketId || ''}`;
      case 'agents': return 'Support Agents & Workload';
      case 'audit-logs': return 'Immutable Audit Trail';
      case 'settings': return 'SLA & Schedule Settings';
      default: return 'Frontdesk';
    }
  };

  const renderViewContent = () => {
    if (currentView === 'detail' && selectedTicketId) {
      return (
        <TicketDetail
          ticketId={selectedTicketId}
          onBack={handleBackToList}
        />
      );
    }

    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            onSelectTicket={handleSelectTicket}
            onNavigateView={(view) => setCurrentView(view)}
          />
        );
      case 'all':
      case 'my':
      case 'unassigned':
      case 'waiting':
      case 'overdue':
      case 'resolved':
        return (
          <TicketList
            initialView={currentView}
            onSelectTicket={handleSelectTicket}
            searchQuery={searchQuery}
          />
        );
      case 'agents':
        return <AgentsView />;
      case 'audit-logs':
        return <AuditLogsView onSelectTicket={handleSelectTicket} />;
      case 'settings':
        return <SettingsView />;
      default:
        return (
          <Dashboard
            onSelectTicket={handleSelectTicket}
            onNavigateView={(view) => setCurrentView(view)}
          />
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Dark Navy Sidebar */}
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => {
          setSelectedTicketId(null);
          setCurrentView(view);
        }}
        stats={stats}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          title={getViewTitle()}
          subtitle="Arvo Systems Customer Support Ticket Management"
          searchQuery={searchQuery}
          onSearch={(q) => setSearchQuery(q)}
        />

        <main className="flex-1 pb-12">
          {renderViewContent()}
        </main>
      </div>
    </div>
  );
}
