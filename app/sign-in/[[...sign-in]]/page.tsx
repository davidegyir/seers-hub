'use client';

import { SignIn } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

export default function Page() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || undefined;
  const redirectUrl = searchParams.get('redirect_url') || '/payments?product=awc';

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, #1e3a8a 0, #0f172a 38%, #020617 100%)',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        padding: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 1040,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 440px)',
          gap: '2rem',
          alignItems: 'center',
        }}
      >
        <div>
          <p
            style={{
              color: '#facc15',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '0.75rem',
            }}
          >
            SEERS ACADEMY
          </p>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 4rem)',
              lineHeight: 1.05,
              margin: '0 0 1rem',
            }}
          >
            Create Your Masterclass Access
          </h1>

          <p
            style={{
              color: '#cbd5e1',
              fontSize: '1.08rem',
              lineHeight: 1.7,
              maxWidth: 560,
            }}
          >
            Use the same email you entered earlier.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.98)',
            borderRadius: 22,
            padding: '1.25rem',
            boxShadow: '0 24px 70px rgba(0,0,0,0.32)',
          }}
        >
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl={redirectUrl}
            forceRedirectUrl={redirectUrl}
            initialValues={{
              emailAddress: email,
            }}
            appearance={{
              layout: {
                logoPlacement: 'none',
                showOptionalFields: false,
              },
              elements: {
                rootBox: {
                  width: '100%',
                },
                card: {
                  width: '100%',
                  boxShadow: 'none',
                  border: 'none',
                  borderRadius: '16px',
                },
                headerTitle: {
                  fontSize: '1.25rem',
                  color: '#111827',
                },
                headerSubtitle: {
                  color: '#6b7280',
                },
                formButtonPrimary: {
                  backgroundColor: '#111827',
                  color: 'white',
                  boxShadow: 'none',
                },
                footerActionLink: {
                  color: '#111827',
                  fontWeight: 700,
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