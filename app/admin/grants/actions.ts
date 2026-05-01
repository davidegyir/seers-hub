'use server';

import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { revalidatePath } from 'next/cache';

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
    return { error: 'Suspended users cannot grant access' as const };
  }

  return { user: currentUser };
}

function refreshGrantPaths() {
  revalidatePath('/admin/grants');
  revalidatePath('/admin/users');
  revalidatePath('/admin/audit');
  revalidatePath('/premium');
}

export async function grantTierDirectly(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const targetUserId = formData.get('targetUserId')?.toString();
  const newTier = formData.get('newTier')?.toString();
  const reason = formData.get('reason')?.toString().trim();

  if (!targetUserId || !newTier || !reason) {
    return { error: 'User, tier, and reason are required' as const };
  }

  if (!['free', 'standard', 'premium', 'enterprise'].includes(newTier)) {
    return { error: 'Invalid tier' as const };
  }

  const userRows = await sql`
    SELECT id, tier
    FROM users
    WHERE id = ${targetUserId}
    LIMIT 1
  `;

  const targetUser = userRows[0];

  if (!targetUser) {
    return { error: 'User not found' as const };
  }

  const oldTier = targetUser.tier || 'free';

  if (oldTier === newTier) {
    return { error: 'User already has that tier' as const };
  }

  await sql`
    UPDATE users
    SET tier = ${newTier}, updated_at = NOW()
    WHERE id = ${targetUserId}
  `;

  await sql`
    INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
    VALUES (
      ${actor.id},
      ${targetUserId},
      'tier_granted_directly',
      ${oldTier},
      ${newTier},
      ${reason}
    )
  `;

  refreshGrantPaths();
  return { success: true as const };
}

export async function grantFeatureDirectly(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const targetUserId = formData.get('targetUserId')?.toString();
  const featureKey = formData.get('featureKey')?.toString();
  const reason = formData.get('reason')?.toString().trim();

  if (!targetUserId || !featureKey || !reason) {
    return { error: 'User, feature, and reason are required' as const };
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

  const featureRows = await sql`
    SELECT feature_key, is_active
    FROM features
    WHERE feature_key = ${featureKey}
    LIMIT 1
  `;

  const feature = featureRows[0];

  if (!feature) {
    return { error: 'Feature not found' as const };
  }

  if (!feature.is_active) {
    return { error: 'Cannot grant an inactive feature' as const };
  }

  const entitlementRows = await sql`
    SELECT granted
    FROM entitlements
    WHERE user_id = ${targetUserId}
      AND feature_key = ${featureKey}
    LIMIT 1
  `;

  const alreadyGranted = entitlementRows[0]?.granted === true;

  if (alreadyGranted) {
    return { error: 'User already has that feature entitlement' as const };
  }

  await sql`
    INSERT INTO entitlements (user_id, feature_key, granted, created_at, updated_at)
    VALUES (${targetUserId}, ${featureKey}, true, NOW(), NOW())
    ON CONFLICT (user_id, feature_key)
    DO UPDATE SET granted = true, updated_at = NOW()
  `;

  await sql`
    INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
    VALUES (
      ${actor.id},
      ${targetUserId},
      'feature_granted_directly',
      ${featureKey + ':not_granted'},
      ${featureKey + ':granted'},
      ${reason}
    )
  `;

  refreshGrantPaths();
  return { success: true as const };
}