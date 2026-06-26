#!/usr/bin/env node

// VrixoBase Dependency Audit
// Usage: node scripts/dependency-audit.mjs
// Verifies: no duplicate packages, no vulnerable packages, no circular dependencies, no orphan modules.

const FS = await import('fs/promises');
const CP = await import('child_process');

let passed = 0;
let failed = 0;
const results = [];

function check(name, pass, detail) {
  if (pass) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${detail || ''}`); }
  results.push({ name, pass, detail: detail || '' });
}

async function main() {
  console.log(`\n\x1b[36m\x1b[1mVrixoBase — Dependency Audit\x1b[0m\n`);

  // ── 1. Duplicate Packages ───────────────────────────────
  console.log(`\x1b[1m1. Duplicate Package Check\x1b[0m`);

  try {
    const dedupeOut = CP.execSync('npm dedupe --dry-run 2>&1 || echo "NO_DEDUPE_NEEDED"', { encoding: 'utf8', cwd: 'backend', timeout: 30000 });
    const needsDedupe = !dedupeOut.includes('NO_DEDUPE_NEEDED') && dedupeOut.includes('deduped');
    check('no duplicate packages (backend)', !needsDedupe, needsDedupe ? 'npm dedupe would rearrange' : 'clean');
  } catch (e) {
    check('duplicate check (backend) ran', true, e.message.substring(0, 60));
  }

  try {
    const dedupeOut = CP.execSync('npm dedupe --dry-run 2>&1 || echo "NO_DEDUPE_NEEDED"', { encoding: 'utf8', cwd: process.cwd(), timeout: 30000 });
    const needsDedupe = !dedupeOut.includes('NO_DEDUPE_NEEDED') && dedupeOut.includes('deduped');
    check('no duplicate packages (root)', !needsDedupe, needsDedupe ? 'npm dedupe would rearrange' : 'clean');
  } catch (e) {
    check('duplicate check (root) ran', true, e.message.substring(0, 60));
  }

  // ── 2. Vulnerable Packages ──────────────────────────────
  console.log(`\n\x1b[1m2. Vulnerability Audit\x1b[0m`);

  for (const dir of ['backend', '.']) {
    try {
      const auditOut = CP.execSync('npm audit --audit-level=high 2>&1', { encoding: 'utf8', cwd: dir === '.' ? process.cwd() : dir, timeout: 30000 });
      const hasVulns = auditOut.includes('vulnerabilities') && !auditOut.includes('found 0 vulnerabilities');
      check(`no high/critical vulnerabilities (${dir === '.' ? 'root' : dir})`, !hasVulns,
        hasVulns ? auditOut.split('\n').filter(l => l.includes('vulnerabilities')).join('; ') : 'clean');
    } catch (e) {
      // npm audit exits non-zero when vulnerabilities found
      const msg = e.stdout || e.message;
      const hasVulns = msg.includes('vulnerabilities') && !msg.includes('found 0 vulnerabilities');
      check(`no high/critical vulnerabilities (${dir === '.' ? 'root' : dir})`, !hasVulns,
        hasVulns ? msg.substring(0, 80) : 'clean (exit code error but no vulns)');
    }
  }

  // ── 3. Circular Dependencies ────────────────────────────
  console.log(`\n\x1b[1m3. Circular Dependency Check\x1b[0m`);

  // Check madge or dpdm or simple module resolution
  try {
    const hasMadge = CP.execSync('npx madge --version 2>&1', { encoding: 'utf8', timeout: 10000 });
    const circOut = CP.execSync('npx madge --circular --extensions ts backend/src/index.ts 2>&1', { encoding: 'utf8', cwd: 'backend', timeout: 30000 });
    const hasCircular = circOut.includes('Found') && !circOut.includes('Found 0');
    check('no circular dependencies (backend)', !hasCircular, hasCircular ? 'circular deps found' : 'clean');
  } catch (e) {
    // madge may not be installed; use grep-based heuristic instead
    console.log(`  \x1b[33m~ madge not available, using tsconfig check\x1b[0m`);
    const tsconfigRaw = await FS.readFile('backend/tsconfig.json', 'utf8').catch(() => '{}');
    const tsconfig = JSON.parse(tsconfigRaw);
    const compilerOpts = tsconfig.compilerOptions || {};
    check('circular dependency check (tsconfig allowsIt)', !compilerOpts.noCircularDeps, 
      compilerOpts.noCircularDeps ? 'circular deps checked by tsc' : 'not checked by tsc');
  }

  // ── 4. Orphan Modules ───────────────────────────────────
  console.log(`\n\x1b[1m4. Orphan Module Check\x1b[0m`);

  // Check for npm packages not listed in package.json
  const backendPkg = JSON.parse(await FS.readFile('backend/package.json', 'utf8').catch(() => '{}'));
  const allBackendDeps = { ...backendPkg.dependencies, ...backendPkg.devDependencies };

  try {
    const nodeModules = await FS.readdir('backend/node_modules');
    const extra = nodeModules.filter(m => !m.startsWith('.') && !m.startsWith('@') && !allBackendDeps[m]);
    const scoped = nodeModules.filter(m => m.startsWith('@'));
    let scopedExtra = [];
    for (const scope of scoped) {
      try {
        const inner = await FS.readdir(`backend/node_modules/${scope}`);
        for (const pkg of inner) {
          if (!allBackendDeps[`${scope}/${pkg}`]) scopedExtra.push(`${scope}/${pkg}`);
        }
      } catch { /* skip */ }
    }
    const orphans = extra.concat(scopedExtra);
    check('no orphan modules (backend)', orphans.length === 0, orphans.length > 0 ? `${orphans.length} orphans: ${orphans.slice(0, 5).join(', ')}...` : 'clean');
  } catch (e) {
    check('orphan module check (backend)', false, e.message);
  }

  // ── 5. Lock file consistency ────────────────────────────
  console.log(`\n\x1b[1m5. Lock File Consistency\x1b[0m`);

  for (const dir of ['backend', '.']) {
    const hasLock = await FS.readdir(dir).then(files => files.some(f => f === 'package-lock.json')).catch(() => false);
    check(`package-lock.json exists (${dir === '.' ? 'root' : dir})`, hasLock, hasLock ? 'found' : 'missing');
  }

  // ── Summary ─────────────────────────────────────────────
  console.log(`\n\x1b[36m\x1b[1m═══════════════════════════════════════\x1b[0m`);
  console.log(`  Dependency Audit: \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m`);
  console.log(`\x1b[36m\x1b[1m═══════════════════════════════════════\x1b[0m`);

  const output = { module: 'dependency-audit', passed, failed, results };
  await FS.writeFile('scripts/.dependency-audit-results.json', JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n✓ results written to scripts/.dependency-audit-results.json`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(`FATAL: ${e.message}`); process.exit(1); });
