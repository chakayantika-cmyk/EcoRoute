// ============================================================================
// Admin Dashboard Page
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/preferences';
import {
  Users, FileText, CheckCircle2, Activity, Shield,
  Loader2, AlertTriangle, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

export default function AdminDashboardPage() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-6 h-6 text-brand-600" />
          <h1 className="page-title">Admin Dashboard</h1>
        </div>
        <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary">
          System overview, user management, and audit log.
        </p>
      </div>

      <OverviewCards />
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <UsersTable />
        <AuditLog />
      </div>
    </div>
  );
}

function OverviewCards() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminService.getOverview(),
  });

  if (isLoading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1,2,3,4].map(i => <div key={i} className="card animate-pulse h-28" />)}
    </div>
  );

  if (error) return (
    <div className="card border-red-200 dark:border-red-800 p-6">
      <p className="text-red-600">Failed to load overview data</p>
    </div>
  );

  const overview = (data?.data ?? {}) as Record<string, unknown>;

  const cards = [
    { icon: Users, label: 'Total Users', value: String(overview.totalUsers ?? 0), color: 'text-blue-600' },
    { icon: FileText, label: 'Total Tasks', value: String(overview.totalTasks ?? 0), color: 'text-brand-600' },
    { icon: CheckCircle2, label: 'Success Rate', value: `${overview.routingSuccessRate ?? 0}%`, color: 'text-green-600' },
    { icon: Activity, label: 'Active Providers', value: String(overview.activeProviders ?? 0), color: 'text-teal-600' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="card">
          <div className="flex items-center gap-2 mb-3">
            <card.icon className={`w-5 h-5 ${card.color}`} />
            <span className="text-caption text-eco-text-secondary dark:text-dark-text-secondary">{card.label}</span>
          </div>
          <p className="text-heading-2 font-sans font-bold text-eco-text dark:text-dark-text">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function UsersTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => adminService.getUsers({ page, pageSize: 5 }),
  });

  const users = (data?.data ?? []) as Array<Record<string, unknown>>;
  const meta = (data?.meta ?? {}) as Record<string, unknown>;

  return (
    <div className="card">
      <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text mb-4">Users</h3>
      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
      ) : (
        <>
          <div className="space-y-3">
            {users.map((u) => (
              <div key={String(u.id)} className="flex items-center gap-3 py-2 border-b border-eco-border dark:border-dark-border last:border-0">
                <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-700 text-body-sm font-medium">
                  {String(u.displayName ?? '?')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium text-eco-text dark:text-dark-text truncate">{String(u.displayName)}</p>
                  <p className="text-caption text-eco-text-secondary truncate">{String(u.email)}</p>
                </div>
                <span className={`badge-${u.role === 'ADMIN' ? 'info' : 'neutral'} text-[10px]`}>{String(u.role)}</span>
              </div>
            ))}
          </div>
          {Number(meta.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-eco-border dark:border-dark-border">
              <span className="text-caption text-eco-text-secondary">Page {page}/{meta.totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost p-1"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Number(meta.totalPages)} className="btn-ghost p-1"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AuditLog() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', page],
    queryFn: () => adminService.getAuditEvents({ page, pageSize: 8 }),
  });

  const events = (data?.data ?? []) as Array<Record<string, unknown>>;
  const meta = (data?.meta ?? {}) as Record<string, unknown>;

  return (
    <div className="card">
      <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text mb-4">Audit Log</h3>
      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
      ) : events.length === 0 ? (
        <p className="text-body-sm text-eco-text-secondary text-center py-8">No audit events yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {events.map((e) => (
              <div key={String(e.id)} className="flex items-start gap-3 py-2 border-b border-eco-border dark:border-dark-border last:border-0">
                <Clock className="w-4 h-4 text-eco-text-secondary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-eco-text dark:text-dark-text">
                    <span className="font-medium">{String(e.eventType)}</span>
                    {e.userName && <span className="text-eco-text-secondary"> · {String(e.userName)}</span>}
                  </p>
                  <p className="text-caption text-eco-text-secondary">{new Date(String(e.createdAt)).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
          {Number(meta.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-eco-border dark:border-dark-border">
              <span className="text-caption text-eco-text-secondary">Page {page}/{meta.totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost p-1"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Number(meta.totalPages)} className="btn-ghost p-1"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
