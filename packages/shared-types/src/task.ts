// ============================================================================
// Task Types
// ============================================================================

export enum TaskStatus {
  PENDING = 'PENDING',
  ROUTING = 'ROUTING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Task {
  id: string;
  userId: string;
  inputText: string;
  status: TaskStatus;
  inputTokenCount: number | null;
  createdAt: string;
  completedAt: string | null;
  errorInfo: string | null;
}

export interface TaskSummary {
  id: string;
  inputText: string;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  routingResult: RoutingResultSummary | null;
}

export interface RoutingResultSummary {
  selectedModel: {
    provider: string;
    name: string;
  };
  estimatedCost: number | null;
  qualityScore: number | null;
}

export interface CreateTaskRequest {
  inputText: string;
  routingStrategy?: string;
}
