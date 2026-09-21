// ============================================================================
// Tasks Routes — Task Orchestration & Server-Sent Events (SSE) Streaming
// ============================================================================

import { FastifyInstance } from 'fastify';
import { TasksService } from './tasks.service';
import { RoutingService } from '../routing/routing.service';
import { createTaskSchema, routeTaskSchema, paginationSchema } from '@ecoroute/validation';
import { authMiddleware } from '../../middleware/auth.middleware';

export async function tasksRoutes(fastify: FastifyInstance) {
  const tasksService = new TasksService(fastify.prisma);
  const routingService = new RoutingService(fastify.prisma);

  // All task routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // POST /api/v1/tasks — Create a task and route it (standard non-streaming)
  fastify.post('/', async (request, reply) => {
    const body = createTaskSchema.parse(request.body);
    const task = await tasksService.createTask(request.userId!, body.inputText);

    try {
      const strategyToUse = body.routingStrategy ?? body.strategy ?? 'balanced';
      await routingService.routeTask(task.id, request.userId!, strategyToUse);
      const fullTask = await tasksService.getTaskById(request.userId!, task.id);
      return reply.status(201).send({ data: fullTask, meta: { requestId: request.id } });
    } catch (err: any) {
      const fullTask = await tasksService.getTaskById(request.userId!, task.id);
      // Return 201 with task and structured errorInfo so frontend can inspect failure
      return reply.status(201).send({
        data: fullTask,
        error: {
          code: err.code || 'ROUTING_ERROR',
          message: err.message || 'Routing failed',
        },
        meta: { requestId: request.id },
      });
    }
  });

  // Reusable streaming handler for /stream and /route-stream
  const handleStreamingTask = async (request: any, reply: any) => {
    const body = createTaskSchema.parse(request.body);
    const idempotencyKey = (request.headers['idempotency-key'] || request.headers['x-idempotency-key']) as string | undefined;

    // Check if task with this idempotency key already exists and is completed
    if (idempotencyKey) {
      const existing = await fastify.prisma.task.findUnique({
        where: { idempotencyKey },
        include: { routingResult: true, answer: true },
      });
      if (existing && existing.status === 'COMPLETED' && existing.userId === request.userId) {
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        });
        reply.raw.write(`event: taskCreated\ndata: ${JSON.stringify({ taskId: existing.id, inputText: existing.inputText })}\n\n`);
        if (existing.routingResult?.candidateScoresJson) {
          try {
            const parsed = JSON.parse(existing.routingResult.candidateScoresJson);
            reply.raw.write(`event: evaluations\ndata: ${JSON.stringify(parsed.evaluations || [])}\n\n`);
          } catch {}
        }
        if (existing.answer?.answerText) {
          reply.raw.write(`event: chunk\ndata: ${JSON.stringify({ chunk: existing.answer.answerText, fullText: existing.answer.answerText })}\n\n`);
        }
        reply.raw.write(`event: completed\ndata: ${JSON.stringify({ taskId: existing.id, status: 'completed' })}\n\n`);
        reply.raw.end();
        return;
      }
    }

    const task = await tasksService.createTask(request.userId!, body.inputText);
    if (idempotencyKey) {
      await fastify.prisma.task.update({
        where: { id: task.id },
        data: { idempotencyKey },
      }).catch(() => {});
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const abortController = new AbortController();
    request.raw.on('close', async () => {
      abortController.abort();
      await fastify.prisma.task.update({
        where: { id: task.id },
        data: { status: 'CANCELLED' },
      }).catch(() => {});
    });

    const sendSse = (event: string, data: any) => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    sendSse('taskCreated', { taskId: task.id, inputText: body.inputText });

    try {
      const strategyToUse = body.routingStrategy ?? body.strategy ?? 'balanced';
      await routingService.routeTaskStream(
        task.id,
        request.userId!,
        strategyToUse,
        ({ event, data }) => sendSse(event, data),
        abortController.signal,
      );
    } catch (err: any) {
      sendSse('error', {
        code: err.code || 'ROUTING_ERROR',
        message: err.message || 'Routing failed',
        provider: err.details?.provider,
      });
    } finally {
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
    }
  };

  // POST /api/v1/tasks/stream — Create and route task with Server-Sent Events (SSE) streaming
  fastify.post('/stream', handleStreamingTask);

  // POST /api/v1/tasks/route-stream — Explicit stream endpoint matching specification section 6
  fastify.post('/route-stream', handleStreamingTask);


  // GET /api/v1/tasks — List tasks
  fastify.get('/', async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const { status } = request.query as { status?: string };
    const result = await tasksService.getTasks(
      request.userId!,
      query.page,
      query.pageSize,
      query.search,
      status,
    );
    return reply.send({
      data: result.tasks,
      meta: {
        requestId: request.id,
        page: result.page,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        hasMore: result.page < result.totalPages,
      },
    });
  });

  // GET /api/v1/tasks/:taskId
  fastify.get('/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = await tasksService.getTaskById(request.userId!, taskId);
    return reply.send({ data: task, meta: { requestId: request.id } });
  });

  // DELETE /api/v1/tasks/:taskId
  fastify.delete('/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    await tasksService.deleteTask(request.userId!, taskId);
    return reply.send({ data: { message: 'Task deleted' }, meta: { requestId: request.id } });
  });

  // POST /api/v1/tasks/:taskId/retry
  fastify.post('/:taskId/retry', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const body = routeTaskSchema.parse(request.body ?? {});

    await tasksService.updateTaskStatus(taskId, 'PENDING');
    await routingService.routeTask(taskId, request.userId!, body.strategy);
    const fullTask = await tasksService.getTaskById(request.userId!, taskId);
    return reply.send({ data: fullTask, meta: { requestId: request.id } });
  });

  // POST /api/v1/tasks/:taskId/route
  fastify.post('/:taskId/route', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const body = routeTaskSchema.parse(request.body ?? {});
    await routingService.routeTask(taskId, request.userId!, body.strategy);
    const fullTask = await tasksService.getTaskById(request.userId!, taskId);
    return reply.send({ data: fullTask, meta: { requestId: request.id } });
  });

  // GET /api/v1/tasks/:taskId/routing-result
  fastify.get('/:taskId/routing-result', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = await tasksService.getTaskById(request.userId!, taskId);
    return reply.send({
      data: (task as Record<string, unknown>).routingResult ?? null,
      meta: { requestId: request.id },
    });
  });

  // GET /api/v1/tasks/:taskId/comparison
  fastify.get('/:taskId/comparison', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = await tasksService.getTaskById(request.userId!, taskId);
    const rr = (task as any)?.routingResult;
    if (!rr) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'No routing result found for this task' },
      });
    }

    let parsedCandidateScores: any = {};
    if (rr.candidateScoresJson) {
      try {
        parsedCandidateScores = JSON.parse(rr.candidateScoresJson);
      } catch {}
    }

    return reply.send({
      data: {
        taskId,
        selectedModel: rr.selectedModel,
        strategy: rr.strategy,
        taskAnalysis: parsedCandidateScores.taskAnalysis ?? rr.taskAnalysis,
        evaluations: parsedCandidateScores.evaluations ?? parsedCandidateScores.candidates ?? [],
        candidates: parsedCandidateScores.candidates ?? [],
        explanation: rr.explanation,
        environmentalImpact: rr.environmentalImpact,
        qualityScore: rr.qualityScore,
        estimatedCost: rr.estimatedCost,
      },
      meta: { requestId: request.id },
    });
  });

  // GET /api/v1/tasks/:taskId/answer
  fastify.get('/:taskId/answer', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = await tasksService.getTaskById(request.userId!, taskId);
    return reply.send({
      data: (task as Record<string, unknown>).answer ?? null,
      meta: { requestId: request.id },
    });
  });
}
