# Architecture Diagram

This is the system architecture showing data flow and service relationships.

```mermaid
graph TD
    %% Styling
    classDef client fill:#312e81,stroke:#4338ca,stroke-width:2px,color:#fff;
    classDef server fill:#0f172a,stroke:#1e293b,stroke-width:2px,color:#fff;
    classDef db fill:#064e3b,stroke:#065f46,stroke-width:2px,color:#fff;
    classDef worker fill:#78350f,stroke:#92400e,stroke-width:2px,color:#fff;

    %% Elements
    Client[React Client Dashboard]:::client
    API[Express API Server]:::server
    DB[(PostgreSQL Database)]:::db
    Worker1[Worker Node 1]:::worker
    Worker2[Worker Node 2]:::worker

    %% Flows
    Client -->|1. Submit Jobs / Inspect Stats| API
    API -->|2. Write Schema / Save State| DB
    Worker1 -->|3. Atomic Claim: SKIP LOCKED| DB
    Worker2 -->|3. Atomic Claim: SKIP LOCKED| DB
    Worker1 -->|4. Push Telemetry Heartbeats| DB
    Worker2 -->|4. Push Telemetry Heartbeats| DB
```

### Components
1. **React Client**: User interface where developer triggers and manages workflows.
2. **Express Backend**: Exposes authenticated REST endpoints, parses schemas, validates payloads.
3. **PostgreSQL DB**: Transactional layer coordinating task routing and logs.
4. **Worker Daemon Cluster**: Concurrent consumers claim and run tasks, posting logs back to Postgres.
