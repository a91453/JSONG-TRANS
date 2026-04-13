
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Navigation } from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'NihongoPath - 沉浸式日語學習 (v1.0)',
  description: '透過沉浸式影片、互動遊戲和結構化練習，輕鬆掌握日語。',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Alegreya:wght@400;700&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen flex flex-col">
        <main className="flex-1 max-w-4xl mx-auto w-full pb-20 shadow-sm bg-background relative">
          {children}
        </main>
        <Navigation />
        <Toaster />
      </body>
    </html>
  );
}
