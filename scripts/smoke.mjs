#!/usr/bin/env node

// VrixoBase Production Smoke Test Suite
// Usage: node scripts/smoke.mjs [--base-url=http://localhost:4001/api]
// Returns exit code 0 if all smoke tests pass.

const BASE = (process.argv.find(a => a.startsWith('--base-url=')) || '--base-url=http://localhost:4001/api').split('=')[1];
const API = `${BASE}`;

let passed = 0;
let failed = 0;
const results = [];

function test(name, pass, detail) {
  if (pass) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${detail || ''}`); }
  results.push({ name, pass, detail: detail || '' });
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, ok: res.ok };
}

async function main() {
  const startTime = Date.now();
  const email = `smoke_${Date.now()}@vrixo.test`;
  const password = 'SmokeTestPass1!';

  console.log(`\n\x1b[36m\x1b[1mVrixoBase — Production Smoke Test Suite\x1b[0m`);
  console.log(`  Target: ${API}`);
  console.log(`  Email:  ${email}\n`);

  // ── 1. Health ───────────────────────────────────────────
  console.log(`\x1b[1m1. Health Checks\x1b[0m`);
  const h = await fetchJson(`${API}/health`);
  test('GET /health returns 200', h.status === 200, `${h.status}`);
  test('health status is healthy or degraded', ['healthy', 'degraded'].includes(h.body?.data?.status), h.body?.data?.status);
  test('health includes database check', h.body?.data?.checks?.database?.status, h.body?.data?.checks?.database?.status);
  test('health includes redis check', h.body?.data?.checks?.redis?.status, h.body?.data?.checks?.redis?.status);
  test('health includes minio check', h.body?.data?.checks?.minio?.status, h.body?.data?.checks?.minio?.status);

  const hS = await fetchJson(`${API}/health/simple`);
  test('GET /health/simple returns 200', hS.status === 200, `${hS.status}`);

  const hL = await fetchJson(`${API}/health/liveness`);
  test('GET /health/liveness returns 200', hL.status === 200, `${hL.status}`);

  const hR = await fetchJson(`${API}/health/readiness`);
  test('GET /health/readiness returns 200', hR.status === 200, `${hR.status}`);

  // ── 2. Metrics ──────────────────────────────────────────
  console.log(`\n\x1b[1m2. Metrics\x1b[0m`);
  const mRes = await fetch(API + '/metrics', { signal: AbortSignal.timeout(5000) });
  const mText = await mRes.text();
  test('GET /metrics returns 200', mRes.status === 200, `${mRes.status}`);
  test('metrics contain vrixo_ prefix', mText.includes('vrixo_'), `prefix found`);
  test('metrics contain http_requests_total', mText.includes('http_requests_total'), `found`);

  // ── 3. Auth — Register ──────────────────────────────────
  console.log(`\n\x1b[1m3. Auth — Register\x1b[0m`);
  const reg = await fetchJson(`${API}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ email, password, name: 'Smoke Test' }),
  });
  test('POST /auth/register returns 201', reg.status === 201, `${reg.status}`);

  // ── 4. Auth — Login ─────────────────────────────────────
  console.log(`\n\x1b[1m4. Auth — Login\x1b[0m`);
  const login = await fetchJson(`${API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const token = login.body?.data?.accessToken;
  test('POST /auth/login returns 200/201', [200, 201].includes(login.status), `${login.status}`);
  test('login returns access token', !!token, `${!!token}`);
  if (!token) { console.log('\n\x1b[31mABORT: No auth token — cannot proceed\x1b[0m\n'); printSummary(startTime); process.exit(1); }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── 5. Projects — Create ────────────────────────────────
  console.log(`\n\x1b[1m5. Projects — Create\x1b[0m`);
  const proj = await fetchJson(`${API}/projects`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: `Smoke Project ${Date.now()}` }),
  });
  const projectId = proj.body?.data?.id;
  test('POST /projects returns 201', proj.status === 201, `${proj.status}`);
  test('project has an id', !!projectId, projectId || 'none');

  // ── 6. Projects — List ──────────────────────────────────
  console.log(`\n\x1b[1m6. Projects — List\x1b[0m`);
  const projList = await fetchJson(`${API}/projects`, { headers: authHeaders });
  test('GET /projects returns 200', projList.status === 200, `${projList.status}`);
  test('projects list is an array', Array.isArray(projList.body?.data), `${typeof projList.body?.data}`);

  if (!projectId) { console.log('\n\x1b[33mSKIP: Remaining tests need a projectId\x1b[0m\n'); printSummary(startTime); process.exit(failed > 0 ? 1 : 0); }

  // ── 7. Database — Create Table ──────────────────────────
  console.log(`\n\x1b[1m7. Database — Create Table\x1b[0m`);
  const table = await fetchJson(`${API}/database/${projectId}/tables`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'smoke_items',
      columns: [
        { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()', isPrimary: true },
        { name: 'label', type: 'varchar', isNullable: false },
      ],
    }),
  });
  test('POST /database/:pid/tables returns 201', table.status === 201, `${table.status}`);
  test('create table response includes id', !!table.body?.data?.id, `${!!table.body?.data?.id}`);

  // ── 8. Database — List Tables ───────────────────────────
  console.log(`\n\x1b[1m8. Database — List Tables\x1b[0m`);
  const tables = await fetchJson(`${API}/database/${projectId}/tables`, { headers: authHeaders });
  const tableId = tables.body?.data?.[0]?.id;
  test('GET /database/:pid/tables returns 200', tables.status === 200, `${tables.status}`);
  test('tables list has at least 1 table', (tables.body?.data?.length || 0) > 0, `count=${tables.body?.data?.length}`);
  test('table has an id', !!tableId, tableId || 'none');

  // ── 9. Storage — Create Bucket ──────────────────────────
  console.log(`\n\x1b[1m9. Storage — Create Bucket\x1b[0m`);
  const bucket = await fetchJson(`${API}/storage/${projectId}/buckets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'smoke-bucket', isPublic: false }),
  });
  test('POST /storage/:pid/buckets returns 201', bucket.status === 201, `${bucket.status}`);
  test('bucket has an id', !!bucket.body?.data?.id, `${!!bucket.body?.data?.id}`);

  // ── 10. Storage — List Buckets ──────────────────────────
  console.log(`\n\x1b[1m10. Storage — List Buckets\x1b[0m`);
  const buckets = await fetchJson(`${API}/storage/${projectId}/buckets`, { headers: authHeaders });
  test('GET /storage/:pid/buckets returns 200', buckets.status === 200, `${buckets.status}`);
  test('buckets list is an array', Array.isArray(buckets.body?.data), `${typeof buckets.body?.data}`);

  // ── 11. Realtime — Create Subscription ──────────────────
  console.log(`\n\x1b[1m11. Realtime — Create Subscription\x1b[0m`);
  if (tableId) {
    const sub = await fetchJson(`${API}/realtime/${projectId}/subscriptions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ tableId, eventType: 'INSERT' }),
    });
    test('POST /realtime/:pid/subscriptions returns 201', sub.status === 201, `${sub.status}`);
  } else {
    test('POST /realtime/:pid/subscriptions — SKIP (no tableId)', true, 'tableId unavailable');
  }

  // ── 12. Functions — List ────────────────────────────────
  console.log(`\n\x1b[1m12. Functions — List\x1b[0m`);
  const funcs = await fetchJson(`${API}/functions/${projectId}`, { headers: authHeaders });
  test('GET /functions/:pid returns 200', funcs.status === 200, `${funcs.status}`);

  // ── 13. Monitoring — Database ───────────────────────────
  console.log(`\n\x1b[1m13. Monitoring — Database\x1b[0m`);
  const mon = await fetchJson(`${API}/monitoring/${projectId}/database`, { headers: authHeaders });
  test('GET /monitoring/:pid/database returns 200', mon.status === 200, `${mon.status}`);

  // ── 14. Security — List Policies ────────────────────────
  console.log(`\n\x1b[1m14. Security — List Policies\x1b[0m`);
  const pols = await fetchJson(`${API}/security/${projectId}/policies`, { headers: authHeaders });
  test('GET /security/:pid/policies returns 200', pols.status === 200, `${pols.status}`);
  test('policies list is an array', Array.isArray(pols.body?.data), `${typeof pols.body?.data}`);

  // ── 15. Team — List Members ─────────────────────────────
  console.log(`\n\x1b[1m15. Team — List Members\x1b[0m`);
  const team = await fetchJson(`${API}/team/${projectId}/members`, { headers: authHeaders });
  test('GET /team/:pid/members returns 200', team.status === 200, `${team.status}`);
  test('members list is an array', Array.isArray(team.body?.data), `${typeof team.body?.data}`);

  // ── 16. Audit — List Logs ───────────────────────────────
  console.log(`\n\x1b[1m16. Audit — List Logs\x1b[0m`);
  const audit = await fetchJson(`${API}/audit/${projectId}`, { headers: authHeaders });
  test('GET /audit/:pid returns 200', audit.status === 200, `${audit.status}`);
  test('audit logs is an array', Array.isArray(audit.body?.data), `${typeof audit.body?.data}`);

  // ── Summary ─────────────────────────────────────────────
  printSummary(startTime);
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary(startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\x1b[36m\x1b[1m═══════════════════════════════════════\x1b[0m`);
  console.log(`  Smoke Tests: \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m, ${elapsed}s`);
  console.log(`\x1b[36m\x1b[1m═══════════════════════════════════════\x1b[0m\n`);
}

main().catch(e => { console.error(`\n\x1b[31mFATAL:\x1b[0m ${e.message}\n`); process.exit(1); });
