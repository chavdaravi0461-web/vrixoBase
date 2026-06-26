import { apiRequest } from './client';

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  joinedAt: string;
}

export interface InviteInput {
  email: string;
  role: string;
}

export async function getTeamMembers(projectId: string): Promise<TeamMember[]> {
  return apiRequest<TeamMember[]>(`/api/team/${projectId}/members`);
}

export async function inviteMember(projectId: string, input: InviteInput): Promise<TeamMember> {
  return apiRequest<TeamMember>(`/api/team/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateMemberRole(memberId: string, role: string): Promise<void> {
  await apiRequest(`/api/team/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function removeMember(memberId: string): Promise<void> {
  await apiRequest(`/api/team/members/${memberId}`, { method: 'DELETE' });
}
