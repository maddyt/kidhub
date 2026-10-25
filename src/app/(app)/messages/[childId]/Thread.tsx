'use client';
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser.ts';

export interface Msg { id: string; sender_id: string; body: string; created_at: string }

export function Thread({ childId, schoolId, me, initial, names, tz }: {
  childId: string; schoolId: string; me: string; initial: Msg[]; names: Record<string, string>; tz: string;
}) {
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const supabase = useRef(supabaseBrowser()).current;

  useEffect(() => {
    // Realtime respects RLS: you only receive messages you are allowed to read.
    const channel = supabase.channel(`thread:${childId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `child_id=eq.${childId}` },
        (payload) => setMsgs((m) => (m.some((x) => x.id === payload.new.id) ? m : [...m, payload.new as Msg])))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [childId, supabase]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true); setError(null);
    const { data, error } = await supabase.from('messages').insert({ child_id: childId, school_id: schoolId, sender_id: me, body })
      .select('id, sender_id, body, created_at').single();
    setSending(false);
    if (error) { setError(error.message); return; }
    setText('');
    setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data as Msg]));
  }

  const fmt = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  return (
    <div className="card flex h-[70vh] flex-col p-0">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="muted text-center">No messages yet. Say hello!</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-brand text-white' : 'bg-canvas'}`}>
                {!mine && <div className="text-xs font-semibold opacity-70">{names[m.sender_id] ?? 'Someone'}</div>}
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div className={`mt-0.5 text-[10px] ${mine ? 'text-white/70' : 'text-muted'}`}>{fmt(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-rule p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={4000} placeholder="Write a message…" className="input resize-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} />
        <button className="btn-primary" disabled={sending || !text.trim()}>Send</button>
      </form>
      {error && <p className="px-3 pb-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
