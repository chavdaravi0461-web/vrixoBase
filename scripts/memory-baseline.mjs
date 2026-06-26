#!/usr/bin/env node

// VrixoBase Memory Baseline Measurement
// Usage: node scripts/memory-baseline.mjs [--base-url=http://localhost:4001/api]
// Reports startup memory, idle memory, CPU usage, open handles.

const BASE = (process.argv.find(a => a.startsWith('--base-url=')) || '--base-url=http://localhost:4001/api').split('=')[1];

const proc = process;
const mem = proc.memoryUsage();
const cpu = proc.cpuUsage();

// This script measures its own process as a proxy; in production, attach to backend PID.
// For a production backend, use: node -e "setInterval(()=>console.log(process.memoryUsage()),1000)"

async function measureBackendMemory() {
  // Attempt to get backend PID from listening port via netstat
  try {
    const netstat = CP.execSync('netstat -ano | findstr :4001', { encoding: 'utf8', timeout: 3000 }).trim();
    const lines = netstat.split('\n').filter(l => l.includes('LISTENING'));
    if (lines.length > 0) {
      const parts = lines[0].trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      return { pid, method: 'netstat (LISTENING)' };
    }
  } catch { /* netstat unavailable */ }

  // Try wmic as fallback
  try {
    const wmic = CP.execSync('wmic process where "name=\'node.exe\'" get ProcessId,WorkingSetSize /format:csv', { encoding: 'utf8', timeout: 3000 }).trim();
    return { pid: 'see wmic output', method: 'wmic', raw: wmic };
  } catch { /* wmic unavailable */ }

  return null;
}

async function main() {
  console.log(`\n\x1b[36m\x1b[1mVrixoBase — Memory Baseline\x1b[0m\n`);

  const backendInfo = await measureBackendMemory();
  const pidInfo = backendInfo ? `PID ${backendInfo.pid} (${backendInfo.method})` : 'not found';

  console.log(`  Backend process: ${pidInfo}`);
  console.log(`  \n  Script process (current node):`);
  console.log(`    RSS:          ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    Heap Total:   ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    Heap Used:    ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    External:     ${(mem.external / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    ArrayBuffers: ${(mem.arrayBuffers / 1024 / 1024).toFixed(2) || 'N/A'} MB`);
  console.log(`    CPU User:     ${(cpu.user / 1000).toFixed(2)} ms`);
  console.log(`    CPU System:   ${(cpu.system / 1000).toFixed(2)} ms`);

  // Open handles
  const handles = process._getActiveRequests ? process._getActiveRequests() : [];
  const handlesCount = handles.length;
  const handlesList = handles.slice(0, 5).map(h => h.constructor?.name || 'unknown');
  console.log(`    Open Handles (active reqs): ${handlesCount}`);
  if (handlesList.length > 0) console.log(`    Sample handles: ${handlesList.join(', ')}${handlesCount > 5 ? '...' : ''}`);

  // Platform info
  console.log(`    Platform:     ${process.platform}`);
  console.log(`    Node Version: ${process.version}`);

  const output = {
    module: 'memory-baseline',
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
    },
    backend: backendInfo || { status: 'not found — run against running backend' },
    memory: {
      rssMB: +(mem.rss / 1024 / 1024).toFixed(2),
      heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
      heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
      externalMB: +(mem.external / 1024 / 1024).toFixed(2),
    },
    cpu: {
      userMs: +(cpu.user / 1000).toFixed(2),
      systemMs: +(cpu.system / 1000).toFixed(2),
    },
    openHandles: handlesCount,
  };

  await FS.writeFile('scripts/.memory-baseline-results.json', JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✓ results written to scripts/.memory-baseline-results.json`);

  // Also try to fetch backend /metrics for process metrics
  try {
    const metricsRes = await fetch(`${BASE}/metrics`, { signal: AbortSignal.timeout(3000) });
    const metricsText = await metricsRes.text();
    const nodeMemLines = metricsText.split('\n').filter(l => l.startsWith('nodejs_') || l.startsWith('process_'));
    if (nodeMemLines.length > 0) {
      console.log(`\n  Backend metrics (from /metrics):`);
      for (const line of nodeMemLines.slice(0, 10)) {
        console.log(`    ${line}`);
      }
      output.metricsSample = nodeMemLines.slice(0, 10);
    }
  } catch { /* metrics not available */ }

  await FS.writeFile('scripts/.memory-baseline-results.json', JSON.stringify(output, null, 2), 'utf8');
}

const FS = await import('fs/promises');
const CP = await import('child_process');
main().catch(e => { console.error(`FATAL: ${e.message}`); process.exit(1); });
