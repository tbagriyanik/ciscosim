import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cisco Switch Simulator - Catalyst 2960",
  description: "Interactive Cisco IOS switch simulator for learning network configuration. Practice CLI commands, VLAN management, and security settings.",
  keywords: ["Cisco", "Switch", "Simulator", "IOS", "Network", "CLI", "Catalyst 2960", "VLAN", "Learning"],
  authors: [{ name: "Cisco Simulator Team" }],
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Cisco Switch Simulator",
    description: "Practice Cisco IOS commands in an interactive web-based simulator",
    url: "https://cisco-simulator.example.com",
    siteName: "Cisco Switch Simulator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cisco Switch Simulator",
    description: "Practice Cisco IOS commands in an interactive web-based simulator",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
