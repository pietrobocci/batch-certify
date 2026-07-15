// wagmi configuration: which chains the app knows, how to reach them,
// and which wallet connectors to offer.
//
// Adding a network = adding it here (and deploying the contract there):
// nothing else in the app changes, because components resolve the
// contract address per-chain through useContract().
import { createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [hardhat, sepolia],
  // `injected` = any browser-extension wallet (MetaMask, Rabby, ...):
  // they all inject a `window.ethereum` object, hence the name.
  connectors: [injected()],
  transports: {
    // Read-only calls go straight to the node over HTTP: this is why
    // the Verify panel works even with no wallet installed.
    [hardhat.id]: http("http://127.0.0.1:8545"),
    // http() with no url = the chain's default public RPC endpoint.
    [sepolia.id]: http(),
  },
});
