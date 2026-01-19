import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meu Dinheiro IA",
  description: "Gerencie suas finanças com inteligência artificial.",
  themeColor: "#050505",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Meu Dinheiro IA",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-96x96.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    title: "Meu Dinheiro IA",
    description: "Gerencie suas finanças com inteligência artificial.",
    siteName: "Meu Dinheiro IA",
    images: [
      {
        url: "/web-app-manifest-512x512.png",
        width: 512,
        height: 512,
        alt: "Meu Dinheiro IA",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Meu Dinheiro IA",
    description: "Gerencie suas finanças com inteligência artificial.",
    images: ["/web-app-manifest-512x512.png"],
  },
};

import ClientLayout from "./components/ClientLayout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-[var(--foreground)]`}
        suppressHydrationWarning
      >
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
