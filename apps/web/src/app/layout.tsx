import type { Metadata } from "next";

import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Backstage · YouTube thumbnails that actually click",
  description:
    "The open-source YouTube thumbnail studio. Layer-based editor, AI background removal, Gemini image gen, all on your machine. Bring your own keys. Lifetime deal $29.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
