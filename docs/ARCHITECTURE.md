# VrixoBase Architecture

---

## System Architecture Overview

VrixoBase follows a microservices-inspired architecture with a central NestJS API server that orchestrates multiple backend modules. The frontend is a Next.js SPA that communicates via REST and WebSocket.

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client Layer                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   Web Dashboard   │  │   Mobile App     │  │    Third-Party    │  │
│  │  (Next.js 16)     │  │  (React Native)  │  │    (API Client)   │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼──────────────────────┼──────────────────────┼────────────┘
            │                      │                      │
            ▼                      ▼                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Nginx (Reverse Proxy)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │ SSL      │  │ Rate     │  │ CORS     │  │ WebSocket Upgrade   │ │
│  │ Term.    │  │ Limiting │  │ Headers  │  │ (HTTP → WS)         │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
            │                      │
      ┌─────┴─────┐         ┌─────┴─────┐
      ▼           ▼         ▼           ▼
┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
│ Frontend │ │ Static │ │ Backend  │ │  MinIO   │
│ :3000    │ │ Assets │ │ :4000    │ │ :9000    │
└──────────┘ └────────┘ └────┬─────┘ └──────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌──────────┐  ┌──────────┐  ┌──────────────┐
       │PostgreSQL│  │  Redis   │  │   Prometheus │
       │   16     │  │    7     │  │   + Grafana  │
       └──────────┘  └──────────┘  └──────────────┘
```

---

## Backend Module Architecture (NestJS)

```
┌────────────────────────────────────────────────────────────┐
│                    AppModule                                │
├────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Config    │ │Throttler │ │Schedule  │ │   Prisma     │  │
│  │Module    │ │Module    │ │Module    │ │   Module     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │               Feature Modules                         │ │
│  │                                                       │ │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐  │ │
│  │  │  Auth   │ │ Database │ │ Storage │ │Realtime  │  │ │
│  │  │ Module  │ │ Module   │ │ Module  │ │ Module   │  │ │
│  │  └────┬────┘ └────┬─────┘ └────┬────┘ └────┬─────┘  │ │
│  │       │           │            │            │         │ │
│  │  ┌────┴────┐ ┌────┴─────┐ ┌────┴────┐ ┌────┴─────┐  │ │
│  │  │Functions│ │Monitoring│ │Security │ │   Team   │  │ │
│  │  │ Module  │ │ Module   │ │ Module  │ │  Module  │  │ │
│  │  └────┬────┘ └────┬─────┘ └────┬────┘ └────┬─────┘  │ │
│  │       │           │            │            │         │ │
│  │  ┌────┴────┐ ┌────┴─────┐      │      ┌────┴─────┐  │ │
│  │  │  Audit  │ │ Project  │      │      │  Health  │  │ │
│  │  │ Module  │ │ Module   │      │      │  Module  │  │ │
│  │  └─────────┘ └──────────┘      │      └──────────┘  │ │
│  │                           ┌────┴─────┐               │ │
│  │                           │ API Gen  │               │ │
│  │                           │ Module   │               │ │
│  │                           └──────────┘               │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Common / Shared Layer                    │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │ │
│  │  │Decorators│ │  Guards  │ │Filters   │ │Pipes   │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘  │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │ │
│  │  │Intercept.│ │ Prisma   │ │   Utils / Helpers  │   │ │
│  │  └──────────┘ └──────────┘ └────────────────────┘   │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| **Auth** | User registration, login, JWT, OAuth, MFA, password reset |
| **Database** | Table CRUD, column management, SQL queries, schema visualization |
| **Storage** | Buckets, file upload/download, signed URLs, MinIO integration |
| **Realtime** | WebSocket gateway, subscriptions, presence, Socket.IO |
| **Functions** | Serverless function CRUD, execution, webhook management |
| **Monitoring** | Metrics collection, Prometheus endpoint, error tracking |
| **Security** | RLS policies, secrets management, API key auth |
| **Team** | Project members, roles, invitations |
| **Audit** | Audit log creation and querying |
| **Project** | Project CRUD, stats, configuration |
| **Health** | Health check endpoint, uptime reporting |
| **API Generator** | Auto-generates REST endpoints from table schemas |

---

