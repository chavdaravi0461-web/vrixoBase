import type { FunctionDefinition, FunctionResponse, FunctionMetrics } from './types'
import { FunctionError } from './types'
import { API_ENDPOINTS } from './constants'

export class FunctionsClient {
  private url: string
  private headers: () => Record<string, string>

  constructor(url: string, headers: () => Record<string, string>) {
    this.url = `${url.replace(/\/$/, '')}${API_ENDPOINTS.functions}`
    this.headers = headers
  }

  async invoke<T = unknown>(functionId: string, payload?: Record<string, unknown>): Promise<FunctionResponse<T>> {
    try {
      const hdrs: Record<string, string> = {
        ...this.headers(),
        'Content-Type': 'application/json',
      }

      if (!payload) {
        hdrs['Content-Type'] = 'text/plain'
      }

      const res = await fetch(`${this.url}/invoke/${functionId}`, {
        method: 'POST',
        headers: hdrs,
        body: payload ? JSON.stringify(payload) : undefined,
      })

      const contentType = res.headers.get('content-type')
      const isJson = contentType?.includes('application/json')
      const data = isJson ? await res.json() : await res.text()

      if (!res.ok) {
        return {
          data: null,
          error: new FunctionError(
            (data as Record<string, unknown>)?.message as string || `Function invocation failed with status ${res.status}`,
            String(res.status),
            res.status
          ),
        }
      }

      return { data: data as T, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof FunctionError ? err : new FunctionError('Network error invoking function', 'NETWORK_ERROR', 0),
      }
    }
  }

  async list(): Promise<FunctionResponse<FunctionDefinition[]>> {
    try {
      const res = await fetch(`${this.url}/functions`, {
        headers: this.headers(),
      })

      const data = await res.json()

      if (!res.ok) {
        return {
          data: null,
          error: new FunctionError(
            data.message || 'Failed to list functions',
            String(res.status),
            res.status
          ),
        }
      }

      return { data: data as FunctionDefinition[], error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof FunctionError ? err : new FunctionError('Network error listing functions', 'NETWORK_ERROR', 0),
      }
    }
  }

  async getStatus(functionId: string): Promise<FunctionResponse<FunctionMetrics>> {
    try {
      const res = await fetch(`${this.url}/functions/${functionId}/status`, {
        headers: this.headers(),
      })

      const data = await res.json()

      if (!res.ok) {
        return {
          data: null,
          error: new FunctionError(
            data.message || 'Failed to get function status',
            String(res.status),
            res.status
          ),
        }
      }

      return { data: data as FunctionMetrics, error: null }
    } catch (err) {
      return {
        data: null,
        error: err instanceof FunctionError ? err : new FunctionError('Network error getting function status', 'NETWORK_ERROR', 0),
      }
    }
  }
}
