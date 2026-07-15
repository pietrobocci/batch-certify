// Revoke panel: batch id + reason -> transaction.
//
// Same transaction lifecycle as IssueCertificate. The certificate is not
// deleted on-chain: the contract flips `revoked` and emits an event — the
// history table below picks that event up and updates by itself.
import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useContract } from "../lib/useContract";

export function RevokeCertificate() {
  const { isConnected } = useAccount();
  const { address: contractAddress, abi: contractAbi } = useContract();
  const [batchId, setBatchId] = useState("");
  const [reason, setReason] = useState("");

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractAddress) return;
    writeContract({
      address: contractAddress,
      abi: contractAbi,
      functionName: "revoke",
      args: [batchId, reason],
    });
  }

  return (
    <section className="card">
      <h2>Revoke a certificate</h2>
      <p className="hint">
        Marks a certificate as no longer valid. The record stays on-chain
        for auditability — nothing is ever deleted.
      </p>

      <form onSubmit={onSubmit}>
        <label>
          Batch ID
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="LOT-2026-0042"
            required
          />
        </label>

        <label>
          Reason
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="issued by mistake"
            required
          />
        </label>

        <button type="submit" disabled={!isConnected || isPending || isConfirming}>
          {!isConnected
            ? "Connect a wallet to revoke"
            : isPending
            ? "Waiting for signature…"
            : isConfirming
            ? "Transaction sent, mining…"
            : "Revoke certificate"}
        </button>
      </form>

      {isConfirmed && (
        <p className="success">✅ Certificate revoked — the history below updates on its own.</p>
      )}
      {error && (
        <p className="error-text">
          {(error as { shortMessage?: string }).shortMessage ?? error.message}
        </p>
      )}
    </section>
  );
}
