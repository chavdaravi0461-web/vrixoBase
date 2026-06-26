# VrixoBase API Reference

**Base URL:** `http://localhost:4000/api`

**Auth:** Most endpoints require either a JWT token (`Authorization: Bearer <token>`) or an API key (`x-api-key: <key>`).

---

## Table of Contents

- [Authentication](#authentication)
- [Projects](#projects)
- [Database](#database)
- [Auto API Proxy](#auto-api-proxy)
- [Storage](#storage)
- [Realtime](#realtime)
- [Functions](#functions)
- [Monitoring](#monitoring)
- [Security](#security)
- [Team](#team)
- [Audit](#audit)
- [Health](#health)

---

## Authentication

### Register

Creates a new user account.

```
POST /auth/register
```

**Auth required:** No

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response** `201`:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "uuid-refresh-token",
  "expiresAt": "2025-01-01T00:00:00.000Z",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

### Login

Authenticates with email and password.

```
POST /auth/login
```

**Auth required:** No

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response** `200`:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "uuid-refresh-token",
  "expiresAt": "2025-01-01T00:00:00.000Z",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

### Refresh Token

Exchanges a refresh token for a new access token.

```
POST /auth/refresh
```

**Auth required:** No

**Request body:**
```json
{
  "refreshToken": "uuid-refresh-token"
}
```

**Response** `200`:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "new-uuid-refresh-token",
  "expiresAt": "2025-01-08T00:00:00.000Z"
}
```

---

### Logout

Revokes the current refresh token.

```
POST /auth/logout
```

**Auth required:** Yes (JWT)

**Request body:**
```json
{
  "refreshToken": "uuid-refresh-token"
}
```

**Response** `200`:
```json
{
  "message": "Logged out successfully"
}
```

---

### Get Profile

Returns the authenticated user's profile.

```
GET /auth/me
```

**Auth required:** Yes (JWT)

**Response** `200`:
```json
{
  "id": "clx...",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "isActive": true,
  "avatarUrl": null,
  "mfaEnabled": false,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### Forgot Password

Sends a password reset link to the specified email.

```
POST /auth/forgot-password
```

**Auth required:** No

**Request body:**
```json
{
  "email": "user@example.com"
}
```

**Response** `200`:
```json
{
  "message": "If that email exists, a reset link has been sent"
}
```

---

### Reset Password

Resets the password using a reset token.

```
POST /auth/reset-password
```

**Auth required:** No

**Request body:**
```json
{
  "token": "reset-token-uuid",
  "password": "newSecurePassword123"
}
```

**Response** `200`:
```json
{
  "message": "Password reset successfully"
}
```

---

### MFA Setup

Enables multi-factor authentication for the user.

```
POST /auth/mfa/setup
```

**Auth required:** Yes (JWT)

**Request body:**
```json
{
  "secret": "base32-encoded-secret"
}
```

**Response** `200`:
```json
{
  "message": "MFA enabled successfully"
}
```

---

### MFA Verify

Verifies an MFA token during authentication.

```
POST /auth/mfa/verify
```

**Auth required:** Yes (JWT)

**Request body:**
```json
{
  "token": "123456",
  "secret": "base32-encoded-secret"
}
```

**Response** `200`:
```json
{
  "message": "MFA verified successfully"
}
```

---

### OAuth — Google

Initiates Google OAuth login.

```
GET /auth/google
```

**Auth required:** No

Redirects to Google's consent screen, then the callback redirects back to the frontend with tokens.

```
GET /auth/google/callback
```

---

### OAuth — GitHub

Initiates GitHub OAuth login.

```
GET /auth/github
```

**Auth required:** No

Redirects to GitHub's authorization page, then the callback redirects back to the frontend with tokens.

```
GET /auth/github/callback
```

---

## Projects

### Create Project

```
POST /api/projects
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "My Project",
  "description": "Project description",
  "slug": "my-project"
}
```

**Response** `201`:
```json
{
  "id": "proj-id",
  "name": "My Project",
  "slug": "my-project",
  "plan": "free",
  "status": "active",
  "region": "us-east-1",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### List Projects

```
GET /api/projects
```

**Auth required:** Yes

**Response** `200`:
```json
[
  {
    "id": "proj-id",
    "name": "My Project",
    "slug": "my-project",
    "plan": "free",
    "status": "active",
    "memberCount": 2
  }
]
```

---

### Get Project

```
GET /api/projects/:id
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "id": "proj-id",
  "name": "My Project",
  "description": "Project description",
  "slug": "my-project",
  "plan": "free",
  "status": "active",
  "region": "us-east-1",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

---

### Update Project

```
PATCH /api/projects/:id
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

---

### Delete Project

```
DELETE /api/projects/:id
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "message": "Project deleted successfully"
}
```

---

### Get Project Stats

```
GET /api/projects/:id/stats
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "totalTables": 12,
  "totalRows": 10420,
  "totalStorageBytes": 52428800,
  "totalFunctions": 3,
  "activeConnections": 5
}
```

---

## Database

*All database endpoints are prefixed with `:projectId`.*

### List Tables

```
GET /database/:projectId/tables
```

**Auth required:** Yes

**Response** `200`:
```json
[
  {
    "id": "table-id",
    "name": "users",
    "schema": "public",
    "description": "User accounts",
    "isSystem": false,
    "columns": [],
    "rowCount": 100,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### Get Table

```
GET /database/:projectId/tables/:tableName
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "id": "table-id",
  "name": "users",
  "schema": "public",
  "columns": [
    {
      "id": "col-id",
      "name": "id",
      "type": "uuid",
      "defaultValue": null,
      "isNullable": false,
      "isUnique": true,
      "isPrimary": true,
      "isForeignKey": false
    }
  ],
  "rowCount": 100,
  "sizeBytes": 40960
}
```

---

### Create Table

```
POST /database/:projectId/tables
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "profiles",
  "description": "User profiles",
  "columns": [
    {
      "name": "id",
      "type": "uuid",
      "isPrimary": true,
      "defaultValue": "gen_random_uuid()"
    },
    {
      "name": "name",
      "type": "text",
      "isNullable": false
    },
    {
      "name": "avatar_url",
      "type": "text",
      "isNullable": true
    }
  ]
}
```

**Response** `201`:
```json
{
  "id": "table-id",
  "name": "profiles",
  "schema": "public",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### Update Table

```
PATCH /database/:projectId/tables/:tableName
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "new_table_name",
  "description": "Updated description"
}
```

---

### Delete Table

```
DELETE /database/:projectId/tables/:tableName
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "message": "Table deleted successfully"
}
```

---

### Add Column

```
POST /database/:projectId/tables/:tableName/columns
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "email",
  "type": "text",
  "isNullable": false,
  "isUnique": true
}
```

**Response** `201`:
```json
{
  "id": "col-id",
  "name": "email",
  "type": "text"
}
```

---

### Delete Column

```
DELETE /database/:projectId/tables/:tableName/columns/:columnName
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "message": "Column deleted successfully"
}
```

---

### Execute Query

```
POST /database/:projectId/query?userId=xxx
```

**Auth required:** Yes

**Request body:**
```json
{
  "query": "SELECT * FROM users WHERE email = $1",
  "params": ["user@example.com"]
}
```

**Response** `200`:
```json
{
  "columns": ["id", "email", "name"],
  "rows": [
    { "id": "clx...", "email": "user@example.com", "name": "John Doe" }
  ],
  "rowCount": 1,
  "duration": 12
}
```

---

### Get Schema

```
GET /database/:projectId/schema
```

**Auth required:** Yes

Returns the full database schema with all tables, columns, and relationships.

---

### Get Table Relations

```
GET /database/:projectId/tables/:tableName/relations
```

**Auth required:** Yes

Returns foreign key relationships for the specified table.

---

### Get Query History

```
GET /database/:projectId/query-history?userId=xxx&limit=50
```

**Auth required:** Yes

---

### Get Query Performance

```
GET /database/:projectId/performance
```

**Auth required:** Yes

Returns query performance analytics (average duration, slowest queries, etc.).

---

## Auto API Proxy

The Auto API Proxy generates RESTful endpoints from your database tables automatically.

### List API Keys

```
GET /api-keys/:projectId
```

**Auth required:** Yes

### Create API Key

```
POST /api-keys/:projectId
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "My API Key",
  "type": "secret",
  "permissions": ["read", "write"]
}
```

### Auto-generated Endpoints

For each table in your project, the following endpoints are automatically created:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rest/:projectId/:table` | List rows (with filtering, pagination) |
| `GET` | `/api/rest/:projectId/:table/:id` | Get a single row |
| `POST` | `/api/rest/:projectId/:table` | Insert a row |
| `PATCH` | `/api/rest/:projectId/:table/:id` | Update a row |
| `DELETE` | `/api/rest/:projectId/:table/:id` | Delete a row |

**Query parameters for `GET /api/rest/:projectId/:table`:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `select` | string | Comma-separated columns to return |
| `eq.column` | any | Equals filter |
| `neq.column` | any | Not equals filter |
| `gt.column` | number | Greater than |
| `gte.column` | number | Greater than or equal |
| `lt.column` | number | Less than |
| `lte.column` | number | Less than or equal |
| `like.column` | string | SQL LIKE pattern |
| `ilike.column` | string | Case-insensitive LIKE |
| `in.column` | string | Comma-separated IN clause |
| `order` | string | `column.asc` or `column.desc` |
| `limit` | number | Max rows (default 100, max 1000) |
| `offset` | number | Pagination offset |

---

## Storage

### List Buckets

```
GET /api/storage/:projectId/buckets
```

**Auth required:** Yes

**Response** `200`:
```json
[
  {
    "id": "bucket-id",
    "name": "avatars",
    "isPublic": true,
    "allowedMimeTypes": "image/*",
    "maxFileSize": 5242880,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### Create Bucket

```
POST /api/storage/:projectId/buckets
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "avatars",
  "isPublic": true,
  "allowedMimeTypes": "image/*",
  "maxFileSize": 5242880
}
```

**Response** `201`:
```json
{
  "id": "bucket-id",
  "name": "avatars",
  "isPublic": true
}
```

---

### Delete Bucket

```
DELETE /api/storage/buckets/:id
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "message": "Bucket deleted successfully"
}
```

---

### Upload File

```
POST /api/storage/buckets/:bucketId/upload?isPublic=true
```

**Auth required:** Yes

**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | binary | The file to upload |
| `isPublic` | boolean | Whether the file is publicly accessible |

**Response** `201`:
```json
{
  "id": "file-id",
  "name": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 204800,
  "isPublic": true,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### Get File

```
GET /api/storage/files/:id
```

**Auth required:** Yes

---

### Delete File

```
DELETE /api/storage/files/:id
```

**Auth required:** Yes

---

### List Files

```
GET /api/storage/buckets/:bucketId/files?prefix=avatars/
```

**Auth required:** Yes

---

### Get Signed URL

```
GET /api/storage/files/:id/signed-url?expiresIn=3600
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "url": "https://minio.example.com/bucket/file.jpg?X-Amz-Algorithm=...",
  "expiresIn": 3600
}
```

---

### Get Public URL

```
GET /api/storage/files/:id/public-url
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "url": "https://cdn.example.com/bucket/file.jpg"
}
```

---

### Download File

```
GET /api/storage/files/:id/download
```

**Auth required:** Yes

Streams the file content with appropriate `Content-Type`, `Content-Disposition`, and `Content-Length` headers.

---

### Create Folder

```
POST /api/storage/buckets/:bucketId/folders
```

**Auth required:** Yes

**Request body:**
```json
{
  "path": "avatars/users/"
}
```

---

## Realtime

### List Subscriptions

```
GET /realtime/:projectId/subscriptions
```

**Auth required:** Yes

---

### Create Subscription

```
POST /realtime/:projectId/subscriptions?userId=xxx
```

**Auth required:** Yes

**Request body:**
```json
{
  "tableId": "table-id"
}
```

**Response** `201`:
```json
{
  "id": "sub-id",
  "projectId": "proj-id",
  "tableId": "table-id",
  "eventType": "*",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### Remove Subscription

```
DELETE /realtime/subscriptions/:id
```

**Auth required:** Yes

---

### List Active Connections

```
GET /realtime/:projectId/connections
```

**Auth required:** Yes

---

### Get Presence

```
GET /realtime/:projectId/presence
```

**Auth required:** Yes

---

### WebSocket Connection

Connect via Socket.IO:

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:4000', {
  auth: { token: 'your-jwt-token' },
  transports: ['websocket'],
});

// Subscribe to channel
socket.emit('subscribe', { channel: 'db-changes' });

// Listen for events
socket.on('INSERT', (data) => console.log('Row inserted:', data));
socket.on('UPDATE', (data) => console.log('Row updated:', data));
socket.on('DELETE', (data) => console.log('Row deleted:', data));

// Presence
socket.on('presence', (users) => console.log('Online users:', users));

// Broadcast
socket.emit('broadcast', { channel: 'chat', event: 'message', data: { text: 'Hello' } });
```

---

## Functions

### Create Function

```
POST /api/functions/:projectId
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "hello-world",
  "slug": "hello-world",
  "description": "A simple hello world function",
  "sourceCode": "export async function handler(req, ctx) { return { body: 'Hello, World!' }; }",
  "runtime": "node18",
  "handler": "index.handler",
  "timeout": 30,
  "memory": 256,
  "environment": {
    "API_KEY": "xxx"
  }
}
```

**Response** `201`:
```json
{
  "id": "func-id",
  "name": "hello-world",
  "slug": "hello-world",
  "status": "active",
  "runtime": "node18",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### List Functions

```
GET /api/functions/:projectId
```

**Auth required:** Yes

---

### Get Function

```
GET /api/functions/:projectId/:id
```

**Auth required:** Yes

---

### Update Function

```
PATCH /api/functions/:projectId/:id
```

**Auth required:** Yes

**Request body:**
```json
{
  "sourceCode": "export async function handler(req, ctx) { return { body: 'Updated!' }; }",
  "timeout": 60
}
```

---

### Delete Function

```
DELETE /api/functions/:projectId/:id
```

**Auth required:** Yes

---

### Execute Function

```
POST /api/functions/:projectId/:id/execute
```

**Auth required:** Yes

**Request body:**
```json
{
  "payload": {
    "name": "World"
  },
  "async": false
}
```

**Response** `200`:
```json
{
  "executionId": "exec-id",
  "status": "success",
  "duration": 142,
  "output": { "body": "Hello, World!" },
  "logs": "[2025-01-01T00:00:00.000Z] Starting execution...\n"
}
```

---

### Get Execution Logs

```
GET /api/functions/:projectId/:id/executions
```

**Auth required:** Yes

---

### Create Webhook

```
POST /api/functions/:projectId/webhooks
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "on-user-signup",
  "url": "https://hooks.example.com/trigger",
  "events": ["AUTH_USER_CREATED"],
  "secret": "whsec_xxx",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

---

### List Webhooks

```
GET /api/functions/:projectId/webhooks
```

**Auth required:** Yes

---

### Delete Webhook

```
DELETE /api/functions/webhooks/:id
```

**Auth required:** Yes

---

## Monitoring

### Database Metrics

```
GET /api/monitoring/:projectId/database
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "activeConnections": 5,
  "transactionsPerSecond": 23.4,
  "cacheHitRatio": 0.97,
  "averageQueryTime": 12.5,
  "slowQueries": 2,
  "diskUsage": 1073741824
}
```

---

### API Metrics

```
GET /api/monitoring/:projectId/api
```

**Auth required:** Yes

**Response** `200`:
```json
{
  "requestsPerMinute": 120,
  "averageResponseTime": 45,
  "p95ResponseTime": 120,
  "p99ResponseTime": 300,
  "errorRate": 0.02,
  "statusCodes": {
    "2xx": 98,
    "4xx": 1.5,
    "5xx": 0.5
  }
}
```

---

### Storage Metrics

```
GET /api/monitoring/:projectId/storage
```

**Auth required:** Yes

---

### Realtime Metrics

```
GET /api/monitoring/:projectId/realtime
```

**Auth required:** Yes

---

### Error Tracking

```
GET /api/monitoring/:projectId/errors?timeframe=24h
```

**Auth required:** Yes

**Query parameters:** `timeframe` — `1h`, `24h`, `7d`, `30d` (default: `7d`)

---

### Usage Metrics

```
GET /api/monitoring/:projectId/usage?metric=requests
```

**Auth required:** Yes

---

## Security

### List RLS Policies

```
GET /api/security/:projectId/policies?tableName=users
```

**Auth required:** Yes

**Response** `200`:
```json
[
  {
    "id": "policy-id",
    "name": "Users can read own profile",
    "tableName": "users",
    "definition": "id = auth.user_id()",
    "roles": ["authenticated"],
    "status": "active",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### Create RLS Policy

```
POST /api/security/:projectId/policies
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "Users can read own profile",
  "tableName": "users",
  "definition": "id = auth.user_id()",
  "roles": ["authenticated"],
  "action": "SELECT"
}
```

**Response** `201`:
```json
{
  "id": "policy-id",
  "name": "Users can read own profile",
  "tableName": "users",
  "status": "active"
}
```

---

### Delete RLS Policy

```
DELETE /api/security/policies/:id
```

**Auth required:** Yes

---

### List Secrets

```
GET /api/security/:projectId/secrets
```

**Auth required:** Yes

---

### Create Secret

```
POST /api/security/:projectId/secrets
```

**Auth required:** Yes

**Request body:**
```json
{
  "name": "STRIPE_API_KEY",
  "value": "sk_live_xxx",
  "type": "environment"
}
```

---

## Team

### List Members

```
GET /api/team/:projectId/members
```

**Auth required:** Yes

**Response** `200`:
```json
[
  {
    "id": "member-id",
    "userId": "user-id",
    "role": "admin",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### Add Member

```
POST /api/team/:projectId/members
```

**Auth required:** Yes

**Request body:**
```json
{
  "email": "newuser@example.com",
  "role": "developer"
}
```

If the user exists, they are added directly. Otherwise, an invitation is sent.

---

### Update Member Role

```
PATCH /api/team/members/:id
```

**Auth required:** Yes

**Request body:**
```json
{
  "role": "admin"
}
```

---

### Remove Member

```
DELETE /api/team/members/:id
```

**Auth required:** Yes

---

## Audit

### List Audit Logs

```
GET /api/audit/:projectId?action=DELETE&userId=xxx&entity=table&from=2025-01-01&to=2025-01-31&limit=50&offset=0
```

**Auth required:** Yes

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | Filter by action (CREATE, UPDATE, DELETE, etc.) |
| `userId` | string | Filter by user ID |
| `entity` | string | Filter by entity type (table, bucket, function, etc.) |
| `from` | string | Start date (ISO 8601) |
| `to` | string | End date (ISO 8601) |
| `limit` | number | Max results (default 50) |
| `offset` | number | Pagination offset |

**Response** `200`:
```json
[
  {
    "id": "log-id",
    "userId": "user-id",
    "action": "DELETE",
    "entity": "table",
    "entityId": "table-id",
    "metadata": "{\"tableName\": \"temp_data\"}",
    "ipAddress": "192.168.1.1",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### Get Audit Log Entry

```
GET /api/audit/:projectId/:id
```

**Auth required:** Yes

Returns a single audit log entry with full details.

---

## Health

### Health Check

```
GET /api/health
```

**Auth required:** No

**Response** `200`:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "0.1.0",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```
