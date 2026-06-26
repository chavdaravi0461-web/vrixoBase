'use client';

import { useState } from 'react';
import {
  Users, UserPlus, Shield, ShieldCheck, ShieldAlert,
  Mail, Trash2, MoreHorizontal, Check, X, Clock, Crown,
  Search, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PageLoading } from '@/components/common/loading-spinner';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { cn, formatDate, getInitials } from '@/lib/utils';
import { useTeamMembers, useInviteMember, useUpdateMemberRole, useRemoveMember } from '@/hooks/use-team';
import { useProjectStore } from '@/stores/project-store';
import { useAuthStore } from '@/stores/auth-store';
import type { TeamMember } from '@/lib/api/team';

const ROLES = ['ADMIN', 'EDITOR', 'VIEWER'] as const;

const roleConfig = {
  ADMIN: { icon: Crown, class: 'text-amber-400 bg-amber-500/10', label: 'Admin' },
  EDITOR: { icon: ShieldCheck, class: 'text-brand-400 bg-brand-500/10', label: 'Editor' },
  VIEWER: { icon: ShieldAlert, class: 'text-muted-foreground bg-muted/50', label: 'Viewer' },
};

const statusConfig: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-500/10',
  invited: 'text-brand-400 bg-brand-500/10',
  declined: 'text-rose-400 bg-rose-500/10',
};

export default function TeamPage() {
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: members, isLoading, error, refetch } = useTeamMembers(projectId ?? '');
  const inviteMember = useInviteMember(projectId ?? '');
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [showInvite, setShowInvite] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleInvite = () => {
    if (!inviteEmail.includes('@')) { toast.error('Enter a valid email'); return; }
    inviteMember.mutate({ email: inviteEmail, role: inviteRole }, {
      onSuccess: () => {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setShowInvite(false);
        setInviteEmail('');
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleChangeRole = (memberId: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER') => {
    updateRole.mutate({ memberId, role }, {
      onSuccess: () => { toast.success('Role updated'); setOpenMenu(null); },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleRemove = () => {
    if (!removeId) return;
    removeMember.mutate(removeId, {
      onSuccess: () => { toast.success('Member removed'); setRemoveId(null); },
      onError: (err) => toast.error(err.message),
    });
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-1">Select a project</h3>
        <p className="text-sm text-muted-foreground">Choose a project from the dropdown above to manage team members.</p>
      </div>
    );
  }

  if (isLoading) return <PageLoading />;
  if (error) return <div className="text-destructive text-sm p-4">Failed to load team members.</div>;

  const teamMembers = members || [];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage team members and their roles</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Invite Member
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold">Team Members</h2>
            <span className="text-xs text-muted-foreground">({teamMembers.length} members)</span>
          </div>
        </div>
        <div className="divide-y divide-border">
          {teamMembers.map((member, idx) => {
            const RoleIcon = roleConfig[member.role as keyof typeof roleConfig]?.icon || Shield;
            const isMe = member.userId === currentUserId;
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/10 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-accent-blue flex items-center justify-center text-sm font-semibold text-white shrink-0">
                  {getInitials(member.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    {isMe && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-brand-500/20 text-brand-400 border border-brand-500/30">YOU</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <span className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                    roleConfig[member.role as keyof typeof roleConfig]?.class || ''
                  )}>
                    <RoleIcon className="h-3 w-3" />
                    {roleConfig[member.role as keyof typeof roleConfig]?.label || member.role}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium',
                    statusConfig[member.status] || ''
                  )}>
                    {member.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    Joined {formatDate(member.joinedAt)}
                  </span>
                </div>
                {!isMe && (
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === member.id ? null : member.id)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <AnimatePresence>
                      {openMenu === member.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden"
                        >
                          <div className="p-1">
                            <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase">Change Role</p>
                            {ROLES.map((role) => (
                              <button
                                key={role}
                                onClick={() => handleChangeRole(member.id, role)}
                                className={cn(
                                  'flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md transition-colors',
                                  member.role === role ? 'text-brand-400 bg-brand-500/10' : 'text-foreground hover:bg-muted'
                                )}
                              >
                                {member.role === role && <Check className="h-3 w-3" />}
                                {roleConfig[role].label}
                              </button>
                            ))}
                            <div className="border-t border-border my-1" />
                            <button
                              onClick={() => { setOpenMenu(null); setRemoveId(member.id); }}
                              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" /> Remove Member
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Invite Member</h3>
                <button onClick={() => setShowInvite(false)} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email Address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map((role) => {
                      const RoleIcon = roleConfig[role].icon;
                      return (
                        <button
                          key={role}
                          onClick={() => setInviteRole(role)}
                          className={cn(
                            'flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs transition-colors',
                            inviteRole === role
                              ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                              : 'border-border hover:border-muted-foreground/30'
                          )}
                        >
                          <RoleIcon className="h-4 w-4" />
                          {roleConfig[role].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-amber-400" /> <strong>Admin</strong> — Full access to all settings</p>
                  <p className="flex items-center gap-1.5 mt-1"><ShieldCheck className="h-3.5 w-3.5 text-brand-400" /> <strong>Editor</strong> — Can manage data and content</p>
                  <p className="flex items-center gap-1.5 mt-1"><ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" /> <strong>Viewer</strong> — Read-only access</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowInvite(false)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleInvite} disabled={inviteMember.isPending} className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  {inviteMember.isPending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={() => setRemoveId(null)}
        onConfirm={handleRemove}
        title="Remove Member"
        description="This will remove the team member from the project. They will lose access to all resources."
        confirmText="Remove"
        variant="destructive"
      />
    </div>
  );
}
