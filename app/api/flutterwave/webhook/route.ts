import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyFlutterwaveTransaction } from '@/lib/flutterwave';
import { applyProductAccess } from '@/lib/product-access';

export const dynamic = 'force-dynamic';

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

async function verifyFlutterwaveTransactionWithTimeout(transactionId: string) {
  return Promise.race([
    verifyFlutterwaveTransaction(transactionId),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Flutterwave verification timeout')), 10000)
    ),
  ]);
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
      console.error('❌ Webhook secret is not configured');
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

    console.log('📦 Raw webhook body:', rawText);
    console.log('📩 Parsed webhook payload:', payload);

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

    const paymentStatus =
      payload?.data?.status ||
      payload?.status;

    console.log('📌 Normalized webhook data:', {
      event,
      transactionId,
      paymentStatus,
    });

    const isSuccessfulPaymentEvent =
      paymentStatus === 'successful' &&
      (event === 'charge.completed' || event === 'CARD_TRANSACTION');

    if (!isSuccessfulPaymentEvent) {
      console.log('ℹ️ Ignored webhook event:', event);

      return NextResponse.json({
        ok: true,
        message: 'Webhook event ignored',
        event,
      });
    }

    if (!transactionId) {
      console.error('❌ Missing transaction ID');

      return NextResponse.json({
        ok: true,
        message: 'Webhook missing transaction ID',
      });
    }

    let verified;

    try {
      verified = await verifyFlutterwaveTransactionWithTimeout(String(transactionId));
    } catch (verificationError) {
      console.error('⏱️ Flutterwave verification timed out or failed:', verificationError);

      return NextResponse.json(
        {
          ok: false,
          error: 'Flutterwave verification unavailable',
          message:
            'Webhook was received, but transaction verification did not complete in time.',
        },
        { status: 503 }
      );
    }

    console.log('✅ Flutterwave transaction verification result:', {
      verifiedStatus: verified.status,
      verifiedTxRef: verified.tx_ref,
      verifiedAmount: verified.amount,
      verifiedCurrency: verified.currency,
    });

    const txRef = verified.tx_ref;

    if (!txRef) {
      console.error('❌ Verified transaction has no tx_ref');

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
        products.price,
        products.currency
      FROM orders
      INNER JOIN products ON orders.product_id = products.id
      WHERE orders.payment_reference = ${txRef}
      LIMIT 1
    `;

    const order = orderRows[0];

    if (!order) {
      console.error('❌ Webhook order not found for tx_ref:', txRef);

      return NextResponse.json({
        ok: true,
        message: 'Order not found for webhook tx_ref',
        txRef,
      });
    }

    if (order.flutterwave_tx_id === String(transactionId)) {
      console.log('⚠️ Duplicate webhook ignored:', {
        orderId: order.id,
        txRef,
        transactionId,
      });

      return NextResponse.json({
        ok: true,
        message: 'Duplicate webhook ignored',
        orderId: order.id,
      });
    }

    if (order.status === 'paid') {
      console.log('ℹ️ Order already paid; webhook ignored:', {
        orderId: order.id,
        txRef,
        existingFlutterwaveTxId: order.flutterwave_tx_id,
        incomingTransactionId: transactionId,
      });

      return NextResponse.json({
        ok: true,
        message: 'Order already processed',
        orderId: order.id,
      });
    }

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
            source: 'webhook',
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

      console.error('❌ Webhook verification mismatch');

      return NextResponse.json(
        { error: 'Transaction verification mismatch' },
        { status: 400 }
      );
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
        ${'tx_ref=' + verified.tx_ref + '; tx_id=' + String(transactionId)}
      )
    `;

    await applyProductAccess({
      actorUserId: null,
      targetUserId: order.user_id,
      productId: order.product_id,
      reason: 'flutterwave verified webhook',
    });

    console.log('✅ Flutterwave webhook processed successfully:', {
      orderId: order.id,
      txRef,
      transactionId,
    });

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