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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
