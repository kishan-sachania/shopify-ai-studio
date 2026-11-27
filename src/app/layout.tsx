import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/common/Sidebar';
import { AuthProvider } from '@/context/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';

export const metadata: Metadata = {
  title: 'Product AI Studio',
  description: 'Extract Excel products and push to Shopify via GraphQL Admin API',
  applicationName: 'Product AI Studio',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'Product AI Studio',
    description: 'Extract Excel products and push to Shopify via GraphQL Admin API',
    siteName: 'Product AI Studio',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased text-slate-900 flex flex-col">
        <AuthProvider>
          <AuthGuard>
            <Sidebar />
            <div className="md:pl-64 flex flex-col flex-1 min-w-0">
              <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </main>
            </div>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
