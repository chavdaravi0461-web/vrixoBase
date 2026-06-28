import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).default('4000'),
  API_PREFIX: z.string().default('api'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_ISSUER: z.string().default('vrixo'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().regex(/^\d+$/).default('6379'),

  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.string().regex(/^\d+$/).default('9000'),
  MINIO_ACCESS_KEY: z.string().min(1, 'MINIO_ACCESS_KEY is required'),
  MINIO_SECRET_KEY: z.string().min(1, 'MINIO_SECRET_KEY is required'),
  MINIO_BUCKET: z.string().default('vrixo-storage'),
  MINIO_USE_SSL: z.string().default('false'),

  ENCRYPTION_KEY: z.string().min(16, 'ENCRYPTION_KEY must be at least 16 characters'),
  ENCRYPTION_SALT: z.string().min(8, 'ENCRYPTION_SALT must be at least 8 characters'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),

  THROTTLE_TTL: z.string().regex(/^\d+$/).default('60'),
  THROTTLE_LIMIT: z.string().regex(/^\d+$/).default('100'),

  REALTIME_PUBLICATION: z.string().default('vrixobase_realtime'),
  REALTIME_SLOT: z.string().default('vrixobase_cdc_slot'),
  REALTIME_START_LSN: z.string().default('0/0'),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

interface ValidationError {
  variable: string;
  reason: string;
}

export function validateEnvironment(): { valid: boolean; errors: ValidationError[]; env: Partial<ValidatedEnv> } {
  const result = envSchema.safeParse(process.env);

  if (result.success) {
    return { valid: true, errors: [], env: result.data };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    variable: issue.path.join('.'),
    reason: issue.message,
  }));

  return { valid: false, errors, env: {} };
}

export function assertValidEnvironment(): void {
  const { valid, errors } = validateEnvironment();

  if (valid) {
    console.log('[EnvValidator] All environment variables validated successfully');
    return;
  }

  console.error('\n\x1b[31m====================================================\x1b[0m');
  console.error('\x1b[31m  Environment Validation Failed\x1b[0m');
  console.error('\x1b[31m====================================================\x1b[0m');
  console.error('');

  for (const err of errors) {
    console.error(`  \x1b[33m✗ ${err.variable}\x1b[0m`);
    console.error(`    Reason: ${err.reason}`);
    console.error('');
  }

  console.error('\x1b[31m====================================================\x1b[0m');
  console.error('  The application cannot start until these are fixed.');
  console.error('  Copy .env.example to .env and configure all required values.');
  console.error('\x1b[31m====================================================\x1b[0m\n');

  process.exit(1);
}
