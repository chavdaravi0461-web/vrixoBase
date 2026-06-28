import { Injectable, Logger } from '@nestjs/common';
import { TenancyService } from '../tenancy/tenancy.service';

@Injectable()
export class OpenApiGeneratorService {
  private readonly logger = new Logger(OpenApiGeneratorService.name);

  constructor(private readonly tenancy: TenancyService) {}

  async generateSpec(projectId: string, host?: string) {
    const tables = await this.tenancy.getSchemaInfo(projectId);

    const schemas: Record<string, any> = {};
    const paths: Record<string, any> = {};
    const tags: Array<{ name: string; description: string }> = [];

    for (const table of tables) {
      const tableName = table.tableName;
      if (tableName.startsWith('_')) continue;

      tags.push({
        name: tableName,
        description: `Auto-generated API for ${tableName}`,
      });

      const schemaName = this.toTitleCase(tableName);
      const properties: Record<string, any> = {};
      const required: string[] = [];
      let primaryKey = 'id';

      for (const col of table.columns) {
        const openApiType = this.mapTypeToOpenApi(col.dataType);
        const prop: Record<string, any> = {
          type: openApiType.type,
          nullable: col.isNullable,
        };
        if (openApiType.format) prop.format = openApiType.format;
        if (col.defaultValue) prop.default = col.defaultValue;
        if (col.isPrimary) {
          prop.description = 'Primary key';
          primaryKey = col.columnName;
        }
        if (col.isUnique && !col.isPrimary) {
          prop.description = (prop.description || '') + ' (unique)';
        }
        properties[col.columnName] = prop;

        if (!col.isNullable && !col.isPrimary && !col.defaultValue) {
          required.push(col.columnName);
        }
      }

      const fkRefs: Record<string, string> = {};
      for (const fk of table.foreignKeys) {
        const refTable = this.stripSchemaPrefix(fk.referencedTable);
        fkRefs[fk.columnName.replace(/_id$/, '')] = refTable;
      }

      const basePath = `/api/proxy/${projectId}/${tableName}`;

      schemas[schemaName] = {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };

      schemas[`${schemaName}ListResponse`] = {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: `#/components/schemas/${schemaName}` },
          },
          total: { type: 'integer', nullable: true },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
        },
      };

      paths[basePath] = {
        get: {
          tags: [tableName],
          summary: `List ${tableName} records`,
          operationId: `list${schemaName}`,
          parameters: [
            { name: 'select', in: 'query', required: false, schema: { type: 'string' }, description: 'Columns to select (comma-separated, supports nested: posts(*))' },
            { name: 'order', in: 'query', required: false, schema: { type: 'string' }, description: 'Sort order: column.asc or column.desc' },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 10 } },
            { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } },
            { name: 'search', in: 'query', required: false, schema: { type: 'string' }, description: 'Full-text search across text columns' },
          ],
          responses: {
            '200': {
              description: 'List of records',
              content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}ListResponse` } } },
            },
          },
        },
        post: {
          tags: [tableName],
          summary: `Create ${tableName} record(s)`,
          operationId: `create${schemaName}`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: `#/components/schemas/${schemaName}` },
                    { type: 'array', items: { $ref: `#/components/schemas/${schemaName}` } },
                  ],
                },
              },
            },
          },
          responses: {
            '201': { description: 'Created record(s)', content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } } },
          },
        },
        patch: {
          tags: [tableName],
          summary: `Update ${tableName} records matching filters`,
          operationId: `update${schemaName}`,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } },
          },
          responses: {
            '200': { description: 'Updated records', content: { 'application/json': { schema: { type: 'object', properties: { records: { type: 'array', items: { $ref: `#/components/schemas/${schemaName}` } }, affected: { type: 'integer' } } } } } },
          },
        },
        delete: {
          tags: [tableName],
          summary: `Delete ${tableName} records matching filters`,
          operationId: `delete${schemaName}`,
          responses: {
            '200': { description: 'Deleted records', content: { 'application/json': { schema: { type: 'object', properties: { records: { type: 'array', items: { $ref: `#/components/schemas/${schemaName}` } }, affected: { type: 'integer' } } } } } },
          },
        },
      };

      const idPath = `${basePath}/{${primaryKey}}`;
      paths[idPath] = {
        get: {
          tags: [tableName],
          summary: `Get a single ${tableName} record by ${primaryKey}`,
          operationId: `get${schemaName}`,
          parameters: [
            { name: primaryKey, in: 'path', required: true, schema: { type: 'string' } },
            { name: 'select', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Single record', content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } } },
            '404': { description: 'Record not found' },
          },
        },
        patch: {
          tags: [tableName],
          summary: `Update a ${tableName} record by ${primaryKey}`,
          operationId: `patch${schemaName}`,
          parameters: [
            { name: primaryKey, in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } },
          },
          responses: {
            '200': { description: 'Updated record', content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } } },
            '404': { description: 'Record not found' },
          },
        },
        delete: {
          tags: [tableName],
          summary: `Delete a ${tableName} record by ${primaryKey}`,
          operationId: `delete${schemaName}ById`,
          parameters: [
            { name: primaryKey, in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Deleted record', content: { 'application/json': { schema: { type: 'object', properties: { records: { type: 'array', items: { $ref: `#/components/schemas/${schemaName}` } }, affected: { type: 'integer' } } } } } },
            '404': { description: 'Record not found' },
          },
        },
      };
    }

    const spec: Record<string, any> = {
      openapi: '3.0.3',
      info: {
        title: `VrixoBase - Project ${projectId} Auto-Generated API`,
        version: '1.0.0',
        description: `Auto-generated REST API for project ${projectId}. Supports PostgREST-compatible query syntax, resource embedding, bulk operations, and upsert.`,
      },
      servers: host
        ? [{ url: `${host}/api/proxy/${projectId}`, description: 'Auto-API server' }]
        : [{ url: `/api/proxy/${projectId}`, description: 'Auto-API server' }],
      paths,
      components: {
        schemas,
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
            description: 'API key for programmatic access (vb_ prefix)',
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [
        { ApiKeyAuth: [] },
        { BearerAuth: [] },
      ],
      tags,
    };

    return spec;
  }

  private mapTypeToOpenApi(pgType: string): { type: string; format?: string } {
    const map: Record<string, { type: string; format?: string }> = {
      'integer': { type: 'integer', format: 'int32' },
      'int': { type: 'integer', format: 'int32' },
      'smallint': { type: 'integer', format: 'int32' },
      'bigint': { type: 'integer', format: 'int64' },
      'serial': { type: 'integer', format: 'int32' },
      'bigserial': { type: 'integer', format: 'int64' },
      'numeric': { type: 'number' },
      'decimal': { type: 'number' },
      'real': { type: 'number', format: 'float' },
      'float': { type: 'number', format: 'float' },
      'double precision': { type: 'number', format: 'double' },
      'boolean': { type: 'boolean' },
      'text': { type: 'string' },
      'character varying': { type: 'string' },
      'varchar': { type: 'string' },
      'character': { type: 'string' },
      'char': { type: 'string' },
      'uuid': { type: 'string', format: 'uuid' },
      'date': { type: 'string', format: 'date' },
      'timestamp': { type: 'string', format: 'date-time' },
      'timestamptz': { type: 'string', format: 'date-time' },
      'timestamp with time zone': { type: 'string', format: 'date-time' },
      'timestamp without time zone': { type: 'string', format: 'date-time' },
      'time': { type: 'string', format: 'time' },
      'json': { type: 'object' },
      'jsonb': { type: 'object' },
      'bytea': { type: 'string', format: 'byte' },
      'citext': { type: 'string' },
      'inet': { type: 'string', format: 'ipv4' },
      'cidr': { type: 'string', format: 'ipv4' },
      'macaddr': { type: 'string', format: 'mac' },
    };
    return map[pgType] || { type: 'string' };
  }

  private toTitleCase(str: string): string {
    return str
      .split(/[_\s-]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  }

  private stripSchemaPrefix(tableName: string): string {
    return tableName.replace(/^proj_[a-zA-Z0-9_]+_/, '');
  }
}
