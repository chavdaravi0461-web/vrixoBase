# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Production-grade Kubernetes manifests (deployments, services, ingress, HPA, PDB, network policies)
- Full CI/CD pipeline with GitHub Actions (lint, typecheck, test, E2E, Docker build/push)
- CD pipeline with environment approvals, staging/production deployment, automatic rollback
- Automated security scanning (Trivy filesystem + IaC, npm audit, Gitleaks)
- Prometheus metrics endpoint at `/api/metrics` with default and custom metrics
- Structured Prisma migration pipeline with rollback support
- Release automation (version management, CHANGELOG, git tagging)
- Production deployment checklists and deployment targets documentation
- Kustomize-based Kubernetes resource management
- Pod Disruption Budgets (PDB) for HA deployments
- Horizontal Pod Autoscaler (HPA) for backend and frontend
- Network policies for zero-trust security posture
- RBAC configuration for backend service account
- Persistent volume claim for upload storage
- Pre/post-deployment and rollback checklists

### Changed
- Enhanced existing E2E workflow into comprehensive CI pipeline
- Added concurrency groups and cancel-in-progress to all workflows
- Added Prometheus scrape annotations to service definitions
- Optimized Docker layer caching in CI pipeline

### Security
- Integrated Trivy for filesystem and IaC security scanning
- Added Gitleaks secrets detection
- Scheduled weekly security scans
- Network policies enforcing zero-trust access control

## [0.1.0] - 2026-06-01

### Added
- Initial release of VrixoBase
- Authentication system with JWT, OAuth (GitHub, Google), MFA
- Database management with schema editor and SQL queries
- File storage with S3-compatible API (MinIO)
- Serverless functions with event-driven execution
- Realtime subscriptions via WebSocket
- Monitoring dashboard with metrics and error tracking
- Role-based access control (RBAC)
- Audit logging
- Swagger API documentation
- Docker Compose production setup
- Prometheus + Grafana monitoring stack
- Backup and restore operations system
- Health check system with dependency monitoring
