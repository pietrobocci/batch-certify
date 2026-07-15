// wagmi configuration: which chains the app knows, how to reach them,
// and which wallet connectors to offer.
//
// For now the only chain is the local Hardhat node (chain id 31337).
// When we deploy to Sepolia this is the ONLY file that grows: add the
// chain and its transport, the rest of the app stays untouched.
import { createConfig, http } from "wagmi";
import { hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [hardhat],
  // `injected` = any browser-extension wallet (MetaMask, Rabby, ...):
  // they all inject a `window.ethereum` object, hence the name.
  connectors: [injected()],
  transports: {
    // Read-only calls go straight to the node over HTTP: this is why
    // the Verify panel works even with no wallet installed.
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
});
