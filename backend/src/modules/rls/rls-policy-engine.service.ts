import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';

interface ParsedPolicyDefinition {
  usingExpression: string | null;
  withCheckExpression: string | null;
  command: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
}

@Injectable()
export class RlsPolicyEngineService {
  private readonly logger = new Logger(RlsPolicyEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
  ) {}

  private id(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  async enableRlsOnTable(schema: string, tableName: string): Promise<void> {
    const safeRef = `${this.id(schema)}.${this.id(tableName)}`;
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE ${safeRef} ENABLE ROW LEVEL SECURITY`,
      );
      this.logger.log(`RLS enabled on ${safeRef}`);
    } catch (err) {
      this.logger.warn(`Failed to enable RLS on ${safeRef}: ${(err as Error).message}`);
    }
  }

  async disableRlsOnTable(schema: string, tableName: string): Promise<void> {
    const safeRef = `${this.id(schema)}.${this.id(tableName)}`;
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE ${safeRef} DISABLE ROW LEVEL SECURITY`,
      );
      this.logger.log(`RLS disabled on ${safeRef}`);
    } catch (err) {
      this.logger.warn(`Failed to disable RLS on ${safeRef}: ${(err as Error).message}`);
    }
  }

  async forceRlsOnTable(schema: string, tableName: string): Promise<void> {
    const safeRef = `${this.id(schema)}.${this.id(tableName)}`;
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE ${safeRef} FORCE ROW LEVEL SECURITY`,
      );
      this.logger.log(`RLS forced on ${safeRef}`);
    } catch (err) {
      this.logger.warn(`Failed to force RLS on ${safeRef}: ${(err as Error).message}`);
    }
  }

  async applyPolicy(policy: {
    projectId: string;
    tableName: string;
    name: string;
    definition: string;
    roles: string[];
    status: string;
  }): Promise<void> {
    if (policy.status !== 'active') return;

    const schema = this.tenancy.schemaName(policy.projectId);
    const safeTable = `${this.id(schema)}.${this.id(policy.tableName)}`;

    const parsed = this.parseDefinition(policy.definition);

    const roleClause = this.buildRoleClause(policy.roles);

    const policyName = this.id(`rls_${policy.tableName}_${policy.name}`);

    const sqlParts: string[] = [
      `CREATE POLICY ${policyName}`,
      `ON ${safeTable}`,
    ];

    if (parsed.command !== 'ALL') {
      sqlParts.push(`AS PERMISSIVE`);
      sqlParts.push(`FOR ${parsed.command}`);
    } else {
      sqlParts.push(`AS PERMISSIVE`);
    }

    if (roleClause) {
      sqlParts.push(`TO ${roleClause}`);
    }

    if (parsed.usingExpression) {
      sqlParts.push(`USING (${parsed.usingExpression})`);
    }

    if (parsed.withCheckExpression) {
      sqlParts.push(`WITH CHECK (${parsed.withCheckExpression})`);
    }

    const sql = sqlParts.join(' ');

    this.logger.debug(`Applying RLS policy: ${policyName} on ${safeTable}`);
    this.logger.debug(`SQL: ${sql}`);

    try {
      await this.prisma.$executeRawUnsafe(
        `DROP POLICY IF EXISTS ${policyName} ON ${safeTable}`,
      );
      await this.prisma.$executeRawUnsafe(sql);
      this.logger.log(`Policy "${policy.name}" applied on ${safeTable}`);
    } catch (err) {
      this.logger.error(
        `Failed to apply policy "${policy.name}" on ${safeTable}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  async removePolicy(policy: {
    projectId: string;
    tableName: string;
    name: string;
  }): Promise<void> {
    const schema = this.tenancy.schemaName(policy.projectId);
    const safeTable = `${this.id(schema)}.${this.id(policy.tableName)}`;
    const policyName = this.id(`rls_${policy.tableName}_${policy.name}`);

    try {
      await this.prisma.$executeRawUnsafe(
        `DROP POLICY IF EXISTS ${policyName} ON ${safeTable}`,
      );
      this.logger.log(`Policy "${policy.name}" removed from ${safeTable}`);
    } catch (err) {
      this.logger.error(
        `Failed to remove policy "${policy.name}" from ${safeTable}: ${(err as Error).message}`,
      );
    }
  }

  async syncProjectPolicies(projectId: string): Promise<void> {
    const schema = this.tenancy.schemaName(projectId);

    const policies = await this.prisma.policy.findMany({
      where: { projectId },
    });

    const tablesWithPolicies = new Set(policies.map((p) => p.tableName));
    const activePolicies = policies.filter((p) => p.status === 'active');

    for (const tableName of tablesWithPolicies) {
      const safeRef = `${this.id(schema)}.${this.id(tableName)}`;

      const existingPolicies = await this.prisma.$queryRawUnsafe(
        `SELECT polname FROM pg_policies
         WHERE schemaname = $1 AND tablename = $2`,
        schema,
        tableName,
      ) as Array<{ polname: string }>;

      for (const ep of existingPolicies) {
        const policyKey = ep.polname.replace(/^rls_/, '').replace(/^[^_]+_/, '');
        const stillDefined = activePolicies.some(
          (ap) => ap.tableName === tableName && `rls_${tableName}_${ap.name}` === ep.polname,
        );
        if (!stillDefined) {
          await this.prisma.$executeRawUnsafe(
            `DROP POLICY IF EXISTS ${this.id(ep.polname)} ON ${safeRef}`,
          );
        }
      }
    }

    for (const policy of activePolicies) {
      await this.applyPolicy(policy);
    }

    this.logger.log(`Synced ${activePolicies.length} RLS policies for project ${projectId}`);
  }

  async tableHasRls(schema: string, tableName: string): Promise<boolean> {
    const safeRef = `${this.id(schema)}.${this.id(tableName)}`;
    const result = await this.prisma.$queryRawUnsafe(
      `SELECT relrowsecurity FROM pg_class
       WHERE oid = $1::regclass`,
      safeRef,
    ) as Array<{ relrowsecurity: boolean }>;
    return result[0]?.relrowsecurity ?? false;
  }

  async listPgPolicies(schema: string, tableName?: string): Promise<Array<{
    policyName: string;
    command: string;
    roles: string[];
    using: string | null;
    withCheck: string | null;
  }>> {
    const conditions: string[] = ['schemaname = $1'];
    const params: unknown[] = [schema];

    if (tableName) {
      conditions.push('tablename = $2');
      params.push(tableName);
    }

    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT polname, polcmd, polroles::text[], polqual::text, polwithcheck::text
       FROM pg_policies
       WHERE ${conditions.join(' AND ')}
       ORDER BY tablename, polname`,
      ...params,
    ) as Array<{
      polname: string;
      polcmd: string;
      polroles: string[];
      polqual: string | null;
      polwithcheck: string | null;
    }>;

    return rows.map((r) => ({
      policyName: r.polname,
      command: this.decodeCommand(r.polcmd),
      roles: r.polroles || [],
      using: r.polqual,
      withCheck: r.polwithcheck,
    }));
  }

  private parseDefinition(definition: string): ParsedPolicyDefinition {
    const trimmed = definition.trim();

    let command: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' = 'ALL';
    const cmdMatch = trimmed.match(/^(FOR|for)\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\s+/);
    if (cmdMatch) {
      command = cmdMatch[2].toUpperCase() as typeof command;
    }

    let defWithoutCmd = trimmed;
    if (cmdMatch) {
      defWithoutCmd = trimmed.slice(cmdMatch[0].length);
    }

    let usingExpression: string | null = null;
    let withCheckExpression: string | null = null;

    const usingMatch = defWithoutCmd.match(
      /^(?:USING|using)\s*\((.+)\)(?:\s+(?:WITH|with)\s+(?:CHECK|check)\s*\((.+)\))?\s*;?\s*$/s,
    );
    if (usingMatch) {
      usingExpression = usingMatch[1].trim();
      withCheckExpression = usingMatch[2]?.trim() || null;
    } else {
      const standaloneUsing = defWithoutCmd.match(
        /^(?:USING|using)\s*\((.+)\)\s*;?\s*$/s,
      );
      if (standaloneUsing) {
        usingExpression = standaloneUsing[1].trim();
      } else {
        const standaloneWithCheck = defWithoutCmd.match(
          /^(?:WITH|with)\s+(?:CHECK|check)\s*\((.+)\)\s*;?\s*$/s,
        );
        if (standaloneWithCheck) {
          withCheckExpression = standaloneWithCheck[1].trim();
        } else {
          usingExpression = this.inferExpression(trimmed);
        }
      }
    }

    return { usingExpression, withCheckExpression, command };
  }

  private inferExpression(definition: string): string {
    const lower = definition.toLowerCase().trim();

    if (lower === 'true' || lower === 'true;' || lower === '(true)') {
      return 'true';
    }
    if (lower === 'false' || lower === 'false;' || lower === '(false)') {
      return 'false';
    }

    const uidMatch = definition.match(/auth\.uid\(\s*\)\s*=\s*(\S+)/);
    if (uidMatch) {
      return `auth.uid() = ${uidMatch[1]}`;
    }

    const roleMatch = definition.match(/auth\.role\(\s*\)\s*=\s*'([^']+)'/);
    if (roleMatch) {
      return `auth.role() = '${roleMatch[1]}'`;
    }

    if (lower === 'authenticated' || lower === 'authenticated;') {
      return 'auth.is_authenticated()';
    }

    if (definition.includes('auth.uid()') || definition.includes('current_setting')) {
      return definition;
    }

    this.logger.warn(`Could not parse RLS definition: "${definition}", defaulting to false`);
    return 'false';
  }

  private buildRoleClause(roles: string[]): string | null {
    if (!roles || roles.length === 0) return null;

    const pgRoles = roles.map((r) => {
      switch (r.toLowerCase()) {
        case 'authenticated':
          return 'authenticated';
        case 'anon':
        case 'anonymous':
        case 'public':
          return 'public';
        case 'service_role':
          return 'service_role';
        default:
          return r;
      }
    });

    return pgRoles.join(', ');
  }

  private decodeCommand(cmd: string): string {
    switch (cmd) {
      case 'r': return 'SELECT';
      case 'a': return 'INSERT';
      case 'w': return 'UPDATE';
      case 'd': return 'DELETE';
      case '*': return 'ALL';
      default: return cmd;
    }
  }
}
