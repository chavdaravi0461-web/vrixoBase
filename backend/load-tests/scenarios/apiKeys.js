import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL } from '../config.js';

export function createApiKey(token, projectId, csrfToken) {
  const name = `load-apikey-${__VU}_${Date.now()}`;
  const res = http.post(`${BASE_URL}/api-keys/${projectId}`, JSON.stringify({
    name,
    scopes: ['database:read'],
  }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
  });
  check(res, { 'create apikey 201': (r) => r.status === 201 });
  if (res.status === 201) return res.json().key || res.json().data?.key;
  return null;
}

export function listApiKeys(token, projectId) {
  const res = http.get(`${BASE_URL}/api-keys/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'list apikeys 200': (r) => r.status === 200 });
}
