import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { grantTierDirectly, grantFeatureDirectly } from './actions';
import GrantActionForm from './GrantActionForm';

export default async function GrantsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const adminCheck = await sql`
    SELECT role, status
    FROM users
    WHERE clerk_user_id = ${userId}
    LIMIT 1
  `;

  const currentUser = adminCheck[0];

  if (!currentUser) {
    redirect('/sign-in');
  }

  if (currentUser.status === 'suspended') {
    redirect('/suspended');
  }

  if (currentUser.role !== 'admin') {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Access denied</h1>
        <p>You do not have permission to manage direct grants.</p>
      </main>
    );
  }

  const users = await sql`
    SELECT id, email
    FROM users
    WHERE status = 'active'
    ORDER BY email ASC
  `;

  const features = await sql`
    SELECT feature_key, name
    FROM features
    WHERE is_active = true
    ORDER BY feature_key ASC
  `;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Direct Grants</h1>
      <p style={{ color: '#4b5563' }}>
        Grant access directly for physical payments, transfers, scholarships, promos, or administrative exceptions.
      </p>

      <section
        style={{
          marginTop: '1.5rem',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '1rem',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Grant Tier Directly</h2>

        <GrantActionForm action={grantTierDirectly}>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <select name="targetUserId" style={inputStyle}>
              <option value="">Select user</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>

            <select name="newTier" style={inputStyle}>
              <option value="">Select tier</option>
              <option value="free">free</option>
              <option value="standard">standard</option>
              <option value="premium">premium</option>
              <option value="enterprise">enterprise</option>
            </select>

            <input
              type="text"
              name="reason"
              placeholder="Reason (e.g. cash payment received)"
              style={inputStyle}
            />
          </div>

          <button type="submit" style={primaryButtonStyle}>
            Grant Tier
          </button>
        </GrantActionForm>
      </section>

      <section
        style={{
          marginTop: '1.5rem',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '1rem',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Grant Feature Directly</h2>

        <GrantActionForm action={grantFeatureDirectly}>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <select name="targetUserId" style={inputStyle}>
              <option value="">Select user</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>

            <select name="featureKey" style={inputStyle}>
              <option value="">Select feature</option>
              {features.map((feature: any) => (
                <option key={feature.feature_key} value={feature.feature_key}>
                  {feature.name} ({feature.feature_key})
                </option>
              ))}
            </select>

            <input
              type="text"
              name="reason"
              placeholder="Reason (e.g. scholarship)"
              style={inputStyle}
            />
          </div>

          <button type="submit" style={primaryButtonStyle}>
            Grant Feature
          </button>
        </GrantActionForm>
      </section>
    </div>
  );
}

const inputStyle = {
  padding: '0.65rem 0.8rem',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  width: '100%',
};

const primaryButtonStyle = {
  marginTop: '0.9rem',
  padding: '0.65rem 1rem',
  borderRadius: '8px',
  border: 'none',
  background: '#111827',
  color: 'white',
  cursor: 'pointer',
};