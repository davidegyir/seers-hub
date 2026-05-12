import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

import { createFlutterwaveCheckout } from '@/lib/flutterwave';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      userId,
      productKey,
      amount,
      discountCode,
      currency = 'GHS',
    } = body;

    // Step 1: Initialize checkout in Neon
    const result = await sql`
      SELECT *
      FROM initialize_checkout(
        ${userId}::uuid,
        ${productKey}::text,
        ${amount}::numeric,
        ${discountCode || null}::text,
        ${currency}::text
      )
    `;

    const checkout = result[0];

    if (!checkout?.success) {
      return NextResponse.json(
        {
          success: false,
          message: checkout?.message || 'Checkout initialization failed.',
        },
        { status: 400 }
      );
    }

    // Step 2: Free checkout
    if (Number(checkout.final_amount) === 0) {
      return NextResponse.json({
        success: true,
        freeCheckout: true,
        checkout,
      });
    }

    // Step 3: Create Flutterwave checkout
    const paymentLink = await createFlutterwaveCheckout({
      amount: Number(checkout.final_amount),
      currency: checkout.currency,
      txRef: checkout.payment_reference,
      email: checkout.customer_email,
      name: checkout.customer_name,
      title: `Seers Purchase - ${checkout.product_key}`,
      description: `Payment for ${checkout.product_key}`,
    });

    return NextResponse.json({
      success: true,
      freeCheckout: false,
      paymentLink,
      checkout,
    });
  } catch (error) {
    console.error('Initialize payment error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error.',
      },
      { status: 500 }
    );
  }
}