import { Field } from './ui.tsx';

export interface ChildValues {
  first_name?: string; last_name?: string; birth_date?: string | null; classroom_id?: string | null; status?: string;
  allergies?: string | null; medical_notes?: string | null; start_date?: string | null;
}

export function ChildFields({ v = {}, rooms }: { v?: ChildValues; rooms: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="First name"><input name="first_name" required defaultValue={v.first_name} className="input" /></Field>
      <Field label="Last name"><input name="last_name" required defaultValue={v.last_name} className="input" /></Field>
      <Field label="Birth date"><input name="birth_date" type="date" defaultValue={v.birth_date ?? ''} className="input" /></Field>
      <Field label="Start date"><input name="start_date" type="date" defaultValue={v.start_date ?? ''} className="input" /></Field>
      <Field label="Classroom">
        <select name="classroom_id" defaultValue={v.classroom_id ?? ''} className="input">
          <option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={v.status ?? 'enrolled'} className="input">
          <option value="enrolled">Enrolled</option><option value="waitlist">Waitlist</option><option value="withdrawn">Withdrawn</option>
        </select>
      </Field>
      <Field label="Allergies" className="sm:col-span-2"><input name="allergies" defaultValue={v.allergies ?? ''} placeholder="e.g. Peanuts (EpiPen in office)" className="input" /></Field>
      <Field label="Medical notes" className="sm:col-span-2"><textarea name="medical_notes" rows={2} defaultValue={v.medical_notes ?? ''} className="input" /></Field>
    </div>
  );
}
