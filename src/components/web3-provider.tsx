"use client";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import type { Chain } from "viem";
import { http, WagmiProvider } from "wagmi";
import {
  genLayerChain,
  getGenLayerRpcUrl,
  getWalletConnectProjectId,
} from "@/lib/genlayer-config";

const walletChain = genLayerChain as Chain;

const wagmiConfig = getDefaultConfig({
  appName: "Oracle Workspace",
  projectId: getWalletConnectProjectId(),
  chains: [walletChain],
  transports: {
    [walletChain.id]: http(getGenLayerRpcUrl()),
  },
  ssr: true,
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
