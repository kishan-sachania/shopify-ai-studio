import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/common/Sidebar';

export const metadata: Metadata = {
  title: 'Shopify Product Automation Suite',
  description: 'Extract Excel products and push to Shopify via GraphQL Admin API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased text-slate-900 flex flex-col">
        <Sidebar />
        <div className="md:pl-64 flex flex-col flex-1 min-w-0">
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
