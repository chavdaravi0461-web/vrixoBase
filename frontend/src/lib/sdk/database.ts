import type {
  QueryResponse,
  FilterDefinition,
  QueryOperator,
  OrderDefinition,
  GenericResponse,
  PostgrestFilterBuilder as PostgrestFilterBuilderType,
} from './types'
import { PostgrestError } from './types'
import { API_ENDPOINTS, DEFAULT_HEADERS, DEFAULT_QUERY_TIMEOUT, DEFAULT_PAGE_LIMIT } from './constants'

export class DatabaseClient {
  private url: string
  private headers: () => Record<string, string>
  private schema: string

  constructor(url: string, headers: () => Record<string, string>, schema?: string) {
    this.url = `${url.replace(/\/$/, '')}${API_ENDPOINTS.rest}`
    this.headers = headers
    this.schema = schema || 'public'
  }

  from<T extends Record<string, unknown> = Record<string, unknown>>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this.url, table, this.headers, this.schema)
  }

  rpc<T = unknown>(fn: string, params?: Record<string, unknown>): Promise<GenericResponse<T>> {
    return this.rpcCall<T>(fn, params)
  }

  private async rpcCall<T>(fn: string, params?: Record<string, unknown>): Promise<GenericResponse<T>> {
    try {
      const res = await fetch(`${this.url}/rpc/${fn}`, {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: params ? JSON.stringify(params) : undefined,
      })

      const data = await res.json()

      if (!res.ok) {
        return {
          data: null,
          error: new PostgrestError(
            data.message || data.error_description || `RPC ${fn} failed`,
            data.details,
            data.hint,
            data.code
          ),
        }
      }

      return { data: data as T, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof PostgrestError ? err : new PostgrestError(`Network error calling RPC ${fn}`),
      }
    }
  }
}

type Thenable<T> = {
  then: <TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => PromiseLike<TResult1 | TResult2>
}

