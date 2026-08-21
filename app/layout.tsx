import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WaterLens",
  description:
    "Investigate water sources using visual evidence, geographic context, and public research.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the theme class is applied before hydration.
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
