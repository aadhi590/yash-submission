require('dotenv').config();
const os = require('os');
const prisma = require('./db');

const WORKER_NAME = process.env.WORKER_NAME || `worker-${os.hostname()}-${process.pid}`;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '2000', 10);
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '10000', 10);
const SCHEDULE_CHECK_INTERVAL = parseInt(process.env.SCHEDULE_CHECK_INTERVAL || '5000', 10);

let workerId = null;
let isRunning = true;
const activeJobs = new Map(); // jobId -> Promise/Info
let heartbeatTimer = null;
let pollTimer = null;
let scheduleTimer = null;

// Helper: Calculate next cron run time
function getNextCronDate(cronStr, fromDate = new Date()) {
  const next = new Date(fromDate.getTime());
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(next.getMinutes() + 1);

  const parts = cronStr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('Invalid cron expression');

  const [minPart, hourPart, domPart, monthPart, dowPart] = parts;

  const parseField = (part) => {
    if (part === '*') return null;
    if (part.includes('/')) {
      const [, step] = part.split('/');
      return { step: parseInt(step, 10) };
    }
    if (part.includes(',')) {
      return part.split(',').map(x => parseInt(x, 10));
    }
    return [parseInt(part, 10)];
  };

  const minutes = parseField(minPart);
  const hours = parseField(hourPart);
  const doms = parseField(domPart);
  const months = parseField(monthPart);
  const dows = parseField(dowPart);

  const match = (val, rule) => {
    if (!rule) return true;
    if (rule.step !== undefined) return val % rule.step === 0;
    return rule.includes(val);
  };

  let safety = 0;
  while (safety < 525600) {
    const curMin = next.getMinutes();
    const curHour = next.getHours();
    const curDom = next.getDate();
    const curMonth = next.getMonth() + 1;
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
  return new Date(fromDate.getTime() + 60 * 60 * 1000);
}

// Log formatting helper
function log(level, message, jobId = null) {
  const timestamp = new Date().toISOString();
  const jobPart = jobId ? ` [Job: ${jobId}]` : '';
  console.log(`[${timestamp}] [${level}] [${WORKER_NAME}]${jobPart} ${message}`);
}

// Calculate CPU/Memory metrics
function getSystemMetrics() {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

  // CPU usage calculation
  let totalMs = 0;
  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalMs += cpu.times[type];
    }
  });
  const cpuUsage = (process.cpuUsage().user / (totalMs * 1000)) * 100 || 5.0; // Fallback to 5% if division issues

  return {
    cpuUsage: Math.min(100, Math.max(0, cpuUsage)),
    memoryUsage: Math.min(100, Math.max(0, memoryUsage)),
  };
}

// Register Worker
async function registerWorker() {
  const hostname = os.hostname();
  const networkInterfaces = os.networkInterfaces();
  let ipAddress = '127.0.0.1';

  // Get first non-internal IP
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ipAddress = net.address;
        break;
      }
    }
  }

  const worker = await prisma.worker.create({
    data: {
      name: WORKER_NAME,
      hostname,
      ipAddress,
      status: 'ACTIVE',
      lastHeartbeat: new Date(),
    },
  });

  workerId = worker.id;
  log('INFO', `Worker registered successfully with ID: ${workerId}`);
}

// Heartbeat execution
async function sendHeartbeat() {
  if (!workerId || !isRunning) return;

  try {
    const metrics = getSystemMetrics();

    await prisma.$transaction([
      prisma.worker.update({
        where: { id: workerId },
        data: { lastHeartbeat: new Date() },
      }),
      prisma.workerHeartbeat.create({
        data: {
          workerId,
          cpuUsage: metrics.cpuUsage,
          memoryUsage: metrics.memoryUsage,
        },
      }),
    ]);
  } catch (err) {
    log('ERROR', `Failed to send heartbeat: ${err.message}`);
  }
}

// Calculate backoff time based on policy
function getBackoffDelay(policy, retryCount) {
  if (!policy) return 5; // Default 5 seconds

  const delay = policy.delay;
  switch (policy.strategy) {
    case 'LINEAR':
      return delay * (retryCount + 1);
    case 'EXPONENTIAL':
      return delay * Math.pow(policy.backoffFactor, retryCount);
    case 'FIXED':
    default:
      return delay;
  }
}

