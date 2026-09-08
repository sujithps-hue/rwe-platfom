'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/connectors', label: 'Connectors' },
  { href: '/analytics', label: 'Cohort Builder' },
  { href: '/care-management', label: 'Care Management' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/billing', label: 'Billing' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={pathname?.startsWith(link.href) ? 'active' : ''}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
