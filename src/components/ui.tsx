import Link from 'next/link';
import type { Severity } from '@/lib/domain/alerts.ts';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  green: 'bg-ok/10 text-ok', amber: 'bg-warn/10 text-warn', red: 'bg-danger/10 text-danger',
  gray: 'bg-rule text-muted', brand: 'bg-brand-light text-brand-dark',
} as const;

export function Badge({ tone = 'gray', children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`chip ${TONES[tone]}`}>{children}</span>;
}

export const SEVERITY_TONE: Record<Severity, keyof typeof TONES> = { critical: 'red', warning: 'amber', info: 'brand' };

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-rule p-6 text-center text-sm text-muted">{children}</div>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'red' | 'amber' }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`text-2xl font-semibold ${tone === 'red' ? 'text-danger' : tone === 'amber' ? 'text-warn' : ''}`}>{value}</div>
      {hint && <div className="muted mt-0.5 text-xs">{hint}</div>}
    </div>
  );
}

export function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Notice({ tone = 'brand', children }: { tone?: 'brand' | 'amber' | 'red'; children: React.ReactNode }) {
  const cls = tone === 'red' ? 'border-danger/30 bg-danger/5' : tone === 'amber' ? 'border-warn/30 bg-warn/5' : 'border-brand/20 bg-brand-light';
  return <div className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function AlertList({ alerts, schoolName }: { alerts: { id: string; severity: Severity; title: string; detail: string; href: string; school_id: string }[]; schoolName?: (id: string) => string }) {
  if (!alerts.length) return <Empty>All clear. No alerts right now.</Empty>;
  return (
    <ul className="divide-y divide-rule">
      {alerts.map((a) => (
        <li key={a.id} className="flex items-start gap-3 py-2.5">
          <Badge tone={SEVERITY_TONE[a.severity]}>{a.severity}</Badge>
          <div className="min-w-0 flex-1">
            <Link href={a.href} className="font-medium hover:underline">{a.title}</Link>
            <div className="muted text-xs">{a.detail}{schoolName ? ` · ${schoolName(a.school_id)}` : ''}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ width: size, height: size, background: `hsl(${h} 45% 45%)` }}>{initials}</span>
  );
}
