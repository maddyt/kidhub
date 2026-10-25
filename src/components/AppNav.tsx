'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem { href: string; label: string; icon: string }

export function AppNav({ staff, family }: { staff: NavItem[]; family: NavItem[] }) {
  const path = usePathname();
  const items = staff.length && !path.startsWith('/family') ? staff : family;
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((i) => {
        const active = path === i.href || (i.href !== '/family' && path.startsWith(`${i.href}/`));
        return (
          <Link key={i.href} href={i.href}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? 'bg-brand-light font-medium text-brand-dark' : 'text-ink hover:bg-canvas'}`}>
            <span aria-hidden>{i.icon}</span>{i.label}
          </Link>
        );
      })}
    </nav>
  );
}
