const express = require('express');
const {
  getQueues,
  createQueue,
  updateQueue,
  deleteQueue,
  pauseQueue,
  resumeQueue,
  getQueueStats,
} = require('../controllers/queues');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use(authMiddleware);

// Project-nested queues
// GET /api/projects/:projectId/queues
// POST /api/projects/:projectId/queues
router.get('/projects/:projectId/queues', getQueues);
router.post('/projects/:projectId/queues', createQueue);

// Flat queue routes
router.put('/queues/:id', updateQueue);
router.delete('/queues/:id', deleteQueue);
router.post('/queues/:id/pause', pauseQueue);
router.post('/queues/:id/resume', resumeQueue);
router.get('/queues/:id/stats', getQueueStats);

module.exports = router;
