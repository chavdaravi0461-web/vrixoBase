import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class RlsInfrastructureService implements OnModuleInit {
  private readonly logger = new Logger(RlsInfrastructureService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.installHelperFunctions();
  }

  async installHelperFunctions(): Promise<void> {
    this.logger.log('Installing RLS helper functions...');

    await this.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS TEXT
      LANGUAGE SQL STABLE
      AS $$
        SELECT NULLIF(current_setting('app.current_user_id', true), '')::TEXT;
      $$;
    `).catch((err: Error) => this.logger.warn(`auth.uid() setup: ${err.message}`));

    await this.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT
      LANGUAGE SQL STABLE
      AS $$
        SELECT NULLIF(current_setting('app.current_user_role', true), '')::TEXT;
      $$;
    `).catch((err: Error) => this.logger.warn(`auth.role() setup: ${err.message}`));

    await this.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION auth.project_id() RETURNS TEXT
      LANGUAGE SQL STABLE
      AS $$
        SELECT NULLIF(current_setting('app.current_project_id', true), '')::TEXT;
      $$;
    `).catch((err: Error) => this.logger.warn(`auth.project_id() setup: ${err.message}`));

    await this.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION auth.is_authenticated() RETURNS BOOLEAN
      LANGUAGE SQL STABLE
      AS $$
        SELECT current_setting('app.current_user_id', true) IS NOT NULL
           AND current_setting('app.current_user_id', true) != '';
      $$;
    `).catch((err: Error) => this.logger.warn(`auth.is_authenticated() setup: ${err.message}`));

    await this.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION auth.has_role(required_role TEXT) RETURNS BOOLEAN
      LANGUAGE SQL STABLE
      AS $$
        SELECT NULLIF(current_setting('app.current_user_role', true), '') = required_role;
      $$;
    `).catch((err: Error) => this.logger.warn(`auth.has_role() setup: ${err.message}`));

    await this.prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_namespace WHERE nspname = 'app'
        ) THEN
          CREATE SCHEMA IF NOT EXISTS app;
        END IF;
      END
      $$;
    `).catch((err: Error) => this.logger.warn(`app schema setup: ${err.message}`));

    this.logger.log('RLS helper functions installed successfully');
  }

  async ensureHelperFunctionsExist(): Promise<void> {
    const funcs = ['auth.uid', 'auth.role', 'auth.project_id', 'auth.is_authenticated', 'auth.has_role'];
    for (const func of funcs) {
      const exists = await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
         WHERE n.nspname = 'auth' AND p.proname = $1`,
        func.split('.')[1],
      ) as Array<Record<string, unknown>>;
      if (exists.length === 0) {
        this.logger.warn(`Function ${func} not found, reinstalling helpers...`);
        await this.installHelperFunctions();
        return;
      }
    }
  }
}
