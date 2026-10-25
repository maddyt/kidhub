'use client';
import { useState } from 'react';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { ACTIVITY_ICONS, ACTIVITY_LABELS } from '@/lib/domain/report.ts';
import { logActivity } from './actions.ts';

interface Kid { id: string; name: string; classroom_id: string | null; present: boolean; allergies: string | null }

const TYPES = ['diaper', 'potty', 'bottle', 'meal', 'nap_start', 'nap_end', 'photo', 'note', 'observation', 'medication', 'incident'];

export function LogForm({ kids, rooms }: { kids: Kid[]; rooms: { id: string; name: string }[] }) {
  const [type, setType] = useState('diaper');
  const [room, setRoom] = useState<string>('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const visible = kids.filter((k) => (showAll || k.present) && (!room || k.classroom_id === room));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <ActionForm action={logActivity} className="space-y-4">
      <div>
        <span className="label">What happened</span>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button type="button" key={t} onClick={() => setType(t)}
              className={`btn btn-sm border ${type === t ? 'border-brand bg-brand text-white' : 'border-rule bg-white'}`}>
              {ACTIVITY_ICONS[t]} {ACTIVITY_LABELS[t]}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="label mb-0">Children</span>
          <select value={room} onChange={(e) => setRoom(e.target.value)} className="input w-auto py-1 text-xs" aria-label="Room">
            <option value="">All rooms</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <label className="text-xs text-muted"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> include absent</label>
          <button type="button" className="text-xs text-brand underline" onClick={() => setPicked(new Set(visible.map((k) => k.id)))}>select all</button>
          <button type="button" className="text-xs text-muted underline" onClick={() => setPicked(new Set())}>clear</button>
        </div>
        {visible.length === 0 ? <p className="muted">Nobody is checked in{room ? ' in this room' : ''}.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {visible.map((k) => (
              <label key={k.id} className={`chip cursor-pointer border px-3 py-1.5 text-sm ${picked.has(k.id) ? 'border-brand bg-brand-light text-brand-dark' : 'border-rule bg-white'}`}>
                <input type="checkbox" name="child_id" value={k.id} checked={picked.has(k.id)} onChange={() => toggle(k.id)} className="sr-only" />
                {k.name}{k.allergies ? ' ⚠' : ''}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {type === 'meal' && <>
          <Select name="meal_type" label="Meal" options={['breakfast', 'am snack', 'lunch', 'pm snack', 'dinner']} />
          <Select name="amount" label="Amount eaten" options={['all', 'most', 'some', 'none']} />
          <Text name="food" label="Food" placeholder="e.g. pasta, peas" />
        </>}
        {type === 'bottle' && <>
          <Text name="ounces" label="Ounces" type="number" step="0.5" />
          <Select name="contents" label="Contents" options={['breast milk', 'formula', 'whole milk', 'water']} />
        </>}
        {(type === 'diaper' || type === 'potty') && <Select name="kind" label="Type" options={type === 'diaper' ? ['wet', 'BM', 'wet + BM', 'dry'] : ['success', 'tried', 'accident']} />}
        {type === 'observation' && <Select name="domain" label="Development area" options={['social-emotional', 'language', 'cognitive', 'fine motor', 'gross motor', 'self-care', 'creative']} />}
        {type === 'medication' && <><Text name="medicine" label="Medicine" /><Text name="dose" label="Dose" /></>}
        <Text name="time" label="Time (blank = now)" type="time" />
      </div>

      <label className="block"><span className="label">Note {['note', 'incident', 'observation'].includes(type) ? '(required)' : '(optional)'}</span>
        <textarea name="note" rows={2} className="input" placeholder={type === 'observation' ? 'e.g. Stacked 4 blocks on her own!' : ''} /></label>

      {(type === 'photo' || type === 'observation' || type === 'note') && (
        <label className="block"><span className="label">Photo {type === 'photo' ? '' : '(optional)'}</span>
          <input type="file" name="photo" accept="image/*" capture="environment" className="text-sm" /></label>
      )}
      <SubmitButton pendingText="Logging…" disabled={picked.size === 0}>Log for {picked.size || '…'} {picked.size === 1 ? 'child' : 'children'}</SubmitButton>
    </ActionForm>
  );
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return <label className="block"><span className="label">{label}</span>
    <select name={name} className="input"><option value="">—</option>{options.map((o) => <option key={o}>{o}</option>)}</select></label>;
}
function Text({ name, label, ...rest }: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block"><span className="label">{label}</span><input name={name} className="input" {...rest} /></label>;
}
