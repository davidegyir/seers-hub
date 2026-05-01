'use server';

import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { applyProductAccess } from '@/lib/product-access';

async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return { error: 'Not authenticated' as const };
  }

  const result = await sql`
    SELECT id, role, status
    FROM users
    WHERE clerk_user_id = ${userId}
    LIMIT 1
  `;

  const currentUser = result[0];

  if (!currentUser || currentUser.role !== 'admin') {
    return { error: 'Unauthorized' as const };
  }

  if (currentUser.status === 'suspended') {
    return { error: 'Suspended users cannot manage orders' as const };
  }

  return { user: currentUser };
}

function refreshOrderPaths() {
  revalidatePath('/admin/orders');
  revalidatePath('/admin/users');
  revalidatePath('/admin/audit');
  revalidatePath('/premium');
}

export async function createManualOrder(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const targetUserId = formData.get('targetUserId')?.toString();
  const productId = formData.get('productId')?.toString();

  if (!targetUserId || !productId) {
    return { error: 'Missing order data' as const };
  }

  const userRows = await sql`
    SELECT id
    FROM users
    WHERE id = ${targetUserId}
    LIMIT 1
  `;

  if (!userRows[0]) {
    return { error: 'User not found' as const };
  }

  const productRows = await sql`
    SELECT id, is_active
    FROM products
    WHERE id = ${productId}
    LIMIT 1
  `;

  const product = productRows[0];

  if (!product) {
    return { error: 'Product not found' as const };
  }

  if (!product.is_active) {
    return { error: 'Cannot create order for inactive product' as const };
  }

  await sql`
    INSERT INTO orders (user_id, product_id, status, created_at, updated_at)
    VALUES (${targetUserId}, ${productId}, 'pending', NOW(), NOW())
  `;

  refreshOrderPaths();
  return { success: true as const };
}

export async function markOrderPaid(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const orderId = formData.get('orderId')?.toString();

  if (!orderId) {
    return { error: 'Missing order id' as const };
  }

  const orderRows = await sql`
    SELECT id, user_id, product_id, status
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;

  const order = orderRows[0];

  if (!order) {
    return { error: 'Order not found' as const };
  }

  if (order.status === 'paid') {
    return { error: 'Order is already marked as paid' as const };
  }

  await sql`
    UPDATE orders
    SET status = 'paid', updated_at = NOW()
    WHERE id = ${orderId}
  `;

  await sql`
    INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
    VALUES (
      ${actor.id},
      ${order.user_id},
      'order_status_changed',
      ${order.status},
      'paid',
      'manual payment confirmation'
    )
  `;

  await applyProductAccess({
    actorUserId: actor.id,
    targetUserId: order.user_id,
    productId: order.product_id,
    reason: 'manual payment confirmation',
  });

  refreshOrderPaths();
  return { success: true as const };
}