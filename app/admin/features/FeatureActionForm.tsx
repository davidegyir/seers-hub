'use client';

import { useActionState, useEffect, useState } from 'react';

type ActionResult =
  | { success: true }
  | { error: string }
  | undefined;

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
};

export default function FeatureActionForm({ action, children }: Props) {
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
    <div>
      <form action={formAction}>{children}</form>

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

      {pending && (
        <div
          style={{
            marginTop: '0.45rem',
            fontSize: '0.82rem',
            color: '#6b7280',
          }}
        >
          Saving...
        </div>
      )}
    </div>
  );
}