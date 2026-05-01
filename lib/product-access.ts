import { sql } from '@/lib/db';

export async function applyProductAccess(params: {
  actorUserId: string | null;
  targetUserId: string;
  productId: string;
  reason?: string | null;
}) {
  const rules = await sql`
    SELECT tier_to_grant, feature_key
    FROM product_access_rules
    WHERE product_id = ${params.productId}
  `;

  const targetRows = await sql`
    SELECT id, tier
    FROM users
    WHERE id = ${params.targetUserId}
    LIMIT 1
  `;

  const targetUser = targetRows[0];

  if (!targetUser) {
    throw new Error('Target user not found for access assignment');
  }

  for (const rule of rules as any[]) {
    if (rule.tier_to_grant) {
      const oldTier = targetUser.tier || 'free';
      const newTier = rule.tier_to_grant;

      if (oldTier !== newTier) {
        await sql`
          UPDATE users
          SET tier = ${newTier}, updated_at = NOW()
          WHERE id = ${params.targetUserId}
        `;

        targetUser.tier = newTier;

        if (params.actorUserId) {
          await sql`
            INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
            VALUES (
              ${params.actorUserId},
              ${params.targetUserId},
              'tier_changed_by_product',
              ${oldTier},
              ${newTier},
              ${params.reason || null}
            )
          `;
        }
      }
    }

    if (rule.feature_key) {
      const existingRows = await sql`
        SELECT granted
        FROM entitlements
        WHERE user_id = ${params.targetUserId}
          AND feature_key = ${rule.feature_key}
        LIMIT 1
      `;

      const alreadyGranted = existingRows[0]?.granted === true;

      if (!alreadyGranted) {
        await sql`
          INSERT INTO entitlements (user_id, feature_key, granted, created_at, updated_at)
          VALUES (${params.targetUserId}, ${rule.feature_key}, true, NOW(), NOW())
          ON CONFLICT (user_id, feature_key)
          DO UPDATE SET granted = true, updated_at = NOW()
        `;

        if (params.actorUserId) {
          await sql`
            INSERT INTO audit_logs (actor_user_id, target_user_id, action, old_value, new_value, reason)
            VALUES (
              ${params.actorUserId},
              ${params.targetUserId},
              'entitlement_changed_by_product',
              ${rule.feature_key + ':not_granted'},
              ${rule.feature_key + ':granted'},
              ${params.reason || null}
            )
          `;
        }
      }
    }
  }
}