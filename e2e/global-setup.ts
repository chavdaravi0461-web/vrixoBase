import { FullConfig } from '@playwright/test';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com',
  password: process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026',
  name: process.env.TEST_USER_NAME || 'E2E Test User',
};

async function ensureBackendReady(): Promise<void> {
  const maxRetries = 15;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Backend at ${BACKEND_URL} not ready after ${maxRetries * 2}s`);
}

async function ensureFrontendReady(): Promise<void> {
  const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const maxRetries = 15;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(frontendUrl);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Frontend at ${frontendUrl} not ready after ${maxRetries * 2}s`);
}

async function createTestUser(): Promise<{ accessToken: string; refreshToken: string }> {
  const registerBody = {
    email: TEST_USER.email,
    password: TEST_USER.password,
    name: TEST_USER.name,
  };

  const registerRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registerBody),
  });

  if (registerRes.ok) {
    const data = await registerRes.json();
    const tokens = data.data || data;
    if (tokens.accessToken) {
      return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }
  }

  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
  });

  if (!loginRes.ok) {
    throw new Error(`Cannot create or login test user: ${loginRes.status} ${await loginRes.text()}`);
  }

  const data = await loginRes.json();
  const tokens = data.data || data;
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

async function createTestProject(accessToken: string): Promise<string> {
  const projectBody = { name: `E2E-Test-${Date.now()}`, description: 'Auto-created by E2E test suite' };

  const res = await fetch(`${BACKEND_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(projectBody),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`Project creation failed (${res.status}): ${text}. Tests may still work.`);
    return '';
  }

  const data = await res.json();
  const project = data.data || data;
  return project.id || '';
}

async function createTestTable(accessToken: string, projectId: string): Promise<void> {
  const tableBody = {
    name: 'e2e_test_items',
    description: 'Auto-created by E2E tests',
    columns: [
      { name: 'id', type: 'SERIAL', isPrimary: true },
      { name: 'title', type: 'VARCHAR(255)', isNullable: false },
      { name: 'description', type: 'TEXT', isNullable: true },
      { name: 'status', type: 'VARCHAR(50)', defaultValue: "'active'" },
      { name: 'created_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()' },
    ],
  };

  const res = await fetch(`${BACKEND_URL}/api/database/${projectId}/tables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(tableBody),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`Test table creation failed (${res.status}): ${text}`);
  }
}

async function createTestBucket(accessToken: string, projectId: string): Promise<string> {
  const bucketBody = {
    name: `e2e-test-bucket-${Date.now()}`,
    isPublic: true,
  };

  const res = await fetch(`${BACKEND_URL}/api/storage/${projectId}/buckets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(bucketBody),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`Bucket creation failed (${res.status}): ${text}`);
    return '';
  }

  const data = await res.json();
  const bucket = data.data || data;
  return bucket.name || bucket.id || '';
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('[global-setup] Verifying backend and frontend are running...');
  await ensureBackendReady();
  await ensureFrontendReady();

  console.log('[global-setup] Creating test user and seeding data...');
  const { accessToken, refreshToken } = await createTestUser();

  const projectId = await createTestProject(accessToken);

  if (projectId) {
    await createTestTable(accessToken, projectId);
    await createTestBucket(accessToken, projectId);
  }

  process.env.E2E_ACCESS_TOKEN = accessToken;
  process.env.E2E_REFRESH_TOKEN = refreshToken;
  process.env.E2E_PROJECT_ID = projectId;

  console.log('[global-setup] Complete.');
  console.log(`  Access Token: ${accessToken.substring(0, 20)}...`);
  console.log(`  Project ID: ${projectId || '(none)'}`);
}
