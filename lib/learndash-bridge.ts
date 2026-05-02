export async function enrollUserInLearnDash(params: {
  email: string;
  fullName?: string | null;
  courseId: string | number;
  orderId: string;
  txRef: string;
}) {
  const endpoint = process.env.WP_ENROLL_ENDPOINT;
  const secret = process.env.SEERS_PORTAL_BRIDGE_SECRET;

  if (!endpoint) {
    throw new Error('WP_ENROLL_ENDPOINT is not configured');
  }

  if (!secret) {
    throw new Error('SEERS_PORTAL_BRIDGE_SECRET is not configured');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-seers-bridge-secret': secret,
    },
    body: JSON.stringify({
      email: params.email,
      full_name: params.fullName || '',
      course_id: Number(params.courseId),
      order_id: params.orderId,
      tx_ref: params.txRef,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || 'LearnDash enrollment request failed'
    );
  }

  if (!data?.ok) {
    throw new Error(data?.message || 'LearnDash enrollment did not return ok');
  }

  return data;
}