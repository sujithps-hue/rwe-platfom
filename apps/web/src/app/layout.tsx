import type { Metadata } from 'next';
import { SessionProvider } from '@/lib/session';
import { Nav } from '@/components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'RWE Platform',
  description: 'Pluggable, multi-tenant real-world-evidence / EHR analytics platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <div className="app-shell">
            <aside className="sidebar">
              <div className="sidebar-brand">RWE Platform</div>
              <div className="sidebar-subtitle">Tenant console</div>
              <Nav />
            </aside>
            <main className="main">{children}</main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
