'use client';

import { SignUp } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

export default function Page() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/access/awc';

  return (
    <main style={styles.main}>
      <section style={styles.container}>
        {/* LEFT PANEL */}
        <div style={styles.left}>
          <p style={styles.badge}>SEERS ACADEMY</p>

          <h1 style={styles.heading}>
            Create Your Masterclass Account
          </h1>

          <p style={styles.subtext}>
            Use the same email you entered earlier so your access can be
            attached correctly.
          </p>
        </div>

        {/* RIGHT PANEL */}
        <div style={styles.card}>
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl={redirectUrl}
            forceRedirectUrl={redirectUrl}
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

    // 🔥 Responsive layout
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
};