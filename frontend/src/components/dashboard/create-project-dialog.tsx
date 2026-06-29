'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  Github,
  HelpCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Database,
  Globe,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth-store';
import { useCreateProject } from '@/hooks/use-projects';
import { useProjectStore } from '@/stores/project-store';

const regions = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU West (Ireland)' },
  { value: 'eu-central-1', label: 'EU Central (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
];

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { setCurrentProject } = useProjectStore();
  const createProject = useCreateProject();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [region, setRegion] = useState('ap-southeast-1');
  const [enableDataApi, setEnableDataApi] = useState(true);
  const [autoExposeTables, setAutoExposeTables] = useState(false);
  const [enableRls, setEnableRls] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const canSubmit = name.trim().length > 0;

  const handleCreate = async () => {
    if (!canSubmit) return;

    createProject.mutate(
      {
        name: name.trim(),
        region,
      },
      {
        onSuccess: (p) => {
          setCurrentProject(p);
          onOpenChange(false);
          router.push('/dashboard');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Create a new project</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Your project will have its own dedicated instance and full Postgres
            database. An API will be set up so you can easily interact with your
            new database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Organization */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium">Organization</Label>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {(user?.email?.[0] || 'U').toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{user?.email || 'Personal'}</p>
                  <p className="text-xs text-muted-foreground">Free</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Free</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* GitHub (optional) */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium">GitHub (optional)</Label>
            <button
              type="button"
              className="flex items-center gap-2.5 w-full rounded-lg border border-border/60 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors text-left"
            >
              <Github className="h-4 w-4" />
              <span>Connect GitHub</span>
            </button>
            <p className="text-xs text-muted-foreground">
              Ideal for agent-first workflows: update your schema in code, push it
              to GitHub, and VrixoBase deploys the changes automatically.
            </p>
          </div>

          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-xs text-muted-foreground font-medium">
              Project name
            </Label>
            <Input
              id="project-name"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Database Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="db-password" className="text-xs text-muted-foreground font-medium">
                Database password
              </Label>
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Generate a password
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              This is the password to your Postgres database, so it must be strong
              and hard to guess.{' '}
              <HelpCircle className="inline h-3 w-3 text-muted-foreground" />
            </p>
            <div className="relative">
              <Input
                id="db-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Type in a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Region */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground font-medium">Region</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  <SelectValue placeholder="Select a region" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the region closest to your users for the best performance.
            </p>
          </div>

          {/* Security Toggles */}
          <div className="space-y-3 rounded-lg border border-border/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enable Data API</Label>
                <p className="text-xs text-muted-foreground">
                  Autogenerate a RESTful API for your public schema. Recommended if
                  using a client library like supabase-js.
                </p>
              </div>
              <Switch checked={enableDataApi} onCheckedChange={setEnableDataApi} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Automatically expose new tables</Label>
                <p className="text-xs text-muted-foreground">
                  Grants privileges to Data API roles by default, exposing new
                  tables. We recommend disabling this to control access manually.
                </p>
              </div>
              <Switch checked={autoExposeTables} onCheckedChange={setAutoExposeTables} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enable automatic RLS</Label>
                <p className="text-xs text-muted-foreground">
                  Create an event trigger that automatically enables Row Level
                  Security on all new tables in the public schema.
                </p>
              </div>
              <Switch checked={enableRls} onCheckedChange={setEnableRls} />
            </div>
          </div>

          {/* Advanced Configuration */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  showAdvanced ? 'rotate-180' : ''
                }`}
              />
              Advanced Configuration
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-medium">
                    Database version
                  </Label>
                  <Select defaultValue="16">
                    <SelectTrigger className="w-full">
                      <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16">PostgreSQL 16</SelectItem>
                      <SelectItem value="15">PostgreSQL 15</SelectItem>
                      <SelectItem value="14">PostgreSQL 14</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/60">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!canSubmit || createProject.isPending}>
              {createProject.isPending ? 'Creating...' : 'Create project'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