## Frontend Component Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Root Layout                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │              Providers Layer                      │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │ │
│  │  │Theme     │ │Query    │ │   Auth          │ │ │
│  │  │Provider  │ │Provider │ │   Provider      │ │ │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │ │
│  └─────────────────────────────────────────────────┘ │
│                                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │              Navigation / Sidebar                 │ │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐  │ │
│  │  │Projects│ │Database│ │Storage │ │Functions │  │ │
│  │  ├────────┤ ├────────┤ ├────────┤ ├──────────┤  │ │
│  │  │Realtime│ │Monitor │ │Settings│ │  Team    │  │ │
│  │  └────────┘ └────────┘ └────────┘ └──────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │                 Content Area                      │ │
│  │                                                   │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────────────┐  │ │
│  │  │Table │ │Query │ │Schema│ │  Row Editor    │  │ │
│  │  │List  │ │Editor│ │View  │ │                │  │ │
│  │  └──────┘ └──────┘ └──────┘ └────────────────┘  │ │
│  │                                                   │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────────────┐  │ │
│  │  │Bucket│ │File  │ │Bucket│ │  Upload Zone   │  │ │
│  │  │List  │ │Grid  │ │Config│ │                │  │ │
│  │  └──────┘ └──────┘ └──────┘ └────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### State Management

```
┌────────────────────────────────────────────────────┐
│                    Zustand Stores                    │
├────────────┬───────────────┬───────────────────────┤
│ AuthStore  │ ProjectStore  │ SettingsStore         │
│ - user     │ - projects    │ - theme              │
│ - tokens   │ - current     │ - preferences        │
│ - login()  │ - members     │                      │
│ - logout() │               │                      │
└────────────┴───────────────┴───────────────────────┘

┌────────────────────────────────────────────────────┐
│              React Query (Server State)               │
├────────────────────────────────────────────────────┤
│ useTables()       → GET  /database/tables          │
│ useTable(name)    → GET  /database/tables/:name    │
│ useCreateTable()  → POST /database/tables          │
│ useMe()           → GET  /auth/me                  │
│ useBuckets()      → GET  /storage/buckets          │
│ useFunctions()    → GET  /functions                │
│ useMetrics()      → GET  /monitoring/metrics       │
└────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Authentication Flow

```
User                    Frontend                  Backend                  Database
 │                        │                         │                        │
 │  Enter email/password  │                         │                        │
 │───────────────────────►│                         │                        │
 │                        │  POST /auth/login       │                        │
 │                        │────────────────────────►│                        │
 │                        │                         │  SELECT user by email  │
 │                        │                         │───────────────────────►│
 │                        │                         │◄───────────────────────│
 │                        │                         │                        │
 │                        │                         │  bcrypt.compare()      │
 │                        │                         │  (password verification)│
 │                        │                         │                        │
 │                        │                         │  Generate JWT tokens   │
 │                        │                         │  Store refresh token   │
 │                        │                         │───────────────────────►│
 │                        │                         │                        │
 │                        │  { accessToken,         │                        │
 │                        │    refreshToken, user }  │                        │
 │                        │◄────────────────────────│                        │
 │                        │                         │                        │
 │  Store tokens          │                         │                        │
 │◄───────────────────────│                         │                        │
 │                        │                         │                        │
 │  Subsequent requests   │                         │                        │
 │  with Bearer token     │  ──── All API calls ──► │  JWTGuard validates    │
 │───────────────────────►│  with Authorization     │  token, attaches user  │
 │                        │  header                 │                        │
```

### API Request Flow

```
Client                    Nginx                     Backend                    Service
  │                         │                         │                         │
  │  HTTPS Request          │                         │                         │
  │────────────────────────►│                         │                         │
  │                         │  Rate limit check       │                         │
  │                         │  SSL termination        │                         │
  │                         │  CORS headers           │                         │
  │                         │  Add X-Request-ID       │                         │
  │                         │                         │                         │
  │                         │  Proxy to backend       │                         │
  │                         │────────────────────────►│                         │
  │                         │                         │  Auth check (JWT/API key)│
  │                         │                         │  Validation pipe        │
  │                         │                         │  Logging interceptor    │
  │                         │                         │  Transform interceptor  │
  │                         │                         │                         │
  │                         │                         │  Route to controller    │
  │                         │                         │────────────────────────►│
  │                         │                         │                         │
  │                         │                         │  Process request        │
  │                         │                         │◄────────────────────────│
  │                         │                         │                         │
  │                         │  Response to client     │  Audit log (if needed)  │
  │  HTTPS Response         │◄────────────────────────│                         │
  │◄────────────────────────│                         │                         │
