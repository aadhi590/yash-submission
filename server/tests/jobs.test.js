const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ userId: 'user-123' }, 'test-secret');

jest.mock('../src/db', () => ({
  user: {
    findUnique: jest.fn(),
  },
  queue: {
    findUnique: jest.fn(),
  },
  job: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  jobLog: {
    create: jest.fn(),
  },
}));

describe('Job APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-123', email: 'test@example.com', name: 'Test' });
  });

  describe('POST /api/queues/:queueId/jobs', () => {
    it('should create an immediate job successfully', async () => {
      prisma.queue.findUnique.mockResolvedValue({
        id: 'q-123',
        name: 'default',
        project: { userId: 'user-123' },
      });

      prisma.job.create.mockResolvedValue({
        id: 'job-999',
        queueId: 'q-123',
        payload: { task: 'send_email' },
        status: 'QUEUED',
        maxRetries: 3,
        runAt: new Date(),
      });

      const res = await request(app)
        .post('/api/queues/q-123/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payload: { task: 'send_email' },
          type: 'immediate',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.id).toEqual('job-999');
      expect(prisma.job.create).toHaveBeenCalled();
    });

    it('should create a delayed job successfully', async () => {
      prisma.queue.findUnique.mockResolvedValue({
        id: 'q-123',
        name: 'default',
        project: { userId: 'user-123' },
      });

      prisma.job.create.mockResolvedValue({
        id: 'job-delayed',
        queueId: 'q-123',
        payload: { task: 'heavy_computation' },
        status: 'QUEUED',
        maxRetries: 3,
        runAt: new Date(Date.now() + 60000), // 1 min delay
      });

      const res = await request(app)
        .post('/api/queues/q-123/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          payload: { task: 'heavy_computation' },
          type: 'delayed',
          delay: 60,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.id).toEqual('job-delayed');
      expect(prisma.job.create).toHaveBeenCalled();
    });
  });
});
