# Distributed Job Scheduler

A production-grade, highly reliable, and realistic Distributed Job Scheduler built with Node.js, Express, PostgreSQL, Prisma ORM, and React (Vite + Tailwind CSS).

The project features a decentralized design where multiple worker instances poll queues concurrently, claiming jobs atomically using database-level locking (`FOR UPDATE SKIP LOCKED`). It supports immediate, delayed, scheduled (cron-based), and batch jobs with robust error handling, detailed logging, retry policies (linear, exponential, fixed backoffs), and a comprehensive management dashboard.

## Features

- **Authentication**: Secure JWT authentication with protected frontend routes.
- **Project Management**: Group queues and jobs under distinct Projects.
- **Queue Management**: Independent priority levels, concurrency limits, and retry policies. Toggle active execution by pausing/resuming queues.
- **Job Lifecycle**: Clean transition states (`QUEUED`, `SCHEDULED`, `CLAIMED`, `RUNNING`, `COMPLETED`, `FAILED`, `RETRY`, `DLQ`).
- **Worker Cluster**: Continuously poll queues, atomically claim jobs using Postgres locking, stream CPU/Memory health metrics, and shutdown gracefully without breaking active workloads.
- **Interactive Dashboard**: Real-time throughput graphs, worker cluster health lists, queue status breakdown, and a full-featured job explorer with live terminal execution logs and manual retry controls.

---

## Tech Stack

- **Backend**: Node.js, Express, Zod (validation)
- **Database / ORM**: PostgreSQL, Prisma ORM
- **Worker Service**: Node.js (with system resource utilization metrics)
- **Frontend**: React (Vite, Tailwind CSS, Lucide icons)
- **Testing**: Jest, Supertest

---

## Folder Structure

```text
distributed-job-scheduler/
├── client/          # React + Vite dashboard app
├── server/          # Express REST API, Prisma schema & migrations
├── worker/          # Independent claim-loop worker node service
├── docs/            # Architecture and database visual diagrams
└── README.md        # Main installation and setup guide
```

---

## Installation

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)
- Git

### 1. Database Setup
Create a PostgreSQL database named `job_scheduler`:
```sql
CREATE DATABASE job_scheduler;
```

### 2. Configure Environment Variables
Create a `.env` file in **both** the `server/` and `worker/` directories:

**server/.env & worker/.env**:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/job_scheduler?schema=public"
JWT_SECRET="your-super-secure-key"
PORT=5000
NODE_ENV=development
```

---

## Running the Project

### 1. Initialize Database Migrations
Run these commands in the `server/` directory:
```bash
cd server
npm install
npx prisma migrate dev --name init
```

### 2. Start the Backend API Server
```bash
npm run dev
```
The server will run on `http://localhost:5000`.

### 3. Start the Background Worker Service
In a new terminal window:
```bash
cd worker
npm install
npm start
```

### 4. Start the Frontend Dashboard
In a new terminal window:
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Testing
To run the automated Jest tests for the authentication, queues, and job endpoints, navigate to the `server/` directory and execute:
```bash
npm run test
```

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Create developer account.
- `POST /api/auth/login` - Authenticate and get JWT token.
- `GET /api/auth/me` - Fetch authenticated user details.

### Projects & Queues
- `GET /api/projects` - List all projects.
- `POST /api/projects` - Create a new project.
- `GET /api/projects/:projectId/queues` - List project queues.
- `POST /api/projects/:projectId/queues` - Build a queue with concurrency and retries.
- `POST /api/queues/:id/pause` / `resume` - Control execution states.

### Jobs
- `POST /api/queues/:queueId/jobs` - Enqueue immediate, delayed, scheduled, or batch jobs.
- `GET /api/queues/:queueId/jobs` - Paginated job query with status filtering and search.
- `POST /api/jobs/:id/retry` - Manually requeue failed or DLQ jobs.
- `GET /api/jobs/:id/logs` - Fetch stdout execution logs.

---

## Screenshots Placeholder
*(Screenshots showing the Dashboard widgets, throughput charts, and Job explorer terminal log drawer can be placed here during deployment).*

---

## Future Improvements
- **Redis Cache Layer**: Incorporate a Redis layer for speedier job status checking.
- **WebSockets**: Transition from HTTP polling to WebSockets for instant dashboard updates.
- **Worker Autoscaling**: Hook up metrics to dynamically scale worker nodes.
