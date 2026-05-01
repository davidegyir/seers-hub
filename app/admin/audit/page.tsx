import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';

function formatAction(action: string) {
  const labels: Record<string, string> = {
    role_changed: 'Role Changed',
    status_changed: 'Status Changed',
    tier_changed: 'Tier Changed',
    entitlement_changed: 'Entitlement Changed',
    feature_created: 'Feature Created',
    feature_updated: 'Feature Updated',
    feature_status_changed: 'Feature Status Changed',
    feature_deleted: 'Feature Deleted',
    order_status_changed: 'Order Status Changed',
    tier_changed_by_product: 'Tier Changed by Product',
    entitlement_changed_by_product: 'Entitlement Changed by Product',
    tier_granted_directly: 'Tier Granted Directly',
    feature_granted_directly: 'Feature Granted Directly',
    payment_verified_by_flutterwave: 'Payment Verified by Flutterwave',
    payment_verified_by_flutterwave_callback: 'Payment Verified by Flutterwave Callback',
    payment_verification_failed: 'Payment Verification Failed',
  };

  return labels[action] || action;
}

export default async function AuditPage() {
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
        <p>You do not have permission to view audit logs.</p>
      </main>
    );
  }

  const logs = await sql`
    SELECT
      audit_logs.id,
      audit_logs.action,
      audit_logs.old_value,
      audit_logs.new_value,
      audit_logs.reason,
      audit_logs.created_at,
      actor.email AS actor_email,
      target.email AS target_email
    FROM audit_logs
    LEFT JOIN users AS actor ON audit_logs.actor_user_id = actor.id
    LEFT JOIN users AS target ON audit_logs.target_user_id = target.id
    ORDER BY audit_logs.created_at DESC
    LIMIT 100
  `;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Audit Log</h1>
      <p style={{ color: '#4b5563' }}>
        Recent governance, feature, payment, and access changes across Seers Hub.
      </p>

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
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Target</Th>
              <Th>Action</Th>
              <Th>Old Value</Th>
              <Th>New Value</Th>
              <Th>Reason</Th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <Td colSpan={7}>No audit logs yet.</Td>
              </tr>
            ) : (
              logs.map((log: any) => (
                <tr key={log.id}>
                  <Td>{new Date(log.created_at).toLocaleString()}</Td>
                  <Td>{log.actor_email || 'Unknown'}</Td>
                  <Td>{log.target_email || 'Unknown'}</Td>
                  <Td>{formatAction(log.action)}</Td>
                  <Td>{log.old_value || '—'}</Td>
                  <Td>{log.new_value || '—'}</Td>
                  <Td>{log.reason || '—'}</Td>
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