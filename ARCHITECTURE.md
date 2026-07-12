# Architecture Documentation

This document describes the high-level architecture of the Distributed Job Scheduler.

## Architectural Overview

The system is designed around a decoupled, database-backed scheduling model, allowing high availability, horizontal scalability, and thread-safe distributed operations.

```text
  ┌────────────────────────────────────────────────────────┐
  │                   React Client Dashboard               │
  └───────────────────────────┬────────────────────────────┘
                              │ (REST API / JWT)
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                    Express API Server                  │
  └───────────────────────────┬────────────────────────────┘
                              │
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                 PostgreSQL Database (Prisma)           │
  └───────────────────────────▲────────────────────────────┘
                              │
             ┌────────────────┴────────────────┐
             │                                 │ (Atomic claim, Heartbeats)
             ▼                                 ▼
   ┌───────────────────┐             ┌───────────────────┐
   │  Worker Node 1    │             │  Worker Node 2    │
   └───────────────────┘             └───────────────────┘
```

The three components interact through a centralized PostgreSQL instance:
1. **API Server**: An Express server acting as the entry point for dashboard clients and job submitters. It performs validation and pushes jobs into the database.
2. **PostgreSQL Database**: Serves as the state store, locking coordinator, and message broker.
3. **Worker Nodes**: Decoupled daemon processes running in a poll loop. Workers monitor queues, atomically claim and process tasks, write telemetry heartbeats, and manage scheduled jobs.

---

## Atomic Claim Protocol

To ensure that a job is processed **exactly once** and not picked up by multiple workers simultaneously, the claim operation utilizes a PostgreSQL row-level lock:

```sql
UPDATE "Job"
SET status = 'CLAIMED'::"JobStatus", "workerId" = $1, "claimedAt" = NOW()
WHERE id = (
  SELECT id
  FROM "Job"
  WHERE status = 'QUEUED'::"JobStatus" AND "runAt" <= NOW() AND "queueId" = $2
  ORDER BY "createdAt" ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

### How it works:
- `FOR UPDATE` locks the matching job row so no other connection can write to or read-lock it.
- `SKIP LOCKED` tells other workers polling at the same time to ignore any locked row and immediately look for the next available one. This prevents lock contention or blocking queues.

---

## Concurrency Limit

Every queue defines a `concurrencyLimit`. When polling, a worker:
1. Counts its local active jobs running for that queue.
2. Compares it against the queue's maximum capacity.
3. Only claims new tasks if it has remaining slots, ensuring high-priority workloads do not choke individual worker resource capacities.

---

## Retry Policies and Backoffs

If a job fails during worker execution, it can be scheduled for automatic retries. The next run time `runAt` is calculated as `now() + backoffDelay`, where backoff is computed using:

1. **FIXED**: `delay`
2. **LINEAR**: `delay * attemptCount`
3. **EXPONENTIAL**: `delay * (factor ^ (attemptCount - 1))`

Once maximum retries are exhausted, the job status is flagged as `DLQ` and moved into the `DeadLetterQueue` table for developer inspection.

---

## Graceful Shutdown Flow

When a worker receives a `SIGTERM` or `SIGINT` termination signal:
1. It pauses its polling loop to reject incoming jobs.
2. It waits up to 10 seconds for currently running tasks to finish execution.
3. Any claimed job that hasn't completed is returned to the queue (status reset to `QUEUED`, `workerId` reset to `null`).
4. The worker updates its status to `INACTIVE` in the DB and disconnects cleanly.
