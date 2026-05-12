'use client';

import { SignUp } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

export default function Page() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/access/awc';

  return (
    <>
      <main className="auth-page">
        <section className="auth-shell">
          <div className="auth-copy">
            <p className="auth-badge">SEERS ACADEMY</p>

            <h1>Create Your Masterclass Account</h1>

            <p>
              Sign in securely to continue your Masterclass enrollment.
            </p>
          </div>

          <div className="auth-card">
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
                  rootBox: {
                    width: '100%',
                  },
                  card: {
                    width: '100%',
                    maxWidth: '100%',
                    boxShadow: 'none',
                    border: 'none',
                    borderRadius: '16px',
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

      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }

        .auth-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: radial-gradient(
            circle at top left,
            #1e3a8a 0,
            #0f172a 38%,
            #020617 100%
          );
          color: white;
          font-family: Arial, sans-serif;
          padding: 48px 20px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .auth-shell {
          width: 100%;
          max-width: 1040px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(340px, 440px);
          gap: 40px;
          align-items: center;
        }

        .auth-copy {
          max-width: 560px;
        }

        .auth-badge {
          color: #facc15;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 12px;
        }

        .auth-copy h1 {
          font-size: clamp(2.2rem, 5vw, 4rem);
          line-height: 1.05;
          margin: 0 0 18px;
          font-weight: 400;
        }

        .auth-copy p {
          color: #cbd5e1;
          font-size: 1.08rem;
          line-height: 1.7;
          margin: 0;
        }

        .auth-card {
          width: 100%;
          max-width: 440px;
          background: rgba(255, 255, 255, 0.98);
          border-radius: 22px;
          padding: 16px;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.32);
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .auth-page {
            padding: 64px 16px 32px;
            align-items: flex-start;
          }

          .auth-shell {
            display: flex;
            flex-direction: column;
            gap: 28px;
          }

          .auth-copy {
            width: 100%;
            max-width: none;
          }

          .auth-badge {
            font-size: 0.85rem;
            margin-bottom: 10px;
          }

          .auth-copy h1 {
            font-size: 2.35rem;
            line-height: 1.08;
            margin-bottom: 14px;
          }

          .auth-copy p {
            font-size: 1rem;
            line-height: 1.55;
          }

          .auth-card {
            width: 100%;
            max-width: 100%;
            border-radius: 20px;
            padding: 10px;
          }

          .cl-card {
            width: 100% !important;
            max-width: 100% !important;
          }
        }

        @media (max-width: 420px) {
          .auth-page {
            padding: 56px 12px 24px;
          }

          .auth-copy h1 {
            font-size: 2rem;
          }

          .auth-card {
            padding: 8px;
            border-radius: 18px;
          }
        }
      `}</style>
    </>
  );
}