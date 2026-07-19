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

export const metadata: Metadata = {
  title: "Kilig — find your next obsession",
  description: "Emotion-first discovery for vertical drama. What do you want to feel tonight?",
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
