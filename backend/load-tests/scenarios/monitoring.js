import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL } from '../config.js';

export function getMetrics(token, projectId) {
  const res = http.get(`${BASE_URL}/monitoring/${projectId}/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'metrics 200': (r) => r.status === 200 });
}

export function getAuditLogs(token, projectId) {
  const res = http.get(`${BASE_URL}/audit/${projectId}?limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'audit logs 200': (r) => r.status === 200 });
}
