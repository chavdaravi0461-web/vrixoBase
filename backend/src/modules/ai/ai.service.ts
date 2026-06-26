import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface SqlResult {
  sql: string;
  explanation: string;
  tokensUsed?: number;
  model?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openaiApiKey: string | undefined;
  private readonly useOpenAi: boolean;

  constructor(private readonly databaseService: DatabaseService) {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.useOpenAi = !!this.openaiApiKey;
  }

  async nlToSql(projectId: string, prompt: string): Promise<SqlResult> {
    if (!prompt?.trim()) {
      throw new BadRequestException('Prompt is required');
    }

    const schema = await this.getSchemaContext(projectId);

    if (this.useOpenAi) {
      return this.generateWithOpenAI(schema, prompt);
    }

    return this.generateFallback(schema, prompt);
  }

  private async getSchemaContext(projectId: string): Promise<string> {
    try {
      const tables = await this.databaseService.listTables(projectId);
      const parts: string[] = [];

      for (const table of tables) {
        try {
          const detail = await this.databaseService.getTable(projectId, table.name);
          const cols = (detail.columns || [])
            .map((c) => {
              const fk = (c as any).foreign_key;
              return `  - ${c.name} (${c.type})${c.isPrimary ? ' PRIMARY KEY' : ''}${c.isNullable ? '' : ' NOT NULL'}${c.defaultValue ? ` DEFAULT ${c.defaultValue}` : ''}${fk ? ` -> ${fk.table}(${fk.column})` : ''}`;
            })
            .join('\n');
          parts.push(`Table: ${table.name}${table.description ? ` — ${table.description}` : ''}\nColumns:\n${cols}`);
        } catch {
          parts.push(`Table: ${table.name}`);
        }
      }

      return parts.join('\n\n');
    } catch {
      return '(No tables found in this project)';
    }
  }

  private async generateWithOpenAI(schema: string, prompt: string): Promise<SqlResult> {
    try {
      let OpenAI: any;
      try {
        OpenAI = Function('return require("openai")')();
      } catch {
        throw new Error('OpenAI package not installed. Install with: npm install openai');
      }
      const openai = new OpenAI({ apiKey: this.openaiApiKey });

      const systemPrompt = `You are a SQL expert. Given the following database schema, convert natural language questions into PostgreSQL queries.

Database schema:
${schema}

Rules:
- Generate ONLY PostgreSQL-compatible SQL
- Use proper table and column names from the schema
- Always use table_name.column_name notation when joining
- Never use SELECT * - list explicit columns
- Add meaningful column aliases
- For EXPLAIN/ANALYZE queries, prefix with EXPLAIN
- Wrap string literals in single quotes
- Use proper JOIN syntax for related tables
- Add LIMIT clauses for broad queries (max 100)
- Return ONLY valid, executable SQL

Respond in JSON format:
{
  "sql": "the generated SQL query",
  "explanation": "brief explanation of what the query does"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content) as { sql?: string; explanation?: string };

      if (!parsed.sql) {
        throw new Error('No SQL generated');
      }

      return {
        sql: parsed.sql,
        explanation: parsed.explanation || 'Generated from natural language',
        tokensUsed: completion.usage?.total_tokens,
        model: completion.model,
      };
    } catch (error: any) {
      this.logger.error(`OpenAI generation failed: ${error.message}`);
      return this.generateFallback(schema, prompt);
    }
  }

  private generateFallback(schema: string, prompt: string): SqlResult {
    const lower = prompt.toLowerCase().trim();

    if (this.looksLikeInsert(lower)) {
      return this.handleInsert(lower, prompt);
    }

    if (this.looksLikeUpdate(lower)) {
      return this.handleUpdate(lower, prompt);
    }

    if (this.looksLikeDelete(lower)) {
      return this.handleDelete(lower);
    }

    if (this.looksLikeCreate(lower)) {
      return this.handleCreate(lower, prompt);
    }

    if (this.looksLikeAggregate(lower)) {
      return this.handleAggregate(lower, schema);
    }

    return this.handleSelect(lower, prompt, schema);
  }

  private looksLikeInsert(lower: string): boolean {
    return /^(insert|add|create|new)\b/.test(lower) && /(into|to|record|row|entry|item|user|product|order)/.test(lower);
  }

  private looksLikeUpdate(lower: string): boolean {
    return /^(update|change|modify|set|edit)\b/.test(lower);
  }

  private looksLikeDelete(lower: string): boolean {
    return /^(delete|remove|destroy|erase|drop)\b/.test(lower) && !/table\b/.test(lower);
  }

  private looksLikeCreate(lower: string): boolean {
    return /^(create|make|build|define)\b/.test(lower) && /table/.test(lower);
  }

  private looksLikeAggregate(lower: string): boolean {
    return /\b(count|total|average|avg|sum|maximum|max|minimum|min|stats|statistics|summary|report)\b/.test(lower);
  }

  private inferTable(lower: string, schema: string): string | null {
    const tableMatch = schema.match(/Table: (\w+)/g);
    if (!tableMatch) return null;

    const tables = tableMatch.map((t) => t.replace('Table: ', ''));
    for (const table of tables) {
      if (lower.includes(table.toLowerCase())) return table;
    }
    return tables[0] || null;
  }

  private handleSelect(lower: string, original: string, schema: string): SqlResult {
    const table = this.inferTable(lower, schema) || 'your_table';

    let conditions = '';
    if (/\b(id|name|email|status|type)\s*(=|is|equals?)\s*['"]?(\w+)['"]?/.test(original)) {
      conditions = ` WHERE id = 1`;
    } else if (/\b(recent|latest|last|newest)\b/.test(lower)) {
      conditions = ` ORDER BY created_at DESC LIMIT 20`;
    } else if (/\b(old|older|earliest)\b/.test(lower)) {
      conditions = ` ORDER BY created_at ASC LIMIT 20`;
    } else if (/\bactive\b/.test(lower)) {
      conditions = ` WHERE status = 'active'`;
    } else if (/\b(inactive|disabled|archived)\b/.test(lower)) {
      conditions = ` WHERE status = 'inactive'`;
    } else if (/\bbetween\b.*(\d{4})/.test(lower)) {
      const yearMatch = lower.match(/(\d{4})/);
      conditions = ` WHERE created_at BETWEEN '${yearMatch![1]}-01-01' AND '${yearMatch![1]}-12-31'`;
    } else {
      conditions = ` LIMIT 50`;
    }

    return {
      sql: `SELECT * FROM ${table}${conditions};`,
      explanation: `Retrieves records from the "${table}" table${conditions ? conditions.toLowerCase().replace(/`/g, '') : ''}.`,
    };
  }

  private handleInsert(lower: string, original: string): SqlResult {
    const tableMatch = original.match(/(?:into|to)\s+(\w+)/i);
    const table = tableMatch?.[1] || 'your_table';

    return {
      sql: `INSERT INTO ${table} (column1, column2, column3)\nVALUES ('value1', 'value2', 'value3')\nRETURNING *;`,
      explanation: `Inserts a new record into the "${table}" table. Replace column names and values with your actual data.`,
    };
  }

  private handleUpdate(lower: string, original: string): SqlResult {
    const tableMatch = original.match(/(?:table|in|set)\s+(\w+)/i);
    const table = tableMatch?.[1] || 'your_table';

    return {
      sql: `UPDATE ${table}\nSET column1 = 'new_value'\nWHERE id = 1\nRETURNING *;`,
      explanation: `Updates records in the "${table}" table matching the condition.`,
    };
  }

  private handleDelete(lower: string): SqlResult {
    const table = 'your_table';

    return {
      sql: `DELETE FROM ${table}\nWHERE id = 1\nRETURNING *;`,
      explanation: `Deletes records from the "${table}" table matching the condition. Returns the deleted rows.`,
    };
  }

  private handleCreate(lower: string, original: string): SqlResult {
    const tableMatch = original.match(/(?:table|called|named)\s+(\w+)/i);
    const table = tableMatch?.[1] || 'new_table';

    const fields = [
      'id SERIAL PRIMARY KEY',
      'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    ];

    if (/\b(user|person|customer|client|member)\b/.test(lower)) {
      fields.splice(1, 0, 'email VARCHAR(255) NOT NULL UNIQUE');
      fields.splice(2, 0, 'name VARCHAR(255) NOT NULL');
    }

    if (/\b(product|item|goods?|merchandise)\b/.test(lower)) {
      fields.splice(1, 0, 'name VARCHAR(255) NOT NULL');
      fields.splice(2, 0, 'description TEXT');
      fields.splice(3, 0, 'price DECIMAL(10, 2) NOT NULL');
      fields.splice(4, 0, 'category VARCHAR(100)');
    }

    if (/\b(order|purchase|transaction|invoice)\b/.test(lower)) {
      fields.splice(1, 0, 'user_id INTEGER NOT NULL REFERENCES users(id)');
      fields.splice(2, 0, 'status VARCHAR(50) NOT NULL DEFAULT \'pending\'');
      fields.splice(3, 0, 'total DECIMAL(10, 2) NOT NULL');
    }

    if (/\b(post|article|blog|content|page)\b/.test(lower)) {
      fields.splice(1, 0, 'title VARCHAR(255) NOT NULL');
      fields.splice(2, 0, 'slug VARCHAR(255) NOT NULL UNIQUE');
      fields.splice(3, 0, 'content TEXT NOT NULL');
      fields.splice(4, 0, 'published BOOLEAN NOT NULL DEFAULT false');
      fields.splice(5, 0, 'author_id INTEGER REFERENCES users(id)');
    }

    if (/\b(tag|label|category)\b/.test(lower)) {
      fields.splice(1, 0, 'name VARCHAR(100) NOT NULL UNIQUE');
      fields.splice(2, 0, 'slug VARCHAR(100) NOT NULL UNIQUE');
    }

    return {
      sql: `CREATE TABLE ${table} (\n  ${fields.join(',\n  ')}\n);\n\nCREATE INDEX idx_${table}_created_at ON ${table}(created_at);`,
      explanation: `Creates a "${table}" table with appropriate columns${table === 'new_table' ? ' — customize columns as needed' : ''}.`,
    };
  }

  private handleAggregate(lower: string, schema: string): SqlResult {
    const table = this.inferTable(lower, schema) || 'your_table';

    if (/\bcount\b/.test(lower) && /\bgroup\b/.test(lower)) {
      return {
        sql: `SELECT category, COUNT(*) as count\nFROM ${table}\nGROUP BY category\nORDER BY count DESC;`,
        explanation: `Counts records in "${table}" grouped by category.`,
      };
    }

    if (/\bcount\b/.test(lower)) {
      return {
        sql: `SELECT COUNT(*) as total_count\nFROM ${table};`,
        explanation: `Counts total records in the "${table}" table.`,
      };
    }

    if (/\b(average|avg)\b/.test(lower)) {
      const column = 'price';
      return {
        sql: `SELECT AVG(${column}) as average\nFROM ${table};`,
        explanation: `Calculates the average "${column}" from the "${table}" table.`,
      };
    }

    if (/\b(sum|total)\b/.test(lower)) {
      return {
        sql: `SELECT SUM(amount) as total\nFROM ${table}\nWHERE status = 'completed';`,
        explanation: `Calculates the sum of "amount" for completed records in "${table}".`,
      };
    }

    if (/\b(report|summary|stats)\b/.test(lower)) {
      return {
        sql: `SELECT\n  DATE_TRUNC('month', created_at) as month,\n  COUNT(*) as total_records,\n  COUNT(DISTINCT status) as unique_statuses\nFROM ${table}\nGROUP BY DATE_TRUNC('month', created_at)\nORDER BY month DESC\nLIMIT 12;`,
        explanation: `Generates a monthly summary report from "${table}".`,
      };
    }

    return {
      sql: `SELECT COUNT(*) as count, MIN(created_at) as earliest, MAX(created_at) as latest\nFROM ${table};`,
      explanation: `Provides aggregate statistics for the "${table}" table.`,
    };
  }
}
