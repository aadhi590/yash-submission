const { z } = require('zod');
const prisma = require('../db');

const retryPolicySchema = z.object({
  name: z.string().min(1, 'Policy name is required').max(100),
  strategy: z.enum(['FIXED', 'LINEAR', 'EXPONENTIAL']),
  delay: z.number().int().min(1, 'Delay must be at least 1 second'),
  maxRetries: z.number().int().min(0, 'Max retries cannot be negative'),
  backoffFactor: z.number().min(1.0, 'Backoff factor must be at least 1.0').optional(),
});

const queueSchema = z.object({
  name: z.string().min(1, 'Queue name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  priority: z.number().int().min(1).max(3).default(1),
  concurrencyLimit: z.number().int().min(1).max(100).default(5),
  retryPolicy: retryPolicySchema.optional().nullable(),
});

const editQueueSchema = z.object({
  name: z.string().min(1, 'Queue name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  priority: z.number().int().min(1).max(3),
  concurrencyLimit: z.number().int().min(1).max(100),
  retryPolicy: retryPolicySchema.optional().nullable(),
});

// Helper: check project ownership
const verifyProjectOwnership = async (projectId, userId) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  return !!project;
};

const getQueues = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const isOwner = await verifyProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied: You do not own this project' });
    }

    const queues = await prisma.queue.findMany({
      where: { projectId },
      include: {
        retryPolicy: true,
        _count: {
          select: { jobs: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.status(200).json(queues);
  } catch (error) {
    next(error);
  }
};

const createQueue = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const isOwner = await verifyProjectOwnership(projectId, req.user.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied: You do not own this project' });
    }

    const data = queueSchema.parse(req.body);

    // Check if queue name already exists in this project
    const existingQueue = await prisma.queue.findFirst({
      where: { projectId, name: data.name },
    });
    if (existingQueue) {
      return res.status(400).json({ error: 'A queue with this name already exists in the project' });
    }

    let retryPolicyId = null;
    if (data.retryPolicy) {
      const policy = await prisma.retryPolicy.create({
        data: {
          name: data.retryPolicy.name,
          strategy: data.retryPolicy.strategy,
          delay: data.retryPolicy.delay,
          maxRetries: data.retryPolicy.maxRetries,
          backoffFactor: data.retryPolicy.backoffFactor ?? 2.0,
        },
      });
      retryPolicyId = policy.id;
    }

    const queue = await prisma.queue.create({
      data: {
        name: data.name,
        description: data.description,
        projectId,
        priority: data.priority,
        concurrencyLimit: data.concurrencyLimit,
        retryPolicyId,
      },
      include: {
        retryPolicy: true,
      },
    });

    res.status(201).json(queue);
  } catch (error) {
    next(error);
  }
};

const updateQueue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = editQueueSchema.parse(req.body);

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { project: true, retryPolicy: true },
    });

    if (!queue || queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Handle Retry Policy Update
    let retryPolicyId = queue.retryPolicyId;
    if (data.retryPolicy) {
      if (queue.retryPolicyId) {
        // Update existing
        await prisma.retryPolicy.update({
          where: { id: queue.retryPolicyId },
          data: {
            name: data.retryPolicy.name,
            strategy: data.retryPolicy.strategy,
            delay: data.retryPolicy.delay,
            maxRetries: data.retryPolicy.maxRetries,
            backoffFactor: data.retryPolicy.backoffFactor ?? 2.0,
          },
        });
      } else {
        // Create new
        const policy = await prisma.retryPolicy.create({
          data: {
            name: data.retryPolicy.name,
            strategy: data.retryPolicy.strategy,
            delay: data.retryPolicy.delay,
            maxRetries: data.retryPolicy.maxRetries,
            backoffFactor: data.retryPolicy.backoffFactor ?? 2.0,
          },
        });
        retryPolicyId = policy.id;
      }
    } else if (queue.retryPolicyId) {
      // User removed retry policy, clean up policy
      retryPolicyId = null;
      await prisma.queue.update({
        where: { id },
        data: { retryPolicyId: null },
      });
      await prisma.retryPolicy.delete({
        where: { id: queue.retryPolicyId },
      });
    }

    const updated = await prisma.queue.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        priority: data.priority,
        concurrencyLimit: data.concurrencyLimit,
        retryPolicyId,
      },
      include: {
        retryPolicy: true,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteQueue = async (req, res, next) => {
  try {
    const { id } = req.params;

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!queue || queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Delete retry policy if exists
    const policyId = queue.retryPolicyId;

    await prisma.queue.delete({
      where: { id },
    });

    if (policyId) {
      await prisma.retryPolicy.delete({
        where: { id: policyId },
      }).catch(() => {}); // ignore error if already gone
    }

    res.status(200).json({ message: 'Queue deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const pauseQueue = async (req, res, next) => {
  try {
    const { id } = req.params;

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!queue || queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const updated = await prisma.queue.update({
      where: { id },
      data: { isPaused: true },
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

const resumeQueue = async (req, res, next) => {
  try {
    const { id } = req.params;

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!queue || queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const updated = await prisma.queue.update({
      where: { id },
      data: { isPaused: false },
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

const getQueueStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!queue || queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Count jobs by status
    const statusCounts = await prisma.job.groupBy({
      by: ['status'],
      where: { queueId: id },
      _count: {
        _all: true,
      },
    });

    const stats = {
      QUEUED: 0,
      SCHEDULED: 0,
      CLAIMED: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      RETRY: 0,
      DLQ: 0,
      total: 0,
    };

    statusCounts.forEach((item) => {
      if (stats[item.status] !== undefined) {
        stats[item.status] = item._count._all;
        stats.total += item._count._all;
      }
    });

    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQueues,
  createQueue,
  updateQueue,
  deleteQueue,
  pauseQueue,
  resumeQueue,
  getQueueStats,
};
