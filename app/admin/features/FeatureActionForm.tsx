'use client';

import { useActionState, useEffect, useState } from 'react';

type ActionState =
  | { success: true; error?: never }
  | { error: string; success?: never }
  | null;

type FeatureActionFormProps = {
  action: (formData: FormData) => Promise<any>;
  children: React.ReactNode;
  submitLabel?: string;
  successMessage?: string;
};

const initialState: ActionState = null;

export default function FeatureActionForm({
  action,
  children,
  submitLabel = 'Save',
  successMessage = 'Saved successfully.',
}: FeatureActionFormProps) {
  async function formActionWrapper(
    _prevState: ActionState,
    formData: FormData
  ): Promise<ActionState> {
    const result = await action(formData);

    if (result?.error) {
      return { error: String(result.error) };
    }

    return { success: true };
  }

  const [state, formAction, pending] = useActionState(
    formActionWrapper,
    initialState
  );

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!state) return;

    if ('error' in state && state.error) {
      setMessage({ type: 'error', text: state.error });
      return;
    }

    if ('success' in state && state.success) {
      setMessage({ type: 'success', text: successMessage });
    }
  }, [state, successMessage]);

  return (
    <form action={formAction} className="space-y-3">
      {children}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Saving...' : submitLabel}
      </button>

      {message && (
        <p
          className={
            message.type === 'error'
              ? 'text-sm text-red-600'
              : 'text-sm text-green-600'
          }
        >
          {message.text}
        </p>
      )}
    </form>
  );
}