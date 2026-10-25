'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { switchSchool } from '@/app/actions.ts';

/** Switches the staff UI to another school as soon as one is picked. */
export function SchoolSwitcher({ schools, current }: { schools: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="block md:mt-3">
      <span className="sr-only">School</span>
      <select value={current} disabled={pending} className="input py-1.5 text-xs"
        onChange={(e) => {
          const id = e.target.value;
          start(async () => { await switchSchool(id); router.refresh(); });
        }}>
        {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {pending && <span className="mt-1 block text-xs text-muted">Switching…</span>}
    </label>
  );
}
