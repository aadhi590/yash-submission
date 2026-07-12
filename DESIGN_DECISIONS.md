# Architectural Design Decisions

This document outlines key engineering design decisions made during the development of the Distributed Job Scheduler.

## 1. Database-backed Scheduling (PostgreSQL vs. Redis)

### Decision:
We selected **PostgreSQL** coupled with Prisma as the scheduling backend rather than **Redis** (e.g. BullMQ).

### Rationale:
- **Relational Integrity**: Projects, Queues, Users, and Audit Logs naturally benefit from relational database rules, foreign key constraints, and cascading deletes.
- **ACID Transactions**: Claiming, executing, updating retry counters, and writing execution history records are grouped into atomic transactions to prevent double claims or lost job tracking.
- **SQL Concurrency Power**: Modern PostgreSQL version 9.5+ supports `FOR UPDATE SKIP LOCKED`. This enables high-performance queue polling directly in SQL with zero race conditions, matching Redis speed for medium workloads while remaining persistent out-of-the-box.

---

## 2. Distributed Lock claiming via `SKIP LOCKED`

### Decision:
To select and claim queued jobs, workers execute a raw SQL `UPDATE` using a subquery structured with `FOR UPDATE SKIP LOCKED`.

### Rationale:
- Without locks, two workers checking the DB simultaneously could claim the exact same job, leading to duplicate executions.
- Standard `SELECT ... FOR UPDATE` locks rows but forces other queries to wait, blocking workers and introducing bottlenecks.
- `SKIP LOCKED` ensures that any worker encountering locked rows skips them instantly to fetch the next free item. This eliminates wait time and provides high concurrent throughput.

---

## 3. Worker Telemetry & System Heartbeats

### Decision:
Worker processes periodically push CPU and memory utilization metrics alongside timestamp heartbeats into the DB.

### Rationale:
- Allows the dashboard to identify offline workers quickly. If `lastHeartbeat` is older than 60 seconds, the worker status is shown as `INACTIVE`.
- Simulates real cluster resource constraints, preparing the infrastructure for intelligent auto-routing or metric-based queue autoscaling.

---

## 4. Cron Evaluation inside Node.js

### Decision:
The scheduler includes a self-contained, lightweight five-field cron parsing state machine in JavaScript instead of relying on external scheduler libraries.

### Rationale:
- Eliminates external parsing dependency issues.
- Calculates exact future dates (`nextRunAt`) based on standard Unix Cron conventions (`* * * * *`, `*/5 * * * *`).
- Standardizes scheduled job lifecycles: when a scheduler triggers, it creates a *new* job in the queue for workers to claim, ensuring scheduled executions conform to queue limits and priorities.
