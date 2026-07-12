const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const errorHandler = require('./middleware/error');

const authRouter = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const queuesRouter = require('./routes/queues');
const jobsRouter = require('./routes/jobs');
const dashboardRouter = require('./routes/dashboard');
const workersRouter = require('./routes/workers');

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Router assignments
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api', queuesRouter); // Mounts /projects/:projectId/queues and /queues/:id
app.use('/api', jobsRouter);    // Mounts /queues/:queueId/jobs and /jobs/:id
app.use('/api/dashboard', dashboardRouter);
app.use('/api/workers', workersRouter);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Distributed Job Scheduler API Server is running' });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;
