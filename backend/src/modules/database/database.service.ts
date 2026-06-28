import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsPolicyEngineService } from '../rls/rls-policy-engine.service';
import { CreateTableDto, ColumnDefinition } from './dto/create-table.dto';
import { AddColumnDto } from './dto/add-column.dto';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsPolicyEngine: RlsPolicyEngineService,
  ) {}

  private schema(projectId: string): string {
    return `proj_${projectId.replace(/[^a-zA-Z0-9_]/g, '')}`;
  }

  private id(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  private async ensureSchema(schema: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `CREATE SCHEMA IF NOT EXISTS ${this.id(schema)}`,
      );
    } catch {
      // Race condition: another concurrent request created the schema
    }
  }

  async listTables(projectId: string) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);

    const tables = (await this.prisma.$queryRawUnsafe(
      `SELECT table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      schemaName,
    )) as Array<{ table_name: string; table_type: string }>;

    const metaRows = await this.prisma.table.findMany({
      where: { projectId },
      select: { id: true, name: true },
    });
    const metaByName = new Map<string, string>(
      metaRows.map((m) => [m.name, m.id]),
    );

    const result = [];
    for (const t of tables) {
      const tableRef = `${this.id(schemaName)}.${this.id(t.table_name)}`;

      const countResult = (await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS count FROM ${tableRef}`,
      )) as Array<{ count: bigint }>;

      const descResult = (await this.prisma.$queryRawUnsafe(
        `SELECT pgd.description
         FROM pg_catalog.pg_description pgd
         WHERE pgd.objoid = $1::text::regclass AND pgd.objsubid = 0`,
        `${schemaName}.${t.table_name}`,
      )) as Array<{ description: string | null }>;

      result.push({
        id: metaByName.get(t.table_name) ?? null,
        name: t.table_name,
        rowCount: Number(countResult[0]?.count ?? 0),
        description: descResult[0]?.description ?? null,
      });
    }

    return result;
  }

  async getTable(projectId: string, tableName: string) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);

    const tables = (await this.prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2`,
      schemaName,
      tableName,
    )) as Array<{ table_name: string }>;

    if (tables.length === 0) {
      throw new NotFoundException(`Table "${tableName}" not found in project`);
    }

    const descResult = (await this.prisma.$queryRawUnsafe(
      `SELECT pgd.description
       FROM pg_catalog.pg_description pgd
       WHERE pgd.objoid = $1::text::regclass AND pgd.objsubid = 0`,
      `${schemaName}.${tableName}`,
    )) as Array<{ description: string | null }>;

    const columns = (await this.prisma.$queryRawUnsafe(
      `SELECT column_name, data_type, is_nullable, column_default, ordinal_position
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      schemaName,
      tableName,
    )) as Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      ordinal_position: number;
    }>;

    const pkCols = (await this.prisma.$queryRawUnsafe(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'`,
      schemaName,
      tableName,
    )) as Array<{ column_name: string }>;
    const pkSet = new Set(pkCols.map((r: any) => r.column_name));

    const uqCols = (await this.prisma.$queryRawUnsafe(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'UNIQUE'`,
      schemaName,
      tableName,
    )) as Array<{ column_name: string }>;
    const uqSet = new Set(uqCols.map((r: any) => r.column_name));

    const tableMeta = await this.prisma.table.findUnique({
      where: { projectId_name: { projectId, name: tableName } },
      select: { id: true },
    });

    return {
      id: tableMeta?.id ?? null,
      name: tableName,
      description: descResult[0]?.description ?? null,
      columns: columns.map((col: any) => ({
        name: col.column_name,
        type: col.data_type,
        defaultValue: col.column_default,
        isNullable: col.is_nullable === 'YES',
        isUnique: uqSet.has(col.column_name),
        isPrimary: pkSet.has(col.column_name),
        ordinalPosition: col.ordinal_position,
      })),
    };
  }

  async createTable(projectId: string, dto: CreateTableDto) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);

    const exists = (await this.prisma.$queryRawUnsafe(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) AS exists`,
      schemaName,
      dto.name,
    )) as Array<{ exists: boolean }>;
    if (exists[0].exists) {
      throw new BadRequestException(`Table "${dto.name}" already exists`);
    }

    const colDefs: string[] = [];
    let hasPrimary = false;

    for (const col of dto.columns) {
      const parts: string[] = [
        this.id(col.name),
        this.mapType(col.type),
      ];

      if (col.isPrimary) {
        parts.push('PRIMARY KEY');
        hasPrimary = true;
      }
      if (col.isPrimary || col.isNullable === false) {
        parts.push('NOT NULL');
      }
      if (col.isUnique) {
        parts.push('UNIQUE');
      }
      if (col.defaultValue !== undefined && col.defaultValue !== null) {
        const def = col.defaultValue as string;
        if (typeof def === 'string' && (def.startsWith('(') || /^\w+\s*\(.*\)\s*$/.test(def))) {
          parts.push(`DEFAULT ${def}`);
        } else {
          parts.push(`DEFAULT ${this.literal(col.defaultValue)}`);
        }
      }

      colDefs.push(parts.join(' '));
    }

    if (!hasPrimary && colDefs.length > 0) {
      colDefs[0] = `${colDefs[0]} PRIMARY KEY`;
    }

    const sql = `CREATE TABLE ${this.id(schemaName)}.${this.id(dto.name)} (\n  ${colDefs.join(',\n  ')}\n)`;
    
    // DEBUG: Log the exact SQL being generated for UUID debugging
    this.logger.log(`=== CREATE TABLE SQL ===`);
    this.logger.log(`Project: ${projectId}`);
    this.logger.log(`Schema: ${schemaName}`);
    this.logger.log(`Table: ${dto.name}`);
    this.logger.log(`Columns: ${JSON.stringify(dto.columns.map(c => ({ name: c.name, type: c.type, isPrimary: c.isPrimary, isNullable: c.isNullable, isUnique: c.isUnique })))}`);
    this.logger.log(`Mapped Types: ${JSON.stringify(dto.columns.map(c => ({ original: c.type, mapped: this.mapType(c.type) })))}`);
    this.logger.log(`SQL: ${sql}`);
    this.logger.log(`========================`);
    
    try {
      await this.prisma.$executeRawUnsafe(sql);
    } catch (error: unknown) {
      // Capture detailed PostgreSQL error
      const pgError = error as any;
      this.logger.error(`=== CREATE TABLE FAILED ===`);
      this.logger.error(`SQL: ${sql}`);
      this.logger.error(`Error Code: ${pgError?.code}`);
      this.logger.error(`Error Message: ${pgError?.message}`);
      this.logger.error(`Error Detail: ${pgError?.detail}`);
      this.logger.error(`Error Hint: ${pgError?.hint}`);
      this.logger.error(`Error Position: ${pgError?.position}`);
      this.logger.error(`Error Internal Query: ${pgError?.internalQuery}`);
      this.logger.error(`Stack Trace: ${pgError?.stack}`);
      this.logger.error(`============================`);
      throw error;
    }

    if (dto.description) {
      await this.prisma.$executeRawUnsafe(
        `COMMENT ON TABLE ${this.id(schemaName)}.${this.id(dto.name)} IS $1`,
        dto.description,
      );
    }

    await this.prisma.table.upsert({
      where: { projectId_name: { projectId, name: dto.name } },
      create: {
        projectId,
        name: dto.name,
        description: dto.description ?? null,
        schema: schemaName,
      },
      update: { description: dto.description ?? null },
    });

    await this.rlsPolicyEngine.enableRlsOnTable(schemaName, dto.name);

    return this.getTable(projectId, dto.name);
  }

  async deleteTable(projectId: string, tableName: string) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);

    await this.rlsPolicyEngine.disableRlsOnTable(schemaName, tableName);

    const policies = await this.prisma.policy.findMany({
      where: { projectId, tableName },
    });
    for (const policy of policies) {
      await this.rlsPolicyEngine.removePolicy(policy);
    }
    await this.prisma.policy.deleteMany({
      where: { projectId, tableName },
    });

    await this.prisma.$executeRawUnsafe(
      `DROP TABLE IF EXISTS ${this.id(schemaName)}.${this.id(tableName)} CASCADE`,
    );

    await this.prisma.table.deleteMany({
      where: { projectId, name: tableName },
    });

    return { message: `Table "${tableName}" dropped` };
  }

  async updateTable(
    projectId: string,
    tableName: string,
    dto: { name?: string; description?: string; columns?: AddColumnDto[] },
  ) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);

    const oldName = tableName;

    if (dto.name && dto.name !== tableName) {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE ${this.id(schemaName)}.${this.id(tableName)} RENAME TO ${this.id(dto.name)}`,
      );
      tableName = dto.name;
    }

    if (dto.description !== undefined) {
      await this.prisma.$executeRawUnsafe(
        `COMMENT ON TABLE ${this.id(schemaName)}.${this.id(tableName)} IS $1`,
        dto.description,
      );
    }

    if (dto.name && dto.name !== oldName) {
      await this.prisma.table.updateMany({
        where: { projectId, name: oldName },
        data: { name: dto.name },
      });
    }

    if (dto.description !== undefined) {
      await this.prisma.table.updateMany({
        where: { projectId, name: tableName },
        data: { description: dto.description ?? null },
      });
    }

    if (dto.columns && dto.columns.length > 0) {
      for (const col of dto.columns) {
        await this.addColumnRaw(schemaName, tableName, col);
      }
    }

    return this.getTable(projectId, tableName);
  }

  async addColumn(projectId: string, tableName: string, dto: AddColumnDto) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);
    await this.addColumnRaw(schemaName, tableName, dto);
    return this.getTable(projectId, tableName);
  }

  private async addColumnRaw(schema: string, table: string, dto: AddColumnDto) {
    const parts: string[] = [
      `ALTER TABLE ${this.id(schema)}.${this.id(table)}`,
      `ADD COLUMN ${this.id(dto.name)} ${this.mapType(dto.type)}`,
    ];

    if (dto.isPrimary) {
      parts.push('PRIMARY KEY');
    }
    if (dto.isPrimary || dto.isNullable === false) {
      parts.push('NOT NULL');
    }
    if (dto.isUnique) {
      parts.push('UNIQUE');
    }
    if (dto.defaultValue !== undefined && dto.defaultValue !== null) {
      const def = dto.defaultValue as string;
      if (typeof def === 'string' && def.startsWith('(')) {
        parts.push(`DEFAULT ${def}`);
      } else {
        parts.push(`DEFAULT ${this.literal(dto.defaultValue)}`);
      }
    }

    const sql = parts.join(' ');
    this.logger.debug(`Add column: ${sql}`);
    await this.prisma.$executeRawUnsafe(sql);
  }

  async updateColumn(
    projectId: string,
    tableName: string,
    columnName: string,
    dto: { name?: string; type?: string; defaultValue?: unknown; isNullable?: boolean; isUnique?: boolean; isPrimary?: boolean },
  ) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);

    const alterations: string[] = [];

    if (dto.name && dto.name !== columnName) {
      alterations.push(
        `ALTER TABLE ${this.id(schemaName)}.${this.id(tableName)} RENAME COLUMN ${this.id(columnName)} TO ${this.id(dto.name)}`,
      );
      columnName = dto.name;
    }

    if (dto.type) {
      alterations.push(
        `ALTER TABLE ${this.id(schemaName)}.${this.id(tableName)} ALTER COLUMN ${this.id(columnName)} TYPE ${this.mapType(dto.type)}`,
      );
    }

    if (dto.isNullable === true) {
      alterations.push(
        `ALTER TABLE ${this.id(schemaName)}.${this.id(tableName)} ALTER COLUMN ${this.id(columnName)} DROP NOT NULL`,
      );
    } else if (dto.isNullable === false) {
      alterations.push(
        `ALTER TABLE ${this.id(schemaName)}.${this.id(tableName)} ALTER COLUMN ${this.id(columnName)} SET NOT NULL`,
      );
    }

    if (dto.defaultValue !== undefined) {
      if (dto.defaultValue === null) {
        alterations.push(
          `ALTER TABLE ${this.id(schemaName)}.${this.id(tableName)} ALTER COLUMN ${this.id(columnName)} DROP DEFAULT`,
        );
      } else {
        alterations.push(
          `ALTER TABLE ${this.id(schemaName)}.${this.id(tableName)} ALTER COLUMN ${this.id(columnName)} SET DEFAULT ${this.literal(dto.defaultValue)}`,
        );
      }
    }

    if (dto.isUnique !== undefined) {
      if (dto.isUnique) {
        alterations.push(
          `ALTER TABLE ${this.id(schemaName)}.${this.id(tableName)} ADD CONSTRAINT ${this.id(`uq_${tableName}_${columnName}`)} UNIQUE (${this.id(columnName)})`,
        );
      }
    }

    for (const sql of alterations) {
      await this.prisma.$executeRawUnsafe(sql);
    }

    return this.getTable(projectId, tableName);
  }

  async deleteColumn(
    projectId: string,
    tableName: string,
    columnName: string,
  ) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);

    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE ${this.id(schemaName)}.${this.id(tableName)} DROP COLUMN IF EXISTS ${this.id(columnName)} CASCADE`,
    );
    return { message: `Column "${columnName}" dropped from "${tableName}"` };
  }

  async executeQuery(projectId: string, userId: string, query: string) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);

    const trimmed = query.trim().toUpperCase();

    if (/(pg_catalog|pg_class|pg_namespace|pg_authid|pg_shadow|pg_user|pg_settings|pg_stat|pg_proc)/i.test(query)) {
      throw new BadRequestException('Query references forbidden system catalog tables');
    }

    const dangerous = /(COPY\s|pg_sleep|pg_read_file|lo_import|lo_export|pg_write_file|pg_log|dblink|CURRENT_USER\s+TO|GRANT\s+[^,]+TO|REASSIGN\s+OWNED)/i;
    if (dangerous.test(query)) {
      throw new BadRequestException('Query contains forbidden operations');
    }

    this.logger.debug(`Exec query in ${schemaName}: ${query}`);

    const isSelect =
      trimmed.startsWith('SELECT') ||
      trimmed.startsWith('WITH') ||
      trimmed.startsWith('EXPLAIN');
    const isModifying =
      trimmed.startsWith('INSERT') ||
      trimmed.startsWith('UPDATE') ||
      trimmed.startsWith('DELETE') ||
      trimmed.startsWith('CREATE') ||
      trimmed.startsWith('DROP') ||
      trimmed.startsWith('ALTER') ||
      trimmed.startsWith('TRUNCATE');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '30s'`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${this.id(schemaName)}`);
        if (isSelect) {
          const rows = await tx.$queryRawUnsafe(query);
          return { rows, rowCount: Array.isArray(rows) ? rows.length : 0 };
        }
        const r = await tx.$executeRawUnsafe(query);
        return { affectedRows: r };
      });
      await this.recordQuery(projectId, userId, query, isSelect ? 'SELECT' : isModifying ? 'MODIFY' : 'OTHER', true);
      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Query failed';
      await this.recordQuery(projectId, userId, query, 'ERROR', false);
      throw new BadRequestException(`Query execution failed: ${msg}`);
    }
  }

  private async recordQuery(
    projectId: string,
    userId: string,
    query: string,
    type: string,
    success: boolean,
  ) {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO public.query_history (project_id, user_id, query, query_type, success, executed_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        projectId,
        userId,
        query,
        type,
        success,
      );
    } catch {
      try {
        await this.ensureQueryHistoryTable();
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO public.query_history (project_id, user_id, query, query_type, success, executed_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          projectId,
          userId,
          query,
          type,
          success,
        );
      } catch (e: unknown) {
        this.logger.warn('Failed to record query history', e instanceof Error ? e.message : e);
      }
    }
  }

  private async ensureQueryHistoryTable() {
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS public.query_history (
        id BIGSERIAL PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        query_type TEXT NOT NULL DEFAULT 'OTHER',
        success BOOLEAN NOT NULL DEFAULT true,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_qh_project_time
       ON public.query_history(project_id, executed_at DESC)`,
    );
  }

  async getQueryHistory(projectId: string, userId?: string, limit = 50) {
    try {
      await this.ensureQueryHistoryTable();
    } catch {
    }

    if (userId) {
      return (await this.prisma.$queryRawUnsafe(
        `SELECT id, project_id, user_id, query, query_type, success, executed_at
         FROM public.query_history
         WHERE project_id = $1 AND user_id = $2
         ORDER BY executed_at DESC LIMIT $3`,
        projectId,
        userId,
        limit,
      )) as Array<{
        id: bigint;
        project_id: string;
        user_id: string;
        query: string;
        query_type: string;
        success: boolean;
        executed_at: Date;
      }>;
    }

    return (await this.prisma.$queryRawUnsafe(
      `SELECT id, project_id, user_id, query, query_type, success, executed_at
       FROM public.query_history
       WHERE project_id = $1
       ORDER BY executed_at DESC LIMIT $2`,
      projectId,
      limit,
    )) as Array<{
      id: bigint;
      project_id: string;
      user_id: string;
      query: string;
      query_type: string;
      success: boolean;
      executed_at: Date;
    }>;
  }

  async getQueryPerformance(projectId: string) {
    const schemaName = this.schema(projectId);

    try {
      const stats = (await this.prisma.$queryRawUnsafe(
        `SELECT queryid::text, query, calls,
                total_exec_time, min_exec_time, max_exec_time, mean_exec_time,
                rows, shared_blks_hit, shared_blks_read
         FROM pg_stat_statements
         WHERE query LIKE $1
         ORDER BY total_exec_time DESC
         LIMIT 50`,
        `%${schemaName}%`,
      )) as Array<{
        queryid: string;
        query: string;
        calls: bigint;
        total_exec_time: number;
        min_exec_time: number;
        max_exec_time: number;
        mean_exec_time: number;
        rows: bigint;
        shared_blks_hit: bigint;
        shared_blks_read: bigint;
      }>;

      return stats.map((s: any) => ({
        queryId: s.queryid,
        query: s.query.substring(0, 500),
        calls: Number(s.calls),
        totalExecTime: s.total_exec_time,
        minExecTime: s.min_exec_time,
        maxExecTime: s.max_exec_time,
        meanExecTime: s.mean_exec_time,
        rows: Number(s.rows),
        cacheHitRatio:
          Number(s.shared_blks_hit) + Number(s.shared_blks_read) > 0
            ? Number(s.shared_blks_hit) /
              (Number(s.shared_blks_hit) + Number(s.shared_blks_read))
            : 0,
      }));
    } catch {
      return {
        message:
          'pg_stat_statements extension not enabled. Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements',
        stats: [],
      };
    }
  }

  async getTableRelations(projectId: string, tableName: string) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);

    const outgoing = (await this.prisma.$queryRawUnsafe(
      `SELECT tc.constraint_name,
              kcu.column_name,
              ccu.table_schema AS foreign_table_schema,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = $1 AND tc.table_name = $2`,
      schemaName,
      tableName,
    )) as Array<{
      constraint_name: string;
      column_name: string;
      foreign_table_schema: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>;

    const incoming = (await this.prisma.$queryRawUnsafe(
      `SELECT tc.constraint_name,
              tc.table_name,
              kcu.column_name,
              ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND ccu.table_schema = $1 AND ccu.table_name = $2`,
      schemaName,
      tableName,
    )) as Array<{
      constraint_name: string;
      table_name: string;
      column_name: string;
      foreign_column_name: string;
    }>;

    const stripProject = (name: string) =>
      name.replace(/^proj_[a-zA-Z0-9_]+_/, '');

    return {
      outgoing: outgoing.map((r: any) => ({
        constraintName: r.constraint_name,
        columnName: r.column_name,
        referencedTable: stripProject(r.foreign_table_name),
        referencedColumn: r.foreign_column_name,
      })),
      incoming: incoming.map((r: any) => ({
        constraintName: r.constraint_name,
        tableName: stripProject(r.table_name),
        columnName: r.column_name,
        referencedColumn: r.foreign_column_name,
      })),
    };
  }

  async getSchemaVisualization(projectId: string) {
    const schemaName = this.schema(projectId);
    await this.ensureSchema(schemaName);

    const tables = (await this.prisma.$queryRawUnsafe(
      `SELECT t.table_name, pgd.description
       FROM information_schema.tables t
       LEFT JOIN pg_catalog.pg_description pgd
         ON pgd.objsubid = 0 AND pgd.objoid = ($1 || '.' || t.table_name)::regclass
       WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE'
       ORDER BY t.table_name`,
      schemaName,
    )) as Array<{ table_name: string; description: string | null }>;

    const metaRows = await this.prisma.table.findMany({
      where: { projectId },
      select: { id: true, name: true },
    });
    const metaByName = new Map<string, string>(
      metaRows.map((m) => [m.name, m.id]),
    );

    const result = [];

    for (const t of tables) {
      const columns = (await this.prisma.$queryRawUnsafe(
        `SELECT column_name, data_type, is_nullable, column_default, ordinal_position
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        schemaName,
        t.table_name,
      )) as Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        ordinal_position: number;
      }>;

      const pkCols = (await this.prisma.$queryRawUnsafe(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'`,
        schemaName,
        t.table_name,
      )) as Array<{ column_name: string }>;
      const pkSet = new Set(pkCols.map((r: any) => r.column_name));

      const relations = (await this.prisma.$queryRawUnsafe(
        `SELECT kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = $1 AND tc.table_name = $2`,
        schemaName,
        t.table_name,
      )) as Array<{
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
      }>;

      const stripProject = (name: string) =>
        name.replace(/^proj_[a-zA-Z0-9_]+_/, '');

      result.push({
        id: metaByName.get(t.table_name) ?? null,
        name: t.table_name,
        description: t.description,
        columns: columns.map((col: any) => ({
          name: col.column_name,
          type: col.data_type,
          defaultValue: col.column_default,
          isNullable: col.is_nullable === 'YES',
          isPrimary: pkSet.has(col.column_name),
          ordinalPosition: col.ordinal_position,
        })),
        relations: relations.map((r: any) => ({
          columnName: r.column_name,
          referencedTable: stripProject(r.foreign_table_name),
          referencedColumn: r.foreign_column_name,
        })),
      });
    }

    return result;
  }

  private mapType(colType: string): string {
    const map: Record<string, string> = {
      varchar: 'varchar(255)',
      'double precision': 'double precision',
      timestamptz: 'timestamptz',
    };
    return map[colType] || colType;
  }

  private literal(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    const str = String(value);
    return `'${str.replace(/'/g, "''")}'`;
  }
}
