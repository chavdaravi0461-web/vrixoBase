# Deployment Execution Checklist

## Pre-Flight
- [ ] Deployment pipeline triggered (CD workflow)
- [ ] Image tags match expected commit SHA
- [ ] Staging deployment completed successfully
- [ ] Staging health checks passed
- [ ] Staging smoke tests passed
- [ ] Production approval received from authorized reviewer

## Production Deployment
- [ ] Initial deploy to 1 pod (canary)
- [ ] Canary pod health verified (liveness, readiness, startup)
- [ ] Canary pod serving traffic correctly
- [ ] Scale up to full replica count (rolling update)
- [ ] All pods reach Ready state
- [ ] No errors in application logs
- [ ] No increase in error rate (check Grafana)
- [ ] No increase in P99 latency
- [ ] Database migrations executed (if applicable)
- [ ] Migration completed within expected duration

## Verification
- [ ] Health endpoint returns 200 (all endpoints: liveness, readiness, startup, dependencies)
- [ ] Frontend loads without errors
- [ ] Authentication flow works (login/register)
- [ ] API endpoints respond correctly
- [ ] File upload/download works
- [ ] Real-time connections establish correctly
- [ ] Prometheus metrics are being scraped
- [ ] No unexpected alerts triggered
- [ ] Rollback plan is ready and tested
