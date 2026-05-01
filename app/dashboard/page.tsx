import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';

export default async function Dashboard() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const email = user.emailAddresses?.[0]?.emailAddress ?? '';
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') || null;

  await sql`
    INSERT INTO users (clerk_user_id, email, full_name)
    VALUES (${userId}, ${email}, ${fullName})
    ON CONFLICT (clerk_user_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      updated_at = NOW()
  `;

  const dbUser = await sql`
    SELECT id, clerk_user_id, email, full_name, status, role
    FROM users
    WHERE clerk_user_id = ${userId}
    LIMIT 1
  `;

  const savedUser = dbUser[0];

  if (!savedUser) {
    redirect('/sign-in');
  }

  if (savedUser.role === 'admin') {
    redirect('/admin');
  }

  redirect('/portal');
}