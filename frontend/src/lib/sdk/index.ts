import type { VrixoClientOptions } from './types'
import { AuthClient } from './auth'
import { DatabaseClient } from './database'
import { StorageClient } from './storage'
import { RealtimeClient } from './realtime'
import { FunctionsClient } from './functions'

export class VrixoClient {
  public url: string
  public anonKey: string
  public auth: AuthClient
  public database: DatabaseClient
  public storage: StorageClient
  public realtime: RealtimeClient
  public functions: FunctionsClient

  constructor(url: string, anonKey: string, options?: VrixoClientOptions) {
    this.url = url.replace(/\/$/, '')
    this.anonKey = anonKey

    const combinedHeaders: Record<string, string> = {
      ...options?.global?.headers,
      ...options?.headers,
    }

    const authClient = new AuthClient(this.url, anonKey, {
      headers: combinedHeaders,
      autoRefreshToken: options?.autoRefreshToken ?? true,
    })

    const getHeaders = () => authClient.getAuthHeaders()

    this.auth = authClient
    this.database = new DatabaseClient(this.url, getHeaders, options?.db?.schema)
    this.storage = new StorageClient(this.url, getHeaders)
    this.realtime = new RealtimeClient(this.url, anonKey)
    this.functions = new FunctionsClient(this.url, getHeaders)
  }
}

export { AuthClient } from './auth'
export { DatabaseClient, QueryBuilder } from './database'
export { StorageClient, StorageFileApi } from './storage'
export { RealtimeClient, RealtimeChannel } from './realtime'
export { FunctionsClient } from './functions'
export * from './types'
export * from './constants'

export function createClient(url: string, anonKey: string, options?: VrixoClientOptions): VrixoClient {
  return new VrixoClient(url, anonKey, options)
}