```

### Realtime (WebSocket) Flow

```
Client                    Nginx                     Backend (Socket.IO)        Redis
  │                         │                         │                         │
  │  WS Connect             │  Upgrade to WS          │                         │
  │────────────────────────►│────────────────────────►│                         │
  │                         │                         │  Auth via JWT token     │
  │                         │                         │  Store connection       │
  │                         │                         │────────────────────────►│
  │                         │                         │                         │
  │  Subscribe to channel   │                         │                         │
  │────────────────────────►│────────────────────────►│                         │
  │                         │                         │  Join Socket.IO room    │
  │                         │                         │  Add to Redis pub/sub   │
  │                         │                         │────────────────────────►│
  │                         │                         │                         │
  │  (Another client        │                         │                         │
  │   modifies a row)       │                         │                         │
  │                         │                         │  POST /database/...     │
  │                         │                         │◄────────────────────────│
  │                         │                         │                         │
  │                         │                         │  Process DB change      │
  │                         │                         │  Publish to Redis       │
  │                         │                         │────────────────────────►│
  │                         │                         │                         │
  │                         │                         │  Redis broadcasts to    │
  │                         │                         │  all gateway instances  │
  │                         │                         │◄────────────────────────│
  │                         │                         │                         │
  │  Receive event          │                         │  Emit to Socket.IO room │
  │◄────────────────────────│─────────────────────────│                         │
  │                         │                         │                         │
