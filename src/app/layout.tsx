import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skillproof — Prove your skills. Find your next opportunity.",
  description:
    "One intelligent placement platform to connect verified skills with relevant jobs, build evidence-backed resumes and track your career progress.",
  keywords: [
    "Skillproof",
    "campus placements",
    "evidence-based skills",
    "job matching",
    "resume builder",
    "Next.js",
    "TypeScript",
  ],
  authors: [{ name: "Skillproof" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Skillproof",
    description:
      "Connect verified skills with relevant jobs, build evidence-backed resumes and track your career progress.",
    siteName: "Skillproof",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skillproof",
    description:
      "Connect verified skills with relevant jobs, build evidence-backed resumes and track your career progress.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
