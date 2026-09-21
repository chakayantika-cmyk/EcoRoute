// ============================================================================
// History Page
// ============================================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { tasksService } from '../services/tasks';
import {
  Search, Filter, Loader2, Trash2, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, XCircle, AlertTriangle, FileText,
} from 'lucide-react';
import { TASK_STATUS_LABELS } from '@ecoroute/config';

export default function HistoryPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const pageSize = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', page, search, statusFilter],
    queryFn: () => tasksService.list({ page, pageSize, search: search || undefined, status: statusFilter || undefined }),
  });

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => tasksService.delete(taskId),
    onMutate: (taskId: string) => {
      setDeletingId(taskId);
      setDeleteError(null);
    },
    onSuccess: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: unknown) => {
      setDeletingId(null);
      const msg = err instanceof Error ? err.message : 'Failed to delete task';
      setDeleteError(msg);
    },
  });

  const tasks = (data?.data ?? []) as Array<Record<string, unknown>>;
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  const totalPages = Number(meta.totalPages ?? 1);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'FAILED': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'ROUTING': case 'PROCESSING': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title mb-2">Task History</h1>
        <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary">
          Browse and manage your previous routing tasks.
        </p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-eco-text-secondary" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search tasks..." className="input-field pl-10" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-eco-text-secondary" />
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="input-field w-auto cursor-pointer">
              <option value="">All Statuses</option>
              {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="card text-center py-12">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
          <p className="text-body text-eco-text-secondary">Loading tasks...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card border-red-200 dark:border-red-800 text-center py-12">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-body text-red-600">{error instanceof Error ? error.message : 'Failed to load tasks'}</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && tasks.length === 0 && (
        <div className="card text-center py-16">
          <FileText className="w-12 h-12 text-eco-text-secondary/30 mx-auto mb-4" />
          <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text mb-2">No tasks yet</h3>
          <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary mb-4">
            {search || statusFilter ? 'No tasks match your filters.' : 'Submit your first task from the Dashboard.'}
          </p>
          {!search && !statusFilter && (
            <button onClick={() => navigate('/dashboard')} className="btn-primary">Go to Dashboard</button>
          )}
        </div>
      )}

      {/* Delete Error Banner */}
      {deleteError && (
        <div className="card mb-4 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-body-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{deleteError}</span>
          </div>
          <button onClick={() => setDeleteError(null)} className="text-caption text-red-500 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Task List */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          {tasks.map((task) => {
            const routing = task.routingResult as Record<string, unknown> | null;
            const isDeleting = deletingId === String(task.id);
            return (
              <div key={String(task.id)} className="card-hover group">
                <div className="flex items-start gap-4">
                  <div className="mt-1">{statusIcon(String(task.status))}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-medium text-eco-text dark:text-dark-text line-clamp-2 mb-1">
                      {String(task.inputText)}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-caption text-eco-text-secondary dark:text-dark-text-secondary">
                      <span>{TASK_STATUS_LABELS[String(task.status)] ?? String(task.status)}</span>
                      {routing && (
                        <>
                          <span>·</span>
                          <span>{String((routing.selectedModel as Record<string, unknown>)?.name ?? '')}</span>
                          <span>·</span>
                          <span>by {String((routing.selectedModel as Record<string, unknown>)?.provider ?? '')}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(String(task.createdAt)).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(String(task.id));
                    }}
                    className="opacity-70 group-hover:opacity-100 p-2 text-eco-text-secondary hover:text-red-600 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
                    aria-label="Delete task"
                    title="Delete task"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-caption text-eco-text-secondary">
            Page {page} of {totalPages} · {String(meta.totalCount ?? 0)} total tasks
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
              className="btn-ghost p-2 disabled:opacity-30">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
              className="btn-ghost p-2 disabled:opacity-30">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