// Mock job processor (simulates a job run based on payload)
async function executeJobTask(job) {
  // Simulate task processing time (e.g. between 1 and 3 seconds)
  const processTime = job.payload.duration || Math.floor(Math.random() * 2000) + 1000;
  
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate random error based on payload or fail 10% of the time for demo purposes
      if (job.payload.shouldFail || (Math.random() < 0.15 && !job.payload.shouldSucceed)) {
        reject(new Error(job.payload.errorMessage || 'Job failed due to simulated execution error'));
      } else {
        resolve({ result: 'Job processed successfully', processedAt: new Date().toISOString() });
      }
    }, processTime);
  });
}

// Process a claimed job
async function processJob(job, queue) {
  const executionId = await prisma.jobExecution.create({
    data: {
      jobId: job.id,
      workerId,
      status: 'RUNNING',
      attemptNumber: job.retryCount + 1,
    },
  });

  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'RUNNING' },
  });

  await prisma.jobLog.create({
    data: {
      jobId: job.id,
      message: `Started job execution attempt #${job.retryCount + 1}`,
      level: 'INFO',
    },
  });

  log('INFO', `Processing job attempt #${job.retryCount + 1}`, job.id);

  try {
    const result = await executeJobTask(job);

    // Complete Job
    await prisma.$transaction([
      prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      }),
      prisma.jobExecution.update({
        where: { id: executionId.id },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
        },
      }),
      prisma.jobLog.create({
        data: {
          jobId: job.id,
          message: `Job completed successfully: ${JSON.stringify(result)}`,
          level: 'INFO',
        },
      }),
    ]);

    log('INFO', 'Job completed successfully', job.id);
  } catch (err) {
    const errorMsg = err.message || 'Unknown error';
    log('WARN', `Job failed: ${errorMsg}`, job.id);

    const isRetryable = job.retryCount < job.maxRetries;

    if (isRetryable) {
      // Calculate retry delay
      const nextRetryCount = job.retryCount + 1;
      const delaySec = getBackoffDelay(queue.retryPolicy, nextRetryCount);
      const runAt = new Date(Date.now() + delaySec * 1000);

      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'QUEUED',
            retryCount: nextRetryCount,
            runAt,
            error: errorMsg,
          },
        }),
        prisma.jobExecution.update({
          where: { id: executionId.id },
          data: {
            status: 'FAILED',
            endedAt: new Date(),
            error: errorMsg,
          },
        }),
        prisma.jobLog.create({
          data: {
            jobId: job.id,
            message: `Job attempt #${nextRetryCount} failed. Retrying in ${delaySec}s at ${runAt.toISOString()}. Error: ${errorMsg}`,
            level: 'WARN',
          },
        }),
      ]);

      log('INFO', `Job rescheduled for retry in ${delaySec}s`, job.id);
    } else {
      // Dead Letter Queue
      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'DLQ',
            failedAt: new Date(),
            error: errorMsg,
          },
        }),
        prisma.jobExecution.update({
          where: { id: executionId.id },
          data: {
            status: 'FAILED',
            endedAt: new Date(),
            error: errorMsg,
          },
        }),
        prisma.deadLetterQueue.create({
          data: {
            jobId: job.id,
            queueId: queue.id,
            reason: `Retries exhausted. Last error: ${errorMsg}`,
            payload: job.payload || {},
          },
        }),
        prisma.jobLog.create({
          data: {
            jobId: job.id,
            message: `Job failed and moved to Dead Letter Queue (DLQ) after ${job.maxRetries + 1} attempts. Error: ${errorMsg}`,
            level: 'ERROR',
          },
        }),
      ]);

      log('ERROR', 'Job moved to Dead Letter Queue', job.id);
    }
  } finally {
    activeJobs.delete(job.id);
  }
}

