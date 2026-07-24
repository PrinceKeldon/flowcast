import type { Metadata } from "next";
import { Oswald, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Display: condensed bold sans, film-poster register — reserved for
// titles and hero statements only (see ARCHITECTURE.md typography rules).
const oswald = Oswald({
  variable: "--font-oswald",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

// Body: humanist sans, quiet and readable.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Metadata: taxonomy, tags, episode counts — used sparingly.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const SITE_NAME = "Kilig";
const SITE_DESCRIPTION = "Emotion-first discovery for vertical drama. What do you want to feel tonight?";

export const metadata: Metadata = {
  title: {
    default: "Kilig — find your next obsession",
    // Child routes (e.g. title/[id]'s generateMetadata) set title to
    // just the title name; Next.js composes it against this template
    // automatically, so "The Light Between Oceans" becomes
    // "The Light Between Oceans · Kilig" without repeating the suffix
    // in every generateMetadata call.
    template: "%s · Kilig",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
