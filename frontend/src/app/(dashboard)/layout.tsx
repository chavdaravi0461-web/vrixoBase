import type { Metadata } from 'next';
import { DashboardAuthShell } from './dashboard-auth-shell';

export const metadata: Metadata = {
  title: {
    default: 'Dashboard | VrixoBase',
    template: '%s | VrixoBase',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardAuthShell>{children}</DashboardAuthShell>;
}
