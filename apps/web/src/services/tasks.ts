// ============================================================================
// Tasks Service
// ============================================================================

import { api } from './api';

export const tasksService = {
  create(inputText: string, routingStrategy?: string) {
    return api.post<{ data: Record<string, unknown> }>('/tasks', { inputText, routingStrategy });
  },
  list(params?: { page?: number; pageSize?: number; search?: string; status?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    return api.get<{ data: Record<string, unknown>[]; meta: Record<string, unknown> }>(`/tasks${qs ? `?${qs}` : ''}`);
  },
  get(taskId: string) {
    return api.get<{ data: Record<string, unknown> }>(`/tasks/${taskId}`);
  },
  delete(taskId: string) {
    return api.delete<{ data: { message: string } }>(`/tasks/${taskId}`);
  },
  retry(taskId: string, strategy?: string) {
    return api.post<{ data: Record<string, unknown> }>(`/tasks/${taskId}/retry`, { strategy });
  },
  stream(
    inputText: string,
    routingStrategy: string,
    onEvent: (event: string, data: any) => void,
    abortSignal?: AbortSignal,
  ) {
    return api.stream('/tasks/stream', { inputText, routingStrategy }, onEvent, abortSignal);
  },
};
