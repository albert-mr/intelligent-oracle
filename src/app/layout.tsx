import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Web3Provider } from "@/components/web3-provider";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenLayer Intelligent Oracle — trustless resolution from the live web",
  description:
    "Design prediction-market oracles in plain English. Validators read live web sources and reach consensus via equivalence principle — without trusting a single API.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          <TooltipProvider>{children}</TooltipProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
