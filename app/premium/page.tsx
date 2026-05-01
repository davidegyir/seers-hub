import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { hasAccess } from '@/lib/access';

export default async function PremiumPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const allowed = await hasAccess(userId, 'premium_articles');

  if (!allowed) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Access Restricted</h1>
        <p>You do not currently have access to Premium Articles.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Premium Articles</h1>
      <p>Welcome. You have access to this premium area.</p>
    </main>
  );
}