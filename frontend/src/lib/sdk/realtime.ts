import type { RealtimePresence, RealtimePresenceState } from './types'
import { DEFAULT_REALTIME_TIMEOUT } from './constants'

type RealtimeEventHandler = (payload: unknown) => void

interface RealtimeSubscription {
  event: string
  callback: RealtimeEventHandler
}

export class RealtimeChannel {
  private _id: string
  private _topic: string
  private subscriptions: RealtimeSubscription[] = []
  private _socket: WebSocket | null = null
  private presenceState: Map<string, RealtimePresence> = new Map()
  private presenceListeners: Array<(presence: RealtimePresenceState) => void> = []

  constructor(id: string, topic: string) {
    this._id = id
    this._topic = topic
  }

  on(event: string, callback: RealtimeEventHandler): this {
    this.subscriptions.push({ event, callback })
    return this
  }

  off(event: string): this {
    this.subscriptions = this.subscriptions.filter((s) => s.event !== event)
    return this
  }

  subscribe(callback?: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void): void {
    if (callback) {
      callback('SUBSCRIBED')
    }
  }

  unsubscribe(): void {
    this.subscriptions = []
    this.presenceListeners = []
    if (this._socket) {
      this._socket.close()
      this._socket = null
    }
  }

  track(presence: Record<string, unknown>): void {
    const key = `${this._id}:${this._topic}`
    const entry: RealtimePresence = {
      key,
      user: (presence.user as string) || 'anonymous',
      online_at: new Date().toISOString(),
      state: presence,
    }
    this.presenceState.set(key, entry)
    this.notifyPresence()
  }

  untrack(): void {
    this.presenceState.clear()
    this.notifyPresence()
  }

  onPresence(callback: (presence: RealtimePresenceState) => void): () => void {
    this.presenceListeners.push(callback)
    return () => {
      this.presenceListeners = this.presenceListeners.filter((l) => l !== callback)
    }
  }

  dispatchEvent(event: string, payload: unknown): void {
    this.subscriptions
      .filter((s) => s.event === event || s.event === '*')
      .forEach((s) => {
        try {
          s.callback(payload)
        } catch {
          // Swallow callback errors
        }
      })
  }

  getSubscriptions(): RealtimeSubscription[] {
    return [...this.subscriptions]
  }

  private notifyPresence(): void {
    const state: RealtimePresenceState = {
      presences: Array.from(this.presenceState.values()),
    }
    this.presenceListeners.forEach((listener) => {
      try {
        listener(state)
      } catch {
        // Swallow listener errors
      }
    })
  }
}

export class RealtimeClient {
  private url: string
  private anonKey: string
  private socket: WebSocket | null = null
  private channels: Map<string, RealtimeChannel> = new Map()
  private isConnected: boolean = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private maxReconnects: number = 5
  private reconnectAttempts: number = 0
  private globalPresenceListeners: Array<(presence: RealtimePresenceState) => void> = []

  constructor(url: string, anonKey: string) {
    const baseUrl = url.replace(/\/$/, '')
    this.url = baseUrl.includes('/realtime') ? baseUrl : `${baseUrl}/realtime/v1`
    this.anonKey = anonKey
  }

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return
    }

    try {
      const wsUrl = this.url.replace(/^http/, 'ws')
      this.socket = new WebSocket(`${wsUrl}?apikey=${this.anonKey}`)

      this.socket.onopen = () => {
        this.isConnected = true
        this.reconnectAttempts = 0
      }

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch {
          // Ignore malformed messages
        }
      }

      this.socket.onclose = () => {
        this.isConnected = false
        this.handleDisconnect()
      }

      this.socket.onerror = () => {
        this.isConnected = false
      }
    } catch {
      this.isConnected = false
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.channels.forEach((channel) => channel.unsubscribe())
    this.channels.clear()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.isConnected = false
  }

  channel(name: string): RealtimeChannel {
    const existing = this.channels.get(name)
    if (existing) return existing
    const channel = new RealtimeChannel(name, name)
    this.channels.set(name, channel)
    return channel
  }

  onPresence(callback: (presence: RealtimePresenceState) => void): () => void {
    this.globalPresenceListeners.push(callback)
    return () => {
      this.globalPresenceListeners = this.globalPresenceListeners.filter((l) => l !== callback)
    }
  }

  getChannels(): RealtimeChannel[] {
    return Array.from(this.channels.values())
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnects) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++
        this.connect()
      }, delay)
    }
  }

  private handleMessage(message: { type?: string; channel?: string; event?: string; payload?: unknown }): void {
    if (!message) return

    if (message.channel) {
      const channel = this.channels.get(message.channel)
      if (channel) {
        channel.dispatchEvent(message.event || message.type || 'message', message.payload)
      }
    }

    if (message.type === 'presence') {
      const presenceState: RealtimePresenceState = {
        presences: message.payload as RealtimePresence[],
      }
      this.globalPresenceListeners.forEach((listener) => {
        try {
          listener(presenceState)
        } catch {
          // Swallow
        }
      })
    }
  }
}
