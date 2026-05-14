import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { createWordPressLoginLink } from '@/lib/wp-login-token';
import { applyProductAccess } from '@/lib/product-access';

export const dynamic = 'force-dynamic';

const FEATURE_KEY = 'ai_workshop';
const PRODUCT_KEY = 'awc';

const FIRST_LESSON_URL =
  'https://www.seersapp.com/academy/awc-level-one/lessons/reduce-operating-cost-increase-productivity-profitability-without-hiring-more-people-video/';

type SearchParams = Promise<{
  intent?: string;
}>;

async function getOrCreateUserFromClerk(clerkUserId: string) {
  const existingByClerkRows = await sql`
    SELECT id, email, full_name, status
    FROM users
    WHERE clerk_user_id = ${clerkUserId}
    LIMIT 1
  `;

  if (existingByClerkRows[0]) {
    return existingByClerkRows[0];
  }

  const clerkUser = await currentUser();

  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    null;

  const fullName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
    email ||
    'Seers User';

  if (!email) {
    return null;
  }

  const existingByEmailRows = await sql`
    SELECT id, email, full_name, status
    FROM users
    WHERE lower(email) = lower(${email})
    ORDER BY created_at ASC
    LIMIT 1
  `;

  const existingByEmail = existingByEmailRows[0];

  if (existingByEmail) {
    await sql`
      UPDATE users
      SET
        clerk_user_id = ${clerkUserId},
        full_name = COALESCE(NULLIF(full_name, ''), ${fullName}),
        updated_at = NOW()
      WHERE id = ${existingByEmail.id}
    `;

    return {
      ...existingByEmail,
      full_name: existingByEmail.full_name || fullName,
    };
  }

  const insertedRows = await sql`
    INSERT INTO users (
      clerk_user_id,
      email,
      full_name,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${clerkUserId},
      ${email},
      ${fullName},
      'active',
      NOW(),
      NOW()
    )
    RETURNING id, email, full_name, status
  `;

  return insertedRows[0];
}

async function restoreAwcAccessFromPaidOrder(user: any) {
  const existingEntitlementRows = await sql`
    SELECT id
    FROM entitlements
    WHERE user_id = ${user.id}
      AND feature_key = ${FEATURE_KEY}
      AND granted = true
    LIMIT 1
  `;

  if (existingEntitlementRows.length > 0) {
    return true;
  }

  const paidOrderRows = await sql`
    SELECT
      orders.id,
      orders.product_id,
      orders.payment_reference,
      orders.customer_email,
      products.product_key
    FROM orders
    INNER JOIN products ON products.id = orders.product_id
    WHERE lower(orders.customer_email) = lower(${user.email})
      AND orders.status = 'paid'
      AND products.product_key = ${PRODUCT_KEY}
    ORDER BY orders.created_at DESC
    LIMIT 1
  `;

  const paidOrder = paidOrderRows[0];

  if (!paidOrder) {
    return false;
  }

  await applyProductAccess({
    actorUserId: null,
    targetUserId: user.id,
    productId: paidOrder.product_id,
    reason: `restored access from paid order by email; order=${paidOrder.id}; tx_ref=${paidOrder.payment_reference}`,
  });

  await sql`
    INSERT INTO audit_logs (
      actor_user_id,
      target_user_id,
      action,
      old_value,
      new_value,
      reason
    )
    VALUES (
      NULL,
      ${user.id},
      'access_restored_by_email_match',
      NULL,
      ${FEATURE_KEY + ':granted'},
      ${'Matched paid AWC order for email ' + user.email}
    )
  `;

  return true;
}

export default async function AwcAccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const intentId = params.intent;

  const { userId } = await auth();

  if (!userId) {
    const redirectTarget = intentId
      ? `/access/awc?intent=${encodeURIComponent(intentId)}`
      : '/access/awc';

    redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectTarget)}`);
  }

  const user = await getOrCreateUserFromClerk(userId);

  if (!user) {
    const redirectTarget = intentId
      ? `/access/awc?intent=${encodeURIComponent(intentId)}`
      : '/access/awc';

    redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectTarget)}`);
  }

  if (user.status === 'suspended') {
    redirect('/suspended');
  }

  const hasAccess = await restoreAwcAccessFromPaidOrder(user);

  if (hasAccess) {
    const loginLink = await createWordPressLoginLink({
      userId: user.id,
      email: user.email,
      courseUrl: FIRST_LESSON_URL,
    });

    redirect(loginLink);
  }

  if (intentId) {
    await sql`
      UPDATE checkout_intents
      SET
        clerk_user_id = ${userId},
        email = COALESCE(email, ${user.email}),
        updated_at = NOW()
      WHERE id = ${intentId}
    `;

    redirect(`/payments?intent=${encodeURIComponent(intentId)}`);
  }

  redirect('/payments?product=awc');
}