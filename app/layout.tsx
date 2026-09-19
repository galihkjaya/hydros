import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { themeInitScript } from "@/components/layout/ThemeToggle";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans-base",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-base",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Hydros — See water. Find context. Follow the evidence.",
    template: "%s · Hydros",
  },
  description:
    "An evidence-first investigation tool for urban freshwater ecosystems, built on the One Health model. Hydros separates what is observed, what is documented, and what can only be inferred.",
  applicationName: "Hydros",
  openGraph: {
    title: "Hydros — See water. Find context. Follow the evidence.",
    description:
      "An evidence-first investigation tool for urban freshwater ecosystems, built on the One Health model.",
    type: "website",
  },
  icons: {
    icon: "/src/logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: themeInitScript sets the class before hydration.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        <script
          // Runs before paint to avoid a flash of the wrong theme.
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="flex min-h-dvh flex-col bg-paper font-sans text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
        >
          Skip to content
        </a>
        <Navbar />
        <div id="main" className="flex flex-1 flex-col">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
