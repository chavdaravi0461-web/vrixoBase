# Post-Deployment Checklist

## Monitoring
- [ ] Error rates stable (< 0.1% increase from baseline)
- [ ] P99 latency within SLO (< 500ms for API, < 2s for queries)
- [ ] CPU/Memory usage within expected ranges
- [ ] Database connection pool not exhausted
- [ ] Redis memory usage normal
- [ ] No 5xx errors in access logs
- [ ] Prometheus targets all UP
- [ ] Grafana dashboards showing correct data

## Database
- [ ] Migration applied successfully (check `prisma migrate status`)
- [ ] Query performance unchanged or improved
- [ ] No slow queries in logs
- [ ] Replication lag < 1s

## User Experience
- [ ] All critical user journeys working
- [ ] No increase in support tickets related to deployment
- [ ] Load times within normal range

## Cleanup
- [ ] Old deployment resources cleaned up (if applicable)
- [ ] Old images tagged for retention pruned
- [ ] Deployment documented in release notes
- [ ] Post-mortem scheduled (if issues occurred)
- [ ] Monitoring baseline reset for next deployment
