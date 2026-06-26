'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useAuthStore } from '@/stores/auth-store';
import { getInitials } from '@/lib/utils';
import { ProjectSelector } from './project-selector';

const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/database': 'Database',
  '/api': 'API',
  '/storage': 'Storage',
  '/realtime': 'Realtime',
  '/functions': 'Functions',
  '/monitoring': 'Monitoring',
  '/team': 'Team',
  '/settings': 'Settings',
};

const searchItems = [
  { label: 'Dashboard', href: '/dashboard', category: 'Pages' },
  { label: 'Database', href: '/database', category: 'Pages' },
  { label: 'API', href: '/api', category: 'Pages' },
  { label: 'Storage', href: '/storage', category: 'Pages' },
  { label: 'Realtime', href: '/realtime', category: 'Pages' },
  { label: 'Functions', href: '/functions', category: 'Pages' },
  { label: 'Monitoring', href: '/monitoring', category: 'Pages' },
  { label: 'Team', href: '/team', category: 'Pages' },
  { label: 'Settings', href: '/settings', category: 'Pages' },
  { label: 'Create New Project', href: '/dashboard?new=true', category: 'Actions' },
];

interface NavbarProps {
  onMobileMenuToggle: () => void;
}

export function Navbar({ onMobileMenuToggle }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const breadcrumb = breadcrumbMap[pathname] || 'Dashboard';

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 w-full border-b transition-all duration-200',
          scrolled
            ? 'bg-background/80 backdrop-blur-xl border-border/80'
            : 'bg-background border-transparent'
        )}
      >
        <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8 text-muted-foreground"
            onClick={onMobileMenuToggle}
          >
            <Menu className="h-4.5 w-4.5" />
          </Button>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">VrixoBase</span>
            <span className="text-muted-foreground mx-0.5">/</span>
            <span className="font-medium">{breadcrumb}</span>
          </div>

          <div className="hidden sm:flex ml-4">
            <ProjectSelector />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex h-8 gap-2 text-muted-foreground text-xs border border-border/50"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ml-4">
                <Keyboard className="h-2.5 w-2.5" />
                K
              </kbd>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4 sm:hidden" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground relative"
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 gap-2 pl-1.5 pr-2"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={(user as { avatar_url?: string })?.avatar_url || ''} />
                    <AvatarFallback className="text-[10px] bg-muted">
                      {user ? getInitials(user.name || '') : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-sm font-medium max-w-[120px] truncate">
                    {user?.name || 'User'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.name || 'User'}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {user?.email || ''}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    router.push('/auth/login');
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search pages, projects, or actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {searchItems
              .filter((item) => item.category === 'Pages')
              .map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    router.push(item.href);
                    setSearchOpen(false);
                  }}
                >
                  {item.label}
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            {searchItems
              .filter((item) => item.category === 'Actions')
              .map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    router.push(item.href);
                    setSearchOpen(false);
                  }}
                >
                  {item.label}
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
