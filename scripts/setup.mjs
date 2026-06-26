#!/usr/bin/env node

// VrixoBase Setup Script
// Usage: node scripts/setup.mjs [--check]
//   --check  : only validate environment, do not install or migrate

import { execSync } from 'child_process';
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CHECK_ONLY = process.argv.includes('--check');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(...args) { console.log(...args); }
function info(msg) { console.log(`  ${colors.green}✓${colors.reset} ${msg}`); }
function warn(msg) { console.log(`  ${colors.yellow}⚠${colors.reset} ${msg}`); }
function error(msg) { console.log(`  ${colors.red}✗${colors.reset} ${msg}`); }
function header(msg) {
  console.log(`\n${colors.cyan}${colors.bold}${msg}${colors.reset}`);
  console.log(`  ${'-'.repeat(Math.min(msg.length, 60))}`);
}

function cmd(command, opts = {}) {
  try {
    return execSync(command, { cwd: ROOT, stdio: 'pipe', encoding: 'utf-8', timeout: 60000, ...opts }).trim();
  } catch (e) {
    if (opts.optional) return '';
    throw e;
  }
}

function checkCommand(name) {
  try {
    execSync(name === 'node' ? 'node --version' : `${name} --version`, { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ── Step 0: Prerequisites ──────────────────────────────────
async function checkPrerequisites() {
  header('Step 0: Checking prerequisites');

  const checks = [
    { name: 'Node.js', test: checkCommand('node') },
    { name: 'npm', test: checkCommand('npm') },
  ];

  if (!CHECK_ONLY) {
    checks.push({ name: 'Docker (optional)', test: checkCommand('docker'), optional: true });
  }

  let allPassed = true;
  for (const c of checks) {
    if (c.test) {
      info(`${c.name}`);
    } else if (c.optional) {
      warn(`${c.name} — not found (backend runs on host instead)`);
    } else {
      error(`${c.name} — not found. Install from https://nodejs.org/`);
      allPassed = false;
    }
  }

  return allPassed;
}

// ── Step 1: Environment ────────────────────────────────────
async function setupEnvironment() {
  header('Step 1: Setting up environment');

  const envPath = resolve(ROOT, '.env');
  const examplePath = resolve(ROOT, '.env.example');

  if (!existsSync(envPath)) {
    if (existsSync(examplePath)) {
      copyFileSync(examplePath, envPath);
      info('Created .env from .env.example');
    } else {
      error('.env.example not found!');
      process.exit(1);
    }
  } else {
    info('.env already exists');
  }

  // Check for default/placeholder secrets
  const envContent = readFileSync(envPath, 'utf-8');
  const placeholders = [
    { key: 'JWT_ACCESS_SECRET', pattern: /change-me/i },
    { key: 'JWT_REFRESH_SECRET', pattern: /change-me/i },
    { key: 'ENCRYPTION_KEY', pattern: /change-me/i },
    { key: 'SESSION_SECRET', pattern: /change-me/i },
  ];

  let needsSecrets = false;
  for (const p of placeholders) {
    const match = envContent.match(new RegExp(`^${p.key}=(.+)$`, 'm'));
    if (match && p.pattern.test(match[1])) {
      needsSecrets = true;
      break;
    }
  }

  if (needsSecrets && !CHECK_ONLY) {
    warn('Placeholder secrets detected. Generating random values...');
    try {
      const jwtAccess = cmd('node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
      const jwtRefresh = cmd('node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
      const encKey = cmd('node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'hex\'))"');
      const sessionSecret = cmd('node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'hex\'))"');
      const encSalt = cmd('node -e "console.log(require(\'crypto\').randomBytes(12).toString(\'hex\'))"');

      let updated = envContent;
      updated = updated.replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${jwtAccess}`);
      updated = updated.replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=${jwtRefresh}`);
      updated = updated.replace(/^ENCRYPTION_KEY=.*$/m, `ENCRYPTION_KEY=${encKey}`);
      updated = updated.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${sessionSecret}`);
      updated = updated.replace(/^ENCRYPTION_SALT=.*$/m, `ENCRYPTION_SALT=${encSalt}`);
      writeFileSync(envPath, updated, 'utf-8');
      info('Secrets generated and written to .env');
    } catch (e) {
      warn(`Could not generate secrets: ${e.message}. Edit .env manually.`);
    }
  }
}

// ── Step 2: Validate .env ──────────────────────────────────
async function validateEnv() {
  header('Step 2: Validating environment variables');

  const requiredVars = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'ENCRYPTION_KEY',
    'ENCRYPTION_SALT',
    'SESSION_SECRET',
  ];

  let allPassed = true;
  for (const v of requiredVars) {
    const val = process.env[v] || readEnvVar(v);
    if (!val) {
      error(`${v} — missing. Set it in .env`);
      allPassed = false;
    } else if (val.startsWith('change-me')) {
      warn(`${v} — still has placeholder value. Run 'npm run setup' to generate secrets.`);
    }
  }

  if (allPassed) info('All required variables present');
  return allPassed;
}

function readEnvVar(name) {
  try {
    const envPath = resolve(ROOT, '.env');
    const content = readFileSync(envPath, 'utf-8');
    const match = content.match(new RegExp(`^${name}=(.+)$`, 'm'));
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

// ── Step 3: Install dependencies ────────────────────────────
async function installDependencies() {
  header('Step 3: Installing dependencies');

  if (existsSync(resolve(ROOT, 'node_modules', '.package-lock.json'))) {
    info('Dependencies already installed');
    return;
  }

  log('  Running npm install...');
  cmd('npm install', { timeout: 120000 });
  info('Dependencies installed');
}

// ── Step 4: Generate Prisma client ──────────────────────────
async function generatePrisma() {
  header('Step 4: Generating Prisma client');

  cmd('npm run prisma:generate', { timeout: 30000 });
  info('Prisma client generated');
}

// ── Step 5: Push database schema ───────────────────────────
async function pushDatabase() {
  header('Step 5: Pushing database schema');

  try {
    cmd('npm run prisma:push', { timeout: 30000 });
    info('Database schema pushed');
  } catch (e) {
    error(`Database push failed: ${e.message}`);
    warn('Make sure PostgreSQL is running and DATABASE_URL in .env is correct.');
    warn(`  DATABASE_URL=${readEnvVar('DATABASE_URL')}`);
    return false;
  }
  return true;
}

// ── Step 6: Seed database ──────────────────────────────────
async function seedDatabase() {
  header('Step 6: Seeding database');

  try {
    cmd('npx ts-node backend/prisma/seed-user.ts', { timeout: 15000 });
    info('Database seeded');
  } catch (e) {
    warn(`Seed failed (may be normal if already seeded): ${e.message}`);
  }
}

// ── Step 7: Verify build ───────────────────────────────────
async function verifyBuild() {
  header('Step 7: Verifying build');

  try {
    cmd('npm run build -w backend', { timeout: 60000 });
    info('Backend builds successfully');
  } catch (e) {
    error(`Backend build failed: ${e.message}`);
    return false;
  }
  return true;
}

// ── Step 8: Health verification ────────────────────────────
async function verifyHealth() {
  header('Step 8: Verifying service health');

  // Check if backend is already running
  try {
    const res = await fetch('http://localhost:4000/api/health/simple', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    info(`Backend running (uptime: ${data.uptime}s)`);
  } catch {
    warn('Backend not running locally. Start with: npm run dev');
    return;
  }

  // Check dependencies endpoint
  try {
    const depRes = await fetch('http://localhost:4000/api/health', { signal: AbortSignal.timeout(5000) });
    const depData = await depRes.json();
    const checks = depData.checks || {};
    for (const [name, status] of Object.entries(checks)) {
      const s = status.status;
      if (s === 'healthy') info(`${name}: ${s}`);
      else if (s === 'degraded') warn(`${name}: ${s}`);
      else error(`${name}: ${s}`);
    }
  } catch (e) {
    warn(`Could not fetch health details: ${e.message}`);
  }
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log(`\n${colors.cyan}${colors.bold}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  VrixoBase — Setup${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════${colors.reset}\n`);

  if (CHECK_ONLY) {
    info('Check mode: validating environment only\n');
    const prereqsOk = await checkPrerequisites();
    const envOk = await validateEnv();
    if (prereqsOk && envOk) {
      console.log(`\n${colors.green}${colors.bold}✓ All checks passed${colors.reset}\n`);
    } else {
      console.log(`\n${colors.red}${colors.bold}✗ Some checks failed${colors.reset}\n`);
      process.exit(1);
    }
    return;
  }

  const prereqsOk = await checkPrerequisites();
  if (!prereqsOk) process.exit(1);

  await setupEnvironment();
  const envOk = await validateEnv();
  if (!envOk) process.exit(1);

  await installDependencies();
  await generatePrisma();
  const dbOk = await pushDatabase();
  if (dbOk) await seedDatabase();
  await verifyBuild();
  await verifyHealth();

  console.log(`\n${colors.green}${colors.bold}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}${colors.bold}  Setup complete!${colors.reset}`);
  console.log(`${colors.green}${colors.bold}═══════════════════════════════════════${colors.reset}`);
  console.log(`\n  ${colors.bold}Start development:${colors.reset} npm run dev`);
  console.log(`  ${colors.bold}Backend API:${colors.reset}       http://localhost:4000/api`);
  console.log(`  ${colors.bold}Swagger docs:${colors.reset}      http://localhost:4000/api/docs`);
  console.log(`  ${colors.bold}MinIO Console:${colors.reset}     http://localhost:9001`);
  console.log(`  ${colors.bold}Prisma Studio:${colors.reset}     npm run prisma:studio\n`);
}

main().catch((e) => {
  console.error(`\n${colors.red}${colors.bold}Setup failed:${colors.reset} ${e.message}\n`);
  process.exit(1);
});
