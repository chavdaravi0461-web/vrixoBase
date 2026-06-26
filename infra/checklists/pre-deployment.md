# Pre-Deployment Checklist

## Code Quality
- [ ] All CI pipeline jobs pass (lint, typecheck, test, E2E)
- [ ] Security scan has no CRITICAL or HIGH findings
- [ ] npm audit has no CRITICAL vulnerabilities
- [ ] Docker images build successfully
- [ ] Code review completed and approved

## Database
- [ ] Prisma migrations validated (`prisma validate`)
- [ ] Migration has been reviewed for backward compatibility
- [ ] Rollback migration prepared (if applicable)
- [ ] Database backup completed for production DB
- [ ] Migration will not cause downtime (additive changes only)

## Infrastructure
- [ ] Kubernetes cluster is healthy (all nodes Ready)
- [ ] Expected capacity available for new pods (CPU/Memory)
- [ ] Secrets exist in cluster (or external secrets manager)
- [ ] TLS certificates are valid (not expiring within 30 days)
- [ ] Ingress controller is running
- [ ] Monitoring stack (Prometheus/Grafana) is operational

## Dependencies
- [ ] PostgreSQL is healthy and has replication lag < 1s
- [ ] Redis is healthy and has memory available
- [ ] MinIO is healthy and has disk space available
- [ ] External API providers are reachable

## Release
- [ ] Version bumped according to semver
- [ ] CHANGELOG updated with all changes
- [ ] Release tag created
- [ ] Release notes prepared
- [ ] Stakeholders notified of deployment window
