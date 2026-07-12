const express = require('express');
const {
  getJobs,
  createJob,
  getJobById,
  retryJob,
  getJobLogs,
  getJobExecutions,
} = require('../controllers/jobs');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Queue nested job routes
router.get('/queues/:queueId/jobs', getJobs);
router.post('/queues/:queueId/jobs', createJob);

// Flat job routes
router.get('/jobs/:id', getJobById);
router.post('/jobs/:id/retry', retryJob);
router.get('/jobs/:id/logs', getJobLogs);
router.get('/jobs/:id/executions', getJobExecutions);

module.exports = router;
