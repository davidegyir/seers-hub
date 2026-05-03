'use client';

import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        padding: '2rem',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'white',
          borderRadius: 16,
          padding: '2rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        }}
      >
        {/* 🔷 Custom Header */}
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '0.5rem', color: '#111827' }}>
            Create Your Masterclass Access
          </h1>

          <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>
            Use the same email you entered earlier so we can attach your payment
            and unlock the <strong>AWC Level 1 Masterclass</strong>.
          </p>
        </div>

        {/* 🔷 Clerk Component */}
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/payments?product=awc"
        />
      </section>
    </main>
  );
}