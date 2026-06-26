const BASE = 'http://localhost:4001/api';

async function run() {
  const results = [];
  const email = 'audit_final2_' + Date.now() + '@test.com';

  // 1-5: Health
  console.log('=== HEALTH ===');
  for (const ep of ['/health', '/health/liveness', '/health/readiness', '/health/startup', '/health/version']) {
    const r = await fetch(`${BASE}${ep}`);
    console.log(`${ep}: ${r.status}`);
    results.push({ test: `Health ${ep}`, pass: r.status === 200 });
  }

  // 6: Metrics
  console.log('\n=== METRICS ===');
  const metrics = await fetch(`${BASE}/metrics`);
  const txt = await metrics.text();
  const hasMetrics = txt.includes('vrixo_');
  console.log(`/metrics: ${metrics.status}, prefix=${hasMetrics}`);
  results.push({ test: 'Prometheus metrics', pass: metrics.status === 200 && hasMetrics });

  // 7-8: Register + Login
  console.log('\n=== AUTH ===');
  const reg = await fetch(`${BASE}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass123!', name: 'Final Audit' })
  });
  console.log(`Register: ${reg.status}`);
  results.push({ test: 'Registration', pass: reg.status === 201 });

  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPass123!' })
  });
  const ld = await login.json();
  const token = ld?.data?.accessToken;
  const rt = ld?.data?.refreshToken;
  console.log(`Login: ${login.status}, token=${!!token}`);
  results.push({ test: 'Login', pass: (login.status === 200 || login.status === 201) && !!token });
  if (!token) { console.log('NO TOKEN'); return results; }

  const refresh = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ refreshToken: rt })
  });
  console.log(`Refresh: ${refresh.status}`);
  results.push({ test: 'Token refresh', pass: refresh.status === 200 || refresh.status === 201 });

  const me = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`GET /auth/me: ${me.status}`);
  results.push({ test: 'Get current user', pass: me.status === 200 });

  // 9-11: Projects
  console.log('\n=== PROJECTS ===');
  const proj = await fetch(`${BASE}/projects`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Final2 Audit Proj ' + Date.now() })
  });
  const pd = await proj.json();
  const pid = pd?.data?.id;
  console.log(`Create project: ${proj.status}, id=${!!pid}`);
  results.push({ test: 'Create project', pass: proj.status === 201 && !!pid });
  if (!pid) { console.log('NO PROJECT'); return results; }

  const plist = await fetch(`${BASE}/projects`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`List projects: ${plist.status}`);
  results.push({ test: 'List projects', pass: plist.status === 200 });

  const pstats = await fetch(`${BASE}/projects/${pid}/stats`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`Stats: ${pstats.status}`);
  results.push({ test: 'Project stats', pass: pstats.status === 200 });

  // 12-15: Database
  console.log('\n=== DATABASE ===');
  const table = await fetch(`${BASE}/database/${pid}/tables`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'audit_items',
      columns: [
        { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()', isPrimary: true },
        { name: 'title', type: 'varchar', isNullable: false },
        { name: 'count', type: 'integer', defaultValue: 0 }
      ]
    })
  });
  const td = await table.json();
  console.log(`Create table: ${table.status}`);
  // BUG: table id not returned in response - data object has name, description, columns but NO id
  results.push({ test: 'Create table', pass: table.status === 201 });

  const tables = await fetch(`${BASE}/database/${pid}/tables`, { headers: { Authorization: `Bearer ${token}` } });
  const tbd = await tables.json();
  const tcount = tbd?.data?.length || 0;
  // BUG: listed tables don't have id field either
  const firstTableId = tbd?.data?.[0]?.id;
  console.log(`List tables: ${tables.status}, count=${tcount}, tableId=${firstTableId || 'MISSING'}`);
  results.push({ test: 'List tables', pass: tables.status === 200 && tcount > 0 });

  // SQL blocklist test - this returns 400 with "forbidden" message, which is a block
  const query = await fetch(`${BASE}/database/${pid}/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: 'SELECT * FROM pg_catalog.pg_tables LIMIT 1' })
  });
  const qd = await query.json();
  const isBlocked = query.status === 400 && qd?.message?.[0]?.includes('forbidden');
  console.log(`SQL blocklist: ${query.status}, blocked=${isBlocked}`);
  results.push({ test: 'SQL blocklist blocking', pass: isBlocked });

  // 16-17: API Keys
  console.log('\n=== API KEYS ===');
  const ak = await fetch(`${BASE}/api-keys/${pid}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Final Key' })
  });
  const akd = await ak.json();
  console.log(`Create API key: ${ak.status}, key=${!!(akd?.data?.key)}`);
  results.push({ test: 'Create API key', pass: ak.status === 201 && !!akd?.data?.key });

  const akl = await fetch(`${BASE}/api-keys/${pid}`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`List API keys: ${akl.status}`);
  results.push({ test: 'List API keys', pass: akl.status === 200 });

  // 18-19: Storage
  console.log('\n=== STORAGE ===');
  const bk = await fetch(`${BASE}/storage/${pid}/buckets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'final-bucket', isPublic: false })
  });
  const bkd = await bk.json();
  console.log(`Create bucket: ${bk.status}, id=${!!(bkd?.data?.id)}`);
  results.push({ test: 'Create bucket', pass: bk.status === 201 && !!bkd?.data?.id });

  const bkl = await fetch(`${BASE}/storage/${pid}/buckets`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`List buckets: ${bkl.status}`);
  results.push({ test: 'List buckets', pass: bkl.status === 200 });

  // 20-22: Security
  console.log('\n=== SECURITY ===');
  const pl = await fetch(`${BASE}/security/${pid}/policies`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'pub_read', tableName: 'audit_items', definition: 'USING (true)' })
  });
  console.log(`Create policy: ${pl.status}`);
  results.push({ test: 'Create RLS policy', pass: pl.status === 201 });

  const pols = await fetch(`${BASE}/security/${pid}/policies`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`List policies: ${pols.status}`);
  results.push({ test: 'List RLS policies', pass: pols.status === 200 });

  const sc = await fetch(`${BASE}/security/${pid}/secrets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'final-secret', value: 'secret123' })
  });
  console.log(`Create secret: ${sc.status}`);
  results.push({ test: 'Create secret', pass: sc.status === 201 });

  const scs = await fetch(`${BASE}/security/${pid}/secrets`, { headers: { Authorization: `Bearer ${token}` } });
  const scd = await scs.json();
  const valHidden = !JSON.stringify(scd).includes('"value"');
  console.log(`List secrets: ${scs.status}, valHidden=${valHidden}`);
  results.push({ test: 'Secrets value hidden', pass: scs.status === 200 && valHidden });

  // 23: Team
  console.log('\n=== TEAM ===');
  const tm = await fetch(`${BASE}/team/${pid}/members`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`Members: ${tm.status}`);
  results.push({ test: 'Team members', pass: tm.status === 200 });

  // 24: Audit
  console.log('\n=== AUDIT ===');
  const al = await fetch(`${BASE}/audit/${pid}`, { headers: { Authorization: `Bearer ${token}` } });
  const ald = await al.json();
  const acount = ald?.data?.length || 0;
  console.log(`Audit logs: ${al.status}, count=${acount}`);
  results.push({ test: 'Audit logs', pass: al.status === 200 });

  // 25: Monitoring
  console.log('\n=== MONITORING ===');
  const mn = await fetch(`${BASE}/monitoring/${pid}/database`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(`Monitoring: ${mn.status}`);
  results.push({ test: 'Monitoring DB', pass: mn.status === 200 });

  // 26: AI (uses 'sql' not 'query')
  console.log('\n=== AI ===');
  const ai = await fetch(`${BASE}/ai/${pid}/explain-sql`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sql: 'SELECT 1' })
  });
  console.log(`AI explain: ${ai.status}`);
  results.push({ test: 'AI explain SQL', pass: ai.status === 200 || ai.status === 201 });

  // 27: Realtime (requires tableId UUID - backend doesn't return it from create/list)
  console.log('\n=== REALTIME ===');
  const tableId = tbd?.data?.[0]?.id;
  if (tableId) {
    const rsub = await fetch(`${BASE}/realtime/${pid}/subscriptions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tableId, eventType: 'INSERT' })
    });
    console.log(`Realtime sub: ${rsub.status}`);
    results.push({ test: 'Realtime subscription', pass: rsub.status === 201 });
  } else {
    // BUG: table ID not returned from database module - can't test realtime
    console.log('Realtime sub: SKIPPED (table ID not returned by backend)');
    results.push({ test: 'Realtime subscription', pass: false, detail: 'backend does not return table ID' });
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  let passed = 0, failed = 0;
  for (const r of results) {
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.test}`);
    if (r.pass) passed++; else failed++;
  }
  console.log(`\n${passed}/${results.length} passed, ${failed} failed`);
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
