// Wallet connection panel.
//
// Everything here is wagmi hooks: they subscribe to the wallet state,
// so if the user switches account or disconnects from the MetaMask
// popup, `useAccount` updates and React re-renders — no manual event
// handling anywhere.
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="wallet-bar connected">
        <span className="dot" />
        <code>{address.slice(0, 6)}…{address.slice(-4)}</code>
        <button className="secondary" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  // `connectors[0]` is the injected wallet (MetaMask & co.); if no
  // extension is installed the connect attempt fails and we show why.
  return (
    <div className="wallet-bar">
      <span>
        Issuing requires a wallet — verification below works without one.
      </span>
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {error && <span className="error-text">{error.message}</span>}
    </div>
  );
}
