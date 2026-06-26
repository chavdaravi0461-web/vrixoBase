# Rollback Checklist

## Trigger Criteria
Any of the following triggers an immediate rollback:
- [ ] Health checks failing for > 30s after deployment
- [ ] Error rate increase > 5% from baseline
- [ ] P99 latency increase > 2x baseline
- [ ] Database migration failure (partial apply)
- [ ] Any critical user journey broken
- [ ] Security vulnerability discovered in deployed version

## Rollback Steps
- [ ] Execute CD rollback workflow (automatic) OR manual rollback:
- [ ] `kubectl rollout undo deployment/backend -n vrixo`
- [ ] Wait for backend rollout to complete (verify all pods Ready)
- [ ] `kubectl rollout undo deployment/frontend -n vrixo`
- [ ] Wait for frontend rollout to complete (verify all pods Ready)
- [ ] Run health verification on restored version
- [ ] Check error rates and latency returned to baseline
- [ ] If database migration was applied:
  - [ ] Run `prisma migrate resolve --rolled-back <migration>`
  - [ ] Verify database schema matches previous version
  - [ ] Verify no data integrity issues

## Post-Rollback
- [ ] Notify stakeholders of rollback and root cause
- [ ] Restore monitoring baselines
- [ ] Schedule investigation of deployment failure
- [ ] Update deployment process to prevent recurrence
- [ ] Link related issue/ticket to deployment record
