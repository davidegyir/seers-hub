'use client';

import { useActionState, useEffect, useState } from 'react';

type ActionState =
  | { success: true; error?: never }
  | { error: string; success?: never }
  | null;

type Feature = {
  key?: string;
  slug?: string;
  name?: string;
  label?: string;
};

type UserEntitlementsFormProps = {
  action: (formData: FormData) => Promise<any>;
  userId?: string;
  features?: Feature[];
  entitlements?: string[];
  currentEntitlements?: string[];
  children?: React.ReactNode;
  buttonLabel?: string;
  successMessage?: string;
  [key: string]: any;
};

const initialState: ActionState = null;

export default function UserEntitlementsForm({
  action,
  userId,
  features = [],
  entitlements = [],
  currentEntitlements = [],
  children,
  buttonLabel = 'Save',
  successMessage = 'Saved successfully.',
}: UserEntitlementsFormProps) {
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

  const granted = new Set([...entitlements, ...currentEntitlements]);

  return (
    <form action={formAction} className="space-y-3">
      {userId && <input type="hidden" name="targetUserId" value={userId} />}

      {features.length > 0 && (
        <div className="space-y-2">
          {features.map((feature) => {
            const value = feature.key || feature.slug || feature.name || '';
            const label = feature.label || feature.name || feature.key || value;

            if (!value) return null;

            return (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="entitlements"
                  value={value}
                  defaultChecked={granted.has(value)}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      )}

      {children}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Saving...' : buttonLabel}
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