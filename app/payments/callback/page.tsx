import Link from 'next/link';
import { sql } from '@/lib/db';
import { verifyFlutterwaveTransaction } from '@/lib/flutterwave';
import { applyProductAccess } from '@/lib/product-access';
import { enrollUserInLearnDash } from '@/lib/learndash-bridge';

export const dynamic = 'force-dynamic';

const SAFE_AUTO_APPROVE_METHODS = new Set([
  'card',
  'mobilemoney',
  'mobile_money',
  'mobile money',
  'momo',
  'ussd',
]);

const UNSAFE_MANUAL_METHODS = new Set([
  'bank',
  'banktransfer',
  'bank_transfer',
  'bank transfer',
  'bankdeposit',
  'bank_deposit',
  'bank deposit',
  'account',
]);

type CallbackSearchParams = Promise<{
  status?: string;
  transaction_id?: string;
  tx_ref?: string;
}>;

function normalizePaymentMethod(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/-/g, '_');
}

function getPaymentMethod(verified: any) {
  return normalizePaymentMethod(
    verified?.payment_type ||
      verified?.paymentType ||
      verified?.payment_method ||
      verified?.paymentMethod ||
      verified?.data?.payment_type ||
      verified?.data?.payment_method ||
      verified?.meta?.payment_type
  );
}

function getChargeResponseCode(verified: any) {
  return String(
    verified?.charge_response_code ||
      verified?.chargeResponseCode ||
      verified?.processor_response_code ||
      verified?.data?.charge_response_code ||
      ''
  ).trim();
}

function allowTestAutoApprove() {
  return process.env.ALLOW_PAYMENT_TEST_AUTO_APPROVE === 'true';
}

async function verifyFlutterwaveTransactionWithTimeout(transactionId: string) {
  return Promise.race([
    verifyFlutterwaveTransaction(transactionId),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Flutterwave verification timeout')),
        10000
      )
    ),
  ]);
}

async function tryEnrollAwcUser(params: {
  userId: string;
  orderId: string;
  productKey: string;
  txRef: string;
  transactionId: string;
}) {
  if (params.productKey !== 'awc') return;

  const courseId = process.env.LEARNDASH_AWC_COURSE_ID;

  if (!courseId) {
    throw new Error('LEARNDASH_AWC_COURSE_ID is not configured');
  }

  const userRows = await sql`
    SELECT email, full_name
    FROM users
    WHERE id = ${params.userId}
    LIMIT 1
  `;

  const user = userRows[0];

  if (!user?.email) {
    throw new Error('User email not found for LearnDash enrollment');
  }

  const enrollment = await enrollUserInLearnDash({
    email: user.email,
    fullName: user.full_name,
    courseId,
    orderId: params.orderId,
    txRef: params.txRef,
  });

  await sql`
    INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
    VALUES (
      NULL,
      ${params.userId},
      'learndash_enrollment_completed',
      NULL,
      ${'course_id=' + String(courseId)},
      ${'source=callback; tx_ref=' + params.txRef + '; tx_id=' + params.transactionId + '; wp_user_id=' + String(enrollment.user_id)}
    )
  `;
}

