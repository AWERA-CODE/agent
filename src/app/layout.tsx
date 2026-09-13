import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Autonomous Customer Resolution Agent',
  description: 'AI-powered customer support dashboard with autonomous resolution capabilities',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
