import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL } from '../config.js';

export function listFunctions(token, projectId) {
  const res = http.get(`${BASE_URL}/functions/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'list functions 200': (r) => r.status === 200 });
}

export function createFunction(token, projectId, csrfToken) {
  const name = `load_func_${__VU}_${Date.now()}`;
  const res = http.post(`${BASE_URL}/functions/${projectId}`, JSON.stringify({
    name,
    source: 'module.exports = async (req) => ({ status: 200, body: { ok: true } });',
    timeout: 10,
  }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
  });
  check(res, { 'create function 201': (r) => r.status === 201 });
  if (res.status === 201) return res.json().id || res.json().data?.id;
  return null;
}
