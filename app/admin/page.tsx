import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';

export default async function AdminPage() {
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

  if (savedUser.role !== 'admin') {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Access denied</h1>
        <p>You do not have permission to view the admin area.</p>
      </main>
    );
  }

  const userCount = await sql`
    SELECT COUNT(*)::int AS count FROM users
  `;

  const totalUsers = userCount[0]?.count ?? 0;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Admin Dashboard</h1>
      <p style={{ color: '#4b5563' }}>
        Welcome back to Seers platform administration.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem',
        }}
      >
        <Card title="Your Role" value={savedUser.role} />
        <Card title="Your Email" value={savedUser.email} />
        <Card title="Total Users" value={String(totalUsers)} />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '1rem',
      }}
    >
      <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>{title}</div>
      <div
        style={{
          marginTop: '0.5rem',
          fontSize: '1.4rem',
          fontWeight: 700,
          color: '#111827',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>
    </div>
  );
}