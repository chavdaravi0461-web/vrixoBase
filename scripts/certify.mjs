#!/usr/bin/env node

// VrixoBase Production Certification Report
// Usage: node scripts/certify.mjs [--base-url=http://localhost:4001/api]
// Runs all certification modules and produces a single production certification report.
// Writes production-certification-report.json and release-report.json.

const FS = await import('fs/promises');
const CP = await import('child_process');
const BASE = (process.argv.find(a => a.startsWith('--base-url=')) || '--base-url=http://localhost:4001/api').split('=')[1];
const API = `${BASE}`;

function execScript(script, label) {
  return new Promise((resolve) => {
    console.log(`\n\x1b[36m▶ ${label}\x1b[0m`);
    try {
      const out = CP.execSync(`node ${script} --base-url=${API}`, {
        encoding: 'utf8',
        timeout: 60000,
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      resolve({ success: true, stdout: out });
    } catch (e) {
      resolve({ success: false, stdout: e.stdout || '', stderr: e.stderr || e.message });
    }
  });
}

async function loadJson(path) {
  try {
    const raw = await FS.readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

async function fetchJson(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) });
    return { status: res.status, body: await res.json().catch(() => ({})), ok: res.ok };
  } catch { return { status: 0, body: { error: 'unreachable' }, ok: false }; }
}

async function main() {
  const startTime = Date.now();

  console.log(`\n\x1b[36m\x1b[1m═══════════════════════════════════════════════\x1b[0m`);
  console.log(`\x1b[36m\x1b[1m  VrixoBase — Production Certification Report\x1b[0m`);
  console.log(`\x1b[36m\x1b[1m  ${new Date().toISOString()}\x1b[0m`);
  console.log(`\x1b[36m\x1b[1m  Target: ${API}\x1b[0m`);
  console.log(`\x1b[36m\x1b[1m═══════════════════════════════════════════════\x1b[0m\n`);

  // ── Step 1: Runtime Status ──────────────────────────────
  console.log(`\x1b[1m[1/7] Runtime Status\x1b[0m`);
  const health = await fetchJson(`${API}/health`);
  const simple = await fetchJson(`${API}/health/simple`);
  const liveness = await fetchJson(`${API}/health/liveness`);
  const readiness = await fetchJson(`${API}/health/readiness`);
  const runtimeHealthy = liveness.body?.data?.status === 'alive' && readiness.body?.data?.status === 'ready';
  console.log(`  ${runtimeHealthy ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m Runtime: ${runtimeHealthy ? 'healthy' : 'degraded'}`);
  console.log(`  Uptime: ${simple.body?.uptime || 0}s`);

  // ── Step 2: Smoke Tests ────────────────────────────────
  const smokeResult = await execScript('scripts/smoke.mjs', 'Smoke Tests');
  const smokePassed = smokeResult.success && !smokeResult.stdout.match(/✗/);

  // ── Step 3: Release Report ─────────────────────────────
  const reportResult = await execScript('scripts/report.mjs', 'Release Report');
  const releaseReport = await loadJson('release-report.json');

  // ── Step 4: Startup Timing ─────────────────────────────
  await execScript('scripts/startup-timing.mjs', 'Startup Timing');
  const timingResults = await loadJson('scripts/.startup-timing-results.json');

  // ── Step 5: Memory Baseline ────────────────────────────
  await execScript('scripts/memory-baseline.mjs', 'Memory Baseline');
  const memoryResults = await loadJson('scripts/.memory-baseline-results.json');

  // ── Step 6: Dependency Audit ───────────────────────────
  const depResult = await execScript('scripts/dependency-audit.mjs', 'Dependency Audit');
  const depResults = await loadJson('scripts/.dependency-audit-results.json');

  // ── Step 7: Rollback Verification ──────────────────────
  const rollbackResult = await execScript('scripts/rollback-check.mjs', 'Rollback Verification');
  const rollbackResults = await loadJson('scripts/.rollback-results.json');

  // ── Step 8: Health Summary ─────────────────────────────
  console.log(`\n\x1b[1m[Health Summary]\x1b[0m`);
  const checks = health.body?.data?.checks || {};
  for (const [svc, info] of Object.entries(checks)) {
    const icon = info.status === 'healthy' ? '\x1b[32m✓\x1b[0m' : info.status === 'degraded' ? '\x1b[33m~\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${icon} ${svc}: ${info.status} ${info.latencyMs != null ? `(${info.latencyMs}ms)` : ''}${info.error ? ` — ${info.error}` : ''}`);
  }

  // ── Build Certification Report ─────────────────────────
  const allPassed = smokePassed && runtimeHealthy;
  const overrides = {};

  const report = {
    certification: {
      version: releaseReport?.release?.version || '0.1.0',
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: allPassed ? 'certified' : 'failed',
      summary: {
        allPassed,
        smokePassed,
        runtimeHealthy,
      },
    },
    runtime: {
      status: runtimeHealthy ? 'healthy' : 'degraded',
      uptimeSeconds: simple.body?.uptime || 0,
      liveness: liveness.body?.data?.status || 'unknown',
      readiness: readiness.body?.data?.status || 'unknown',
      timestamp: new Date().toISOString(),
    },
    deployment: {
      baseUrl: API,
      version: releaseReport?.release?.version || '0.1.0',
      buildTime: releaseReport?.release?.buildTime || null,
      git: releaseReport?.git || null,
    },
    health: {
      status: health.body?.data?.status || 'unknown',
      dependencies: Object.fromEntries(
        Object.entries(checks).map(([svc, info]) => [svc, { status: info.status, latencyMs: info.latencyMs, error: info.error || null }])
      ),
    },
    smokeTests: {
      passed: smokePassed,
      output: smokeResult.stdout?.split('\n').slice(-6).join('\n') || '',
    },
    timing: timingResults || null,
    memory: memoryResults || null,
    dependencies: depResults || null,
    rollback: rollbackResults || null,
    releaseReport,
  };

  await FS.writeFile('production-certification-report.json', JSON.stringify(report, null, 2), 'utf8');

  // Update release-report.json to include full certification data
  if (releaseReport) {
    releaseReport.certification = {
      status: allPassed ? 'passed' : 'failed',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      runtimeVerification: runtimeHealthy ? 'passed' : 'failed',
      smokeTests: smokePassed ? 'passed' : 'failed',
    };
    await FS.writeFile('release-report.json', JSON.stringify(releaseReport, null, 2), 'utf8');
  }

  // ── Final Output ───────────────────────────────────────
  console.log(`\n\x1b[36m\x1b[1m═══════════════════════════════════════════════\x1b[0m`);
  if (allPassed) {
    console.log(`\x1b[32m\x1b[1m  ✓ PLATFORM CERTIFIED\x1b[0m`);
    console.log(`\x1b[32m    All smoke tests passed — runtime healthy\x1b[0m`);
  } else {
    console.log(`\x1b[31m\x1b[1m  ✗ CERTIFICATION FAILED\x1b[0m`);
    if (!runtimeHealthy) console.log(`\x1b[31m    Runtime is not healthy\x1b[0m`);
    if (!smokePassed) console.log(`\x1b[31m    Smoke tests failed\x1b[0m`);
  }
  console.log(`\x1b[36m\x1b[1m═══════════════════════════════════════════════\x1b[0m`);
  console.log(`  Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`  Report:   production-certification-report.json`);
  console.log(`  Release:  release-report.json`);
  console.log(`\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(e => { console.error(`FATAL: ${e.message}`); process.exit(1); });
