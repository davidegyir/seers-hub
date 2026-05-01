import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { createManualOrder, markOrderPaid } from './actions';
import OrderActionForm from './OrderActionForm';

export default async function OrdersPage() {
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
        <p>You do not have permission to manage orders.</p>
      </main>
    );
  }

  const users = await sql`
    SELECT id, email
    FROM users
    WHERE status = 'active'
    ORDER BY email ASC
  `;

  const products = await sql`
    SELECT id, product_key, name, is_active
    FROM products
    ORDER BY name ASC
  `;

  const orders = await sql`
    SELECT
      orders.id,
      orders.status,
      orders.created_at,
      users.email AS user_email,
      products.name AS product_name
    FROM orders
    INNER JOIN users ON orders.user_id = users.id
    INNER JOIN products ON orders.product_id = products.id
    ORDER BY orders.created_at DESC
  `;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Orders</h1>
      <p style={{ color: '#4b5563' }}>
        Create manual orders and simulate payment completion for access assignment.
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
        <h2 style={{ marginTop: 0 }}>Create Manual Order</h2>

        <OrderActionForm action={createManualOrder}>
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

            <select name="productId" style={inputStyle}>
              <option value="">Select product</option>
              {products
                .filter((product: any) => product.is_active)
                .map((product: any) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
            </select>
          </div>

          <button type="submit" style={primaryButtonStyle}>
            Create Order
          </button>
        </OrderActionForm>
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
              <Th>User</Th>
              <Th>Product</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <Td colSpan={5}>No orders yet.</Td>
              </tr>
            ) : (
              orders.map((order: any) => (
                <tr key={order.id}>
                  <Td>{order.user_email}</Td>
                  <Td>{order.product_name}</Td>
                  <Td>{order.status}</Td>
                  <Td>{new Date(order.created_at).toLocaleString()}</Td>
                  <Td>
                    {order.status === 'paid' ? (
                      <span style={{ color: '#166534', fontWeight: 600 }}>Paid</span>
                    ) : (
                      <OrderActionForm action={markOrderPaid}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <button
                          type="submit"
                          style={{
                            padding: '0.5rem 0.8rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#2563eb',
                            color: 'white',
                            cursor: 'pointer',
                          }}
                        >
                          Mark Paid
                        </button>
                      </OrderActionForm>
                    )}
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