async function processCallback(params: {
  transactionId?: string;
  txRefFromUrl?: string;
}) {
  if (!params.transactionId) {
    return {
      ok: false,
      title: 'Payment Could Not Be Verified',
      message:
        'No transaction reference was received. Please contact support if you believe payment was completed.',
      actionLabel: 'Return to Payment',
      actionHref: '/payments?product=awc',
    };
  }

  let verified: any;

  try {
    verified = await verifyFlutterwaveTransactionWithTimeout(
      params.transactionId
    );
  } catch (error) {
    console.error('Callback verification failed:', error);

    return {
      ok: false,
      title: 'Verification Temporarily Unavailable',
      message:
        'Your payment response was received, but verification could not be completed. Please try again shortly or contact support.',
      actionLabel: 'Return to Dashboard',
      actionHref: '/dashboard',
    };
  }

  const txRef = verified?.tx_ref || params.txRefFromUrl;
  const paymentMethod = getPaymentMethod(verified);
  const chargeResponseCode = getChargeResponseCode(verified);
  const testAutoApproveEnabled = allowTestAutoApprove();

  if (!txRef) {
    return {
      ok: false,
      title: 'Payment Reference Missing',
      message:
        'The transaction was checked, but no payment reference was found.',
      actionLabel: 'Return to Payment',
      actionHref: '/payments?product=awc',
    };
  }

  const orderRows = await sql`
    SELECT
      orders.id,
      orders.user_id,
      orders.product_id,
      orders.status,
      orders.payment_reference,
      orders.flutterwave_tx_id,
      products.product_key,
      products.price,
      products.currency
    FROM orders
    INNER JOIN products ON orders.product_id = products.id
    WHERE orders.payment_reference = ${txRef}
    LIMIT 1
  `;

  const order = orderRows[0];

  if (!order) {
    return {
      ok: false,
      title: 'Order Not Found',
      message:
        'The payment reference was received, but no matching order was found.',
      actionLabel: 'Return to Payment',
      actionHref: '/payments?product=awc',
    };
  }

  if (order.status === 'paid') {
    return {
      ok: true,
      title: 'Payment Already Confirmed',
      message: 'Your payment has already been verified and access granted.',
      actionLabel: 'Go to Course',
      actionHref:
        'https://www.seersapp.com/academy/how-to-reduce-operating-cost-and-increase-productivity-profitability-without-hiring-more-people/',
    };
  }

  const expectedAmount = Number(order.price);
  const actualAmount = Number(verified.amount);

  const amountMatches = actualAmount === expectedAmount;
  const currencyMatches = verified.currency === order.currency;
  const txRefMatches = verified.tx_ref === order.payment_reference;
  const statusSuccessful = verified.status === 'successful';

  const chargeCodeAcceptable =
    chargeResponseCode === '' ||
    chargeResponseCode === '00' ||
    chargeResponseCode === '0';

  const isUnsafeManualMethod = UNSAFE_MANUAL_METHODS.has(paymentMethod);
  const isSafeAutoApproveMethod = SAFE_AUTO_APPROVE_METHODS.has(paymentMethod);

  const strictAutoApproval =
    statusSuccessful &&
    txRefMatches &&
    amountMatches &&
    currencyMatches &&
    chargeCodeAcceptable &&
    isSafeAutoApproveMethod &&
    !isUnsafeManualMethod;

  const testModeAutoApproval =
    testAutoApproveEnabled &&
    statusSuccessful &&
    txRefMatches &&
    amountMatches &&
    currencyMatches &&
    chargeCodeAcceptable;

  const isValidForAutoApproval = strictAutoApproval || testModeAutoApproval;

  if (!isValidForAutoApproval) {
    await sql`
      INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
      VALUES (
        NULL,
        ${order.user_id},
        'payment_callback_auto_approval_rejected',
        ${order.status},
        'not_approved',
        ${JSON.stringify({
          source: 'callback',
          transactionId: params.transactionId,
          txRef,
          status: verified.status,
          paymentMethod,
          chargeResponseCode,
          expectedAmount,
          actualAmount,
          expectedCurrency: order.currency,
          actualCurrency: verified.currency,
          txRefMatches,
          amountMatches,
          currencyMatches,
          statusSuccessful,
          chargeCodeAcceptable,
          isSafeAutoApproveMethod,
          isUnsafeManualMethod,
          testAutoApproveEnabled,
        })}
      )
    `;

    return {
      ok: false,
      title: 'Payment Requires Review',
      message:
        'This payment method cannot be automatically approved. If you used bank transfer or deposit, access will be granted after confirmation.',
      actionLabel: 'Return to Dashboard',
      actionHref: '/dashboard',
    };
  }

  await sql`
    UPDATE orders
    SET status = 'paid',
        flutterwave_tx_id = ${String(params.transactionId)},
        payment_verified_at = NOW(),
        payment_provider = 'flutterwave',
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
      ${'tx_ref=' + verified.tx_ref + '; tx_id=' + String(params.transactionId) + '; method=' + paymentMethod + '; test_auto_approve=' + String(testAutoApproveEnabled)}
    )
  `;

  await applyProductAccess({
    actorUserId: null,
    targetUserId: order.user_id,
    productId: order.product_id,
    reason: 'flutterwave verified callback',
  });

  try {
    await tryEnrollAwcUser({
      userId: order.user_id,
      orderId: order.id,
      productKey: order.product_key,
      txRef,
      transactionId: String(params.transactionId),
    });
  } catch (error) {
    console.error('LearnDash callback enrollment failed:', error);

    await sql`
      INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
      VALUES (
        NULL,
        ${order.user_id},
        'learndash_enrollment_failed',
        NULL,
        ${'product_key=' + order.product_key},
        ${'source=callback; ' + String(error)}
      )
    `;
  }

  return {
    ok: true,
    title: 'Payment Confirmed',
    message: 'Your payment has been verified and access has been granted.',
    actionLabel: 'Go to Course',
    actionHref:
      'https://www.seersapp.com/academy/how-to-reduce-operating-cost-and-increase-productivity-profitability-without-hiring-more-people/',
  };
}

export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: CallbackSearchParams;
}) {
  const params = await searchParams;

  const result = await processCallback({
    transactionId: params.transaction_id,
    txRefFromUrl: params.tx_ref,
  });

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        padding: '2rem',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 620,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 18,
          padding: '2rem',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '999px',
            margin: '0 auto 1rem',
            display: 'grid',
            placeItems: 'center',
            background: result.ok ? '#dcfce7' : '#fef3c7',
            color: result.ok ? '#166534' : '#92400e',
            fontSize: '1.5rem',
            fontWeight: 800,
          }}
        >
          {result.ok ? '✓' : '!'}
        </div>

        <h1 style={{ color: '#111827', marginBottom: '0.75rem' }}>
          {result.title}
        </h1>

        <p style={{ color: '#4b5563', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {result.message}
        </p>

        <Link
          href={result.actionHref}
          style={{
            display: 'inline-block',
            padding: '0.8rem 1.2rem',
            borderRadius: 10,
            background: result.ok ? '#16a34a' : '#111827',
            color: 'white',
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          {result.actionLabel}
        </Link>
      </section>
    </main>
  );
}
