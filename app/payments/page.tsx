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

    redirect(`/sign-up?redirect_url=${encodeURIComponent(redirectTarget)}`);
  }

  const userRows = await sql`
    SELECT status
    FROM users
    WHERE clerk_user_id = ${userId}
    LIMIT 1
  `;

  const user = userRows[0];

  if (!user) {
    redirect('/sign-up');
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
      intentError =
        'Checkout intent expired. Please start again from the registration page.';
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
        padding: '3rem 1.5rem',
        background:
          'radial-gradient(circle at top left, rgba(59,130,246,0.28), transparent 32%), radial-gradient(circle at bottom right, rgba(245,158,11,0.18), transparent 30%), linear-gradient(135deg, #0b1224 0%, #111827 48%, #172554 100%)',
        fontFamily: 'Arial, sans-serif',
        color: 'white',
      }}
    >
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <div
          style={{
            textAlign: 'center',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '0.45rem 1rem',
              borderRadius: '999px',
              background: 'rgba(96,165,250,0.18)',
              color: '#bfdbfe',
              fontWeight: 800,
              fontSize: '0.85rem',
              letterSpacing: '0.04em',
              border: '1px solid rgba(147,197,253,0.35)',
              marginBottom: '1rem',
            }}
          >
            Secure Enrollment Portal
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '2.6rem',
              color: '#ffffff',
              letterSpacing: '-0.04em',
            }}
          >
            Complete Your Enrollment
          </h1>

          <p
            style={{
              color: '#dbeafe',
              marginTop: '1rem',
              fontSize: '1.05rem',
              lineHeight: 1.7,
              maxWidth: '760px',
              marginInline: 'auto',
            }}
          >
            Secure your access instantly after payment. Your enrollment includes
            immediate access to the AWC Masterclass, protected masterclass
            delivery, and seamless login into the Seers learning ecosystem.
          </p>
        </div>

        {checkoutIntent && !intentError ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(14px)',
              border: '1px solid rgba(147,197,253,0.35)',
              borderRadius: '18px',
              padding: '1rem 1.2rem',
              marginBottom: '2rem',
              color: '#dbeafe',
              boxShadow: '0 10px 30px rgba(0,0,0,0.16)',
            }}
          >
            <strong>Enrollment prepared for:</strong>{' '}
            {checkoutIntent.full_name || checkoutIntent.email}
          </div>
        ) : null}

        {intentError ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.96)',
              borderRadius: '24px',
              padding: '2rem',
              border: '1px solid rgba(226,232,240,0.9)',
              textAlign: 'center',
              color: '#0f172a',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Checkout session unavailable</h2>

            <p style={{ color: '#64748b', lineHeight: 1.7 }}>
              {intentError}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.15fr 0.85fr',
              gap: '2rem',
              alignItems: 'start',
            }}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(14px)',
                borderRadius: '30px',
                padding: '2rem',
                border: '1px solid rgba(226,232,240,0.9)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.22)',
                color: '#0f172a',
              }}
            >
              {products.map((product: any) => (
                <div key={product.id}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1.5rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#2563eb',
                          fontWeight: 800,
                          letterSpacing: '0.07em',
                          textTransform: 'uppercase',
                          marginBottom: '0.4rem',
                        }}
                      >
                        ACHIEVERS WEALTH CREATION SERIES | AWC
                      </div>

                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: '#64748b',
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          marginBottom: '0.65rem',
                        }}
                      >
                        Seers Academy
                      </div>

                      <h2
                        style={{
                          margin: 0,
                          fontSize: '2rem',
                          lineHeight: 1.18,
                          color: '#0f172a',
                        }}
                      >
                        {product.name}
                      </h2>
                    </div>

                    <div
                      style={{
                        textAlign: 'right',
                        minWidth: 150,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.9rem',
                          color: '#64748b',
                          marginBottom: '0.35rem',
                        }}
                      >
                        Enrollment Fee
                      </div>

                      <div
                        style={{
                          fontSize: '2rem',
                          fontWeight: 900,
                          color: '#0f172a',
                          lineHeight: 1.05,
                        }}
                      >
                        {formatPrice(product.currency, product.price)}
                      </div>
                    </div>
                  </div>

                  <p
                    style={{
                      color: '#475569',
                      lineHeight: 1.8,
                      marginBottom: '1.8rem',
                    }}
                  >
                    {product.description ||
                      'A transformative masterclass designed to help you reduce operating cost, improve productivity, and increase profitability without hiring more people.'}
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '1rem',
                      marginBottom: '2rem',
                    }}
                  >
                    {[
                      'Instant Access After Payment',
                      'Secure Enrollment & Delivery',
                      'Protected Learning Portal',
                      'Lifetime Access to Masterclass',
                    ].map((item) => (
                      <div
                        key={item}
                        style={{
                          background: '#f8fafc',
                          borderRadius: '14px',
                          padding: '0.9rem 1rem',
                          border: '1px solid #e2e8f0',
                          color: '#334155',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                        }}
                      >
                        ✓ {item}
                      </div>
                    ))}
                  </div>

                  <form action={startCheckout}>
                    <input
                      type="hidden"
                      name="productId"
                      value={product.id}
                    />

                    {intentId ? (
                      <input
                        type="hidden"
                        name="checkoutIntentId"
                        value={intentId}
                      />
                    ) : null}

                    <div style={{ marginBottom: '1.2rem' }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.7rem',
                          fontWeight: 800,
                          color: '#334155',
                        }}
                      >
                        Optional: Have a special rate code?
                      </label>

                      <input
                        type="text"
                        name="discountCode"
                        placeholder="Enter your code here if you have one"
                        style={{
                          width: '100%',
                          padding: '1rem',
                          borderRadius: '14px',
                          border: '1px solid #cbd5e1',
                          fontSize: '1rem',
                          boxSizing: 'border-box',
                          background: '#ffffff',
                          color: '#0f172a',
                        }}
                      />

                      <div
                        style={{
                          marginTop: '0.6rem',
                          color: '#64748b',
                          fontSize: '0.9rem',
                        }}
                      >
                        Discounted enrollments are applied instantly before
                        payment.
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        padding: '1rem 1.2rem',
                        borderRadius: '16px',
                        border: 'none',
                        background:
                          'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 900,
                        fontSize: '1rem',
                        boxShadow: '0 18px 35px rgba(15,23,42,0.22)',
                      }}
                    >
                      Continue to Secure Payment
                    </button>
                  </form>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gap: '1.5rem',
              }}
            >
              <div
                style={{
                  background: 'rgba(255,255,255,0.96)',
                  backdropFilter: 'blur(14px)',
                  borderRadius: '24px',
                  padding: '1.5rem',
                  border: '1px solid rgba(226,232,240,0.9)',
                  boxShadow: '0 20px 55px rgba(0,0,0,0.18)',
                  color: '#0f172a',
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    marginBottom: '1rem',
                    fontSize: '1.1rem',
                  }}
                >
                  Secure & Trusted Checkout
                </div>

                <div
                  style={{
                    color: '#475569',
                    lineHeight: 1.8,
                    fontSize: '0.96rem',
                  }}
                >
                  Your payment is securely processed through Flutterwave. Access
                  is granted automatically immediately after successful payment.
                </div>
              </div>

              <div
                style={{
                  background:
                    'linear-gradient(135deg, rgba(239,246,255,0.98) 0%, rgba(219,234,254,0.98) 100%)',
                  borderRadius: '24px',
                  padding: '1.5rem',
                  border: '1px solid #bfdbfe',
                  boxShadow: '0 20px 55px rgba(0,0,0,0.15)',
                  color: '#0f172a',
                }}
              >
                <div
                  style={{
                    color: '#1e3a8a',
                    fontWeight: 900,
                    marginBottom: '0.8rem',
                    fontSize: '1.05rem',
                  }}
                >
                  Participant Feedback
                </div>

                <div
                  style={{
                    color: '#334155',
                    lineHeight: 1.8,
                    fontStyle: 'italic',
                    marginBottom: '1rem',
                  }}
                >
                  “One of the most practical and transformative business
                  trainings I’ve experienced. The frameworks alone paid for the
                  enrollment.”
                </div>

                <div
                  style={{
                    color: '#1e3a8a',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                  }}
                >
                  — AWC Masterclass Participant
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15,23,42,0.92)',
                  color: 'white',
                  borderRadius: '24px',
                  padding: '1.5rem',
                  border: '1px solid rgba(148,163,184,0.28)',
                  boxShadow: '0 20px 55px rgba(0,0,0,0.25)',
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    marginBottom: '0.8rem',
                    fontSize: '1.1rem',
                  }}
                >
                  Instant Masterclass Access
                </div>

                <div
                  style={{
                    lineHeight: 1.8,
                    color: 'rgba(255,255,255,0.9)',
                  }}
                >
                  Once payment is successful, your access is activated
                  automatically and you can proceed into the masterclass
                  environment.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}