import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';

export default async function PortalPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const dbUser = await sql`
    SELECT role, email, full_name, status
    FROM users
    WHERE clerk_user_id = ${userId}
    LIMIT 1
  `;

  const savedUser = dbUser[0];

  if (!savedUser) {
    redirect('/sign-in');
  }

  if (savedUser.status === 'suspended') {
    redirect('/suspended');
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Seers User Portal</h1>
      <div style={{ marginTop: '1.5rem' }}>
        <p><strong>Email:</strong> {savedUser.email}</p>
        <p><strong>Full Name:</strong> {savedUser.full_name || 'N/A'}</p>
        <p><strong>Role:</strong> {savedUser.role}</p>
        <p><strong>Status:</strong> {savedUser.status}</p>
      </div>
    </main>
  );
}