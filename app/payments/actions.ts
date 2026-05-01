'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { createFlutterwaveCheckout } from '@/lib/flutterwave';

export async function startCheckout(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const productId = formData.get('productId')?.toString();

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
    SELECT id, name, description, price, currency, is_active
    FROM products
    WHERE id = ${productId}
    LIMIT 1
  `;

  const product = productRows[0];

  if (!product || !product.is_active) {
    throw new Error('Product not available');
  }

  const orderRows = await sql`
    INSERT INTO orders (user_id, product_id, status, created_at, updated_at)
    VALUES (${user.id}, ${product.id}, 'pending', NOW(), NOW())
    RETURNING id
  `;

  const order = orderRows[0];
  const txRef = `SEERS-${order.id}`;

  await sql`
    UPDATE orders
    SET payment_reference = ${txRef}, updated_at = NOW()
    WHERE id = ${order.id}
  `;

  const checkoutLink = await createFlutterwaveCheckout({
    amount: Number(product.price),
    currency: product.currency,
    txRef,
    email: user.email,
    name: user.full_name,
    title: product.name,
    description: product.description,
  });

  redirect(checkoutLink);
}