```

---

## Database Schema Overview

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────┐
│    User      │     │     Project      │     │   ProjectMember │
│──────────────│     │──────────────────│     │────────────────│
│ id (PK)      │◄────│ createdById (FK) │     │ id (PK)        │
│ email (UQ)   │     │ id (PK)          │────►│ projectId (FK) │
│ passwordHash │     │ name             │     │ userId (FK)    │
│ name         │     │ slug (UQ)        │     │ role           │
│ googleId (UQ)│     │ plan             │     │ createdAt      │
│ githubId (UQ)│     │ status           │     └────────────────┘
│ mfaEnabled   │     └────────┬─────────┘
│ mfaSecret    │              │
└──────┬───────┘     ┌────────┼───────────────┬──────────────────┐
       │             │        │               │                  │
       ▼             ▼        ▼               ▼                  ▼
┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐ ┌────────────────┐
│ Session  │ │  Table   │ │ Bucket │ │ Function   │ │ Subscription   │
│──────────│ │──────────│ │────────│ │────────────│ │────────────────│
│ id (PK)  │ │ id (PK)  │ │ id (PK)│ │ id (PK)    │ │ id (PK)        │
│ userId   │ │ projectId│ │project │ │ projectId  │ │ projectId (FK) │
│ refresh  │ │ name     │ │ name   │ │ name       │ │ tableId (FK)   │
│ token(UQ)│ │ schema   │ │isPublic│ │ slug (UQ)  │ │ eventType      │
│ expiresAt│ │          │ │maxSize │ │ sourceCode │ │ endpoint       │
│ revokedAt│ │          │ │allowed │ │ runtime    │ │ createdById    │
└──────────┘ │          │ │MIMEs   │ │ handler    │ └────────────────┘
             │          │ └────────┘ │ timeout    │
             └─────┬────┘            │ memory     │
                   │                 │ status     │
                   ▼                 └──────┬─────┘
            ┌────────────┐                  │
            │TableColumn │           ┌──────┴──────────┐
            │────────────│           │ FunctionExec     │
            │ id (PK)    │           │─────────────────│
            │ tableId(FK)│           │ id (PK)         │
            │ name       │           │ functionId (FK) │
            │ type       │           │ status          │
            │ isNullable │           │ duration        │
            │ isPrimary  │           │ logs            │
            │ isUnique   │           │ output          │
            │ isFK       │           │ error           │
            └────────────┘           │ payload         │
                                     │ triggeredById   │
        ┌───────────┐                │ triggeredAt     │
        │  File     │                └─────────────────┘
        │───────────│
        │ id (PK)   │   ┌────────────┐   ┌──────────────┐
        │ bucketId  │   │  Policy    │   │  AuditLog    │
        │ name      │   │────────────│   │──────────────│
        │ path      │   │ id (PK)    │   │ id (PK)      │
        │ mimeType  │   │ projectId  │   │ projectId(FK)│
        │ size      │   │ tableName  │   │ userId       │
        │ isPublic  │   │ definition │   │ action       │
        │ uploadedBy│   │ roles[]    │   │ entity       │
        └───────────┘   │ status     │   │ entityId     │
                        └────────────┘   │ metadata     │
                                          │ createdAt    │
        ┌──────────────┐                 └──────────────┘
        │  API Key     │
        │──────────────│   ┌──────────────┐
        │ id (PK)      │   │   Secret     │
        │ projectId(FK)│   │──────────────│
        │ key (UQ)     │   │ id (PK)      │
        │ type         │   │ projectId(FK)│
        │ permissions  │   │ name         │
        │ lastUsedAt   │   │ value        │
        │ expiresAt    │   │ type         │
        │ createdBy    │   └──────────────┘
        └──────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Layer 1: Transport Security                            ││
│  │  ┌──────────────┐  ┌──────────────┐                    ││
│  │  │ TLS 1.2/1.3  │  │ HSTS         │                    ││
│  │  │ (Let's Encrypt)│  │ (1 year)    │                    ││
│  │  └──────────────┘  └──────────────┘                    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Layer 2: Network Security                              ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ Internal     │  │ Firewall     │  │ Rate         │  ││
│  │  │ Network      │  │ (ports 80/443)│  │ Limiting     │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Layer 3: Authentication                                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ JWT (RS256)  │  │ Refresh      │  │ OAuth 2.0    │  ││
│  │  │ 15min expiry │  │ Token Rotation│  │ (Google/Git) │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  ││
│  │  ┌──────────────┐  ┌──────────────┐                     ││
│  │  │ MFA (TOTP)   │  │ bcrypt (12)  │                     ││
│  │  └──────────────┘  └──────────────┘                     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Layer 4: Authorization                                 ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ JWT Guards   │  │ API Key Auth │  │ Role-Based   │  ││
│  │  │ (Passport)   │  │ (x-api-key)  │  │ Access       │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  ││
│  │  ┌──────────────────────────────────────────────────┐   ││
│  │  │  Row-Level Security (RLS) Policies               │   ││
│  │  │  ┌──────────────────────────────────────────┐    │   ││
│  │  │  │  WHERE user_id = auth.user_id()          │    │   ││
│  │  │  └──────────────────────────────────────────┘    │   ││
│  │  └──────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Layer 5: Data Security                                 ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ││
│  │  │ Encryption   │  │ Secrets at   │  │ Input        │  ││
│  │  │ in Transit   │  │ Rest (AES)   │  │ Validation   │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Layer 6: Auditing                                      ││
│  │  ┌──────────────┐  ┌──────────────┐                     ││
│  │  │ Audit Logs   │  │ Query        │                     ││
│  │  │ (all actions)│  │ History      │                     ││
│  │  └──────────────┘  └──────────────┘                     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Event-Driven Architecture

### Pub/Sub with Redis

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Service A │────►│  Redis   │◄────│ Service B │
│ (Backend) │     │ Pub/Sub  │     │ (Backend) │
└──────────┘     └──────────┘     └──────────┘
                      │
                      ▼
               ┌──────────────┐
               │ Service C    │
               │ (Worker)     │
               └──────────────┘
```

Events published to Redis:

| Event | Description | Consumers |
|-------|-------------|-----------|
| `db.table.insert` | Row inserted | Realtime, Webhooks |
| `db.table.update` | Row updated | Realtime, Webhooks |
| `db.table.delete` | Row deleted | Realtime, Webhooks |
| `auth.user.created` | New user registered | Webhooks, Audit |
| `auth.user.deleted` | User deleted | Webhooks |
| `function.completed` | Function execution done | Monitoring |
| `function.failed` | Function execution failed | Monitoring, Webhooks |
| `storage.file.uploaded` | File uploaded | Webhooks, Audit |
| `storage.file.deleted` | File deleted | Webhooks, Audit |

