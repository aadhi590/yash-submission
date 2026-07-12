const { z } = require('zod');
const prisma = require('../db');

// Basic parser for next cron run time
function getNextCronDate(cronStr, fromDate = new Date()) {
  const next = new Date(fromDate.getTime());
  next.setSeconds(0);
  next.setMilliseconds(0);
  
  // Advance by 1 minute to start
  next.setMinutes(next.getMinutes() + 1);

  const parts = cronStr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression. Must have 5 fields.');
  }

  const [minPart, hourPart, domPart, monthPart, dowPart] = parts;

  const parseField = (part, minVal, maxVal) => {
    if (part === '*') return null;
    if (part.includes('/')) {
      const [, step] = part.split('/');
      const stepVal = parseInt(step, 10);
      return { step: stepVal };
    }
    if (part.includes(',')) {
      return part.split(',').map(x => parseInt(x, 10));
    }
    return [parseInt(part, 10)];
  };

  const minutes = parseField(minPart, 0, 59);
  const hours = parseField(hourPart, 0, 23);
  const doms = parseField(domPart, 1, 31);
  const months = parseField(monthPart, 1, 12); // cron months 1-12
  const dows = parseField(dowPart, 0, 6); // 0 = Sunday

  const match = (val, rule) => {
    if (!rule) return true;
    if (rule.step !== undefined) return val % rule.step === 0;
    return rule.includes(val);
  };

  // Safe counter to prevent infinite loops (max 1 year in minutes)
  let safety = 0;
  while (safety < 525600) {
    const curMin = next.getMinutes();
    const curHour = next.getHours();
    const curDom = next.getDate();
    const curMonth = next.getMonth() + 1; // JS months 0-11
    const curDow = next.getDay();

    if (
      match(curMin, minutes) &&
      match(curHour, hours) &&
      match(curDom, doms) &&
      match(curMonth, months) &&
      match(curDow, dows)
    ) {
      return next;
    }

    next.setMinutes(next.getMinutes() + 1);
    safety++;
  }
  
  // Fallback to 1 hour if it gets stuck
  return new Date(fromDate.getTime() + 60 * 60 * 1000);
}

const jobCreateSchema = z.object({
  payload: z.any(),
  type: z.enum(['immediate', 'delayed', 'scheduled', 'batch']).default('immediate'),
  delay: z.number().int().nonnegative().optional(), // in seconds
  cron: z.string().optional(),
  batch: z.array(z.any()).optional(),
  maxRetries: z.number().int().nonnegative().optional(),
});

const getJobs = async (req, res, next) => {
  try {
    const { queueId } = req.params;
    const { status, search, page = 1, limit = 10 } = req.query;

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: { project: true },
    });

    if (!queue || queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const where = { queueId };
    if (status) {
      where.status = status;
    }
    if (search) {
      where.payload = {
        path: [],
        string_contains: search,
      };
    }

    const [jobs, total] = await prisma.$transaction([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          worker: { select: { name: true } },
        },
      }),
      prisma.job.count({ where }),
    ]);

    res.status(200).json({
      jobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createJob = async (req, res, next) => {
  try {
    const { queueId } = req.params;
    const data = jobCreateSchema.parse(req.body);

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: { project: true, retryPolicy: true },
    });

    if (!queue || queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const defaultMaxRetries = data.maxRetries ?? (queue.retryPolicy ? queue.retryPolicy.maxRetries : 3);

    if (data.type === 'batch') {
      if (!data.batch || !Array.isArray(data.batch)) {
        return res.status(400).json({ error: 'Batch jobs require a "batch" array of payloads' });
      }

      const createdJobs = await prisma.$transaction(
        data.batch.map((payload) =>
          prisma.job.create({
            data: {
              queueId,
              payload,
              status: 'QUEUED',
              maxRetries: defaultMaxRetries,
              runAt: new Date(),
            },
          })
        )
      );

      // Log creation
      await prisma.$transaction(
        createdJobs.map((j) =>
          prisma.jobLog.create({
            data: {
              jobId: j.id,
              message: 'Batch job created successfully in queue',
              level: 'INFO',
            },
          })
        )
      );

      return res.status(201).json({
        message: `Created batch of ${createdJobs.length} jobs`,
        jobs: createdJobs,
      });
    }

    let status = 'QUEUED';
    let runAt = new Date();
    let scheduledConfig = null;

    if (data.type === 'delayed') {
      const delaySec = data.delay || 0;
      runAt = new Date(Date.now() + delaySec * 1000);
    } else if (data.type === 'scheduled') {
      if (!data.cron) {
        return res.status(400).json({ error: 'Scheduled jobs require a valid cron expression' });
      }
      status = 'SCHEDULED';
      try {
        runAt = getNextCronDate(data.cron);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
      scheduledConfig = {
        cronExpression: data.cron,
        nextRunAt: runAt,
      };
    }

    const job = await prisma.job.create({
      data: {
        queueId,
        payload: data.payload || {},
        status,
        maxRetries: defaultMaxRetries,
        runAt,
        ...(scheduledConfig && {
          scheduledJob: {
            create: scheduledConfig,
          },
        }),
      },
      include: {
        scheduledJob: true,
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        message: `Job initialized as type '${data.type}' scheduled to run at ${runAt.toISOString()}`,
        level: 'INFO',
      },
    });

    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
};

const getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        queue: {
          include: { project: true },
        },
        worker: {
          select: { name: true, hostname: true },
        },
        scheduledJob: true,
      },
    });

    if (!job || job.queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.status(200).json(job);
  } catch (error) {
    next(error);
  }
};

const retryJob = async (req, res, next) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        queue: {
          include: { project: true },
        },
      },
    });

    if (!job || job.queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'FAILED' && job.status !== 'DLQ') {
      return res.status(400).json({ error: `Cannot retry job in state: ${job.status}` });
    }

    // Update job to be queued again
    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: 'QUEUED',
        retryCount: 0,
        runAt: new Date(),
        failedAt: null,
        error: null,
        workerId: null,
      },
    });

    // Delete from DLQ if it was in DLQ
    if (job.status === 'DLQ') {
      await prisma.deadLetterQueue.deleteMany({
        where: { jobId: id },
      });
    }

    await prisma.jobLog.create({
      data: {
        jobId: id,
        message: 'Manual retry triggered. Job queued for execution.',
        level: 'INFO',
      },
    });

    res.status(200).json({
      message: 'Job status reset to QUEUED',
      job: updated,
    });
  } catch (error) {
    next(error);
  }
};

const getJobLogs = async (req, res, next) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        queue: {
          include: { project: true },
        },
      },
    });

    if (!job || job.queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const logs = await prisma.jobLog.findMany({
      where: { jobId: id },
      orderBy: { timestamp: 'asc' },
    });

    res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

const getJobExecutions = async (req, res, next) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        queue: {
          include: { project: true },
        },
      },
    });

    if (!job || job.queue.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const executions = await prisma.jobExecution.findMany({
      where: { jobId: id },
      orderBy: { startedAt: 'desc' },
      include: {
        worker: {
          select: { name: true, hostname: true },
        },
      },
    });

    res.status(200).json(executions);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getJobs,
  createJob,
  getJobById,
  retryJob,
  getJobLogs,
  getJobExecutions,
  getNextCronDate,
};
