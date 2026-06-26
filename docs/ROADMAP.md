# VrixoBase Roadmap

---

## Phase 1: Core Platform (Current)

> **Status:** In Development — v0.1.0

The initial release focuses on the core features that make VrixoBase a viable Supabase alternative.

### Authentication
- [x] Email/password registration and login
- [x] JWT access + refresh token flow
- [x] Token rotation (revoke old refresh tokens)
- [x] OAuth 2.0 — Google and GitHub
- [x] Password reset flow
- [x] MFA setup and verification (TOTP)
- [x] Session management (list, revoke)

### Database
- [x] Table CRUD (create, list, get, update, delete)
- [x] Column management (add, delete)
- [x] Raw SQL query execution
- [x] Schema visualization
- [x] Foreign key relationship viewer
- [x] Query history
- [x] Query performance analytics

### Auto API Proxy
- [x] Auto-generated REST endpoints from tables
- [x] Filtering (`eq`, `neq`, `gt`, `lt`, `like`, `in`, etc.)
- [x] Pagination (limit, offset, range)
- [x] Sorting (ascending, descending)
- [x] API key authentication for proxy endpoints

### Storage
- [x] Bucket CRUD (create, list, delete)
- [x] File upload with MIME type validation
- [x] File download with streaming
- [x] Public URL generation
- [x] Signed URL generation (time-limited)
- [x] Folder organization
- [x] File size limits per bucket

### Realtime
- [x] WebSocket connection via Socket.IO
- [x] Table change subscriptions (INSERT, UPDATE, DELETE)
- [x] Broadcast messaging
- [x] Presence tracking
- [x] Connection management

### Edge Functions
- [x] Function CRUD (create, read, update, delete)
- [x] Multiple runtime support (Node.js, Python, Go)
- [x] Synchronous execution
- [x] Async/fire-and-forget execution
- [x] Execution logs
- [x] Webhook management

### Monitoring
- [x] Database metrics
- [x] API metrics (requests, latency, error rate)
- [x] Storage metrics
- [x] Realtime metrics
- [x] Error tracking
- [x] Usage metrics
- [x] Prometheus endpoint
- [x] Pre-configured Grafana dashboard

### Dashboard
- [x] Project management UI
- [x] Database table viewer and editor
- [x] SQL query editor
- [x] Storage browser
- [x] Function editor and executor
- [x] Real-time dashboard
- [x] Monitoring dashboards
- [x] Team management
- [x] Settings and configuration

### Security
- [x] RLS policy management
- [x] Secrets storage (encrypted)
- [x] API key management
- [x] Audit logging
- [x] Rate limiting (Nginx + app level)
- [x] CORS configuration

### Team
- [x] Project members CRUD
- [x] Role management (admin, developer, viewer)
- [x] Invitations
- [x] Member activity

---

## Phase 2: Enhanced Features

> **Target:** v0.2.0 — v0.5.0

### Authentication & Security
- [ ] MFA with backup codes
- [ ] WebAuthn / Passkey support
- [ ] Email verification flow
- [ ] Phone authentication (SMS)
- [ ] CAPTCHA integration
- [ ] IP allowlisting for API keys
- [ ] Advanced rate limiting (per-user, per-route)

### Database
- [ ] Database branching (like Neon)
- [ ] Point-in-time recovery
- [ ] Database migrations via dashboard
- [ ] Index management via UI
- [ ] Stored procedure editor
- [ ] Database views support
- [ ] Full-text search configuration

### Storage
- [ ] Image transformations (resize, crop, format)
- [ ] CDN integration
- [ ] File versioning
- [ ] Storage quotas per project
- [ ] Multipart upload for large files

### Functions
- [ ] Function versioning
- [ ] Scheduled functions (cron jobs)
- [ ] Function secrets (server-side)
- [ ] Function logs viewer
- [ ] Function playground / testing console
- [ ] TypeScript/Deno as first-class runtime

