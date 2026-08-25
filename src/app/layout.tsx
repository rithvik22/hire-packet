import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hire-packet.vercel.app"),
  title: "Hire Packet",
  description: "Match a job to resumes with proof. Scores organize. You decide.",
  openGraph: {
    title: "Hire Packet",
    description: "Compare candidates or make one hire packet. Evidence first. No auto-rejects.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hire Packet",
    description: "Compare candidates or make one hire packet. Evidence first. No auto-rejects.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${figtree.variable} ${syne.variable}`}>
      <body
        className="antialiased"
        style={
          {
            "--font-body": "var(--font-figtree), system-ui, sans-serif",
            "--font-display": "var(--font-syne), system-ui, sans-serif",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
