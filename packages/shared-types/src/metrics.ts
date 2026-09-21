// ============================================================================
// Metrics Types
// ============================================================================

import { MeasurementStatus } from './routing';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimationMethod: string;
  measurementType: MeasurementStatus;
}

export interface MetricSnapshot {
  id: string;
  routingResultId: string;
  metricName: string;
  value: number | null;
  unit: string;
  measurementType: MeasurementStatus;
  methodologyVersion: string;
  dataSource: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  userId: string | null;
  eventType: AuditEventType;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export enum AuditEventType {
  USER_REGISTERED = 'user.registered',
  USER_LOGGED_IN = 'user.logged_in',
  USER_LOGGED_OUT = 'user.logged_out',
  USER_PASSWORD_RESET = 'user.password_reset',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  TASK_CREATED = 'task.created',
  TASK_ROUTED = 'task.routed',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_DELETED = 'task.deleted',
  PREFERENCES_UPDATED = 'preferences.updated',
  MODEL_CREATED = 'model.created',
  MODEL_UPDATED = 'model.updated',
  PROVIDER_UPDATED = 'provider.updated',
  ADMIN_ACTION = 'admin.action',
}

export interface AdminOverview {
  totalUsers: number;
  totalTasks: number;
  routingSuccessRate: number;
  activeProviders: number;
  recentTasks: number;
  recentErrors: number;
}
