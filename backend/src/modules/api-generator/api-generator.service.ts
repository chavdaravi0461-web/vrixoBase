import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProxyQueryDto } from './dto/proxy-query.dto';

@Injectable()
export class ApiGeneratorService {
  private readonly logger = new Logger(ApiGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getTableInfo(tableName: string) {
    const tables = (await this.prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      tableName,
    )) as { table_name: string }[];
    if (tables.length === 0) {
      throw new NotFoundException(`Table "${tableName}" not found`);
    }
    const columns = (await this.prisma.$queryRawUnsafe(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      tableName,
    )) as { column_name: string; data_type: string; is_nullable: string }[];
    return { tableName, columns };
  }

  private quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  async generateEndpoints(projectId: string, tableName: string) {
    await this.getTableInfo(tableName);
    return {
      project: projectId,
      table: tableName,
      endpoints: [
        { method: 'GET', path: `/api/proxy/${projectId}/${tableName}`, description: 'List records with filtering, sorting, and pagination' },
        { method: 'GET', path: `/api/proxy/${projectId}/${tableName}/:id`, description: 'Get a single record by primary key' },
        { method: 'POST', path: `/api/proxy/${projectId}/${tableName}`, description: 'Create a new record' },
        { method: 'PATCH', path: `/api/proxy/${projectId}/${tableName}/:id`, description: 'Update an existing record' },
        { method: 'DELETE', path: `/api/proxy/${projectId}/${tableName}/:id`, description: 'Delete a record' },
      ],
    };
  }

  async readRecords(projectId: string, tableName: string, query: ProxyQueryDto) {
    const { columns } = await this.getTableInfo(tableName);
    const columnNames = columns.map((c: any) => c.column_name);

    let selectClause = '*';
    if (query.select) {
      const cols = query.select.split(',').map(c => c.trim()).filter(Boolean);
      const valid = cols.filter(c => columnNames.includes(c));
      if (valid.length > 0) {
        selectClause = valid.map(c => this.quoteIdent(c)).join(', ');
      }
    }

    const conditions: string[] = [];
    const params: any[] = [];

    if (columnNames.includes('project_id')) {
      conditions.push(`${this.quoteIdent('project_id')} = $${params.length + 1}`);
      params.push(projectId);
    }

    if (query.search) {
      const textColumns = columns.filter((c: any) =>
        ['text', 'character varying', 'varchar', 'character', 'citext'].includes(c.data_type),
      );
      if (textColumns.length > 0) {
        const idx = params.length + 1;
        const likeClauses = textColumns.map(
          (c: any) => `CAST(${this.quoteIdent(c.column_name)} AS TEXT) ILIKE $${idx}`,
        );
        conditions.push(`(${likeClauses.join(' OR ')})`);
        params.push(`%${query.search}%`);
      }
    }

    if (query.filters) {
      try {
        const filters = JSON.parse(query.filters);
        if (Array.isArray(filters)) {
          for (const f of filters) {
            if (!f.field || !columnNames.includes(f.field)) continue;
            const field = this.quoteIdent(f.field);
            const op = f.operator || 'eq';
            const val = f.value;
            switch (op) {
              case 'eq':
                conditions.push(`${field} = $${params.length + 1}`);
                params.push(val);
                break;
              case 'neq':
                conditions.push(`${field} != $${params.length + 1}`);
                params.push(val);
                break;
              case 'gt':
                conditions.push(`${field} > $${params.length + 1}`);
                params.push(val);
                break;
              case 'gte':
                conditions.push(`${field} >= $${params.length + 1}`);
                params.push(val);
                break;
              case 'lt':
                conditions.push(`${field} < $${params.length + 1}`);
                params.push(val);
                break;
              case 'lte':
                conditions.push(`${field} <= $${params.length + 1}`);
                params.push(val);
                break;
              case 'like':
                conditions.push(`CAST(${field} AS TEXT) ILIKE $${params.length + 1}`);
                params.push(`%${val}%`);
                break;
              case 'in': {
                if (Array.isArray(val) && val.length > 0) {
                  const startIdx = params.length + 1;
                  const placeholders = val.map((_, i) => `$${startIdx + i}`);
                  conditions.push(`${field} IN (${placeholders.join(', ')})`);
                  params.push(...val);
                }
                break;
              }
              case 'isnull':
                conditions.push(`${field} IS NULL`);
                break;
              case 'notnull':
                conditions.push(`${field} IS NOT NULL`);
                break;
            }
          }
        }
      } catch {
        // ignore invalid filter JSON
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeTable = this.quoteIdent(tableName);

    const countSql = `SELECT COUNT(*) as total FROM ${safeTable} ${whereClause}`;
    const countResult = (await this.prisma.$queryRawUnsafe(countSql, ...params)) as { total: bigint }[];
    const total = Number(countResult[0]?.total || 0);

    let orderClause = '';
    if (query.order) {
      const parts = query.order.split('.');
      const field = parts[0];
      const dir = parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      if (columnNames.includes(field)) {
        orderClause = `ORDER BY ${this.quoteIdent(field)} ${dir}`;
      }
    }
    if (!orderClause) {
      if (columnNames.includes('created_at')) {
        orderClause = 'ORDER BY "created_at" DESC';
      } else if (columnNames.includes('createdAt')) {
        orderClause = 'ORDER BY "createdAt" DESC';
      }
    }

    const limit = Math.min(query.limit ?? 50, 1000);
    const offset = query.offset ?? 0;

    const dataSql = `SELECT ${selectClause} FROM ${safeTable} ${whereClause} ${orderClause} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const data = (await this.prisma.$queryRawUnsafe(
      dataSql,
      ...params,
      limit,
      offset,
    )) as Record<string, any>[];

    return { data, total, limit, offset };
  }

  async readRecord(projectId: string, tableName: string, id: string, query?: ProxyQueryDto) {
    const { columns } = await this.getTableInfo(tableName);
    const columnNames = columns.map((c: any) => c.column_name);

    let selectClause = '*';
    if (query?.select) {
      const cols = query.select.split(',').map(c => c.trim()).filter(Boolean);
      const valid = cols.filter(c => columnNames.includes(c));
      if (valid.length > 0) {
        selectClause = valid.map(c => this.quoteIdent(c)).join(', ');
      }
    }

    const conditions: string[] = [];
    const params: any[] = [];

    const pkColumn = columns.find((c: any) => c.column_name === 'id')?.column_name || 'id';
    conditions.push(`${this.quoteIdent(pkColumn)} = $${params.length + 1}`);
    params.push(id);

    if (columnNames.includes('project_id')) {
      conditions.push(`${this.quoteIdent('project_id')} = $${params.length + 1}`);
      params.push(projectId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const safeTable = this.quoteIdent(tableName);

    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT ${selectClause} FROM ${safeTable} ${whereClause} LIMIT 1`,
      ...params,
    )) as Record<string, any>[];

    if (rows.length === 0) {
      throw new NotFoundException(`Record not found in "${tableName}"`);
    }

    return rows[0];
  }

