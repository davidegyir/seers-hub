import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import UserActionForm from './UserActionForm';

type UserRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
};

async function updateUserRole(formData: FormData) {
  'use server';

  const { userId } = await auth();

  if (!userId) {
    return { error: 'Not authenticated' };
  }

  const targetUserId = formData.get('targetUserId') as string;
  const newRole = formData.get('newRole') as string;

  if (!targetUserId || !newRole) {
    return { error: 'Missing form data' };
  }

  if (!['user', 'admin'].includes(newRole)) {
    return { error: 'Invalid role' };
  }

  try {
    await sql`
      UPDATE users
      SET role = ${newRole}
      WHERE id = ${targetUserId}
    `;

    return { success: true };
  } catch (err) {
    console.error('Update role error:', err);
    return { error: 'Failed to update role' };
  }
}

export default async function UsersPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const users = await sql<UserRow[]>`
    SELECT id, email, role, created_at
    FROM users
    ORDER BY created_at DESC
  `;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Users</h1>

      <table className="min-w-full border border-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">Role</th>
            <th className="px-4 py-2 text-left">Created</th>
            <th className="px-4 py-2 text-left">Action</th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t">
              <td className="px-4 py-2">{user.email}</td>
              <td className="px-4 py-2">{user.role}</td>
              <td className="px-4 py-2">
                {new Date(user.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-2">
                <UserActionForm
                  action={updateUserRole}
                  hiddenName="targetUserId"
                  hiddenValue={user.id}
                  selectName="newRole"
                  selectDefaultValue={user.role}
                  options={['user', 'admin']}
                  buttonLabel="Save"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}