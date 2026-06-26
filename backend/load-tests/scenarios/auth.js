import { check, sleep } from 'k6';
import http from 'k6/http';
import { BASE_URL, AUTH_USER, AUTH_PASS, CSRF_TOKEN } from '../config.js';

let registeredUsers = 0;

export function register() {
  const email = `load_${__VU}_${Date.now()}@test.com`;
  const payload = JSON.stringify({ email, password: AUTH_PASS, name: `Load User ${__VU}` });
  const res = http.post(`${BASE_URL}/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN },
  });
  check(res, { 'register status 201': (r) => r.status === 201 });
  if (res.status === 201) registeredUsers++;
  const body = res.json();
  return body.accessToken || null;
}

export function login() {
  const email = `load_login_${__VU}@test.com`;
  const payload = JSON.stringify({ email, password: AUTH_PASS });
  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'login status 201': (r) => r.status === 201 || r.status === 200 });
  if (res.status === 201 || res.status === 200) {
    const body = res.json();
    return body.accessToken || body.data?.accessToken || null;
  }
  return null;
}

export function me(token) {
  const res = http.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'me status 200': (r) => r.status === 200 });
}

export function refresh(token) {
  const res = http.post(`${BASE_URL}/auth/refresh`, JSON.stringify({ refreshToken: token }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  check(res, { 'refresh status 201': (r) => r.status === 201 || r.status === 200 });
}

export function getCsrfToken(token) {
  const res = http.get(`${BASE_URL}/auth/csrf-token`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, { 'csrf token status 200': (r) => r.status === 200 });
}
