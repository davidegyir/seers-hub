import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { startCheckout } from './actions';

export default async function PaymentsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const userRows = await sql`
    SELECT status
    FROM users
    WHERE clerk_user_id = ${userId}
    LIMIT 1
  `;

  const user = userRows[0];

  if (!user) {
    redirect('/sign-in');
  }

  if (user.status === 'suspended') {
    redirect('/suspended');
  }

  const products = await sql`
    SELECT id, name, description, price, currency
    FROM products
    WHERE is_active = true
    ORDER BY name ASC
  `;

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Payments</h1>
      <p>Choose a product and start checkout.</p>

      <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
        {products.map((product: any) => (
          <div
            key={product.id}
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1rem',
            }}
          >
            <h2 style={{ marginTop: 0 }}>{product.name}</h2>
            <p>{product.description || '—'}</p>
            <p>
              <strong>
                {product.currency} {product.price}
              </strong>
            </p>

            <form action={startCheckout}>
              <input type="hidden" name="productId" value={product.id} />
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
                Pay with Flutterwave
              </button>
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}