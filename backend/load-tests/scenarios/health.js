import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL } from '../config.js';

export function healthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'health 200': (r) => r.status === 200 });
}

export function swaggerDocs() {
  const res = http.get(`${BASE_URL}/docs`);
  check(res, { 'swagger 200 or 302': (r) => r.status === 200 || r.status === 302 });
}
