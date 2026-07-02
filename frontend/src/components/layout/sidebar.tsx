'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Database,
  Cable,
  HardDrive,
  Zap,
  FunctionSquare,
  Activity,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Hexagon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/auth-store';
import { getInitials } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Database', href: '/database', icon: Database },
  { label: 'API', href: '/api', icon: Cable },
  { label: 'Storage', href: '/storage', icon: HardDrive },
  { label: 'Realtime', href: '/realtime', icon: Zap },
  { label: 'Functions', href: '/functions', icon: FunctionSquare },
  { label: 'Monitoring', href: '/monitoring', icon: Activity },
  { label: 'Team', href: '/team', icon: Users },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isMobile?: boolean;
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobile, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const user = useAuthStore((s) => s.user);

  if (isMobile) {
    return (
      <div className="flex h-full flex-col bg-sidebar">
        <SidebarContent
          pathname={pathname}
          collapsed={false}
          user={user}
          onNavClick={onClose}
        />
      </div>
    );
  }

  return (
    <motion.aside
      layout
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className={cn(
        'hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 overflow-hidden',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      <SidebarContent
        pathname={pathname}
        collapsed={collapsed}
        user={user}
        onToggle={() => setCollapsed(!collapsed)}
      />
    </motion.aside>
  );
}

interface SidebarContentProps {
  pathname: string;
  collapsed: boolean;
  user: { name?: string; email?: string; avatar_url?: string | null } | null;
  onToggle?: () => void;
  onNavClick?: () => void;
}

function SidebarContent({
  pathname,
  collapsed,
  user,
  onToggle,
  onNavClick,
}: SidebarContentProps) {
  return (
    <>
      <div className="flex items-center h-14 px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
            <Hexagon className="w-4 h-4 text-primary" />
          </div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm font-semibold tracking-tight whitespace-nowrap overflow-hidden"
              >
                VrixoBase
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6 shrink-0 text-muted-foreground"
            onClick={onToggle}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      onClick={onNavClick}
                      className={cn(
                        'flex items-center justify-center h-9 w-9 rounded-lg mx-auto transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-muted'
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="ml-2">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group relative',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-muted'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-primary/10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="h-4.5 w-4.5 shrink-0 relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3 shrink-0">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex justify-center">
                <Avatar className="h-8 w-8 cursor-pointer">
                  <AvatarImage src={(user as { avatar_url?: string })?.avatar_url || ''} />
                  <AvatarFallback className="text-xs bg-sidebar-muted">
                    {user ? getInitials(user.name || '') : 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              {user?.name || 'User'}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={(user as { avatar_url?: string })?.avatar_url || ''} />
              <AvatarFallback className="text-xs bg-sidebar-muted">
                {user ? getInitials(user.name || '') : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
