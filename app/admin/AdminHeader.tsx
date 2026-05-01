import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { UserButton } from '@clerk/nextjs';

export default async function AdminHeader() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const dbUser = await sql`
    SELECT email, full_name, role
    FROM users
    WHERE clerk_user_id = ${userId}
    LIMIT 1
  `;

  const savedUser = dbUser[0];

  if (!savedUser) {
    return null;
  }

  return (
    <header
      style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
    >
      <div>
        <strong>Seers Platform Admin</strong>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600, color: '#111827' }}>
            {savedUser.full_name || savedUser.email}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
            {savedUser.email} · {savedUser.role}
          </div>
        </div>

        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}