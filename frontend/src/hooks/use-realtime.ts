'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000';

interface RealtimeOptions {
  channel: string;
  event: string;
  onMessage: (data: unknown) => void;
  enabled?: boolean;
}

export function useRealtime({ channel, event, onMessage, enabled = true }: RealtimeOptions) {
  const socketRef = useRef<Socket | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !accessToken) return;

    const socket = io(WS_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe', { channel });
    });

    socket.on(event, (data: unknown) => {
      callbackRef.current(data);
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err.message);
    });

    return () => {
      socket.emit('unsubscribe', { channel });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [channel, event, enabled, accessToken]);

  const emit = useCallback(
    (eventName: string, data?: unknown) => {
      socketRef.current?.emit(eventName, data);
    },
    []
  );

  return { emit, socket: socketRef };
}

export function useRealtimeChannel(channelName: string) {
  const socketRef = useRef<Socket | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(WS_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe', { channel: channelName });
    });

    return () => {
      socket.emit('unsubscribe', { channel: channelName });
      socket.disconnect();
    };
  }, [channelName, accessToken]);

  const broadcast = useCallback(
    (event: string, data: unknown) => {
      socketRef.current?.emit('broadcast', { channel: channelName, event, data });
    },
    [channelName]
  );

  const on = useCallback(
    (event: string, handler: (data: unknown) => void) => {
      socketRef.current?.on(event, handler);
      return () => {
        socketRef.current?.off(event, handler);
      };
    },
    []
  );

  return { broadcast, on, socket: socketRef };
}
