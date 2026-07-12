const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ userId: 'user-123' }, 'test-secret');

jest.mock('../src/db', () => ({
  user: {
    findUnique: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  queue: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  retryPolicy: {
    create: jest.fn(),
  },
}));

describe('Queue APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'user-123', email: 'test@example.com', name: 'Test' });
  });

  describe('GET /api/projects/:projectId/queues', () => {
    it('should list all queues for a valid project', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-123', userId: 'user-123' });
      prisma.queue.findMany.mockResolvedValue([
        { id: 'q-1', name: 'default', priority: 1, concurrencyLimit: 5 },
        { id: 'q-2', name: 'high-priority', priority: 3, concurrencyLimit: 10 },
      ]);

      const res = await request(app)
        .get('/api/projects/proj-123/queues')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(2);
      expect(res.body[0].name).toEqual('default');
    });

    it('should return 403 if project is not owned by the user', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/projects/proj-999/queues')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('POST /api/projects/:projectId/queues', () => {
    it('should create a new queue successfully', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-123', userId: 'user-123' });
      prisma.queue.create.mockResolvedValue({
        id: 'q-1',
        name: 'email-queue',
        priority: 2,
        concurrencyLimit: 5,
        projectId: 'proj-123',
      });

      const res = await request(app)
        .post('/api/projects/proj-123/queues')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'email-queue',
          priority: 2,
          concurrencyLimit: 5,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.name).toEqual('email-queue');
      expect(prisma.queue.create).toHaveBeenCalled();
    });
  });
});
