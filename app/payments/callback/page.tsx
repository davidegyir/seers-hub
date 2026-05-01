import Link from 'next/link';
import { sql } from '@/lib/db';
import { verifyFlutterwaveTransaction } from '@/lib/flutterwave';
import { applyProductAccess } from '@/lib/product-access';

type SearchParams = Promise<{
  status?: string;
  transaction_id?: string;
  tx_ref?: string;
}>;

export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const status = params.status;
  const transactionId = params.transaction_id;
  const txRef = params.tx_ref;

  if (!transactionId || !txRef) {
    return (
      <main style={pageStyle}>
        <h1>Payment Not Verified</h1>
        <p>Missing payment reference details. Please contact support if you were charged.</p>
        <Link href="/payments">Return to payments</Link>
      </main>
    );
  }

  if (status !== 'successful' && status !== 'completed') {
    return (
      <main style={pageStyle}>
        <h1>Payment Not Completed</h1>
        <p>Your payment was not completed successfully.</p>
        <Link href="/payments">Try again</Link>
      </main>
    );
  }

  const orderRows = await sql`
    SELECT
      orders.id,
      orders.user_id,
      orders.product_id,
      orders.status,
      orders.payment_reference,
      products.price,
      products.currency,
      products.name AS product_name
    FROM orders
    INNER JOIN products ON orders.product_id = products.id
    WHERE orders.payment_reference = ${txRef}
    LIMIT 1
  `;

  const order = orderRows[0];

  if (!order) {
    return (
      <main style={pageStyle}>
        <h1>Order Not Found</h1>
        <p>
          Payment reference was received, but no matching order was found in Seers Hub.
        </p>
        <p>Reference: {txRef}</p>
        <Link href="/payments">Return to payments</Link>
      </main>
    );
  }

  if (order.status === 'paid') {
    return (
      <main style={pageStyle}>
        <h1>Payment Already Confirmed</h1>
        <p>Your payment has already been verified and access has already been granted.</p>
        <Link href="/dashboard">Go to dashboard</Link>
      </main>
    );
  }

  try {
    const verified = await verifyFlutterwaveTransaction(transactionId);

    const expectedAmount = Number(order.price);
    const actualAmount = Number(verified.amount);

    const isValid =
      verified.status === 'successful' &&
      verified.tx_ref === order.payment_reference &&
      actualAmount === expectedAmount &&
      verified.currency === order.currency;

    if (!isValid) {
      await sql`
        INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
        VALUES (
          NULL,
          ${order.user_id},
          'payment_verification_failed',
          ${order.status},
          'rejected',
          ${JSON.stringify({
            source: 'callback',
            transactionId,
            expectedTxRef: order.payment_reference,
            actualTxRef: verified.tx_ref,
            expectedAmount,
            actualAmount,
            expectedCurrency: order.currency,
            actualCurrency: verified.currency,
            actualStatus: verified.status,
          })}
        )
      `;

      return (
        <main style={pageStyle}>
          <h1>Payment Verification Failed</h1>
          <p>
            Flutterwave returned a payment result, but the verified transaction details
            did not match your order.
          </p>
          <p>Please contact support if you were charged.</p>
          <Link href="/payments">Return to payments</Link>
        </main>
      );
    }

    await sql`
      UPDATE orders
      SET status = 'paid',
          flutterwave_tx_id = ${String(transactionId)},
          updated_at = NOW()
      WHERE id = ${order.id}
    `;

    await sql`
      INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
      VALUES (
        NULL,
        ${order.user_id},
        'payment_verified_by_flutterwave_callback',
        ${order.status},
        'paid',
        ${'tx_ref=' + verified.tx_ref + '; tx_id=' + String(transactionId)}
      )
    `;

    await applyProductAccess({
      actorUserId: null,
      targetUserId: order.user_id,
      productId: order.product_id,
      reason: 'flutterwave verified callback',
    });

    return (
      <main style={pageStyle}>
        <h1>Payment Confirmed</h1>
        <p>Your payment for {order.product_name} has been verified.</p>
        <p>Your access has now been granted.</p>
        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
          <Link href="/dashboard">Go to dashboard</Link>
          <Link href="/premium">Go to premium area</Link>
        </div>
      </main>
    );
  } catch (error) {
    console.error('Payment callback verification error:', error);

    await sql`
      INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
      VALUES (
        NULL,
        ${order.user_id},
        'payment_verification_failed',
        ${order.status},
        'error',
        ${'callback verification error for tx_ref=' + txRef}
      )
    `;

    return (
      <main style={pageStyle}>
        <h1>Payment Verification Error</h1>
        <p>
          Your payment result was received, but the system could not verify it at this moment.
        </p>
        <p>Please contact support if you were charged.</p>
        <Link href="/payments">Return to payments</Link>
      </main>
    );
  }
}

const pageStyle = {
  padding: '2rem',
  fontFamily: 'Arial, sans-serif',
};