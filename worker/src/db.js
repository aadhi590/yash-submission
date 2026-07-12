const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'],
});

module.exports = prisma;
// Reuses the same structure for the worker
