import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { ProxyQueryDto } from './dto/proxy-query.dto';

interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  isPrimary: boolean;
  isUnique: boolean;
  defaultValue: string | null;
}

interface ForeignKeyInfo {
  columnName: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
}

interface TableInfo {
  tableName: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
}

interface EmbedRequest {
  relationName: string;
  columns: string[];
  children: EmbedRequest[];
}

interface ParsedSelect {
  columns: string[];
  embeds: EmbedRequest[];
}

@Injectable()
export class ApiGeneratorService {
  private readonly logger = new Logger(ApiGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
  ) {}

  private async setSessionVars(req: any): Promise<void> {
    const userId = req?.rlsUserId;
    const userRole = req?.rlsUserRole || 'anon';
    const projectId = req?.rlsProjectId;

    try {
      await this.prisma.$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', $1, true)`,
        [userId || ''],
      );
      await this.prisma.$executeRawUnsafe(
        `SELECT set_config('app.current_user_role', $1, true)`,
        [userRole],
      );
      if (projectId) {
        await this.prisma.$executeRawUnsafe(
          `SELECT set_config('app.current_project_id', $1, true)`,
          [projectId],
        );
      }
    } catch {
      // non-fatal
    }
  }

  private quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  async generateEndpoints(projectId: string, tableName: string) {
    await this.tenancy.getTableInfo(projectId, tableName);
    return {
      project: projectId,
      table: tableName,
      endpoints: [
        { method: 'GET', path: `/api/proxy/${projectId}/${tableName}`, description: 'List records with filtering, sorting, and pagination' },
        { method: 'GET', path: `/api/proxy/${projectId}/${tableName}/:id`, description: 'Get a single record by primary key' },
        { method: 'POST', path: `/api/proxy/${projectId}/${tableName}`, description: 'Create records (single or bulk)' },
        { method: 'PATCH', path: `/api/proxy/${projectId}/${tableName}/:id`, description: 'Update a record by primary key' },
        { method: 'PATCH', path: `/api/proxy/${projectId}/${tableName}`, description: 'Update records matching filter conditions' },
        { method: 'DELETE', path: `/api/proxy/${projectId}/${tableName}/:id`, description: 'Delete a record by primary key' },
        { method: 'DELETE', path: `/api/proxy/${projectId}/${tableName}`, description: 'Delete records matching filter conditions' },
      ],
    };
  }

  async readRecords(
    projectId: string,
    tableName: string,
    query: ProxyQueryDto,
    preferCount: boolean = false,
    range?: string,
    req?: any,
  ) {
    await this.setSessionVars(req);
    const tableInfo = await this.tenancy.getTableInfo(projectId, tableName);
    const schema = this.tenancy.schemaName(projectId);
    const safeTable = `${this.quoteIdent(schema)}.${this.quoteIdent(tableName)}`;
    const columnNames = tableInfo.columns.map(c => c.columnName);

    const parsedSelect = this.parseSelectClause(query.select, tableInfo);

    let selectClause = safeTable + '.*';
    if (parsedSelect && parsedSelect.columns.length > 0) {
      selectClause = parsedSelect.columns.map(c => `${safeTable}.${this.quoteIdent(c)}`).join(', ');
    }

    const whereParts: string[] = [];
    const params: any[] = [];

    if (columnNames.includes('project_id')) {
      whereParts.push(`${safeTable}.${this.quoteIdent('project_id')} = $${params.length + 1}`);
      params.push(projectId);
    }

    this.applyFilters(whereParts, params, query.filters, tableInfo);
    this.applySearch(whereParts, params, query.search, tableInfo);

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    let total: number | null = null;
    if (preferCount) {
      const countSql = `SELECT COUNT(*) as total FROM ${safeTable} ${whereClause}`;
      const countResult = await this.prisma.$queryRawUnsafe(countSql, ...params) as Array<{ total: bigint }>;
      total = Number(countResult[0]?.total || 0);
    }

    let orderClause = '';
    if (query.order) {
      orderClause = this.buildOrderClause(query.order, columnNames, safeTable);
    }
    if (!orderClause) {
      const createdAtCol = columnNames.includes('created_at') ? 'created_at' :
        columnNames.includes('createdAt') ? 'createdAt' : null;
      if (createdAtCol) {
        orderClause = `ORDER BY ${safeTable}.${this.quoteIdent(createdAtCol)} DESC`;
      }
    }

    let limit = query.limit ?? 10;
    let offset = query.offset ?? 0;

    if (range) {
      const parsed = this.parseRangeHeader(range);
      if (parsed) {
        limit = parsed.limit;
        offset = parsed.offset;
      }
    }

    limit = Math.min(limit, 1000);
    offset = Math.max(offset, 0);

    const dataSql = `SELECT ${selectClause} FROM ${safeTable} ${whereClause} ${orderClause} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    let data = await this.prisma.$queryRawUnsafe(dataSql, ...params, limit, offset) as Record<string, any>[];

    if (parsedSelect && parsedSelect.embeds.length > 0) {
      data = await this.embedRelations(projectId, data, parsedSelect.embeds, tableInfo, schema);
    }

    data = data.map(row => this.camelizeKeys(row));

    return { data, total, limit, offset };
  }

  async readRecord(
    projectId: string,
    tableName: string,
    idOrFilter: string,
    query?: ProxyQueryDto,
    req?: any,
  ) {
    await this.setSessionVars(req);
    const tableInfo = await this.tenancy.getTableInfo(projectId, tableName);
    const schema = this.tenancy.schemaName(projectId);
    const safeTable = `${this.quoteIdent(schema)}.${this.quoteIdent(tableName)}`;
    const columnNames = tableInfo.columns.map(c => c.columnName);

    const parsedSelect = this.parseSelectClause(query?.select, tableInfo);

    let selectClause = safeTable + '.*';
    if (parsedSelect && parsedSelect.columns.length > 0) {
      selectClause = parsedSelect.columns.map(c => `${safeTable}.${this.quoteIdent(c)}`).join(', ');
    }

    const whereParts: string[] = [];
    const params: any[] = [];

    const pkColumn = tableInfo.columns.find(c => c.isPrimary)?.columnName || 'id';
    whereParts.push(`${safeTable}.${this.quoteIdent(pkColumn)} = $${params.length + 1}`);
    params.push(idOrFilter);

    if (columnNames.includes('project_id')) {
      whereParts.push(`${safeTable}.${this.quoteIdent('project_id')} = $${params.length + 1}`);
      params.push(projectId);
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`;
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT ${selectClause} FROM ${safeTable} ${whereClause} LIMIT 1`,
      ...params,
    ) as Record<string, any>[];

    if (rows.length === 0) {
      throw new NotFoundException(`Record not found in "${tableName}"`);
    }

    let row = rows[0];

    if (parsedSelect && parsedSelect.embeds.length > 0) {
      const embedded = await this.embedRelations(projectId, [row], parsedSelect.embeds, tableInfo, schema);
      row = embedded[0];
    }

    return this.camelizeKeys(row);
  }

  async createRecords(
    projectId: string,
    tableName: string,
    body: Record<string, any> | Array<Record<string, any>>,
    userId?: string,
    preferResolution?: string,
    onConflict?: string,
    req?: any,
  ) {
    await this.setSessionVars(req);
    const tableInfo = await this.tenancy.getTableInfo(projectId, tableName);
    const schema = this.tenancy.schemaName(projectId);
    const safeTable = `${this.quoteIdent(schema)}.${this.quoteIdent(tableName)}`;
    const columnNames = tableInfo.columns.map(c => c.columnName);

    const records = Array.isArray(body) ? body : [body];

    const results: Record<string, any>[] = [];

    for (const record of records) {
      const row = { ...record };

      if (columnNames.includes('project_id') && !row.project_id && !row.projectId) {
        row.project_id = projectId;
      }
      if (userId && columnNames.includes('created_by') && !row.created_by && !row.createdBy) {
        row.created_by = userId;
      }

      const insertable: Record<string, any> = {};
      for (const [key, val] of Object.entries(row)) {
        const snakeKey = this.toSnakeCase(key);
        if (columnNames.includes(snakeKey)) {
          insertable[snakeKey] = val;
        }
      }

      if (Object.keys(insertable).length === 0) {
        throw new BadRequestException('No valid columns provided for insert');
      }

      const keys = Object.keys(insertable);
      const values = Object.values(insertable);
      const cols = keys.map(k => this.quoteIdent(k)).join(', ');
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      let sql: string;
      if (onConflict && preferResolution === 'merge-duplicates') {
        const conflictCols = onConflict.split(',').map(c => c.trim()).filter(c => columnNames.includes(c));
        if (conflictCols.length > 0) {
          const updateSet = keys
            .filter(k => !conflictCols.includes(k))
            .map(k => `${this.quoteIdent(k)} = EXCLUDED.${this.quoteIdent(k)}`);
          const conflictTarget = conflictCols.map(c => this.quoteIdent(c)).join(', ');
          sql = `INSERT INTO ${safeTable} (${cols}) VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updateSet.join(', ')} RETURNING *`;
        } else {
          sql = `INSERT INTO ${safeTable} (${cols}) VALUES (${placeholders}) RETURNING *`;
        }
      } else {
        sql = `INSERT INTO ${safeTable} (${cols}) VALUES (${placeholders}) RETURNING *`;
      }

      const result = await this.prisma.$queryRawUnsafe(sql, ...values) as Record<string, any>[];
      results.push(this.camelizeKeys(result[0]));
    }

    return Array.isArray(body) ? results : results[0];
  }

  async updateRecords(
    projectId: string,
    tableName: string,
    idOrFilter: string | undefined,
    data: Record<string, any>,
    query?: ProxyQueryDto,
    userId?: string,
    preferResolution?: string,
    req?: any,
  ) {
    await this.setSessionVars(req);
    const tableInfo = await this.tenancy.getTableInfo(projectId, tableName);
    const schema = this.tenancy.schemaName(projectId);
    const safeTable = `${this.quoteIdent(schema)}.${this.quoteIdent(tableName)}`;
    const columnNames = tableInfo.columns.map(c => c.columnName);

    const pkColumn = tableInfo.columns.find(c => c.isPrimary)?.columnName || 'id';

    const conditions: string[] = [];
    const params: any[] = [];

    if (idOrFilter) {
      conditions.push(`${safeTable}.${this.quoteIdent(pkColumn)} = $${params.length + 1}`);
      params.push(idOrFilter);
    } else {
      this.applyFilters(conditions, params, query?.filters, tableInfo);
      this.applySearch(conditions, params, query?.search, tableInfo);
    }

    if (columnNames.includes('project_id')) {
      conditions.push(`${safeTable}.${this.quoteIdent('project_id')} = $${params.length + 1}`);
      params.push(projectId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const updatable: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      const snakeKey = this.toSnakeCase(key);
      if (columnNames.includes(snakeKey) && snakeKey !== pkColumn) {
        updatable[snakeKey] = val;
      }
    }

    if (Object.keys(updatable).length === 0) {
      throw new BadRequestException('No valid columns provided for update');
    }

    const entries = Object.entries(updatable);
    const setClauses = entries.map(([k], i) => `${safeTable}.${this.quoteIdent(k)} = $${params.length + 1 + i}`);
    const setValues = entries.map(([, v]) => v);

    if (idOrFilter) {
      const exists = await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM ${safeTable} ${whereClause} LIMIT 1`,
        ...params,
      ) as Record<string, any>[];
      if (exists.length === 0) {
        throw new NotFoundException(`Record not found in "${tableName}"`);
      }
    }

    const result = await this.prisma.$queryRawUnsafe(
      `UPDATE ${safeTable} SET ${setClauses.join(', ')} ${whereClause} RETURNING *`,
      ...params,
      ...setValues,
    ) as Record<string, any>[];

    if (result.length === 0) {
      if (idOrFilter) {
        throw new NotFoundException(`Record not found in "${tableName}"`);
      }
      return { records: [], affected: 0 };
    }

    const countResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM ${safeTable} ${whereClause}`,
      ...params,
    ) as Array<{ total: bigint }>;
    const affected = Number(countResult[0]?.total || result.length);

    return {
      records: result.map(r => this.camelizeKeys(r)),
      affected,
    };
  }

  async deleteRecords(
    projectId: string,
    tableName: string,
    idOrFilter?: string,
    query?: ProxyQueryDto,
    req?: any,
  ) {
    await this.setSessionVars(req);
    const tableInfo = await this.tenancy.getTableInfo(projectId, tableName);
    const schema = this.tenancy.schemaName(projectId);
    const safeTable = `${this.quoteIdent(schema)}.${this.quoteIdent(tableName)}`;
    const columnNames = tableInfo.columns.map(c => c.columnName);

    const pkColumn = tableInfo.columns.find(c => c.isPrimary)?.columnName || 'id';

    const conditions: string[] = [];
    const params: any[] = [];

    if (idOrFilter) {
      conditions.push(`${safeTable}.${this.quoteIdent(pkColumn)} = $${params.length + 1}`);
      params.push(idOrFilter);
    } else {
      this.applyFilters(conditions, params, query?.filters, tableInfo);
      this.applySearch(conditions, params, query?.search, tableInfo);
    }

    if (columnNames.includes('project_id')) {
      conditions.push(`${safeTable}.${this.quoteIdent('project_id')} = $${params.length + 1}`);
      params.push(projectId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await this.prisma.$queryRawUnsafe(
      `DELETE FROM ${safeTable} ${whereClause} RETURNING *`,
      ...params,
    ) as Record<string, any>[];

    return {
      records: result.map(r => this.camelizeKeys(r)),
      affected: result.length,
    };
  }

  private parseSelectClause(select: string | undefined, tableInfo: TableInfo): ParsedSelect | null {
    if (!select || select.trim() === '' || select === '*') return null;

    const result: ParsedSelect = { columns: [], embeds: [] };
    const parts = this.splitSelectParts(select);

    for (const part of parts) {
      const trimmed = part.trim();
      const embedMatch = trimmed.match(/^(\w+)\((.+)\)$/);
      if (embedMatch) {
        const relationName = embedMatch[1];
        const innerContent = embedMatch[2].trim();
        const fk = tableInfo.foreignKeys.find(f =>
          this.stripSchemaPrefix(f.referencedTable) === relationName ||
          f.columnName === relationName + '_id',
        );

        if (fk) {
          const innerParsed = this.parseSelectClause(innerContent, tableInfo);
          result.embeds.push({
            relationName: this.stripSchemaPrefix(fk.referencedTable),
            columns: innerParsed ? innerParsed.columns : ['*'],
            children: innerParsed ? innerParsed.embeds : [],
          });
        }
      } else if (trimmed !== '' && trimmed !== '*') {
        if (!trimmed.includes('(')) {
          const colName = this.toSnakeCase(trimmed);
          const matched = tableInfo.columns.find(c => c.columnName === colName);
          if (matched) {
            result.columns.push(trimmed);
          }
        }
      }
    }

    return result;
  }

  private splitSelectParts(select: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const ch of select) {
      if (ch === '(') { depth++; current += ch; }
      else if (ch === ')') { depth--; current += ch; }
      else if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) parts.push(current);
    return parts;
  }

  private async embedRelations(
    projectId: string,
    rows: Record<string, any>[],
    embeds: EmbedRequest[],
    tableInfo: TableInfo,
    schema: string,
  ): Promise<Record<string, any>[]> {
    for (const embed of embeds) {
      const fk = tableInfo.foreignKeys.find(f =>
        this.stripSchemaPrefix(f.referencedTable) === embed.relationName,
      );

      if (!fk) continue;

      const relatedSchema = fk.referencedSchema;
      const safeRefTable = `${this.quoteIdent(relatedSchema)}.${this.quoteIdent(fk.referencedTable)}`;

      const fkValues = rows
        .map(r => r[fk.columnName])
        .filter((v): v is string | number => v != null);
      if (fkValues.length === 0) continue;

      const uniqueVals = [...new Set(fkValues)];
      const placeholders = uniqueVals.map((_, i) => `$${i + 2}`);
      const refPk = await this.findPrimaryKey(relatedSchema, fk.referencedTable);

      const embedCols = embed.columns.includes('*')
        ? '*'
        : embed.columns.map(c => this.quoteIdent(c)).join(', ');

      const relatedRows = await this.prisma.$queryRawUnsafe(
        `SELECT ${embedCols} FROM ${safeRefTable} WHERE ${this.quoteIdent(fk.referencedColumn)} IN (${placeholders.join(',')})`,
        ...uniqueVals,
      ) as Record<string, any>[];

      const grouped: Record<string, any[]> = {};
      for (const rr of relatedRows) {
        const key = String(rr[fk.referencedColumn]);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(this.camelizeKeys(rr));
      }

      for (const row of rows) {
        const key = String(row[fk.columnName]);
        const camelKey = this.toCamelCase(embed.relationName);
        row[camelKey] = grouped[key] || [];
      }
    }

    return rows;
  }

  private async findPrimaryKey(schema: string, table: string): Promise<string> {
    const result = await this.prisma.$queryRawUnsafe(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'`,
      schema, table,
    ) as Array<{ column_name: string }>;
    return result[0]?.column_name || 'id';
  }

  private applyFilters(
    conditions: string[],
    params: any[],
    filters: string | undefined,
    tableInfo: TableInfo,
  ): void {
    if (!filters) return;

    const columnNames = tableInfo.columns.map(c => c.columnName);
    const entries = filters.split('&');

    for (const entry of entries) {
      const trimmed = entry.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('or(') && trimmed.endsWith(')')) {
        const inner = trimmed.slice(3, -1);
        this.applyOrFilter(conditions, params, inner, tableInfo);
        continue;
      }

      if (trimmed.startsWith('and(') && trimmed.endsWith(')')) {
        const inner = trimmed.slice(4, -1);
        this.applyFilters(conditions, params, inner, tableInfo);
        continue;
      }

      if (trimmed.startsWith('not.')) {
        const inner = trimmed.slice(4);
        const tempConditions: string[] = [];
        const tempParams: any[] = [];
        const fakeTableInfo = tableInfo;

        if (inner.startsWith('and(') && inner.endsWith(')')) {
          const andInner = inner.slice(4, -1);
          this.applyFilters(tempConditions, tempParams, andInner, fakeTableInfo);
        } else if (inner.startsWith('or(') && inner.endsWith(')')) {
          const orInner = inner.slice(3, -1);
          this.applyOrFilter(tempConditions, tempParams, orInner, fakeTableInfo);
        }

        if (tempConditions.length > 0) {
          conditions.push(`NOT (${tempConditions.join(' AND ')})`);
        }
        continue;
      }

      const match = trimmed.match(/^(\w+)\.(eq|neq|gt|gte|lt|lte|like|ilike|in|is|not\.is|cs|cd|ov|sl|sr|nxs|nxx)\.(.+)$/);
      if (match) {
        const field = match[1];
        const operator = match[2];
        let value: string = match[3];

        const snakeField = this.toSnakeCase(field);
        if (!columnNames.includes(snakeField)) continue;

        const quotedField = this.quoteIdent(snakeField);

        switch (operator) {
          case 'eq':
            conditions.push(`${quotedField} = $${params.length + 1}`);
            params.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'neq':
            conditions.push(`${quotedField} != $${params.length + 1}`);
            params.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'gt':
            conditions.push(`${quotedField} > $${params.length + 1}`);
            params.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'gte':
            conditions.push(`${quotedField} >= $${params.length + 1}`);
            params.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'lt':
            conditions.push(`${quotedField} < $${params.length + 1}`);
            params.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'lte':
            conditions.push(`${quotedField} <= $${params.length + 1}`);
            params.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'like':
            conditions.push(`CAST(${quotedField} AS TEXT) LIKE $${params.length + 1}`);
            params.push(value);
            break;
          case 'ilike':
            conditions.push(`CAST(${quotedField} AS TEXT) ILIKE $${params.length + 1}`);
            params.push(value);
            break;
          case 'in': {
            const vals = value.split(',').map(v => v.trim()).filter(Boolean);
            if (vals.length > 0) {
              const startIdx = params.length + 1;
              const placeholders = vals.map((_, i) => `$${startIdx + i}`);
              conditions.push(`${quotedField} IN (${placeholders.join(', ')})`);
              params.push(...vals.map(v => this.castValue(v, snakeField, tableInfo)));
            }
            break;
          }
          case 'is':
            if (value.toLowerCase() === 'null') {
              conditions.push(`${quotedField} IS NULL`);
            } else if (value.toLowerCase() === 'true') {
              conditions.push(`${quotedField} IS TRUE`);
            } else if (value.toLowerCase() === 'false') {
              conditions.push(`${quotedField} IS FALSE`);
            }
            break;
          case 'not.is':
            if (value.toLowerCase() === 'null') {
              conditions.push(`${quotedField} IS NOT NULL`);
            } else if (value.toLowerCase() === 'true') {
              conditions.push(`${quotedField} IS NOT TRUE`);
            } else if (value.toLowerCase() === 'false') {
              conditions.push(`${quotedField} IS NOT FALSE`);
            }
            break;
          case 'cs':
            conditions.push(`${quotedField} @> $${params.length + 1}::jsonb`);
            params.push(JSON.stringify(value));
            break;
          case 'cd':
            conditions.push(`${quotedField} <@ $${params.length + 1}::jsonb`);
            params.push(JSON.stringify(value));
            break;
        }
      }
    }
  }

  private applyOrFilter(
    conditions: string[],
    params: any[],
    inner: string,
    tableInfo: TableInfo,
  ): void {
    const orParts: string[] = [];
    const orParams: any[] = [];
    const paramOffset = params.length;

    const subFilters = inner.split(',');
    for (const sub of subFilters) {
      const trimmed = sub.trim();
      const match = trimmed.match(/^(\w+)\.(eq|neq|gt|gte|lt|lte|like|ilike|in|is|not\.is)\.(.+)$/);
      if (match) {
        const field = match[1];
        const operator = match[2];
        const value = match[3];
        const snakeField = this.toSnakeCase(field);
        if (!tableInfo.columns.find(c => c.columnName === snakeField)) continue;

        const quotedField = this.quoteIdent(snakeField);
        const idx = paramOffset + orParams.length + 1;

        switch (operator) {
          case 'eq':
            orParts.push(`${quotedField} = $${idx}`);
            orParams.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'neq':
            orParts.push(`${quotedField} != $${idx}`);
            orParams.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'gt':
            orParts.push(`${quotedField} > $${idx}`);
            orParams.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'gte':
            orParts.push(`${quotedField} >= $${idx}`);
            orParams.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'lt':
            orParts.push(`${quotedField} < $${idx}`);
            orParams.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'lte':
            orParts.push(`${quotedField} <= $${idx}`);
            orParams.push(this.castValue(value, snakeField, tableInfo));
            break;
          case 'like':
            orParts.push(`CAST(${quotedField} AS TEXT) LIKE $${idx}`);
            orParams.push(value);
            break;
          case 'ilike':
            orParts.push(`CAST(${quotedField} AS TEXT) ILIKE $${idx}`);
            orParams.push(value);
            break;
          case 'is':
            if (value.toLowerCase() === 'null') orParts.push(`${quotedField} IS NULL`);
            break;
          case 'not.is':
            if (value.toLowerCase() === 'null') orParts.push(`${quotedField} IS NOT NULL`);
            break;
        }
      }
    }

    if (orParts.length > 0) {
      conditions.push(`(${orParts.join(' OR ')})`);
      params.push(...orParams);
    }
  }

  private applySearch(
    conditions: string[],
    params: any[],
    search: string | undefined,
    tableInfo: TableInfo,
  ): void {
    if (!search) return;

    const textColumns = tableInfo.columns.filter(c =>
      ['text', 'character varying', 'varchar', 'character', 'citext'].includes(c.dataType),
    );
    if (textColumns.length === 0) return;

    const idx = params.length + 1;
    const likeClauses = textColumns.map(
      c => `CAST(${this.quoteIdent(c.columnName)} AS TEXT) ILIKE $${idx}`,
    );
    conditions.push(`(${likeClauses.join(' OR ')})`);
    params.push(`%${search}%`);
  }

  private buildOrderClause(order: string, columnNames: string[], safeTable: string): string {
    const parts = order.split(',');
    const clauses: string[] = [];

    for (const part of parts) {
      const trimmed = part.trim();
      const match = trimmed.match(/^(\w+)\.(asc|desc|ASC|DESC)$/);
      if (match) {
        const field = this.toSnakeCase(match[1]);
        const dir = match[2].toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        if (columnNames.includes(field)) {
          clauses.push(`${safeTable}.${this.quoteIdent(field)} ${dir}`);
        }
      }
    }

    return clauses.length > 0 ? `ORDER BY ${clauses.join(', ')}` : '';
  }

  private parseRangeHeader(range: string): { limit: number; offset: number } | null {
    const match = range.match(/^(\d+)-(\d+)$/);
    if (!match) return null;
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (isNaN(start) || isNaN(end) || end < start) return null;
    return { limit: end - start + 1, offset: start };
  }

  private castValue(value: string, columnName: string, tableInfo: TableInfo): any {
    const col = tableInfo.columns.find(c => c.columnName === columnName);
    if (!col) return value;

    switch (col.dataType) {
      case 'integer':
      case 'int':
      case 'smallint':
        return parseInt(value, 10);
      case 'bigint':
      case 'serial':
      case 'bigserial':
        return BigInt(value);
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      case 'numeric':
      case 'decimal':
      case 'real':
      case 'float':
      case 'double precision':
        return parseFloat(value);
      case 'json':
      case 'jsonb':
        try { return JSON.parse(value); } catch { return value; }
      default:
        return value;
    }
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private stripSchemaPrefix(tableName: string): string {
    return tableName.replace(/^proj_[a-zA-Z0-9_]+_/, '');
  }

  private camelizeKeys(row: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(row)) {
      result[this.toCamelCase(key)] = val;
    }
    return result;
  }
}
