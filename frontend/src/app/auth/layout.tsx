import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Authentication | VrixoBase',
    template: '%s | VrixoBase',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
