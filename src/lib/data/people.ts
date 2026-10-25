import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PickupPerson { name: string; relationship: string | null; kind: 'guardian' | 'pickup' }

/** People allowed to pick each child up: full guardians plus pickup-list entries marked can_pickup. */
export async function loadAuthorizedPickups(supabase: SupabaseClient, childIds: string[]) {
  const out = new Map<string, PickupPerson[]>();
  if (!childIds.length) return out;
  const [g, p] = await Promise.all([
    supabase.from('guardians').select('child_id, relationship, access, profile:profiles(full_name)').in('child_id', childIds).eq('access', 'full'),
    supabase.from('pickups').select('child_id, name, relationship').in('child_id', childIds).eq('can_pickup', true),
  ]);
  const add = (id: string, x: PickupPerson) => { if (x.name) out.set(id, [...(out.get(id) ?? []), x]); };
  for (const row of (g.data ?? []) as any[]) {
    const prof = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    add(row.child_id, { name: prof?.full_name ?? '', relationship: row.relationship, kind: 'guardian' });
  }
  for (const row of p.data ?? []) add(row.child_id, { name: row.name, relationship: row.relationship, kind: 'pickup' });
  return out;
}
