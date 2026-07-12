const prisma = require('../db');

const getWorkers = async (req, res, next) => {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      include: {
        heartbeats: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            jobs: { where: { status: 'RUNNING' } },
          },
        },
      },
    });

    // Map workers to include latest CPU and memory metrics
    const result = workers.map((w) => {
      const latestHeartbeat = w.heartbeats[0];
      const isOnline = new Date().getTime() - new Date(w.lastHeartbeat).getTime() < 60 * 1000;

      return {
        id: w.id,
        name: w.name,
        hostname: w.hostname,
        ipAddress: w.ipAddress,
        status: isOnline ? 'ACTIVE' : 'INACTIVE',
        lastHeartbeat: w.lastHeartbeat,
        activeJobsCount: w._count.jobs,
        metrics: latestHeartbeat
          ? {
              cpuUsage: latestHeartbeat.cpuUsage,
              memoryUsage: latestHeartbeat.memoryUsage,
              timestamp: latestHeartbeat.timestamp,
            }
          : null,
      };
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWorkers,
};
