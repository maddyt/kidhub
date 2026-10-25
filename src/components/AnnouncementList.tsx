import { Badge, Empty } from './ui.tsx';

export interface Announcement { id: string; kind: string; title: string; body: string; created_at: string; school?: string }

export function AnnouncementList({ items, onDelete }: { items: Announcement[]; onDelete?: (form: FormData) => Promise<void> }) {
  if (!items.length) return <Empty>No announcements.</Empty>;
  return (
    <ul className="space-y-3">{items.map((a) => (
      <li key={a.id} className={`card ${a.kind === 'emergency' ? 'border-danger/50 bg-danger/5' : a.kind === 'closure' ? 'border-warn/50 bg-warn/5' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge tone={a.kind === 'emergency' ? 'red' : a.kind === 'closure' ? 'amber' : 'brand'}>{a.kind}</Badge>
            <h3 className="mt-1 font-semibold">{a.title}</h3>
          </div>
          <span className="text-xs text-muted">{new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{a.school ? ` · ${a.school}` : ''}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{a.body}</p>
        {onDelete && <form action={onDelete} className="mt-2"><input type="hidden" name="id" value={a.id} /><button className="text-xs text-muted hover:text-danger">delete</button></form>}
      </li>
    ))}</ul>
  );
}