### WebSocket Event Flow

```
┌───────────────────────────────────────────────────────┐
│                 Socket.IO Gateway                       │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Connection Auth: JWT token validation                 │
│  Rooms: Each channel = 1 room                          │
│  Events: INSERT, UPDATE, DELETE, presence, broadcast   │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │ Client A │  │ Client B │  │   Backend Service   │   │
│  │ Room:    │  │ Room:    │  │                     │   │
│  │ users    │  │ chat     │  │  Emit events to     │   │
│  └──────────┘  └──────────┘  │  Redis channels     │   │
│                               └────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

---

## Caching Strategy (Redis)

Redis is used for multiple purposes:

| Purpose | Key Pattern | TTL | Description |
|---------|-------------|-----|-------------|
| Session store | `session:{refreshToken}` | 7d | Refresh token validation |
| Rate limiting | `ratelimit:{ip}:{route}` | 60s | Request rate counters |
| Pub/Sub | — | — | Real-time event broadcasting |
| Cache | `cache:{entity}:{id}` | 5m | Frequently accessed data |
| Job queue | `queue:functions:*` | — | Function execution queue |

---

## File Storage Architecture (MinIO)

```
Application
    │
    ▼
┌─────────────────────────────────────────────────┐
│              Storage Service                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Bucket   │  │ File     │  │ Signed URL     │  │
│  │ Manager  │  │ Uploader │  │ Generator      │  │
│  └──────────┘  └──────────┘  └────────────────┘  │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │    MinIO       │
              │  (S3 API)      │
              │  port 9000     │
              └────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  /data Volume   │
              │  (persistent)   │
              └────────────────┘
```

### Bucket Structure

```
vrixo-storage/
├── public/                  # Public buckets
│   ├── avatars/
│   ├── images/
│   └── files/
└── private/                 # Private buckets (require auth)
    ├── documents/
    ├── backups/
    └── uploads/
```

---

## Deployment Architecture

### Docker Compose (Development)

```
┌───────────────────────────────────────────────────────────┐
│                    Single Host                              │
├───────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ postgres │ │  redis   │ │  minio   │ │   backend    │ │
│  │   :5432  │ │  :6379   │ │ :9000/01 │ │   :4000      │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
│  ┌──────────┐ ┌──────────┐                                 │
│  │ frontend │ │  nginx   │                                 │
│  │  :3000   │ │ :80/:443 │                                 │
│  └──────────┘ └──────────┘                                 │
└───────────────────────────────────────────────────────────┘
```

### Docker Compose (Production)

```
┌────────────────────────────────────────────────────────────┐
│                     Single Host (Production)                 │
├────────────────────────────────────────────────────────────┤
│  Network: vrixo-internal (internal)                         │
│  Network: vrixo-public  (external)                          │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ postgres │ │  redis   │ │  minio   │    (vrixo-internal) │
│  └──────────┘ └──────────┘ └──────────┘                    │
│                                                             │
│  ┌──────────┐ ┌──────────┐                    (both nets)  │
│  │ backend  │ │ backend  │  (replicated)                   │
│  │  :4000   │ │  :4000   │                                  │
│  └──────────┘ └──────────┘                                  │
│  ┌──────────┐                    (vrixo-public)              │
│  │ frontend │                                              │
│  │  :3000   │                                              │
│  └──────────┘                                              │
│  ┌──────────┐  Ports: 80, 443    (vrixo-public)              │
│  │  nginx   │                                              │
│  │ SSL/Proxy│                                              │
│  └──────────┘                                              │
└────────────────────────────────────────────────────────────┘
```

### Monitoring Stack

```
┌──────────────────────────────────────────────┐
│             Network: vrixo-monitoring          │
├──────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐               │
│  │ Prometheus │  │  Grafana  │               │
│  │  :9090     │  │  :3001    │               │
│  └─────┬─────┘  └───────────┘               │
│        │                                     │
│  ┌─────┴─────────────────────────────┐       │
│  │  Scrape Targets                    │       │
│  │  - backend:4000/api/metrics       │       │
│  │  - node-exporter:9100             │       │
│  │  - postgres-exporter:9187         │       │
│  └────────────────────────────────────┘       │
└──────────────────────────────────────────────┘
```
