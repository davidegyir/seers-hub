import { NextRequest, NextResponse } from 'next/server';
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

function normalizePayload(rawText: string) {
  try {
    return JSON.parse(rawText);
  } catch {
    const params = new URLSearchParams(rawText);
    const asObject: Record<string, string> = {};

    for (const [key, value] of params.entries()) {
      asObject[key] = value;
    }

    return asObject;
  }
}

function normalizePaymentMethod(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
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
      ${'tx_ref=' + params.txRef + '; tx_id=' + params.transactionId + '; wp_user_id=' + String(enrollment.user_id)}
    )
  `;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/flutterwave/webhook',
    message: 'Flutterwave webhook route is active. Use POST for real webhooks.',
  });
}

export async function POST(req: NextRequest) {
  try {
    console.log('🟢 WEBHOOK ROUTE HIT');

    const secretHash =
      process.env.FLW_WEBHOOK_SECRET || process.env.FLW_WEBHOOK_SECRET_HASH;

    const signature = req.headers.get('verif-hash');

    if (!secretHash) {
      return NextResponse.json(
        { error: 'Webhook secret is not configured' },
        { status: 500 }
      );
    }

    if (!signature || signature !== secretHash) {
      console.error('❌ Invalid Flutterwave webhook signature', {
        received: signature,
        expectedExists: Boolean(secretHash),
      });

      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const rawText = await req.text();
    const payload = normalizePayload(rawText);

    const event =
      payload?.event ||
      payload?.['event.type'] ||
      payload?.event_type ||
      payload?.type;

    const transactionId =
      payload?.data?.id ||
      payload?.id ||
      payload?.transaction_id ||
      payload?.transactionId;

    const paymentStatus = payload?.data?.status || payload?.status;

    console.log('📌 Normalized webhook data:', {
      event,
      transactionId,
      paymentStatus,
    });

    const isPotentialPaymentEvent =
      event === 'charge.completed' ||
      event === 'CARD_TRANSACTION' ||
      paymentStatus === 'successful';

    if (!isPotentialPaymentEvent) {
      return NextResponse.json({
        ok: true,
        message: 'Webhook event ignored',
        event,
      });
    }

    if (!transactionId) {
      return NextResponse.json({
        ok: true,
        message: 'Webhook missing transaction ID',
      });
    }

    let verified: any;

    try {
      verified = await verifyFlutterwaveTransactionWithTimeout(
        String(transactionId)
      );
    } catch (verificationError) {
      console.error('⏱️ Flutterwave verification failed:', verificationError);

      return NextResponse.json(
        {
          ok: false,
          error: 'Flutterwave verification unavailable',
        },
        { status: 503 }
      );
    }

    const txRef = verified.tx_ref;
    const paymentMethod = getPaymentMethod(verified);
    const chargeResponseCode = getChargeResponseCode(verified);

    console.log('✅ Flutterwave verification result:', {
      status: verified.status,
      txRef,
      amount: verified.amount,
      currency: verified.currency,
      paymentMethod,
      chargeResponseCode,
    });

    if (!txRef) {
      return NextResponse.json({
        ok: true,
        message: 'Verified transaction has no tx_ref',
      });
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
      return NextResponse.json({
        ok: true,
        message: 'Order not found for webhook tx_ref',
        txRef,
      });
    }

    if (order.flutterwave_tx_id === String(transactionId)) {
      return NextResponse.json({
        ok: true,
        message: 'Duplicate webhook ignored',
        orderId: order.id,
      });
    }

    if (order.status === 'paid') {
      return NextResponse.json({
        ok: true,
        message: 'Order already processed',
        orderId: order.id,
      });
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

    const isValidForAutoApproval =
      statusSuccessful &&
      txRefMatches &&
      amountMatches &&
      currencyMatches &&
      chargeCodeAcceptable &&
      isSafeAutoApproveMethod &&
      !isUnsafeManualMethod;

    if (!isValidForAutoApproval) {
      await sql`
        INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
        VALUES (
          NULL,
          ${order.user_id},
          'payment_auto_approval_rejected',
          ${order.status},
          'not_approved',
          ${JSON.stringify({
            source: 'webhook',
            transactionId,
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
          })}
        )
      `;

      console.error('❌ Payment rejected for auto-approval:', {
        txRef,
        transactionId,
        paymentMethod,
        status: verified.status,
      });

      return NextResponse.json({
        ok: true,
        message:
          'Payment received but not auto-approved. Manual review may be required.',
        orderId: order.id,
        paymentMethod,
      });
    }

    await sql`
      UPDATE orders
      SET status = 'paid',
          flutterwave_tx_id = ${String(transactionId)},
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
        'payment_verified_by_flutterwave_webhook',
        ${order.status},
        'paid',
        ${'tx_ref=' + verified.tx_ref + '; tx_id=' + String(transactionId) + '; method=' + paymentMethod}
      )
    `;

    await applyProductAccess({
      actorUserId: null,
      targetUserId: order.user_id,
      productId: order.product_id,
      reason: 'flutterwave verified webhook',
    });

    try {
      await tryEnrollAwcUser({
        userId: order.user_id,
        orderId: order.id,
        productKey: order.product_key,
        txRef,
        transactionId: String(transactionId),
      });
    } catch (enrollmentError) {
      console.error('❌ LearnDash enrollment failed:', enrollmentError);

      await sql`
        INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
        VALUES (
          NULL,
          ${order.user_id},
          'learndash_enrollment_failed',
          NULL,
          ${'product_key=' + order.product_key},
          ${String(enrollmentError)}
        )
      `;
    }

    return NextResponse.json({
      ok: true,
      message: 'Webhook processed successfully',
      orderId: order.id,
    });
  } catch (error) {
    console.error('🔥 Flutterwave webhook error:', error);

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}