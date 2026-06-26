import { check } from 'k6';
import http from 'k6/http';
import { BASE_URL } from '../config.js';

export function createProject(token, csrfToken) {
  const name = `load-project-${__VU}_${Date.now()}`;
  const res = http.post(`${BASE_URL}/projects`, JSON.stringify({ name }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
  });
  check(res, { 'create project 201': (r) => r.status === 201 });
  if (res.status === 201) return res.json().id || res.json().data?.id;
  return null;
}

export function listProjects(token) {
  const res = http.get(`${BASE_URL}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'list projects 200': (r) => r.status === 200 });
  return res.json();
}

export function getProject(token, projectId) {
  const res = http.get(`${BASE_URL}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'get project 200': (r) => r.status === 200 });
}

export function deleteProject(token, projectId, csrfToken) {
  const res = http.del(`${BASE_URL}/projects/${projectId}`, null, {
    headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
  });
  check(res, { 'delete project 200': (r) => r.status === 200 || r.status === 204 });
}
