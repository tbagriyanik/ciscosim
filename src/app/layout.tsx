import type { Metadata, Viewport } from "next";
import { Inria_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/Providers";

const inriaSans = Inria_Sans({
  variable: "--font-inria-sans",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Network Simulator 2026 - Catalyst 2960",
  description: "Interactive Network NOS switch simulator for learning network configuration. Practice CLI commands, VLAN management, and security settings.",
  keywords: ["Network", "Switch", "Simulator", "NOS", "Network", "CLI", "Catalyst 2960", "VLAN", "Learning"],
  authors: [{ name: "Network Simulator Team" }],
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Network Simulator 2026",
    description: "Practice Network NOS commands in an interactive web-based simulator",
    url: "https://yunus.sf.net",
    siteName: "Network Simulator 2026",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Network Simulator 2026",
    description: "Practice Network NOS commands in an interactive web-based simulator",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0f172a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${inriaSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
