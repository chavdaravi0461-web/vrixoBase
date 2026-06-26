#!/usr/bin/env node

// VrixoBase Release Certification
// Usage: node scripts/report.mjs [--base-url=http://localhost:4001/api]
// Generates release-report.json with git commit, version, build time, deployment time,
// runtime verification, health summary, and dependency summary.

const FS = await import('fs/promises');
const CP = await import('child_process');
const BASE = (process.argv.find(a => a.startsWith('--base-url=')) || '--base-url=http://localhost:4001/api').split('=')[1];
const API = `${BASE}`;

function run(cmd) {
  try { return CP.execSync(cmd, { encoding: 'utf8', cwd: process.cwd() }).trim(); }
  catch { return 'unknown'; }
}

async function fetchJson(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body, ok: res.ok };
  } catch (e) { return { status: 0, body: { error: e.message }, ok: false }; }
}

async function main() {
  const buildTime = new Date().toISOString();
  const gitCommit = run('git rev-parse HEAD');
  const gitBranch = run('git rev-parse --abbrev-ref HEAD');
  const gitTag = run('git describe --tags --exact-match 2>nul || echo ""');
  const gitMessage = run('git log -1 --pretty=%s');
  const gitAuthor = run('git log -1 --pretty=%an');
  const gitDate = run('git log -1 --format=%cI');

  const pkgRaw = await FS.readFile('package.json', 'utf8').catch(() => '{}');
  const pkg = JSON.parse(pkgRaw);
  const version = pkg.version || '0.0.0';

  // Fetch health
  const health = await fetchJson(`${API}/health`);
  const simple = await fetchJson(`${API}/health/simple`);
  const liveness = await fetchJson(`${API}/health/liveness`);
  const readiness = await fetchJson(`${API}/health/readiness`);

  // Fetch dependencies from health check
  const checks = health.body?.data?.checks || {};
  const depSummary = {};
  for (const [svc, info] of Object.entries(checks)) {
    depSummary[svc] = { status: info.status, latencyMs: info.latencyMs, error: info.error || null };
  }

  const runtimeOk = liveness.body?.data?.status === 'alive' && readiness.body?.data?.status === 'ready';

  const report = {
    release: {
      version,
      buildTime,
      generatedAt: new Date().toISOString(),
    },
    git: {
      commit: gitCommit,
      branch: gitBranch,
      tag: gitTag || null,
      message: gitMessage,
      author: gitAuthor,
      date: gitDate,
    },
    deployment: {
      baseUrl: API,
      status: runtimeOk ? 'healthy' : 'degraded',
      uptime: simple.body?.uptime || 0,
    },
    health: {
      status: health.body?.data?.status || 'unknown',
      liveness: liveness.body?.data?.status || 'unknown',
      readiness: readiness.body?.data?.status || 'unknown',
    },
    dependencies: depSummary,
    runtime: {
      verification: runtimeOk ? 'passed' : 'failed',
      timestamp: new Date().toISOString(),
    },
  };

  await FS.writeFile('release-report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.error(`\n✓ release-report.json written (${Object.keys(depSummary).length} dependencies checked)`);
}

main().catch(e => { console.error(`FATAL: ${e.message}`); process.exit(1); });
