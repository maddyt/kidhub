import { requireUser } from '@/lib/context.ts';
import { Notice } from '@/components/ui.tsx';

export default async function Welcome() {
  const ctx = await requireUser();
  return (
    <div className="max-w-lg space-y-3">
      <h1 className="h1">Welcome, {ctx.fullName}</h1>
      <Notice>Your account isn’t linked to a school yet. Ask your school for an invitation link and open it while signed in.</Notice>
    </div>
  );
}
