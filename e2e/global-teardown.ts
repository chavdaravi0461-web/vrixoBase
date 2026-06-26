import { FullConfig } from '@playwright/test';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  const accessToken = process.env.E2E_ACCESS_TOKEN;
  const projectId = process.env.E2E_PROJECT_ID;

  if (!accessToken) {
    console.log('[global-teardown] No access token found, skipping cleanup.');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  if (projectId) {
    try {
      const tablesRes = await fetch(`${BACKEND_URL}/api/database/${projectId}/tables`, { headers });
      if (tablesRes.ok) {
        const tables = await tablesRes.json();
        const tableList = tables.data || tables;
        if (Array.isArray(tableList)) {
          for (const table of tableList) {
            if (table.name && table.name.startsWith('e2e_')) {
              await fetch(
                `${BACKEND_URL}/api/database/${projectId}/tables/${encodeURIComponent(table.name)}`,
                { method: 'DELETE', headers },
              ).catch(() => {});
            }
          }
        }
      }
    } catch {}

    try {
      await fetch(`${BACKEND_URL}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers,
      }).catch(() => {});
    } catch {}
  }

  console.log('[global-teardown] Cleanup complete.');
}
