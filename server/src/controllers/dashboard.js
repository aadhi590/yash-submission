const prisma = require('../db');

const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Projects count
    const projectsCount = await prisma.project.count({
      where: { userId },
    });

    // Queues count (associated with user's projects)
    const queuesCount = await prisma.queue.count({
      where: { project: { userId } },
    });

    // Active workers check: workers with status ACTIVE and lastHeartbeat within last 1 minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const activeWorkersCount = await prisma.worker.count({
      where: {
        status: 'ACTIVE',
        lastHeartbeat: { gte: oneMinuteAgo },
      },
    });

    // Job stats grouped by status for user's queues
    const jobStats = await prisma.job.groupBy({
      by: ['status'],
      where: {
        queue: { project: { userId } },
      },
      _count: {
        _all: true,
      },
    });

    const statusCounts = {
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

    jobStats.forEach((item) => {
      if (statusCounts[item.status] !== undefined) {
        statusCounts[item.status] = item._count._all;
        statusCounts.total += item._count._all;
      }
    });

    // Throughput over the last 24 hours (Completed vs Failed)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const executions = await prisma.jobExecution.findMany({
      where: {
        job: { queue: { project: { userId } } },
        startedAt: { gte: twentyFourHoursAgo },
      },
      select: {
        status: true,
        startedAt: true,
      },
    });

    // Group executions by hour
    const hourlyThroughput = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
      d.setMinutes(0, 0, 0);
      return {
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        completed: 0,
        failed: 0,
        timestamp: d.getTime(),
      };
    });

    executions.forEach((exe) => {
      const exeTime = new Date(exe.startedAt);
      exeTime.setMinutes(0, 0, 0);
      const exeTimestamp = exeTime.getTime();

      const hourBucket = hourlyThroughput.find(
        (h) => Math.abs(h.timestamp - exeTimestamp) < 30 * 60 * 1000
      );
      if (hourBucket) {
        if (exe.status === 'COMPLETED') {
          hourBucket.completed++;
        } else if (exe.status === 'FAILED') {
          hourBucket.failed++;
        }
      }
    });

    res.status(200).json({
      metrics: {
        projectsCount,
        queuesCount,
        activeWorkersCount,
        jobStatuses: statusCounts,
      },
      throughput: hourlyThroughput.map(({ time, completed, failed }) => ({
        time,
        completed,
        failed,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
};