### Team & Billing
- [ ] Team billing (usage-based pricing)
- [ ] Plan management (Free, Pro, Team, Enterprise)
- [ ] Usage quotas enforcement
- [ ] Invoice generation
- [ ] Multiple payment providers (Stripe, Paddle)

### Infrastructure
- [ ] Custom domain support
- [ ] Multi-region deployment (replica databases)
- [ ] Database connection pooling (PgBouncer)
- [ ] Automated SSL renewal
- [ ] Blue/green deployment support

---

## Phase 3: Enterprise

> **Target:** v0.6.0 — v1.0.0

### Authentication
- [ ] SAML/SSO (Okta, Azure AD, Google Workspace)
- [ ] LDAP integration
- [ ] SCIM provisioning
- [ ] Custom JWT claims
- [ ] Session policies (MFA required for certain roles)
- [ ] Passwordless magic links

### Compliance
- [ ] SOC 2 Type II readiness
- [ ] GDPR compliance features
  - [ ] Data export (GDPR Article 20)
  - [ ] Data deletion (right to be forgotten)
  - [ ] Consent management
  - [ ] Data processing records
- [ ] HIPAA compliance considerations
- [ ] ISO 27001 alignment
- [ ] Audit trails with immutable storage
- [ ] Retention policies

### Monitoring & Observability
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Custom alerting rules
- [ ] Anomaly detection
- [ ] SLA monitoring
- [ ] Log aggregation (ELK/Loki)
- [ ] Cost analytics

### Infrastructure
- [ ] Multi-region with active-active replication
- [ ] Read replicas for database
- [ ] Auto-scaling (horizontal pod autoscaler)
- [ ] Disaster recovery automation
- [ ] Infrastructure as Code (Terraform/Pulumi)
- [ ] Kubernetes helm chart

### Security
- [ ] Vault integration (HashiCorp Vault)
- [ ] End-to-end encryption options
- [ ] Database encryption (TDE)
- [ ] Audit log encryption
- [ ] Security scanning integration (Snyk, Trivy)
- [ ] Penetration testing program

---

## Phase 4: Ecosystem

> **Target:** v1.0.0+

### Developer Tools
- [ ] CLI tool (`vrixo` command)
  - [ ] Project management
  - [ ] Local development server
  - [ ] Migration management
  - [ ] Function deployment
- [ ] VS Code extension
  - [ ] Schema visualization
  - [ ] Inline queries
  - [ ] Function editing with live preview

### Client SDKs
- [ ] JavaScript/TypeScript SDK (existing)
- [ ] React hooks (existing)
- [ ] Flutter/Dart SDK
- [ ] Swift SDK
- [ ] Kotlin SDK
- [ ] Python SDK
- [ ] Go SDK
- [ ] Rust SDK

### Marketplace
- [ ] Plugin system
  - [ ] Auth providers
  - [ ] Storage backends
  - [ ] Database extensions
- [ ] Function templates gallery
- [ ] Dashboard widget marketplace
- [ ] Pre-built integrations (Stripe, SendGrid, etc.)

### API & Integration
- [ ] GraphQL support (Apollo Federation)
- [ ] gRPC API
- [ ] Webhook retry with exponential backoff
- [ ] Webhook delivery guarantees (at-least-once)
- [ ] Event sourcing support
- [ ] WebSocket clustering (scaling across instances)

### Documentation & Community
- [ ] Interactive API playground
- [ ] Video tutorials
- [ ] Community forum
- [ ] Contribution rewards program
- [ ] Official integrations directory

---

## Changelog

### v0.1.0 (Current — In Development)

Initial release with core platform features:

- Authentication (email/password, JWT, OAuth)
- Database management with PostgreSQL
- Auto-generated REST API
- S3-compatible file storage via MinIO
- Real-time subscriptions via WebSocket
- Serverless edge functions
- Monitoring with Prometheus and Grafana
- Admin dashboard (Next.js)
- Security (RLS, API keys, secrets)
- Team management
- Docker Compose deployment

### v0.0.1 (Previous)

- Project scaffolding
- Initial architecture setup
- Database schema design
