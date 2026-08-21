import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { themeInitScript } from "@/components/layout/ThemeToggle";

export const metadata: Metadata = {
  title: {
    default: "WaterLens — evidence-based water investigation",
    template: "%s · WaterLens",
  },
  description:
    "Investigate a water source from a photograph, its location and public records. WaterLens separates what is observed, what is documented, and what can only be inferred.",
  applicationName: "WaterLens",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: themeInitScript sets the class before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Runs before paint to avoid a flash of the wrong theme.
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="flex min-h-dvh flex-col bg-background text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
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