// Atomically claim and process jobs
async function pollQueues() {
  if (!isRunning) return;

  try {
    const activeQueues = await prisma.queue.findMany({
      where: { isPaused: false },
      include: { retryPolicy: true },
    });

    for (const queue of activeQueues) {
      // Count local active jobs for this queue
      let localRunningCount = 0;
      for (const [_, jobInfo] of activeJobs.entries()) {
        if (jobInfo.queueId === queue.id) {
          localRunningCount++;
        }
      }

      const availableSlots = queue.concurrencyLimit - localRunningCount;
      if (availableSlots <= 0) continue;

      // Try claiming up to available slots
      for (let i = 0; i < availableSlots; i++) {
        // Atomic claim query with SKIP LOCKED
        const claimedJobs = await prisma.$queryRaw`
          UPDATE "Job"
          SET status = 'CLAIMED'::"JobStatus", "workerId" = ${workerId}, "claimedAt" = NOW()
          WHERE id = (
            SELECT id
            FROM "Job"
            WHERE status = 'QUEUED'::"JobStatus" AND "runAt" <= NOW() AND "queueId" = ${queue.id}
            ORDER BY "createdAt" ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          RETURNING *
        `;

        if (!claimedJobs || claimedJobs.length === 0) {
          // No more jobs in this queue
          break;
        }

        const job = claimedJobs[0];

        // Start async processing
        const promise = processJob(job, queue);
        activeJobs.set(job.id, {
          queueId: queue.id,
          promise,
        });
      }
    }
  } catch (err) {
    log('ERROR', `Queue polling error: ${err.message}`);
  }

  // Reschedule poll
  if (isRunning) {
    pollTimer = setTimeout(pollQueues, POLL_INTERVAL);
  }
}

// Schedule checker (triggers ScheduledJobs)
async function checkSchedules() {
  if (!isRunning) return;

  try {
    const now = new Date();
    const scheduled = await prisma.scheduledJob.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      include: { job: true },
    });

    for (const sj of scheduled) {
      try {
        const nextRun = getNextCronDate(sj.cronExpression, now);

        await prisma.$transaction([
          // Update schedule entry
          prisma.scheduledJob.update({
            where: { id: sj.id },
            data: { nextRunAt: nextRun },
          }),
          // Spawn new job run
          prisma.job.create({
            data: {
              queueId: sj.job.queueId,
              payload: sj.job.payload || {},
              status: 'QUEUED',
              maxRetries: sj.job.maxRetries,
              runAt: now,
            },
          }),
        ]);

        log('INFO', `Triggered scheduled job run. Next run scheduled for ${nextRun.toISOString()}`, sj.jobId);
      } catch (err) {
        log('ERROR', `Failed to trigger schedule: ${err.message}`, sj.jobId);
      }
    }
  } catch (err) {
    log('ERROR', `Scheduled check error: ${err.message}`);
  }

  if (isRunning) {
    scheduleTimer = setTimeout(checkSchedules, SCHEDULE_CHECK_INTERVAL);
  }
}

// Graceful Shutdown
async function shutdown(signal) {
  log('INFO', `Received ${signal}. Starting graceful shutdown...`);
  isRunning = false;

  // Clear timers
  clearTimeout(pollTimer);
  clearTimeout(heartbeatTimer);
  clearTimeout(scheduleTimer);

  // Wait for running jobs
  if (activeJobs.size > 0) {
    log('INFO', `Waiting for ${activeJobs.size} active jobs to complete...`);
    const promises = Array.from(activeJobs.values()).map(x => x.promise);
    
    // Give them max 10s to finish
    const timeout = new Promise((resolve) => setTimeout(resolve, 10000));
    await Promise.race([Promise.all(promises), timeout]);
  }

  // Release any remaining claimed jobs
  try {
    const remainingJobIds = Array.from(activeJobs.keys());
    if (remainingJobIds.length > 0) {
      log('INFO', `Releasing ${remainingJobIds.length} unfinished jobs back to queue...`);
      await prisma.job.updateMany({
        where: { id: { in: remainingJobIds } },
        data: {
          status: 'QUEUED',
          workerId: null,
          claimedAt: null,
        },
      });
    }

    // Set worker status to INACTIVE
    if (workerId) {
      await prisma.worker.update({
        where: { id: workerId },
        data: { status: 'INACTIVE' },
      });
      log('INFO', 'Worker status set to INACTIVE');
    }
  } catch (err) {
    log('ERROR', `Shutdown database cleanup failed: ${err.message}`);
  } finally {
    await prisma.$disconnect();
    log('INFO', 'Graceful shutdown complete. Exiting.');
    process.exit(0);
  }
}

// Start Worker Service
async function start() {
  try {
    await registerWorker();

    // Start heartbeat loop
    await sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Start poll loop
    pollTimer = setTimeout(pollQueues, POLL_INTERVAL);

    // Start schedule checking
    scheduleTimer = setTimeout(checkSchedules, SCHEDULE_CHECK_INTERVAL);

    log('INFO', 'Worker Service running');
  } catch (err) {
    console.error('Fatal: Worker failed to start:', err);
    process.exit(1);
  }
}

// Listen to termination signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
