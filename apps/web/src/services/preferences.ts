// ============================================================================
// Preferences Service
// ============================================================================

import { api } from './api';

export const preferencesService = {
  get() {
    return api.get<{ data: Record<string, unknown> }>('/preferences');
  },
  update(prefs: Record<string, unknown>) {
    return api.put<{ data: Record<string, unknown> }>('/preferences', prefs);
  },
  reset() {
    return api.post<{ data: Record<string, unknown> }>('/preferences/reset');
  },
  getApiKeys() {
    return api.get<{ data: Record<string, boolean> }>('/preferences/api-keys');
  },
  updateApiKeys(keys: { geminiApiKey?: string; openaiApiKey?: string; anthropicApiKey?: string }) {
    return api.put<{ data: { message: string } }>('/preferences/api-keys', keys);
  },
};

export const modelsService = {
  list() {
    return api.get<{ data: Record<string, unknown>[] }>('/models');
  },
  get(modelId: string) {
    return api.get<{ data: Record<string, unknown> }>(`/models/${modelId}`);
  },
  getProviders() {
    return api.get<{ data: Record<string, unknown>[] }>('/models/providers');
  },
  getProvidersHealth() {
    return api.get<{ data: Record<string, unknown>[] }>('/models/providers/health');
  },
};

export const adminService = {
  getOverview() {
    return api.get<{ data: Record<string, unknown> }>('/admin/overview');
  },
  getUsers(params?: { page?: number; pageSize?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const qs = searchParams.toString();
    return api.get<{ data: Record<string, unknown>[]; meta: Record<string, unknown> }>(`/admin/users${qs ? `?${qs}` : ''}`);
  },
  getAuditEvents(params?: { page?: number; pageSize?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const qs = searchParams.toString();
    return api.get<{ data: Record<string, unknown>[]; meta: Record<string, unknown> }>(`/admin/audit-events${qs ? `?${qs}` : ''}`);
  },
};