  async createRecord(projectId: string, tableName: string, data: Record<string, any>, userId?: string) {
    const { columns } = await this.getTableInfo(tableName);
    const columnNames = columns.map((c: any) => c.column_name);

    if (columnNames.includes('project_id') && data.project_id === undefined && data.projectId === undefined) {
      data.project_id = projectId;
    }
    if (userId && columnNames.includes('created_by') && data.created_by === undefined && data.createdBy === undefined) {
      data.created_by = userId;
    }

    const insertable: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (columnNames.includes(key)) {
        insertable[key] = val;
      }
    }

    if (Object.keys(insertable).length === 0) {
      throw new NotFoundException('No valid columns provided for insert');
    }

    const keys = Object.keys(insertable);
    const values = Object.values(insertable);
    const cols = keys.map(k => this.quoteIdent(k)).join(', ');
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const safeTable = this.quoteIdent(tableName);

    const result = (await this.prisma.$queryRawUnsafe(
      `INSERT INTO ${safeTable} (${cols}) VALUES (${placeholders}) RETURNING *`,
      ...values,
    )) as Record<string, any>[];

    return result[0];
  }

  async updateRecord(projectId: string, tableName: string, id: string, data: Record<string, any>, userId?: string) {
    const { columns } = await this.getTableInfo(tableName);
    const columnNames = columns.map((c: any) => c.column_name);

    const pkColumn = columns.find((c: any) => c.column_name === 'id')?.column_name || 'id';

    const conditions: string[] = [];
    const params: any[] = [];

    conditions.push(`${this.quoteIdent(pkColumn)} = $${params.length + 1}`);
    params.push(id);

    if (columnNames.includes('project_id')) {
      conditions.push(`${this.quoteIdent('project_id')} = $${params.length + 1}`);
      params.push(projectId);
    }

    const safeTable = this.quoteIdent(tableName);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const exists = (await this.prisma.$queryRawUnsafe(
      `SELECT 1 FROM ${safeTable} ${whereClause} LIMIT 1`,
      ...params,
    )) as Record<string, any>[];
    if (exists.length === 0) {
      throw new NotFoundException(`Record not found in "${tableName}"`);
    }

    const updatable: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (columnNames.includes(key) && key !== pkColumn) {
        updatable[key] = val;
      }
    }

    if (Object.keys(updatable).length === 0) {
      throw new NotFoundException('No valid columns provided for update');
    }

    const entries = Object.entries(updatable);
    const setClauses = entries.map(([k], i) => `${this.quoteIdent(k)} = $${params.length + 1 + i}`);
    const setValues = entries.map(([, v]) => v);

    const result = (await this.prisma.$queryRawUnsafe(
      `UPDATE ${safeTable} SET ${setClauses.join(', ')} ${whereClause} RETURNING *`,
      ...params,
      ...setValues,
    )) as Record<string, any>[];

    return result[0];
  }

  async deleteRecord(projectId: string, tableName: string, id: string, userId?: string) {
    const { columns } = await this.getTableInfo(tableName);
    const columnNames = columns.map((c: any) => c.column_name);

    const pkColumn = columns.find((c: any) => c.column_name === 'id')?.column_name || 'id';

    const conditions: string[] = [];
    const params: any[] = [];

    conditions.push(`${this.quoteIdent(pkColumn)} = $${params.length + 1}`);
    params.push(id);

    if (columnNames.includes('project_id')) {
      conditions.push(`${this.quoteIdent('project_id')} = $${params.length + 1}`);
      params.push(projectId);
    }

    const safeTable = this.quoteIdent(tableName);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = (await this.prisma.$queryRawUnsafe(
      `DELETE FROM ${safeTable} ${whereClause} RETURNING *`,
      ...params,
    )) as Record<string, any>[];

    if (result.length === 0) {
      throw new NotFoundException(`Record not found in "${tableName}"`);
    }

    return { message: 'Record deleted successfully', record: result[0] };
  }
}
