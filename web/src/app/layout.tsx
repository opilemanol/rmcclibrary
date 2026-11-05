import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RMCC Church Library",
  description: "An offline-first church library and resource app.",
  applicationName: "RMCC Church Library",
  manifest: "./manifest.json",
  appleWebApp: { capable: true, title: "RMCC Library", statusBarStyle: "default" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
