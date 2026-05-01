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

  return { user: currentUser };
}

async function countActiveAdmins() {
  const result = await sql`
    SELECT COUNT(*)::int AS count
    FROM users
    WHERE role = 'admin' AND status = 'active'
  `;

  return result[0]?.count ?? 0;
}

async function logAudit(params: {
  actorUserId: string;
  targetUserId: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
}) {
  await sql`
    INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value)
    VALUES (
      ${params.actorUserId},
      ${params.targetUserId},
      ${params.action},
      ${params.oldValue},
      ${params.newValue}
    )
  `;
}

function refreshAdminPaths() {
  revalidatePath('/admin/users');
  revalidatePath('/admin');
  revalidatePath('/admin/audit');
  revalidatePath('/dashboard');
  revalidatePath('/premium');
}

export async function updateUserRole(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const targetUserId = formData.get('targetUserId')?.toString();
  const newRole = formData.get('newRole')?.toString();

  if (!targetUserId || !newRole) {
    return { error: 'Missing form data' as const };
  }

  if (!['user', 'admin'].includes(newRole)) {
    return { error: 'Invalid role' as const };
  }

  const result = await sql`
    SELECT id, role, status
    FROM users
    WHERE id = ${targetUserId}
    LIMIT 1
  `;

  const targetUser = result[0];

  if (!targetUser) {
    return { error: 'User not found' as const };
  }

  if (targetUser.status === 'suspended' && newRole === 'admin') {
    return { error: 'Cannot make a suspended user an admin. Reactivate the user first.' as const };
  }

  if (
    targetUser.role === 'admin' &&
    newRole !== 'admin' &&
    targetUser.status === 'active'
  ) {
    const count = await countActiveAdmins();

    if (count <= 1) {
      return { error: 'Cannot demote the last active admin' as const };
    }
  }

  await sql`
    UPDATE users
    SET role = ${newRole}, updated_at = NOW()
    WHERE id = ${targetUserId}
  `;

  await logAudit({
    actorUserId: actor.id,
    targetUserId,
    action: 'role_changed',
    oldValue: targetUser.role,
    newValue: newRole,
  });

  refreshAdminPaths();
  return { success: true as const };
}

export async function updateUserStatus(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const targetUserId = formData.get('targetUserId')?.toString();
  const newStatus = formData.get('newStatus')?.toString();

  if (!targetUserId || !newStatus) {
    return { error: 'Missing form data' as const };
  }

  if (!['active', 'suspended'].includes(newStatus)) {
    return { error: 'Invalid status' as const };
  }

  const result = await sql`
    SELECT id, role, status
    FROM users
    WHERE id = ${targetUserId}
    LIMIT 1
  `;

  const targetUser = result[0];

  if (!targetUser) {
    return { error: 'User not found' as const };
  }

  if (
    targetUser.role === 'admin' &&
    targetUser.status === 'active' &&
    newStatus === 'suspended'
  ) {
    const count = await countActiveAdmins();

    if (count <= 1) {
      return { error: 'Cannot suspend the last active admin' as const };
    }

    await sql`
      UPDATE users
      SET role = 'user', updated_at = NOW()
      WHERE id = ${targetUserId}
    `;

    await logAudit({
      actorUserId: actor.id,
      targetUserId,
      action: 'role_changed',
      oldValue: 'admin',
      newValue: 'user',
    });
  }

  await sql`
    UPDATE users
    SET status = ${newStatus}, updated_at = NOW()
    WHERE id = ${targetUserId}
  `;

  await logAudit({
    actorUserId: actor.id,
    targetUserId,
    action: 'status_changed',
    oldValue: targetUser.status,
    newValue: newStatus,
  });

  refreshAdminPaths();
  return { success: true as const };
}

export async function updateUserTier(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const targetUserId = formData.get('targetUserId')?.toString();
  const newTier = formData.get('newTier')?.toString();

  if (!targetUserId || !newTier) {
    return { error: 'Missing form data' as const };
  }

  if (!['free', 'standard', 'premium', 'enterprise'].includes(newTier)) {
    return { error: 'Invalid tier' as const };
  }

  const result = await sql`
    SELECT id, tier
    FROM users
    WHERE id = ${targetUserId}
    LIMIT 1
  `;

  const targetUser = result[0];

  if (!targetUser) {
    return { error: 'User not found' as const };
  }

  await sql`
    UPDATE users
    SET tier = ${newTier}, updated_at = NOW()
    WHERE id = ${targetUserId}
  `;

  await logAudit({
    actorUserId: actor.id,
    targetUserId,
    action: 'tier_changed',
    oldValue: targetUser.tier || 'free',
    newValue: newTier,
  });

  refreshAdminPaths();
  return { success: true as const };
}

export async function updateUserEntitlements(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const targetUserId = formData.get('targetUserId')?.toString();

  if (!targetUserId) {
    return { error: 'Missing target user' as const };
  }

  const targetRows = await sql`
    SELECT id
    FROM users
    WHERE id = ${targetUserId}
    LIMIT 1
  `;

  const targetUser = targetRows[0];

  if (!targetUser) {
    return { error: 'User not found' as const };
  }

  const featureRows = await sql`
    SELECT feature_key
    FROM features
    WHERE is_active = true
    ORDER BY feature_key ASC
  `;

  const validFeatures = featureRows.map((row: any) => row.feature_key as string);

  const selectedFeatures = new Set(
    validFeatures.filter((feature) => formData.getAll('features').includes(feature))
  );

  const existingRows = await sql`
    SELECT feature_key, granted
    FROM entitlements
    WHERE user_id = ${targetUserId}
  `;

  const existingMap = new Map(
    existingRows.map((row: any) => [row.feature_key as string, row.granted as boolean])
  );

  for (const feature of validFeatures) {
    const had = existingMap.get(feature) === true;
    const shouldHave = selectedFeatures.has(feature);

    if (had === shouldHave) {
      continue;
    }

    if (shouldHave) {
      await sql`
        INSERT INTO entitlements (user_id, feature_key, granted, created_at, updated_at)
        VALUES (${targetUserId}, ${feature}, true, NOW(), NOW())
        ON CONFLICT (user_id, feature_key)
        DO UPDATE SET granted = true, updated_at = NOW()
      `;
    } else {
      await sql`
        INSERT INTO entitlements (user_id, feature_key, granted, created_at, updated_at)
        VALUES (${targetUserId}, ${feature}, false, NOW(), NOW())
        ON CONFLICT (user_id, feature_key)
        DO UPDATE SET granted = false, updated_at = NOW()
      `;
    }

    await logAudit({
      actorUserId: actor.id,
      targetUserId,
      action: 'entitlement_changed',
      oldValue: `${feature}:${had ? 'granted' : 'not_granted'}`,
      newValue: `${feature}:${shouldHave ? 'granted' : 'not_granted'}`,
    });
  }

  refreshAdminPaths();
  return { success: true as const };
}