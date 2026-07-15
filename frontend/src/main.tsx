// App entry point: mounts React and wires the two providers every
// wagmi app needs:
//   WagmiProvider        — wallet + chain state (our config in wagmi.ts)
//   QueryClientProvider  — TanStack Query, wagmi's cache engine: every
//                          useReadContract result is cached, deduplicated
//                          and refetched through it.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./wagmi";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
