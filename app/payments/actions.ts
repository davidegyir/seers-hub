'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { createFlutterwaveCheckout } from '@/lib/flutterwave';
import { applyProductAccess } from '@/lib/product-access';

export async function startCheckout(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-up');
  }

  const productId = formData.get('productId')?.toString();
  const checkoutIntentId = formData.get('checkoutIntentId')?.toString();
  const discountCode = formData.get('discountCode')?.toString().trim() || null;

  if (!productId) {
    throw new Error('Missing product');
  }

  const userRows = await sql`
    SELECT id, email, full_name, status
    FROM users
    WHERE clerk_user_id = ${userId}
    LIMIT 1
  `;

  const user = userRows[0];

  if (!user) {
    throw new Error('User not found');
  }

  if (user.status === 'suspended') {
    throw new Error('Suspended users cannot start checkout');
  }

  const productRows = await sql`
    SELECT id, product_key, name, description, price, currency, is_active
    FROM products
    WHERE id = ${productId}
    LIMIT 1
  `;

  const product = productRows[0];

  if (!product || !product.is_active) {
    throw new Error('Product not available');
  }

  let checkoutIntent = null;

  if (checkoutIntentId) {
    const intentRows = await sql`
      SELECT id, email, product_slug, status, expires_at
      FROM checkout_intents
      WHERE id = ${checkoutIntentId}
      LIMIT 1
    `;

    checkoutIntent = intentRows[0];

    if (!checkoutIntent) {
      throw new Error('Checkout intent not found');
    }

    if (new Date(checkoutIntent.expires_at) < new Date()) {
      throw new Error('Checkout intent expired');
    }

    if (checkoutIntent.product_slug !== product.product_key) {
      throw new Error('Checkout intent does not match selected product');
    }
  }

  const originalAmount = Number(product.price);
  let discountAmount = 0;
  let finalAmount = originalAmount;

  if (discountCode) {
    const discountRows = await sql`
      SELECT *
      FROM validate_discount_code(
        ${discountCode}::text,
        ${product.product_key}::text,
        ${originalAmount}::numeric
      )
    `;

    const discount = discountRows[0];

    if (discount?.valid) {
      discountAmount = Number(discount.discount_amount || 0);
      finalAmount = Number(discount.final_amount || originalAmount);
    }
  }

  const orderRows = await sql`
    INSERT INTO orders (
      user_id,
      product_id,
      checkout_intent_id,
      status,
      original_amount,
      discount_amount,
      final_amount,
      currency,
      discount_code,
      created_at,
      updated_at
    )
    VALUES (
      ${user.id},
      ${product.id},
      ${checkoutIntentId || null},
      ${finalAmount === 0 ? 'paid' : 'pending'},
      ${originalAmount},
      ${discountAmount},
      ${finalAmount},
      ${product.currency},
      ${discountCode},
      NOW(),
      NOW()
    )
    RETURNING id
  `;

  const order = orderRows[0];
  const txRef = `SEERS-${order.id}`;

  await sql`
    UPDATE orders
    SET payment_reference = ${txRef}, updated_at = NOW()
    WHERE id = ${order.id}
  `;

  if (checkoutIntentId) {
    await sql`
      UPDATE checkout_intents
      SET
        order_id = ${order.id},
        status = ${finalAmount === 0 ? 'completed' : 'checkout_started'},
        updated_at = NOW()
      WHERE id = ${checkoutIntentId}
    `;
  }

  if (finalAmount === 0) {
    await applyProductAccess({
      actorUserId: null,
      targetUserId: user.id,
      productId: product.id,
      reason: `free checkout discount=${discountCode || 'none'}; tx_ref=${txRef}`,
    });

    redirect(`/payments/callback?status=successful&tx_ref=${txRef}`);
  }

  const checkoutLink = await createFlutterwaveCheckout({
    amount: finalAmount,
    currency: product.currency,
    txRef,
    email: checkoutIntent?.email || user.email,
    name: user.full_name,
    title: product.name,
    description: product.description,
  });

  redirect(checkoutLink);
}