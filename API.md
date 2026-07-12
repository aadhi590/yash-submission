# API Specifications

All endpoints return JSON responses. Authentication requires a JWT token passed in the header as:
`Authorization: Bearer <JWT_TOKEN>`

---

## Authentication Endpoints

### 1. Register Account
- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "name": "Alex Developer"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully",
    "token": "eyJhbGciOi...",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "Alex Developer",
      "createdAt": "2026-07-12T12:00:00Z"
    }
  }
  ```

### 2. Login
- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOi...",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "Alex Developer"
    }
  }
  ```

---

## Project & Queue Endpoints

### 1. List Projects
- **URL**: `/api/projects`
- **Method**: `GET`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": "proj-uuid",
      "name": "Email Microservice",
      "description": "Handles transactional emails",
      "createdAt": "2026-07-12T12:00:00Z",
      "_count": { "queues": 2 }
    }
  ]
  ```

### 2. Create Queue
- **URL**: `/api/projects/:projectId/queues`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "name": "bulk-marketing-emails",
    "description": "Queue for monthly newsletters",
    "priority": 2,
    "concurrencyLimit": 10,
    "retryPolicy": {
      "name": "exponential-backoff",
      "strategy": "EXPONENTIAL",
      "delay": 10,
      "maxRetries": 5,
      "backoffFactor": 2.0
    }
  }
  ```
- **Response (201 Created)**: Returns the newly created queue object with nested retry policy configurations.

---

## Job Management Endpoints

### 1. Submit Job
- **URL**: `/api/queues/:queueId/jobs`
- **Method**: `POST`
- **Request Body (Immediate)**:
  ```json
  {
    "type": "immediate",
    "payload": {
      "email": "customer@gmail.com",
      "template": "welcome"
    }
  }
  ```
- **Request Body (Delayed)**:
  ```json
  {
    "type": "delayed",
    "delay": 300, // delay in seconds
    "payload": { "taskId": 42 }
  }
  ```
- **Request Body (Scheduled)**:
  ```json
  {
    "type": "scheduled",
    "cron": "0 9 * * 1-5", // Monday to Friday at 9:00 AM
    "payload": { "task": "daily-report" }
  }
  ```
- **Request Body (Batch)**:
  ```json
  {
    "type": "batch",
    "batch": [
      { "userId": "1" },
      { "userId": "2" }
    ]
  }
  ```

### 2. Explorer (List Jobs in Queue)
- **URL**: `/api/queues/:queueId/jobs`
- **Method**: `GET`
- **Query Parameters**:
  - `page`: integer (default 1)
  - `limit`: integer (default 10)
  - `status`: string (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `DLQ`)
  - `search`: string (filters payload content)
- **Response (200 OK)**:
  ```json
  {
    "jobs": [...],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  }
  ```

### 3. Manual Retry
- **URL**: `/api/jobs/:id/retry`
- **Method**: `POST`
- **Response (200 OK)**:
  ```json
  {
    "message": "Job status reset to QUEUED",
    "job": { ... }
  }
  ```

---

## Error Handling Format

If a request fails validation or triggers database constraints, the API returns a structured error:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": "email",
      "message": "Invalid email"
    }
  ]
}
```
If an internal server error occurs, it returns:
```json
{
  "error": "Internal Server Error"
}
```
