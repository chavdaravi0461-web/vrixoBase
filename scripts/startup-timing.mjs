#!/usr/bin/env node

// VrixoBase Startup Timing Measurement
// Usage: node scripts/startup-timing.mjs [--base-url=http://localhost:4001/api]
// Measures backend cold start, DB connection, Redis connection, MinIO connection times.

const BASE = (process.argv.find(a => a.startsWith('--base-url=')) || '--base-url=http://localhost:4001/api').split('=')[1];
const API = `${BASE}`;

async function measureLatency(url, label) {
  const trials = [];
  for (let i = 0; i < 3; i++) {
    const start = process.hrtime.bigint();
    try {
      await fetch(url, { signal: AbortSignal.timeout(5000) });
      const end = process.hrtime.bigint();
      trials.push(Number(end - start) / 1e6); // ms
    } catch (e) {
      trials.push(-1);
    }
  }
  const valid = trials.filter(t => t >= 0);
  const avg = valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1) : 'N/A';
  const min = valid.length > 0 ? Math.min(...valid).toFixed(1) : 'N/A';
  const max = valid.length > 0 ? Math.max(...valid).toFixed(1) : 'N/A';
  return { label, avgMs: avg, minMs: min, maxMs: max, trials };
}

async function main() {
  console.log(`\n\x1b[36m\x1b[1mVrixoBase — Startup Timing Measurement\x1b[0m\n`);

  // Determine if this is cold or warm
  const simple = await (await fetch(`${API}/health/simple`)).json().catch(() => ({}));
  const uptime = simple?.uptime || 0;

  const timings = {};

  // Backend cold start (estimated from uptime)
  timings.backend = {
    label: 'Backend Cold Start (estimated from uptime)',
    valueMs: uptime > 0 ? uptime * 1000 : 'N/A',
    source: uptime > 0 ? 'uptime from /health/simple' : 'backend not running',
  };

  // Simple ping
  const ping = await measureLatency(`${API}/health/simple`, 'Simple Ping');
  timings.ping = ping;

  // Full health
  const fullHealth = await measureLatency(`${API}/health`, 'Full Health Check');
  timings.fullHealth = fullHealth;

  // Database latency
  const dbLatency = await measureLatency(`${API}/health`, 'Database (from health.database.latencyMs)');
  const healthData = await (await fetch(`${API}/health`)).json().catch(() => ({}));
  const dbCheck = healthData?.data?.checks?.database?.latencyMs;
  timings.database = {
    label: 'Database Connection Time (from health check)',
    avgMs: dbCheck != null ? `${dbCheck}ms` : 'N/A',
    source: '/api/health',
  };

  const redisCheck = healthData?.data?.checks?.redis?.latencyMs;
  timings.redis = {
    label: 'Redis Connection Time (from health check)',
    avgMs: redisCheck != null ? `${redisCheck}ms` : 'N/A',
    source: '/api/health',
  };

  const minioCheck = healthData?.data?.checks?.minio?.latencyMs;
  timings.minio = {
    label: 'MinIO Connection Time (from health check)',
    avgMs: minioCheck != null ? `${minioCheck}ms` : 'N/A',
    source: '/api/health',
  };

  // Print table
  console.log(`  ${'Service'.padEnd(35)} ${'Average'.padEnd(12)} ${'Min'.padEnd(10)} ${'Max'.padEnd(10)}`);
  console.log(`  ${'─'.repeat(35)} ${'─'.repeat(12)} ${'─'.repeat(10)} ${'─'.repeat(10)}`);
  for (const [key, t] of Object.entries(timings)) {
    const name = t.label || key;
    const avg = t.avgMs != null ? `${t.avgMs}`.padEnd(12) : 'N/A'.padEnd(12);
    const min = t.minMs != null ? `${t.minMs}`.padEnd(10) : ''.padEnd(10);
    const max = t.maxMs != null ? `${t.maxMs}`.padEnd(10) : ''.padEnd(10);
    console.log(`  ${name.substring(0, 34).padEnd(35)} ${avg} ${min} ${max}`);
  }

  const output = {
    module: 'startup-timing',
    timestamp: new Date().toISOString(),
    backendUptime: uptime,
    timings,
  };

  await FS.writeFile('scripts/.startup-timing-results.json', JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✓ results written to scripts/.startup-timing-results.json`);
}

const FS = await import('fs/promises');
main().catch(e => { console.error(`FATAL: ${e.message}`); process.exit(1); });
