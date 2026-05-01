import Link from 'next/link';
import AdminHeader from './AdminHeader';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <aside
        style={{
          background: '#111827',
          color: 'white',
          padding: '1.5rem 1rem',
        }}
      >
        <h2 style={{ margin: 0, marginBottom: '2rem', fontSize: '1.25rem' }}>
          Seers Admin
        </h2>

        <nav style={{ display: 'grid', gap: '0.75rem' }}>
          <Link href="/admin" style={linkStyle}>
            Dashboard
          </Link>
          <Link href="/admin/users" style={linkStyle}>
            Users
          </Link>
          <Link href="/admin/features" style={linkStyle}>
            Features
          </Link>
          <Link href="/admin/orders" style={linkStyle}>
            Orders
          </Link>
          <Link href="/admin/grants" style={linkStyle}>
            Grants
          </Link>
          <Link href="/admin/audit" style={linkStyle}>
            Audit Log
          </Link>
          <Link href="/portal" style={linkStyle}>
            User Portal
          </Link>
        </nav>
      </aside>

      <div style={{ background: '#f9fafb' }}>
        <AdminHeader />
        <main style={{ padding: '1.5rem' }}>{children}</main>
      </div>
    </div>
  );
}

const linkStyle = {
  color: 'white',
  textDecoration: 'none',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  background: '#1f2937',
  display: 'block',
};