'use client';

import { SignIn } from '@clerk/nextjs';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function extractIntentFromRedirectUrl(redirectUrl: string | null) {
  if (!redirectUrl) return null;

  try {
    const decodedUrl = decodeURIComponent(redirectUrl);

    const url = decodedUrl.startsWith('http')
      ? new URL(decodedUrl)
      : new URL(decodedUrl, 'https://portal.seersapp.com');

    return url.searchParams.get('intent');
  } catch {
    return null;
  }
}

export default function Page() {
  const searchParams = useSearchParams();

  const directEmail = searchParams.get('email') || undefined;
  const redirectUrl = searchParams.get('redirect_url') || '/access/awc';

  const intentId = useMemo(
    () => extractIntentFromRedirectUrl(redirectUrl),
    [redirectUrl]
  );

  const [email, setEmail] = useState<string | undefined>(directEmail);
  const [ready, setReady] = useState(!intentId || Boolean(directEmail));

  useEffect(() => {
    let cancelled = false;

    async function loadIntentEmail() {
      if (!intentId || directEmail) {
        setReady(true);
        return;
      }

      const timeout = setTimeout(() => {
        if (!cancelled) setReady(true);
      }, 3000);

      try {
        const response = await fetch(`/api/checkout-intent/${intentId}`, {
          cache: 'no-store',
        });

        const data = await response.json();

        if (!cancelled && data.success && data.intent?.email) {
          setEmail(data.intent.email);
        }
      } catch (error) {
        console.error(error);
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setReady(true);
      }
    }

    loadIntentEmail();

    return () => {
      cancelled = true;
    };
  }, [intentId, directEmail]);

  return (
    <main style={styles.main}>
      <section style={styles.container}>
        {/* LEFT PANEL */}
        <div style={styles.left}>
          <p style={styles.badge}>SEERS ACADEMY</p>

          <h1 style={styles.heading}>
            Create Your Masterclass Access
          </h1>

          <p style={styles.subtext}>
            {email
              ? 'Your email has been prepared. Please continue securely.'
              : 'Please sign in to continue.'}
          </p>
        </div>

        {/* RIGHT PANEL */}
        <div style={styles.card}>
          {!ready ? (
            <div style={styles.loading}>Preparing your sign-in...</div>
          ) : (
            <SignIn
              key={email || 'manual'}
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              fallbackRedirectUrl={redirectUrl}
              forceRedirectUrl={redirectUrl}
              initialValues={
                email ? { emailAddress: email } : undefined
              }
              appearance={{
                layout: {
                  logoPlacement: 'none',
                  showOptionalFields: false,
                },
                elements: {
                  rootBox: { width: '100%' },
                  card: {
                    width: '100%',
                    boxShadow: 'none',
                    border: 'none',
                    borderRadius: '16px',
                  },
                  formButtonPrimary: {
                    backgroundColor: '#111827',
                    color: 'white',
                  },
                },
                variables: {
                  colorPrimary: '#111827',
                },
              }}
            />
          )}
        </div>
      </section>
    </main>
  );
}

const styles = {
  main: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top left, #1e3a8a 0, #0f172a 38%, #020617 100%)',
    color: 'white',
    padding: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  container: {
    width: '100%',
    maxWidth: 1040,
    display: 'grid',
    gap: '2rem',
    alignItems: 'center',

    // 🔥 RESPONSIVE SWITCH
    gridTemplateColumns:
      'repeat(auto-fit, minmax(300px, 1fr))',
  },

  left: {
    textAlign: 'left',
  },

  badge: {
    color: '#facc15',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '0.75rem',
  },

  heading: {
    fontSize: 'clamp(1.8rem, 5vw, 3.2rem)',
    lineHeight: 1.1,
    marginBottom: '1rem',
  },

  subtext: {
    color: '#cbd5e1',
    fontSize: '1rem',
    lineHeight: 1.6,
  },

  card: {
    background: 'rgba(255,255,255,0.98)',
    borderRadius: 18,
    padding: '1rem',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
    minHeight: 380,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loading: {
    color: '#111827',
    fontWeight: 600,
    textAlign: 'center',
  },
};