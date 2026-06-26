# VrixoBase Security Guide

---

## Security Checklist

| Category | Control | Status |
|----------|---------|--------|
| **Authentication** | | |
| | JWT tokens signed with strong secret (256-bit+) | ✅ |
| | Access tokens expire in 15 minutes | ✅ |
| | Refresh tokens expire in 7 days | ✅ |
| | Refresh token rotation (old token revoked) | ✅ |
| | Password hashing with bcrypt (cost factor 12) | ✅ |
| | Rate limiting on auth endpoints (10 req/s) | ✅ |
| | Account lockout after failed attempts | 🔄 |
| | MFA support (TOTP) | ✅ |
| | OAuth 2.0 (Google, GitHub) | ✅ |
| | Session revocation on logout | ✅ |
| **API Security** | | |
| | HTTPS enforced (TLS 1.2/1.3) | ✅ |
| | CORS configured with whitelist | ✅ |
| | Helmet security headers | ✅ |
| | API key authentication alternative | ✅ |
| | Input validation (class-validator + Zod) | ✅ |
| | SQL injection prevention (Prisma parameterized) | ✅ |
| | Request size limiting (100MB max) | ✅ |
| | X-Request-ID tracing | ✅ |
| **Data Security** | | |
| | Encryption in transit (TLS) | ✅ |
| | Encryption at rest (AES-256) | ✅ |
| | Secrets stored encrypted in database | ✅ |
| | Row-Level Security (RLS) policies | ✅ |
| | Data isolation between projects | ✅ |
| **Infrastructure** | | |
| | Docker containers run as non-root | ✅ |
| | Docker health checks configured | ✅ |
| | Internal network isolation | ✅ |
| | Principle of least privilege | ✅ |
| | Secrets never in code/commits | ✅ |
| | Regular backups | ✅ |
| **Monitoring** | | |
| | Audit logging for all operations | ✅ |
| | Query history tracking | ✅ |
| | Rate limiting across all endpoints | ✅ |
| | Prometheus metrics collection | ✅ |
| | Error tracking and alerting | ✅ |
| | Failed authentication logging | ✅ |

✅ = Implemented | 🔄 = In Progress | ❌ = Not Yet

---

## Authentication Security

### JWT Best Practices

VrixoBase uses JSON Web Tokens (JWT) for stateless authentication:

| Property | Configuration | Rationale |
|----------|--------------|-----------|
| Signing Algorithm | HS256 (HMAC-SHA256) | Fast, symmetric, suitable for single-service deployment |
| Secret Length | 256+ bits (`openssl rand -base64 48`) | Prevents brute-force attacks |
| Access Token TTL | 15 minutes | Short-lived to minimize window of compromise |
| Refresh Token TTL | 7 days | Longer-lived but revocable |
| Payload | `sub`, `email`, `role` | Minimal — no sensitive data in token |

**Token validation flow:**

1. Server verifies JWT signature using secret
2. Checks expiration (`exp` claim)
3. Extracts `sub` (user ID) and attaches to request
4. Refresh tokens are stored as UUIDs in the database (revocable)
5. Refresh token rotation: each refresh revokes old token, issues new pair

### Password Hashing

```typescript
// Backend uses bcryptjs with cost factor 12
const hash = await bcrypt.hash(password, 12);

// Verification
const valid = await bcrypt.compare(password, hash);
```

**Password requirements (default):**
- Minimum 8 characters
- No maximum enforced (bcrypt handles up to 72 bytes)
- Recommend: uppercase, lowercase, number, special character

### Rate Limiting

Rate limits are configured at two levels:

**Nginx Level (global):**
```nginx
# nginx.conf
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=storage:10m rate=20r/s;
```

**Application Level (NestJS Throttler):**
```typescript
// configurable via environment
THROTTLE_TTL=60     # window in seconds
THROTTLE_LIMIT=100  # max requests per window
```

### MFA (Multi-Factor Authentication)

VrixoBase supports TOTP-based MFA:

```typescript
// Setup flow
1. User generates TOTP secret (via authenticator app)
2. Secret is stored as `mfaSecret` in user record
3. User verifies by providing 6-digit code
4. `mfaEnabled` flag set to true

// Login flow
1. User authenticates with email/password
2. If mfaEnabled, server requires MFA token
3. User provides TOTP code
4. Server verifies using otplib
5. Access granted
```

