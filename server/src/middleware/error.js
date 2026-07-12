const { ZodError } = require('zod');

const errorHandler = (err, req, res, next) => {
  console.error(err);

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Handle Prisma Known Request Errors (e.g. unique constraint fail)
  if (err.code === 'P2002') {
    const targets = err.meta?.target || [];
    return res.status(400).json({
      error: `Resource already exists: duplicate value for ${targets.join(', ')}`,
    });
  }

  // Handle Prisma Record Not Found Errors
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Requested resource not found',
    });
  }

  // Fallback Error
  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;
