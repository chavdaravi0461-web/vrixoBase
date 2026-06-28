import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface TableInfo {
  tableName: string;
  columns: Array<{
    columnName: string;
    dataType: string;
    isNullable: boolean;
    isPrimary: boolean;
    isUnique: boolean;
    defaultValue: string | null;
  }>;
  foreignKeys: Array<{
    columnName: string;
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
}

@Injectable()
export class TenancyService {
  private readonly logger = new Logger(TenancyService.name);

  constructor(private readonly prisma: PrismaService) {}

  schemaName(projectId: string): string {
    return `proj_${projectId.replace(/[^a-zA-Z0-9_]/g, '')}`;
  }

  private id(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  async provisionProjectSchema(projectId: string): Promise<void> {
    const schema = this.schemaName(projectId);
    this.logger.log(`Provisioning schema "${schema}" for project ${projectId}`);

    await this.prisma.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS ${this.id(schema)}`,
    );

    const systemTablesExist = await this.prisma.$queryRawUnsafe(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = '_schema_version'
      ) AS exists`,
      schema,
    ) as Array<{ exists: boolean }>;

    if (!systemTablesExist[0]?.exists) {
      await this.installSystemTables(schema);
    }

    this.logger.log(`Schema "${schema}" provisioned successfully`);
  }

  async teardownProjectSchema(projectId: string): Promise<void> {
    const schema = this.schemaName(projectId);
    this.logger.log(`Tearing down schema "${schema}" for project ${projectId}`);

    await this.prisma.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS ${this.id(schema)} CASCADE`,
    );

    this.logger.log(`Schema "${schema}" torn down successfully`);
  }

  async schemaExists(projectId: string): Promise<boolean> {
    const schema = this.schemaName(projectId);
    const result = await this.prisma.$queryRawUnsafe(
      `SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS exists`,
      schema,
    ) as Array<{ exists: boolean }>;
    return result[0]?.exists ?? false;
  }

  async cloneSchema(sourceProjectId: string, targetProjectId: string): Promise<void> {
    const sourceSchema = this.schemaName(sourceProjectId);
    const targetSchema = this.schemaName(targetProjectId);

    const tables = await this.prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       AND table_name NOT LIKE '\\_%'`,
      sourceSchema,
    ) as Array<{ table_name: string }>;

    await this.prisma.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS ${this.id(targetSchema)}`,
    );

    for (const t of tables) {
      const sql = `CREATE TABLE ${this.id(targetSchema)}.${this.id(t.table_name)} (LIKE ${this.id(sourceSchema)}.${this.id(t.table_name)} INCLUDING ALL)`;
      await this.prisma.$executeRawUnsafe(sql);

      const rows = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM ${this.id(sourceSchema)}.${this.id(t.table_name)}`,
      ) as Array<Record<string, unknown>>;

      for (const row of rows) {
        const keys = Object.keys(row);
        const vals = Object.values(row);
        const cols = keys.map(k => this.id(k)).join(', ');
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO ${this.id(targetSchema)}.${this.id(t.table_name)} (${cols}) VALUES (${placeholders})`,
          ...vals,
        );
      }
    }
  }

  async getSchemaInfo(projectId: string): Promise<Array<TableInfo>> {
    const schema = this.schemaName(projectId);

    const tables = await this.prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       AND table_name NOT LIKE '\\_%'
       ORDER BY table_name`,
      schema,
    ) as Array<{ table_name: string }>;

    const result: TableInfo[] = [];

    for (const t of tables) {
      const cols = await this.prisma.$queryRawUnsafe(
        `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
                tc.constraint_type
         FROM information_schema.columns c
         LEFT JOIN information_schema.key_column_usage kcu
           ON c.column_name = kcu.column_name AND c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name
         LEFT JOIN information_schema.table_constraints tc
           ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
         WHERE c.table_schema = $1 AND c.table_name = $2
         ORDER BY c.ordinal_position`,
        schema, t.table_name,
      ) as Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        constraint_type: string | null;
      }>;

      const pkSet = new Set<string>();
      const uqSet = new Set<string>();
      for (const c of cols) {
        if (c.constraint_type === 'PRIMARY KEY') pkSet.add(c.column_name);
        if (c.constraint_type === 'UNIQUE') uqSet.add(c.column_name);
      }

      const fks = await this.prisma.$queryRawUnsafe(
        `SELECT kcu.column_name,
                ccu.table_schema AS ref_schema,
                ccu.table_name AS ref_table,
                ccu.column_name AS ref_column
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = $1 AND tc.table_name = $2`,
        schema, t.table_name,
      ) as Array<{
        column_name: string;
        ref_schema: string;
        ref_table: string;
        ref_column: string;
      }>;

      result.push({
        tableName: t.table_name,
        columns: cols.map(c => ({
          columnName: c.column_name,
          dataType: c.data_type,
          isNullable: c.is_nullable === 'YES',
          isPrimary: pkSet.has(c.column_name),
          isUnique: uqSet.has(c.column_name),
          defaultValue: c.column_default,
        })),
        foreignKeys: fks.map(fk => ({
          columnName: fk.column_name,
          referencedSchema: fk.ref_schema,
          referencedTable: fk.ref_table,
          referencedColumn: fk.ref_column,
        })),
      });
    }

    return result;
  }

  async getTableInfo(projectId: string, tableName: string): Promise<TableInfo> {
    const schema = this.schemaName(projectId);

    const tables = await this.prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'`,
      schema, tableName,
    ) as Array<{ table_name: string }>;

    if (tables.length === 0) {
      throw new NotFoundException(`Table "${tableName}" not found in project`);
    }

    const cols = await this.prisma.$queryRawUnsafe(
      `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
              tc.constraint_type
       FROM information_schema.columns c
       LEFT JOIN information_schema.key_column_usage kcu
         ON c.column_name = kcu.column_name AND c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name
       LEFT JOIN information_schema.table_constraints tc
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      schema, tableName,
    ) as Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      constraint_type: string | null;
    }>;

    const pkSet = new Set<string>();
    const uqSet = new Set<string>();
    for (const c of cols) {
      if (c.constraint_type === 'PRIMARY KEY') pkSet.add(c.column_name);
      if (c.constraint_type === 'UNIQUE') uqSet.add(c.column_name);
    }

    const fks = await this.prisma.$queryRawUnsafe(
      `SELECT kcu.column_name,
              ccu.table_schema AS ref_schema,
              ccu.table_name AS ref_table,
              ccu.column_name AS ref_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = $1 AND tc.table_name = $2`,
      schema, tableName,
    ) as Array<{
      column_name: string;
      ref_schema: string;
      ref_table: string;
      ref_column: string;
    }>;

    return {
      tableName,
      columns: cols.map(c => ({
        columnName: c.column_name,
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
        isPrimary: pkSet.has(c.column_name),
        isUnique: uqSet.has(c.column_name),
        defaultValue: c.column_default,
      })),
      foreignKeys: fks.map(fk => ({
        columnName: fk.column_name,
        referencedSchema: fk.ref_schema,
        referencedTable: fk.ref_table,
        referencedColumn: fk.ref_column,
      })),
    };
  }

  private async installSystemTables(schema: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE ${this.id(schema)}._schema_version (
        version INTEGER NOT NULL PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        description TEXT
      )`,
    );

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO ${this.id(schema)}._schema_version (version, description)
       VALUES (1, 'Initial system tables')`,
    );
  }
}
