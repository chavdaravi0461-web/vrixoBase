import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, OPTIONS } from './config.js';

export let options = OPTIONS;

export function setup() {
  const email = `master_${Date.now()}@loadtest.com`;
  const regRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
    email, password: 'MasterPass1234!', name: 'Master User',
  }), { headers: { 'Content-Type': 'application/json' } });

  let masterToken = null;
  if (regRes.status === 201) {
    masterToken = regRes.json().data.accessToken;
  }

  let csrfToken = '';
  const csrfRes = http.get(`${BASE_URL}/auth/csrf-token`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  if (csrfRes.status === 200) {
    const body = csrfRes.json();
    csrfToken = body.data?.token || '';
  }

  const projRes = http.post(`${BASE_URL}/projects`, JSON.stringify({
    name: `load-project-${Date.now()}`,
  }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
  });
  let projectId = null;
  if (projRes.status === 201) projectId = projRes.json().data.id;

  const bucketRes = http.post(`${BASE_URL}/storage/${projectId}/buckets`, JSON.stringify({
    name: `load-bucket-${Date.now()}`, isPublic: true,
  }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
  });
  let bucketId = null;
  if (bucketRes.status === 201) bucketId = bucketRes.json().data.id;

  console.log(`Setup: token=${masterToken?'OK':'FAIL'} project=${projectId} bucket=${bucketId}`);
  return { masterToken, projectId, bucketId, csrfToken };
}

export default function (data) {
  if (!data.masterToken || !data.projectId || !data.bucketId) {
    console.warn(`VU ${__VU}: No setup data`);
    return;
  }
  const { masterToken, projectId, bucketId, csrfToken } = data;

  // Health (no auth)
  let res = http.get(`${BASE_URL}/health`);
  check(res, { 'health': (r) => r.status === 200 });
  if (__ITER === 10 && __VU === 1) console.log(`health[10]: ${res.status} ${res.body.length > 100 ? res.body.slice(0,100)+'...' : res.body}`);

  // Auth
  res = http.get(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'auth/me': (r) => r.status === 200 });

  // Projects
  res = http.get(`${BASE_URL}/projects`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'list projects': (r) => r.status === 200 });

  res = http.get(`${BASE_URL}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'get project': (r) => r.status === 200 });

  // Database
  res = http.get(`${BASE_URL}/database/${projectId}/tables`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'list tables': (r) => r.status === 200 });

  res = http.post(`${BASE_URL}/database/${projectId}/query`, JSON.stringify({ query: 'SELECT 1 as test' }), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'execute query': (r) => r.status === 200 });

  // Storage
  res = http.get(`${BASE_URL}/storage/buckets/${bucketId}/files`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'list files': (r) => r.status === 200 });

  // API Keys
  res = http.get(`${BASE_URL}/api-keys/${projectId}`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'list api keys': (r) => r.status === 200 });

  // Functions
  res = http.get(`${BASE_URL}/functions/${projectId}`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'list functions': (r) => r.status === 200 });

  // Monitoring
  res = http.get(`${BASE_URL}/monitoring/${projectId}/database`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'monitoring database': (r) => r.status === 200 });

  res = http.get(`${BASE_URL}/monitoring/${projectId}/api`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'monitoring api': (r) => r.status === 200 });

  res = http.get(`${BASE_URL}/audit/${projectId}?limit=10`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  check(res, { 'audit logs': (r) => r.status === 200 });
}