---

## API Security

### CORS Configuration

```typescript
// main.ts
app.enableCors({
  origin: corsOrigins,        // Whitelist from env
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  exposedHeaders: ['x-request-id'],
});
```

Configure in `.env`:
```env
CORS_ORIGIN=https://app.yourdomain.com,https://admin.yourdomain.com
```

### Helmet Security Headers

Applied globally via Express middleware:

| Header | Value | Protection |
|--------|-------|------------|
| `X-Frame-Options` | `SAMEORIGIN` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Reflected XSS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage |
| `Content-Security-Policy` | Restricted defaults | XSS, injection |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS enforcement |

### Input Validation

VrixoBase implements defense-in-depth for input validation:

1. **DTO Validation** (NestJS `ValidationPipe` with `class-validator`):
   ```typescript
   // whitelist strips unknown properties
   // forbidNonWhitelisted rejects requests with unknown properties
   app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
   ```

2. **Zod Schemas** — Used for additional validation in services:
   ```typescript
   const querySchema = z.object({
     limit: z.number().min(1).max(1000).default(50),
     offset: z.number().min(0).default(0),
   });
   ```

### SQL Injection Prevention

All database queries use Prisma ORM with parameterized queries:

```typescript
// SAFE — Prisma generates parameterized queries
const user = await prisma.user.findUnique({ where: { email } });

// SAFE — Raw queries with parameter binding
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;

// UNSAFE — Never do this
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`);
```

---

## Data Security

### Encryption at Rest

| Data | Encryption | Method |
|------|-----------|--------|
| User passwords | bcrypt (one-way) | Cost factor 12 |
| JWT secrets | Environment variable | — |
| Database secrets | AES-256-CBC | Application-level |
| Storage files | MinIO SSE-S3 | Server-side |
| Database data | PostgreSQL TDE | Filesystem-level |

### Secrets Management

Secrets stored in the database are encrypted at the application level:

```typescript
// Encryption using crypto module with key from ENCRYPTION_KEY env var
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
```

### Data Isolation

- Each project has its own database schema namespace
- API keys scoped to specific projects
- RLS policies enforce per-user data access
- Team roles control project-level permissions

---

## Infrastructure Security

### Docker Security

```dockerfile
# Backend Dockerfile best practices
FROM node:20-alpine

# Run as non-root user
USER node

# Use specific versions (no :latest in production)
FROM node:20-alpine@sha256:abc123...
```

**Production compose settings:**
- `restart: always` with health checks
- Resource limits prevent DoS
- Internal network (`vrixo-internal`) with no external access
- Read-only root filesystem where possible
- Logging with rotation (max 10MB, 3 files)

### Secrets Management

**Never commit secrets to the repository.**

```bash
# Generate strong secrets
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Store in .env (gitignored by default)
echo "JWT_SECRET=$JWT_SECRET" >> .env
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" >> .env
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
```

### Network Isolation

```
┌─────────────────┐     ┌──────────────────┐
│  vrixo-public    │     │  vrixo-internal  │
│  (internet)      │     │  (isolated)      │
│                  │     │                  │
│  nginx (80/443) │────►│  postgres        │
│  frontend (3000) │     │  redis           │
│                  │     │  minio           │
│                  │     │  backend (int.)  │
└─────────────────┘     └──────────────────┘
```

- `vrixo-public`: External-facing (nginx and frontend)
- `vrixo-internal`: Database, cache, storage (no external access)
- Backend is dual-homed (connected to both networks)

---

## Row-Level Security (RLS) Guide

RLS policies restrict which rows users can access based on their identity.

### Policy Structure

```json
{
  "name": "Users can read own profile",
  "tableName": "users",
  "definition": "id = auth.user_id()",
  "roles": ["authenticated"],
  "action": "SELECT"
}
```

### Policy Actions

| Action | Description |
|--------|-------------|
| `SELECT` | Read access policy |
| `INSERT` | Create access policy |
| `UPDATE` | Update access policy |
| `DELETE` | Delete access policy |
| `ALL` | All operations |

### Example Policies

**User can read own data:**
```json
{
  "name": "own_profile_read",
  "tableName": "profiles",
  "definition": "user_id = auth.user_id()",
  "roles": ["authenticated"],
  "action": "SELECT"
}
```

**Anyone can read public posts:**
```json
{
  "name": "public_posts_read",
  "tableName": "posts",
  "definition": "is_public = true",
  "roles": ["authenticated", "anon"],
  "action": "SELECT"
}
```

**Admin can read all:**
```json
{
  "name": "admin_full_access",
  "tableName": "posts",
  "definition": "auth.role() = 'admin'",
  "roles": ["authenticated"],
  "action": "ALL"
}
```

### Policy Evaluation

1. Request arrives with authentication context (user ID, role)
2. Matching policies are loaded for the table and action
3. Each policy's definition is evaluated against the row
4. If any policy matches, access is granted
5. If no policies match (`active` status), access is denied

---

## Audit Logging

Every significant operation is logged to the `audit_logs` table.

### What Is Logged

| Event | Fields Logged |
|-------|---------------|
| User login | `userId`, `action:LOGIN`, `ipAddress`, `userAgent` |
| Table created | `userId`, `action:CREATE`, `entity:table`, `entityId`, `metadata` |
| Row deleted | `userId`, `action:DELETE`, `entity:table`, `entityId` |
| File uploaded | `userId`, `action:CREATE`, `entity:file`, `entityId`, `metadata` |
| Function executed | `userId`, `action:EXECUTE`, `entity:function`, `entityId` |
| Policy changed | `userId`, `action:CREATE/DELETE`, `entity:policy`, `entityId` |
| Member added | `userId`, `action:CREATE`, `entity:member`, `entityId` |

### Audit Log Schema

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  projectId String
  userId    String?
  action    String   // CREATE, UPDATE, DELETE, LOGIN, EXECUTE, etc.
  entity    String   // table, bucket, function, policy, member, etc.
  entityId  String?
  metadata  String?  // JSON string with additional context
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
}
```