export class QueryBuilder<T extends Record<string, unknown> = Record<string, unknown>>
  implements PostgrestFilterBuilderType<T>, Thenable<QueryResponse<T[]>>
{
  private url: string
  private table: string
  private headers: () => Record<string, string>
  private schema: string
  private method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET'
  private body: unknown = undefined
  private filters: FilterDefinition[] = []
  private orders: OrderDefinition[] = []
  private limitCount: number | null = null
  private offsetCount: number | null = null
  private rangeFrom: number | null = null
  private rangeTo: number | null = null
  private selectedColumns: string = '*'
  private returnSingle: boolean = false
  private returnMaybeSingle: boolean = false
  private countMode: 'exact' | 'planned' | 'estimated' | null = null

  constructor(url: string, table: string, headers: () => Record<string, string>, schema: string) {
    this.url = url
    this.table = table
    this.headers = headers
    this.schema = schema
  }

  select(columns?: string): this {
    this.method = 'GET'
    this.selectedColumns = columns || '*'
    return this
  }

  insert(data: Partial<T> | Partial<T>[]): this {
    this.method = 'POST'
    this.body = Array.isArray(data) ? data : [data]
    return this
  }

  update(data: Partial<T>): this {
    this.method = 'PATCH'
    this.body = data
    return this
  }

  delete(): this {
    this.method = 'DELETE'
    return this
  }

  filter(column: string, operator: QueryOperator, value: unknown): this {
    this.filters.push({ column, operator, value })
    return this
  }

  eq(column: keyof T, value: unknown): this {
    return this.filter(column as string, 'eq', value)
  }

  neq(column: keyof T, value: unknown): this {
    return this.filter(column as string, 'neq', value)
  }

  gt(column: keyof T, value: unknown): this {
    return this.filter(column as string, 'gt', value)
  }

  gte(column: keyof T, value: unknown): this {
    return this.filter(column as string, 'gte', value)
  }

  lt(column: keyof T, value: unknown): this {
    return this.filter(column as string, 'lt', value)
  }

  lte(column: keyof T, value: unknown): this {
    return this.filter(column as string, 'lte', value)
  }

  like(column: keyof T, pattern: string): this {
    return this.filter(column as string, 'like', pattern)
  }

  ilike(column: keyof T, pattern: string): this {
    return this.filter(column as string, 'ilike', pattern)
  }

  isNull(column: keyof T): this {
    return this.filter(column as string, 'is', null)
  }

  isNotNull(column: keyof T): this {
    return this.filter(column as string, 'is', 'not.null')
  }

  in(column: keyof T, values: unknown[]): this {
    return this.filter(column as string, 'in', values)
  }

  order(column: keyof T, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orders.push({
      column: column as string,
      ascending: opts?.ascending ?? true,
      nullsFirst: opts?.nullsFirst,
    })
    return this
  }

  limit(count: number): this {
    this.limitCount = count
    return this
  }

  offset(start: number): this {
    this.offsetCount = start
    return this
  }

  range(from: number, to: number): this {
    this.rangeFrom = from
    this.rangeTo = to
    return this
  }

  single(): this {
    this.returnSingle = true
    return this
  }

  maybeSingle(): this {
    this.returnMaybeSingle = true
    return this
  }

  textSearch(
    column: keyof T,
    query: string,
    options?: { type?: 'plain' | 'phrase' | 'websearch'; config?: string }
  ): this {
    const config = options?.config ? `config=${options.config}` : ''
    const type = options?.type || 'plain'
    const formattedQuery = options?.type === 'plain' ? query.replace(/\s+/g, ' & ') : query
    this.filters.push({
      column: column as string,
      operator: 'like',
      value: formattedQuery,
    })
    return this
  }

  count(mode?: 'exact' | 'planned' | 'estimated'): this {
    this.countMode = mode || 'exact'
    return this
  }

  buildUrl(): string {
    const params = new URLSearchParams()
    params.set('select', this.selectedColumns)
    this.filters.forEach((f) => {
      if (f.operator === 'is' && f.value === null) {
        params.append(`${f.column}`, 'is.null')
      } else if (f.operator === 'is' && f.value === 'not.null') {
        params.append(`${f.column}`, 'is.not.null')
      } else if (f.operator === 'in') {
        const vals = (f.value as unknown[]).map((v) => String(v)).join(',')
        params.append(`${f.column}`, `in.(${vals})`)
      } else if (f.operator === 'like' || f.operator === 'ilike') {
        params.append(`${f.column}`, `${f.operator}.${encodeURIComponent(String(f.value))}`)
      } else {
        params.append(`${f.column}`, `${f.operator}.${encodeURIComponent(String(f.value))}`)
      }
    })
    this.orders.forEach((o) => {
      const dir = o.ascending !== false ? 'asc' : 'desc'
      const nulls = o.nullsFirst === true ? '.nullsfirst' : o.nullsFirst === false ? '.nullslast' : ''
      params.append('order', `${o.column}.${dir}${nulls}`)
    })
    if (this.limitCount !== null) {
      params.set('limit', String(this.limitCount))
    }
    if (this.offsetCount !== null) {
      params.set('offset', String(this.offsetCount))
    }
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      params.set('offset', String(this.rangeFrom))
      params.set('limit', String(this.rangeTo - this.rangeFrom + 1))
    }
    if (this.countMode) {
      params.set('count', this.countMode)
    }
    const qs = params.toString()
    return `${this.url}/${this.table}${qs ? `?${qs}` : ''}`
  }

  async then<TResult1 = QueryResponse<T[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute()
      return onfulfilled ? onfulfilled(result) : (result as unknown as TResult1)
    } catch (err) {
      if (onrejected) return onrejected(err)
      throw err
    }
  }

  private async execute(): Promise<QueryResponse<T[]>> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_QUERY_TIMEOUT)

    try {
      const requestUrl = this.buildUrl()
      const hdrs: Record<string, string> = {
        ...this.headers(),
        'Accept': 'application/json',
        'Content-Profile': this.schema,
      }

      if (this.method !== 'GET') {
        hdrs['Content-Type'] = 'application/json'
        hdrs['Prefer'] = this.method === 'POST' ? 'return=representation' : 'return=representation'
      }

      const res = await fetch(requestUrl, {
        method: this.method,
        headers: hdrs,
        body: this.body ? JSON.stringify(this.body) : undefined,
        signal: controller.signal,
      })

      const contentType = res.headers.get('content-type')
      const isJson = contentType?.includes('application/json')
      const data = isJson ? await res.json() : null
      const countHeader = res.headers.get('content-range') || res.headers.get('x-total-count')
      const count = countHeader ? parseInt(countHeader.split('/')[1] || countHeader, 10) || null : null

      if (!res.ok) {
        return {
          data: null,
          error: new PostgrestError(
            data?.message || data?.error_description || `Query failed with status ${res.status}`,
            data?.details,
            data?.hint,
            data?.code
          ),
          count: null,
          status: res.status,
          statusText: res.statusText,
        }
      }

      let result = data

      if (this.returnSingle) {
        if (Array.isArray(result) && result.length === 0) {
          return {
            data: null,
            error: new PostgrestError('Result contains 0 rows', 'Not found', '', 'PGRST116'),
            count: null,
            status: res.status,
            statusText: res.statusText,
          }
        }
        result = Array.isArray(result) ? result[0] : result
      } else if (this.returnMaybeSingle) {
        result = Array.isArray(result) ? (result[0] ?? null) : result
      }

      return {
        data: result as T[],
        error: null,
        count,
        status: res.status,
        statusText: res.statusText,
      }
    } catch (err) {
      if (err instanceof PostgrestError) {
        return { data: null, error: err, count: null, status: 0, statusText: '' }
      }
      return {
        data: null,
        error: new PostgrestError(
          err instanceof Error ? err.message : 'Unknown error during query execution'
        ),
        count: null,
        status: 0,
        statusText: '',
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}
