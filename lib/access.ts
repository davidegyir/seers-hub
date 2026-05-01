import { sql } from '@/lib/db';

const tierFeatureMap: Record<string, string[]> = {
  free: [],
  standard: ['midweek_live'],
  premium: ['midweek_live', 'pc_course', 'premium_articles'],
  enterprise: ['midweek_live', 'pc_course', 'premium_articles', 'gwb_program', 'ai_workshop', 'sbc_tools'],
};

export async function hasAccess(clerkUserId: string, featureKey: string) {
  const featureRows = await sql`
    SELECT feature_key, is_active
    FROM features
    WHERE feature_key = ${featureKey}
    LIMIT 1
  `;

  const feature = featureRows[0];

  if (!feature || feature.is_active !== true) {
    return false;
  }

  const userRows = await sql`
    SELECT id, tier, status
    FROM users
    WHERE clerk_user_id = ${clerkUserId}
    LIMIT 1
  `;

  const user = userRows[0];

  if (!user) return false;
  if (user.status === 'suspended') return false;

  const tierFeatures = tierFeatureMap[user.tier] || [];

  if (tierFeatures.includes(featureKey)) {
    return true;
  }

  const entitlementRows = await sql`
    SELECT granted
    FROM entitlements
    WHERE user_id = ${user.id}
      AND feature_key = ${featureKey}
    LIMIT 1
  `;

  const entitlement = entitlementRows[0];

  if (!entitlement) return false;

  return entitlement.granted === true;
}