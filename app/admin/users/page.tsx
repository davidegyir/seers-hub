import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { sql } from '@/lib/db';
import {
  updateUserRole,
  updateUserStatus,
  updateUserTier,
  updateUserEntitlements,
} from './actions';
import UserActionForm from './UserActionForm';
import UserEntitlementsForm from './UserEntitlementsForm';

type SearchParams = Promise<{
  q?: string;
  role?: string;
}>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const dbUser = await sql`
    SELECT role, status
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
        <p>You do not have permission to view users.</p>
      </main>
    );
  }

  const params = await searchParams;
  const q = (params.q || '').trim();
  const role = (params.role || '').trim();

  let users;

  if (q && role) {
    users = await sql`
      SELECT id, clerk_user_id, email, full_name, status, role, tier, created_at
      FROM users
      WHERE (email ILIKE ${'%' + q + '%'} OR full_name ILIKE ${'%' + q + '%'})
        AND role = ${role}
      ORDER BY created_at DESC
    `;
  } else if (q) {
    users = await sql`
      SELECT id, clerk_user_id, email, full_name, status, role, tier, created_at
      FROM users
      WHERE email ILIKE ${'%' + q + '%'}
         OR full_name ILIKE ${'%' + q + '%'}
      ORDER BY created_at DESC
    `;
  } else if (role) {
    users = await sql`
      SELECT id, clerk_user_id, email, full_name, status, role, tier, created_at
      FROM users
      WHERE role = ${role}
      ORDER BY created_at DESC
    `;
  } else {
    users = await sql`
      SELECT id, clerk_user_id, email, full_name, status, role, tier, created_at
      FROM users
      ORDER BY created_at DESC
    `;
  }

  const userIds = users.map((user: any) => user.id);

  const entitlements =
    userIds.length > 0
      ? await sql`
          SELECT user_id, feature_key, granted
          FROM entitlements
          WHERE user_id = ANY(${userIds})
        `
      : [];

  const entitlementsByUser = new Map<string, string[]>();

  for (const row of entitlements as any[]) {
    if (!row.granted) continue;
    const current = entitlementsByUser.get(row.user_id) || [];
    current.push(row.feature_key);
    entitlementsByUser.set(row.user_id, current);
  }

  const features = await sql`
    SELECT feature_key, name, description
    FROM features
    WHERE is_active = true
    ORDER BY feature_key ASC
  `;

  const allFeatures = features.map((feature: any) => feature.feature_key);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Users</h1>
      <p style={{ color: '#4b5563' }}>
        Manage users, roles, status, tiers, and entitlement overrides.
      </p>

      <form
        method="GET"
        style={{
          marginTop: '1.5rem',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '1rem',
        }}
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by email or full name"
          style={{
            flex: '1 1 260px',
            minWidth: '220px',
            padding: '0.65rem 0.8rem',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
          }}
        />

        <select
          name="role"
          defaultValue={role}
          style={{
            padding: '0.65rem 0.8rem',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
          }}
        >
          <option value="">All roles</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>

        <button
          type="submit"
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            border: 'none',
            background: '#111827',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Search
        </button>

        <Link
          href="/admin/users"
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            background: '#f9fafb',
            color: '#111827',
            textDecoration: 'none',
          }}
        >
          Reset
        </Link>
      </form>

      <div
        style={{
          marginTop: '1.5rem',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.95rem',
          }}
        >
          <thead style={{ background: '#f3f4f6' }}>
            <tr>
              <Th>Email</Th>
              <Th>Full Name</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Tier</Th>
              <Th>Change Role</Th>
              <Th>Change Status</Th>
              <Th>Change Tier</Th>
              <Th>Entitlements</Th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <Td colSpan={9}>No users found.</Td>
              </tr>
            ) : (
              users.map((user: any) => (
                <tr key={user.id}>
                  <Td>{user.email}</Td>
                  <Td>{user.full_name || 'N/A'}</Td>
                  <Td>{user.role}</Td>
                  <Td>{user.status}</Td>
                  <Td>{user.tier || 'free'}</Td>

                  <Td>
                    <UserActionForm
                      action={updateUserRole}
                      hiddenName="targetUserId"
                      hiddenValue={user.id}
                      selectName="newRole"
                      defaultValue={user.role}
                      options={[
                        { value: 'user', label: 'user' },
                        { value: 'admin', label: 'admin' },
                      ]}
                      buttonLabel="Save"
                      buttonColor="#111827"
                    />
                  </Td>

                  <Td>
                    <UserActionForm
                      action={updateUserStatus}
                      hiddenName="targetUserId"
                      hiddenValue={user.id}
                      selectName="newStatus"
                      defaultValue={user.status}
                      options={[
                        { value: 'active', label: 'active' },
                        { value: 'suspended', label: 'suspended' },
                      ]}
                      buttonLabel="Save"
                      buttonColor="#7c3aed"
                    />
                  </Td>

                  <Td>
                    <UserActionForm
                      action={updateUserTier}
                      hiddenName="targetUserId"
                      hiddenValue={user.id}
                      selectName="newTier"
                      defaultValue={user.tier || 'free'}
                      options={[
                        { value: 'free', label: 'free' },
                        { value: 'standard', label: 'standard' },
                        { value: 'premium', label: 'premium' },
                        { value: 'enterprise', label: 'enterprise' },
                      ]}
                      buttonLabel="Save"
                      buttonColor="#2563eb"
                    />
                  </Td>

                  <Td>
                    <UserEntitlementsForm
                      action={updateUserEntitlements}
                      userId={user.id}
                      selectedFeatures={entitlementsByUser.get(user.id) || []}
                      allFeatures={allFeatures}
                    />
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '0.9rem 1rem',
        borderBottom: '1px solid #e5e7eb',
        verticalAlign: 'top',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  colSpan,
}: {
  children: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: '0.9rem 1rem',
        borderBottom: '1px solid #f3f4f6',
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  );
}