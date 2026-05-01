'use client';

import { useActionState, useEffect, useState } from 'react';

type ActionResult =
  | { success: true }
  | { error: string }
  | undefined;

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  userId: string;
  selectedFeatures: string[];
  allFeatures: string[];
};

export default function UserEntitlementsForm({
  action,
  userId,
  selectedFeatures,
  allFeatures,
}: Props) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => {
      return await action(formData);
    },
    undefined
  );

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (state?.error) {
      setMessage({ type: 'error', text: state.error });
      return;
    }

    if (state?.success) {
      setMessage({ type: 'success', text: 'Saved successfully.' });
    }
  }, [state]);

  return (
    <div style={{ minWidth: '260px' }}>
      <form action={formAction}>
        <input type="hidden" name="targetUserId" value={userId} />

        <div
          style={{
            display: 'grid',
            gap: '0.35rem',
            marginBottom: '0.5rem',
          }}
        >
          {allFeatures.map((feature) => (
            <label
              key={feature}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.85rem',
              }}
            >
              <input
                type="checkbox"
                name="features"
                value={feature}
                defaultChecked={selectedFeatures.includes(feature)}
              />
              <span>{feature}</span>
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: '6px',
            border: 'none',
            background: '#0f766e',
            color: 'white',
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? 'Saving...' : 'Save'}
        </button>
      </form>

      {message && (
        <div
          style={{
            marginTop: '0.45rem',
            fontSize: '0.82rem',
            lineHeight: 1.35,
            color: message.type === 'error' ? '#b91c1c' : '#166534',
          }}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}