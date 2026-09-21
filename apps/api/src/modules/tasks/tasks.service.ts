// ============================================================================
// Tasks Service
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { NotFoundError, AuthorizationError } from '../../lib/errors';

export type TaskStatus = 'PENDING' | 'ROUTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export class TasksService {
  constructor(private prisma: PrismaClient) {}

  async createTask(userId: string, inputText: string) {
    // Estimate input token count (chars / 4 approximation)
    const inputTokenCount = Math.ceil(inputText.length / 4);

    const task = await this.prisma.task.create({
      data: { userId, inputText, inputTokenCount },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId,
        eventType: 'task.created',
        resourceType: 'task',
        resourceId: task.id,
      },
    });

    return task;
  }

  async getTasks(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    status?: string,
  ) {
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    if (search) where.inputText = { contains: search, mode: 'insensitive' };

    const [tasks, totalCount] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          routingResult: {
            include: { selectedModel: { include: { provider: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        inputText: t.inputText,
        status: t.status,
        inputTokenCount: t.inputTokenCount,
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt?.toISOString() ?? null,
        errorInfo: t.errorInfo,
        routingResult: t.routingResult
          ? {
              selectedModel: {
                provider: t.routingResult.selectedModel.provider.name,
                name: t.routingResult.selectedModel.displayName,
              },
              estimatedCost: t.routingResult.estimatedCostValue,
              qualityScore: t.routingResult.qualityScore,
            }
          : null,
      })),
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      page,
      pageSize,
    };
  }

  async getTaskById(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        routingResult: {
          include: {
            selectedModel: { include: { provider: true } },
            metricSnapshots: true,
          },
        },
        answer: true,
      },
    });

    if (!task) throw new NotFoundError('Task', taskId);
    if (task.userId !== userId) throw new AuthorizationError('You do not have access to this task');

    return this.formatTask(task);
  }

  async deleteTask(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task', taskId);
    if (task.userId !== userId) throw new AuthorizationError('You do not have access to this task');

    await this.prisma.task.delete({ where: { id: taskId } });

    await this.prisma.auditEvent.create({
      data: { userId, eventType: 'task.deleted', resourceType: 'task', resourceId: taskId },
    });
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, errorInfo?: string) {
    const data: Record<string, unknown> = { status };
    if (status === 'COMPLETED' || status === 'FAILED') {
      data.completedAt = new Date();
    }
    if (errorInfo) data.errorInfo = errorInfo;

    return this.prisma.task.update({ where: { id: taskId }, data });
  }

  private formatTask(task: Record<string, unknown>) {
    const t = task as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const result: Record<string, unknown> = {
      id: t.id,
      inputText: t.inputText,
      status: t.status,
      inputTokenCount: t.inputTokenCount,
      createdAt: t.createdAt?.toISOString?.() ?? t.createdAt,
      completedAt: t.completedAt?.toISOString?.() ?? null,
      errorInfo: t.errorInfo,
    };

    if (t.routingResult) {
      result.routingResult = {
        id: t.routingResult.id,
        selectedModel: {
          id: t.routingResult.selectedModel.id,
          provider: t.routingResult.selectedModel.provider.name,
          providerKey: t.routingResult.selectedModel.provider.providerKey,
          name: t.routingResult.selectedModel.displayName,
          modelKey: t.routingResult.selectedModel.modelKey,
        },
        strategy: t.routingResult.strategy,
        estimatedTokens: t.routingResult.estimatedTokens,
        actualTokens: t.routingResult.actualTokens,
        estimatedCost: {
          value: t.routingResult.estimatedCostValue,
          currency: t.routingResult.estimatedCostCurrency,
          status: t.routingResult.estimatedCostValue != null ? 'estimated' : 'unavailable',
        },
        actualCost: t.routingResult.actualCostValue
          ? { value: t.routingResult.actualCostValue, currency: t.routingResult.estimatedCostCurrency, status: 'actual' }
          : null,
        environmentalImpact: {
          status: t.routingResult.environmentalStatus.toLowerCase(),
          energyWh: t.routingResult.energyWh,
          carbonGrams: t.routingResult.carbonGrams,
          methodologyVersion: t.routingResult.methodologyVersion,
          confidence: 'low',
          dataSource: 'Published ML energy research (Patterson et al. 2021, IEA 2023)',
          disclaimer: 'This is a modeled estimate based on published averages, not a direct measurement.',
        },
        qualityScore: {
          value: t.routingResult.qualityScore,
          scoreType: t.routingResult.qualityScoreType.toLowerCase(),
          methodology: 'Heuristic capability-matching score',
        },
        explanation: t.routingResult.explanation,
        ...(() => {
          let candidateScores: unknown[] = [];
          let taskAnalysis: unknown = null;
          if (t.routingResult.candidateScoresJson) {
            try {
              const parsed = JSON.parse(t.routingResult.candidateScoresJson);
              if (Array.isArray(parsed)) {
                candidateScores = parsed;
              } else if (parsed && typeof parsed === 'object') {
                candidateScores = parsed.candidates ?? [];
                taskAnalysis = parsed.taskAnalysis ?? null;
              }
            } catch {}
          }
          return { candidateScores, taskAnalysis };
        })(),
        createdAt: t.routingResult.createdAt?.toISOString?.() ?? t.routingResult.createdAt,
      };
    }

    if (t.answer) {
      result.answer = {
        id: t.answer.id,
        answerText: t.answer.answerText,
        providerRequestId: t.answer.providerRequestId,
        createdAt: t.answer.createdAt?.toISOString?.() ?? t.answer.createdAt,
      };
    }

    return result;
  }
}
