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
  title: "Hire Packet — Rithvik Velapati",
    description:
      "Evidence-backed hire packet: explainable score, frozen resume proof, honest gaps. AI assists — it does not hire.",
  openGraph: {
    title: "Hire Packet — why hire Rithvik",
    description:
      "Paste any JD → fit score, proof from a frozen resume, honest gaps, and a forward-ready hire note.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hire Packet — Rithvik Velapati",
    description: "Paste a job description. Get a one-page hire brief grounded on resume data.",
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
