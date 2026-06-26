import { apiRequest } from './client';

export interface Subscription {
  id: string;
  projectId: string;
  tableId: string | null;
  eventType: string;
  endpoint: string;
  createdById: string;
  createdAt: string;
  table?: { name: string } | null;
}

export interface CreateSubscriptionInput {
  tableId?: string;
  eventType: string;
  endpoint?: string;
}

export interface ActiveConnection {
  id: string;
  socketId: string;
  userId: string | null;
  projectId: string;
  connectedAt: string;
  channels: string[];
  user?: { id: string; email: string; name: string } | null;
}

export interface PresenceEvent {
  userId: string;
  status: string;
  lastSeen: string;
  user?: { id: string; email: string; name: string; avatarUrl: string | null };
}

export async function getSubscriptions(projectId: string): Promise<Subscription[]> {
  return apiRequest<Subscription[]>(`/api/realtime/${projectId}/subscriptions`);
}

export async function createSubscription(projectId: string, input: CreateSubscriptionInput): Promise<Subscription> {
  return apiRequest<Subscription>(`/api/realtime/${projectId}/subscriptions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteSubscription(id: string): Promise<void> {
  await apiRequest(`/api/realtime/subscriptions/${id}`, { method: 'DELETE' });
}

export async function getConnections(projectId: string): Promise<ActiveConnection[]> {
  return apiRequest<ActiveConnection[]>(`/api/realtime/${projectId}/connections`);
}

export async function getPresence(projectId: string): Promise<PresenceEvent[]> {
  return apiRequest<PresenceEvent[]>(`/api/realtime/${projectId}/presence`);
}
