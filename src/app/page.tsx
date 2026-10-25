import { redirect } from 'next/navigation';
import { getContext } from '@/lib/context.ts';

export default async function Home() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  redirect(ctx.isStaff ? '/dashboard' : ctx.isFamily ? '/family' : '/welcome');
}
