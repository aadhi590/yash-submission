# Database Schema Design

This document details the PostgreSQL schema designed for the Distributed Job Scheduler using Prisma.

## Entity Relationship Overview

```text
User ────(1:N)───► Project ────(1:N)───► Queue ────(1:N)───► Job
                                           │                   │
                                       (N:1)                   ├───(1:N)───► JobExecution
                                           ▼                   ├───(1:N)───► JobLog
                                      RetryPolicy              ├───(1:1)───► ScheduledJob
                                                               └───(1:1)───► DeadLetterQueue
                                                                        ▲
                                                                  (workerId)
                                                                        │
                                                                 Worker (1:N) ──► WorkerHeartbeat
```

---

## Tables

### 1. `User`
- **Columns**:
  - `id` (String/UUID, PK)
  - `email` (String, Unique)
  - `passwordHash` (String)
  - `name` (String)
  - `createdAt` (DateTime)
  - `updatedAt` (DateTime)
- **Indexes**:
  - `User_email_key` (Unique index on `email`)

### 2. `Project`
- **Columns**:
  - `id` (String/UUID, PK)
  - `name` (String)
  - `description` (String, Nullable)
  - `userId` (String, FK to `User.id` with `ON DELETE CASCADE`)
  - `createdAt` / `updatedAt` (DateTime)
- **Indexes**:
  - Index on `userId`

### 3. `Queue`
- **Columns**:
  - `id` (String/UUID, PK)
  - `name` (String)
  - `description` (String, Nullable)
  - `projectId` (String, FK to `Project.id` with `ON DELETE CASCADE`)
  - `priority` (Integer, Default 1)
  - `concurrencyLimit` (Integer, Default 5)
  - `retryPolicyId` (String, FK to `RetryPolicy.id` with `ON DELETE SET NULL`, Nullable)
  - `isPaused` (Boolean, Default false)
  - `createdAt` / `updatedAt` (DateTime)
- **Constraints / Indexes**:
  - Unique constraint on `(projectId, name)`
  - Index on `projectId`

### 4. `RetryPolicy`
- **Columns**:
  - `id` (String/UUID, PK)
  - `name` (String)
  - `strategy` (Enum: `FIXED`, `LINEAR`, `EXPONENTIAL`)
  - `delay` (Integer)
  - `maxRetries` (Integer)
  - `backoffFactor` (Float)
  - `createdAt` / `updatedAt` (DateTime)

### 5. `Job`
- **Columns**:
  - `id` (String/UUID, PK)
  - `queueId` (String, FK to `Queue.id` with `ON DELETE CASCADE`)
  - `status` (Enum: `QUEUED`, `SCHEDULED`, `CLAIMED`, `RUNNING`, `COMPLETED`, `FAILED`, `RETRY`, `DLQ`)
  - `payload` (Json)
  - `maxRetries` (Integer)
  - `retryCount` (Integer)
  - `runAt` (DateTime)
  - `claimedAt` / `completedAt` / `failedAt` (DateTime, Nullable)
  - `error` (String, Nullable)
  - `workerId` (String, FK to `Worker.id` with `ON DELETE SET NULL`, Nullable)
  - `createdAt` / `updatedAt` (DateTime)
- **Indexes**:
  - Compound index on `(queueId, status, runAt)` - *Used by worker claim loops*
  - Index on `status`
  - Index on `workerId`

### 6. `Worker`
- **Columns**:
  - `id` (String/UUID, PK)
  - `name` (String)
  - `hostname` / `ipAddress` (String)
  - `status` (Enum: `ACTIVE`, `INACTIVE`)
  - `lastHeartbeat` (DateTime)
  - `createdAt` / `updatedAt` (DateTime)
- **Indexes**:
  - Index on `status`
  - Index on `lastHeartbeat`

### 7. `WorkerHeartbeat`
- **Columns**:
  - `id` (String/UUID, PK)
  - `workerId` (String, FK to `Worker.id` with `ON DELETE CASCADE`)
  - `timestamp` (DateTime)
  - `cpuUsage` / `memoryUsage` (Float)
- **Indexes**:
  - Index on `(workerId, timestamp)`

### 8. `JobExecution`
- **Columns**:
  - `id` (String/UUID, PK)
  - `jobId` (String, FK to `Job.id` with `ON DELETE CASCADE`)
  - `workerId` (String, FK to `Worker.id` with `ON DELETE CASCADE`)
  - `status` (Enum: `RUNNING`, `COMPLETED`, `FAILED`)
  - `startedAt` / `endedAt` (DateTime)
  - `error` (String, Nullable)
  - `attemptNumber` (Integer)
- **Indexes**:
  - Index on `jobId`
  - Index on `workerId`

### 9. `JobLog`
- **Columns**:
  - `id` (String/UUID, PK)
  - `jobId` (String, FK to `Job.id` with `ON DELETE CASCADE`)
  - `message` (String)
  - `level` (Enum: `INFO`, `WARN`, `ERROR`)
  - `timestamp` (DateTime)
- **Indexes**:
  - Compound index on `(jobId, timestamp)`

### 10. `ScheduledJob`
- **Columns**:
  - `id` (String/UUID, PK)
  - `jobId` (String, FK to `Job.id` with `ON DELETE CASCADE`, Unique)
  - `cronExpression` (String)
  - `nextRunAt` (DateTime)
  - `isActive` (Boolean)
  - `createdAt` / `updatedAt` (DateTime)
- **Indexes**:
  - Compound index on `(nextRunAt, isActive)`

### 11. `DeadLetterQueue`
- **Columns**:
  - `id` (String/UUID, PK)
  - `jobId` (String, FK to `Job.id` with `ON DELETE CASCADE`, Unique)
  - `queueId` (String, FK to `Queue.id` with `ON DELETE CASCADE`)
  - `reason` (String, Nullable)
  - `failedAt` (DateTime)
  - `payload` (Json)
- **Indexes**:
  - Index on `queueId`
