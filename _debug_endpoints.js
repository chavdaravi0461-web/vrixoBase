const BASE = 'http://localhost:4001/api';

async function main() {
  const email = `audit_debug3_${Date.now()}@test.com`;
  const pw = 'TestPass123!';

  // Register
  const reg = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw, name: 'Debug3' })
  });
  console.log('REGISTER:', reg.status);

  // Login
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw })
  });
  const loginData = await login.json();
  console.log('LOGIN:', login.status, JSON.stringify({ 
    success: loginData.success,
    hasData: !!loginData.data,
    dataKeys: loginData.data ? Object.keys(loginData.data) : [],
    accessToken: loginData?.data?.accessToken ? loginData.data.accessToken.substring(0, 20) + '...' : 'MISSING'
  }));

  const token = loginData?.data?.accessToken;
  if (!token) { console.log('NO TOKEN - aborting'); return; }

  // Test create table with more detail
  const projRes = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Debug Project' })
  });
  const projData = await projRes.json();
  const projectId = projData?.data?.id || projData?.id;
  console.log('PROJECT:', projRes.status, 'id:', projectId);

  if (!projectId) { console.log('NO PROJECT'); return; }

  // Try to create table
  const tableRes = await fetch(`${BASE}/database/${projectId}/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'test_items',
      columns: [
        { name: 'id', type: 'uuid', defaultValue: 'gen_random_uuid()' },
        { name: 'title', type: 'varchar(255)' },
        { name: 'count', type: 'integer' }
      ]
    })
  });
  const tableData = await tableRes.json();
  console.log('CREATE TABLE:', tableRes.status, JSON.stringify(tableData).slice(0, 200));

  // Try bucket
  const bucketRes = await fetch(`${BASE}/storage/${projectId}/buckets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'debug-bucket', maxFileSize: 10485760 })
  });
  const bucketData = await bucketRes.json();
  console.log('CREATE BUCKET:', bucketRes.status, JSON.stringify(bucketData).slice(0, 200));

  // Try RLS policy
  const policyRes = await fetch(`${BASE}/security/${projectId}/policies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'test_policy', tableName: 'test_items', policyType: 'SELECT', policyExpression: 'true' })
  });
  const policyData = await policyRes.json();
  console.log('CREATE POLICY:', policyRes.status, JSON.stringify(policyData).slice(0, 200));

  // Try realtime subscription
  const subRes = await fetch(`${BASE}/realtime/${projectId}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tableName: 'test_items', event: 'INSERT' })
  });
  const subData = await subRes.json();
  console.log('REALTIME SUB:', subRes.status, JSON.stringify(subData).slice(0, 200));

  // SQL query
  const sqlRes = await fetch(`${BASE}/database/${projectId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sql: "SELECT * FROM pg_catalog.pg_tables LIMIT 1" })
  });
  const sqlData = await sqlRes.json();
  console.log('SQL QUERY:', sqlRes.status, JSON.stringify(sqlData).slice(0, 200));
}
main().catch(e => console.error('FATAL:', e.message));
