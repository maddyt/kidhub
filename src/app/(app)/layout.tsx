import Link from 'next/link';
import { requireUser } from '@/lib/context.ts';
import { AppNav, type NavItem } from '@/components/AppNav.tsx';
import { switchSchool, signOut } from '../actions.ts';
import { Avatar } from '@/components/ui.tsx';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();

  const staff: NavItem[] = !ctx.isStaff ? [] : [
    { href: '/dashboard', label: 'Today', icon: '🏠' },
    { href: '/attendance', label: 'Attendance', icon: '✅' },
    { href: '/log', label: 'Care log', icon: '📝' },
    { href: '/children', label: 'Children', icon: '🧒' },
    { href: '/messages', label: 'Messages', icon: '💬' },
    { href: '/announcements', label: 'Announcements', icon: '📣' },
    { href: '/staff', label: 'Staff', icon: '👩‍🏫' },
    ...(ctx.isAdmin ? [
      { href: '/billing', label: 'Billing', icon: '💳' },
      { href: '/approvals', label: 'Approvals', icon: '🛡️' },
      { href: '/video', label: 'Cameras', icon: '🎥' },
      { href: '/assistant', label: 'AI assistant', icon: '✨' },
      { href: '/settings', label: 'Settings', icon: '⚙️' },
    ] : []),
    ...(ctx.isFamily ? [{ href: '/family', label: 'My family', icon: '👪' }] : []),
  ];
  const fullFamily = ctx.guardianOf.some((g) => g.access === 'full');
  const family: NavItem[] = [
    { href: '/family', label: 'Home', icon: '🏠' },
    ...(fullFamily ? [
      { href: '/family/messages', label: 'Messages', icon: '💬' },
      { href: '/family/billing', label: 'Billing', icon: '💳' },
      { href: '/family/milestones', label: 'Milestones', icon: '🌱' },
    ] : []),
    { href: '/family/video', label: 'Live video', icon: '🎥' },
    ...(fullFamily ? [{ href: '/family/people', label: 'Pickups & family', icon: '👪' }] : []),
    ...(ctx.isStaff ? [{ href: '/dashboard', label: 'Staff view', icon: '🏫' }] : []),
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
      <aside className="no-print border-b border-rule bg-white p-3 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="mb-3 flex items-center justify-between gap-2 md:block">
          <Link href={ctx.isStaff ? '/dashboard' : '/family'} className="flex items-center gap-2 text-lg font-semibold text-brand-dark">
            <span aria-hidden>🌳</span> KidHub
          </Link>
          {ctx.schools.length > 1 && ctx.school && (
            <form action={switchSchool} className="md:mt-3">
              <select name="school_id" defaultValue={ctx.school.id} className="input py-1.5 text-xs" aria-label="School">
                {ctx.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="btn-secondary btn-sm mt-1 w-full">Switch school</button>
            </form>
          )}
          {ctx.schools.length === 1 && ctx.school && <div className="muted md:mt-2">{ctx.school.name}</div>}
        </div>
        <AppNav staff={staff} family={family} />
        <div className="mt-3 hidden items-center gap-2 border-t border-rule pt-3 md:flex">
          <Avatar name={ctx.fullName} size={28} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{ctx.fullName}</div>
            <div className="truncate text-xs text-muted">{ctx.role ?? 'family'}</div>
          </div>
          <form action={signOut}><button className="text-xs text-muted hover:underline">Sign out</button></form>
        </div>
        <form action={signOut} className="mt-2 md:hidden"><button className="text-xs text-muted hover:underline">Sign out ({ctx.fullName})</button></form>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
