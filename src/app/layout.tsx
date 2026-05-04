import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intelligent Oracle",
  description: "Create and monitor GenLayer Intelligent Oracles.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
