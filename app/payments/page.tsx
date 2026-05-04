import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { startCheckout } from './actions';

type SearchParams = Promise<{
  product?: string;
  intent?: string;
}>;

function formatPrice(currency: string, price: string | number) {
  const amount = Number(price);

  if (currency === 'GHS') {
    return `GHS ${amount.toFixed(2)}`;
  }

  return `${currency} ${amount.toFixed(2)}`;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const intentId = params.intent;
  let productKey = params.product;
  let checkoutIntent: any = null;
  let intentError: string | null = null;

  const { userId } = await auth();

  if (!userId) {
    const redirectTarget = intentId
      ? `/payments?intent=${encodeURIComponent(intentId)}`
      : productKey
        ? `/payments?product=${encodeURIComponent(productKey)}`
        : '/payments';

    redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectTarget)}`);
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

  if (intentId) {
    const intentRows = await sql`
      SELECT
        id,
        full_name,
        mobile,
        email,
        product_slug,
        source,
        status,
        expires_at
      FROM checkout_intents
      WHERE id = ${intentId}
      LIMIT 1
    `;

    checkoutIntent = intentRows[0];

    if (!checkoutIntent) {
      intentError = 'Checkout intent not found.';
    } else if (new Date(checkoutIntent.expires_at) < new Date()) {
      intentError = 'Checkout intent expired. Please start again from the registration page.';
    } else {
      productKey = checkoutIntent.product_slug;

      await sql`
        UPDATE checkout_intents
        SET clerk_user_id = ${userId}
        WHERE id = ${intentId}
      `;
    }
  }

  const products = intentError
    ? []
    : productKey
      ? await sql`
          SELECT id, product_key, name, description, price, currency
          FROM products
          WHERE is_active = true
            AND product_key = ${productKey}
          ORDER BY name ASC
        `
      : await sql`
          SELECT id, product_key, name, description, price, currency
          FROM products
          WHERE is_active = true
          ORDER BY name ASC
        `;

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '2rem',
        background: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0, color: '#111827' }}>Payment</h1>

        <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
          Confirm your selection and continue to the available payment options.
        </p>

        {checkoutIntent && !intentError ? (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#1e3a8a',
            }}
          >
            <strong>Access prepared for:</strong>{' '}
            {checkoutIntent.full_name || checkoutIntent.email}
          </div>
        ) : null}

        {intentError ? (
          <div
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Checkout session unavailable</h2>
            <p style={{ color: '#4b5563' }}>{intentError}</p>
            <a
              href="https://www.seersapp.com/awc"
              style={{
                display: 'inline-block',
                marginTop: '1rem',
                padding: '0.8rem 1.15rem',
                borderRadius: '10px',
                background: '#111827',
                color: 'white',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Start Again
            </a>
          </div>
        ) : products.length === 0 ? (
          <div
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Product not found</h2>
            <p style={{ color: '#4b5563' }}>
              The selected product is unavailable or inactive.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {products.map((product: any) => (
              <div
                key={product.id}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.06)',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    marginBottom: '0.5rem',
                    fontSize: '0.85rem',
                    color: '#2563eb',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Seers Academy
                </p>

                <h2
                  style={{
                    marginTop: 0,
                    marginBottom: '0.75rem',
                    color: '#111827',
                    fontSize: '1.6rem',
                  }}
                >
                  {product.name}
                </h2>

                <p
                  style={{
                    color: '#4b5563',
                    lineHeight: 1.6,
                    marginBottom: '1.25rem',
                  }}
                >
                  {product.description || 'No description available.'}
                </p>

                <p
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: '#111827',
                    marginBottom: '1.5rem',
                  }}
                >
                  {formatPrice(product.currency, product.price)}
                </p>

                <form action={startCheckout}>
                  <input type="hidden" name="productId" value={product.id} />
                  {intentId ? (
                    <input type="hidden" name="checkoutIntentId" value={intentId} />
                  ) : null}

                  <button
                    type="submit"
                    style={{
                      padding: '0.8rem 1.15rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#111827',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '1rem',
                    }}
                  >
                    Payment Options
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}