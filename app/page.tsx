export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: 'white',
        fontFamily: 'system-ui',
        padding: '2rem',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 680 }}>
        <p
          style={{
            color: '#facc15',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}
        >
          AWC Achievers Wealth Creation Series
        </p>

        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          AWC Level 1 Masterclass
        </h1>

        <p style={{ opacity: 0.85, marginBottom: '2rem', lineHeight: 1.6 }}>
          Learn how to reduce operating cost, increase productivity, and improve
          profitability — without hiring more people.
        </p>

        <a
          href="/payments?product=awc"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: '#22c55e',
            color: 'black',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 'bold',
          }}
        >
          Enroll Now
        </a>
      </div>
    </main>
  );
}