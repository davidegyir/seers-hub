import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import {
  createFeature,
  updateFeature,
  toggleFeatureStatus,
  deleteFeature,
} from './actions';
import FeatureActionForm from './FeatureActionForm';

export default async function FeaturesPage() {
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
        <p>You do not have permission to manage features.</p>
      </main>
    );
  }

  const features = await sql`
    SELECT id, feature_key, name, description, is_active, created_at
    FROM features
    ORDER BY feature_key ASC
  `;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Features</h1>
      <p style={{ color: '#4b5563' }}>
        Create, update, activate, deactivate, and delete platform features.
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
        <h2 style={{ marginTop: 0 }}>Create New Feature</h2>

        <FeatureActionForm action={createFeature}>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <input
              type="text"
              name="featureKey"
              placeholder="feature_key"
              style={inputStyle}
            />
            <input
              type="text"
              name="name"
              placeholder="Feature name"
              style={inputStyle}
            />
            <input
              type="text"
              name="description"
              placeholder="Description (optional)"
              style={inputStyle}
            />
          </div>

          <button type="submit" style={primaryButtonStyle}>
            Create Feature
          </button>
        </FeatureActionForm>
      </section>

      <section
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
              <Th>Feature Key</Th>
              <Th>Name</Th>
              <Th>Description</Th>
              <Th>Status</Th>
              <Th>Edit</Th>
              <Th>Toggle Status</Th>
              <Th>Delete</Th>
            </tr>
          </thead>
          <tbody>
            {features.length === 0 ? (
              <tr>
                <Td colSpan={7}>No features found.</Td>
              </tr>
            ) : (
              features.map((feature: any) => (
                <tr key={feature.id}>
                  <Td>{feature.feature_key}</Td>
                  <Td>{feature.name}</Td>
                  <Td>{feature.description || '—'}</Td>
                  <Td>{feature.is_active ? 'active' : 'inactive'}</Td>

                  <Td>
                    <FeatureActionForm action={updateFeature}>
                      <input type="hidden" name="featureId" value={feature.id} />
                      <div style={{ display: 'grid', gap: '0.5rem', minWidth: '260px' }}>
                        <input
                          type="text"
                          name="name"
                          defaultValue={feature.name}
                          style={inputStyle}
                        />
                        <input
                          type="text"
                          name="description"
                          defaultValue={feature.description || ''}
                          style={inputStyle}
                        />
                        <button type="submit" style={secondaryButtonStyle}>
                          Save
                        </button>
                      </div>
                    </FeatureActionForm>
                  </Td>

                  <Td>
                    <FeatureActionForm action={toggleFeatureStatus}>
                      <input type="hidden" name="featureId" value={feature.id} />
                      <input
                        type="hidden"
                        name="newStatus"
                        value={feature.is_active ? 'inactive' : 'active'}
                      />
                      <button
                        type="submit"
                        style={{
                          ...secondaryButtonStyle,
                          background: feature.is_active ? '#b91c1c' : '#166534',
                          color: 'white',
                          border: 'none',
                        }}
                      >
                        {feature.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </FeatureActionForm>
                  </Td>

                  <Td>
                    <FeatureActionForm action={deleteFeature}>
                      <input type="hidden" name="featureId" value={feature.id} />
                      <button
                        type="submit"
                        style={{
                          ...secondaryButtonStyle,
                          background: '#7f1d1d',
                          color: 'white',
                          border: 'none',
                        }}
                      >
                        Delete
                      </button>
                    </FeatureActionForm>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

const secondaryButtonStyle = {
  padding: '0.5rem 0.8rem',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  background: '#f9fafb',
  color: '#111827',
  cursor: 'pointer',
};

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