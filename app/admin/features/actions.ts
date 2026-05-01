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
    return { error: 'Suspended users cannot manage features' as const };
  }

  return { user: currentUser };
}

async function logAudit(params: {
  actorUserId: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
}) {
  await sql`
    INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value)
    VALUES (
      ${params.actorUserId},
      NULL,
      ${params.action},
      ${params.oldValue},
      ${params.newValue}
    )
  `;
}

function refreshFeaturePaths() {
  revalidatePath('/admin/features');
  revalidatePath('/admin/users');
  revalidatePath('/premium');
}

export async function createFeature(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const featureKey = formData.get('featureKey')?.toString().trim();
  const name = formData.get('name')?.toString().trim();
  const description = formData.get('description')?.toString().trim() || '';

  if (!featureKey || !name) {
    return { error: 'Feature key and name are required' as const };
  }

  const normalizedKey = featureKey.toLowerCase();

  if (!/^[a-z0-9_]+$/.test(normalizedKey)) {
    return { error: 'Feature key must use lowercase letters, numbers, and underscores only' as const };
  }

  const existing = await sql`
    SELECT id
    FROM features
    WHERE feature_key = ${normalizedKey}
    LIMIT 1
  `;

  if (existing[0]) {
    return { error: 'Feature key already exists' as const };
  }

  await sql`
    INSERT INTO features (feature_key, name, description, is_active, created_at, updated_at)
    VALUES (${normalizedKey}, ${name}, ${description}, true, NOW(), NOW())
  `;

  await logAudit({
    actorUserId: actor.id,
    action: 'feature_created',
    oldValue: null,
    newValue: `${normalizedKey}:${name}`,
  });

  refreshFeaturePaths();
  return { success: true as const };
}

export async function updateFeature(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const featureId = formData.get('featureId')?.toString();
  const name = formData.get('name')?.toString().trim();
  const description = formData.get('description')?.toString().trim() || '';

  if (!featureId || !name) {
    return { error: 'Missing feature data' as const };
  }

  const existingRows = await sql`
    SELECT feature_key, name, description
    FROM features
    WHERE id = ${featureId}
    LIMIT 1
  `;

  const existing = existingRows[0];

  if (!existing) {
    return { error: 'Feature not found' as const };
  }

  await sql`
    UPDATE features
    SET name = ${name},
        description = ${description},
        updated_at = NOW()
    WHERE id = ${featureId}
  `;

  await logAudit({
    actorUserId: actor.id,
    action: 'feature_updated',
    oldValue: `${existing.feature_key}:${existing.name}:${existing.description || ''}`,
    newValue: `${existing.feature_key}:${name}:${description}`,
  });

  refreshFeaturePaths();
  return { success: true as const };
}

export async function toggleFeatureStatus(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const featureId = formData.get('featureId')?.toString();
  const newStatus = formData.get('newStatus')?.toString();

  if (!featureId || !newStatus) {
    return { error: 'Missing feature status data' as const };
  }

  if (!['active', 'inactive'].includes(newStatus)) {
    return { error: 'Invalid status value' as const };
  }

  const existingRows = await sql`
    SELECT feature_key, is_active
    FROM features
    WHERE id = ${featureId}
    LIMIT 1
  `;

  const existing = existingRows[0];

  if (!existing) {
    return { error: 'Feature not found' as const };
  }

  const isActive = newStatus === 'active';

  await sql`
    UPDATE features
    SET is_active = ${isActive},
        updated_at = NOW()
    WHERE id = ${featureId}
  `;

  await logAudit({
    actorUserId: actor.id,
    action: 'feature_status_changed',
    oldValue: `${existing.feature_key}:${existing.is_active ? 'active' : 'inactive'}`,
    newValue: `${existing.feature_key}:${newStatus}`,
  });

  refreshFeaturePaths();
  return { success: true as const };
}

export async function deleteFeature(formData: FormData) {
  const adminCheck = await requireAdmin();
  if ('error' in adminCheck) return adminCheck;

  const actor = adminCheck.user;
  const featureId = formData.get('featureId')?.toString();

  if (!featureId) {
    return { error: 'Missing feature id' as const };
  }

  const featureRows = await sql`
    SELECT id, feature_key, name, is_active
    FROM features
    WHERE id = ${featureId}
    LIMIT 1
  `;

  const feature = featureRows[0];

  if (!feature) {
    return { error: 'Feature not found' as const };
  }

  if (feature.is_active === true) {
    return { error: 'Deactivate the feature before deleting it' as const };
  }

  const entitlementCountRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM entitlements
    WHERE feature_key = ${feature.feature_key}
  `;

  const entitlementCount = entitlementCountRows[0]?.count ?? 0;

  if (entitlementCount > 0) {
    return {
      error: 'Cannot delete this feature because entitlement records still exist for it',
    } as const;
  }

  await sql`
    DELETE FROM features
    WHERE id = ${featureId}
  `;

  await logAudit({
    actorUserId: actor.id,
    action: 'feature_deleted',
    oldValue: `${feature.feature_key}:${feature.name}`,
    newValue: null,
  });

  refreshFeaturePaths();
  return { success: true as const };
}