### Retention

Audit logs are retained indefinitely by default. Configure cleanup policies based on your compliance requirements:

```sql
-- Delete logs older than 90 days
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## OWASP Top 10 Compliance

| # | Category | VrixoBase Mitigation |
|---|----------|---------------------|
| A01 | Broken Access Control | JWT guards, RLS policies, role-based access, API key scoping |
| A02 | Cryptographic Failures | bcrypt for passwords, TLS 1.2/1.3, AES-256 for secrets |
| A03 | Injection | Prisma ORM (parameterized queries), input validation, Zod schemas |
| A04 | Insecure Design | Rate limiting, audit logging, principle of least privilege |
| A05 | Security Misconfiguration | Helmet headers, CORS whitelist, CSP, secure defaults in env |
| A06 | Vulnerable Components | Alpine-based Docker images, dependency scanning via npm audit |
| A07 | Authentication Failures | MFA support, short-lived JWTs, refresh rotation, rate limiting |
| A08 | Data Integrity Failures | Signed JWTs, checksummed backups, audit trail |
| A09 | Logging & Monitoring | Full audit logs, Prometheus metrics, Grafana dashboards |
| A10 | SSRF | Internal network isolation, no direct URL fetching from user input |

---

## Secure Configuration Guide

### Step 1: Generate Secrets

```bash
# Run the setup script which handles this automatically
bash scripts/setup.sh --prod

# Or manually:
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Update .env with these values
```

### Step 2: Configure SSL

See [Deployment Guide SSL section](DEPLOYMENT.md#sslhttps-setup) for Let's Encrypt setup.

### Step 3: Harden Nginx

Default `nginx.conf` already includes:
- TLS 1.2 and 1.3 only
- Strong cipher suites
- HSTS with preload
- CSP headers
- Rate limiting zones
- Server tokens off

### Step 4: Database Security

```sql
-- Create a dedicated database user (not superuser)
CREATE USER vrixo_app WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE vrixo TO vrixo_app;
GRANT USAGE ON SCHEMA public TO vrixo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vrixo_app;

-- Enable RLS on user tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### Step 5: Regular Maintenance

```bash
# Update dependencies
cd backend && npm audit
cd frontend && npm audit

# Rotate secrets periodically
# Regenerate JWT secrets and update .env

# Review audit logs
docker exec -it vrixo-postgres psql -U vrixo -d vrixo -c \
  "SELECT action, entity, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100;"
```

### Step 6: Monitoring

- Set up Grafana alerts for error rate spikes
- Monitor failed login attempts
- Track API response times
- Watch disk usage on all volumes
