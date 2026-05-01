'use client';

import { useActionState, useEffect, useState } from 'react';

type ActionResult =
  | { success: true }
  | { error: string }
  | undefined;

type Option = {
  value: string;
  label: string;
};

type Props = {
  action: (formData: FormData) => Promise<ActionResult>;
  hiddenName: string;
  hiddenValue: string;
  selectName: string;
  defaultValue: string;
  options: Option[];
  buttonLabel: string;
  buttonColor: string;
};

export default function UserActionForm({
  action,
  hiddenName,
  hiddenValue,
  selectName,
  defaultValue,
  options,
  buttonLabel,
  buttonColor,
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
      setMessage({
        type: 'error',
        text: state.error,
      });
      return;
    }

    if (state?.success) {
      setMessage({
        type: 'success',
        text: 'Saved successfully.',
      });
    }
  }, [state]);

  return (
    <div style={{ minWidth: '220px' }}>
      <form action={formAction} style={{ display: 'flex', gap: '0.5rem' }}>
        <input type="hidden" name={hiddenName} value={hiddenValue} />

        <select
          name={selectName}
          defaultValue={defaultValue}
          style={{
            padding: '0.4rem 0.5rem',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            background: 'white',
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: '6px',
            border: 'none',
            background: buttonColor,
            color: 'white',
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.7 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {pending ? 'Saving...' : buttonLabel}
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