import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Seers Hub',
  description: 'Seers Hub platform',
};

const clerkLocalization = {
  signIn: {
    start: {
      title: 'Proceed to Seers Authentication',
      subtitle: 'Please sign in to continue',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={clerkLocalization}>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}