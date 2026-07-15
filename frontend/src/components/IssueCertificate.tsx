// Issue panel: batch id + batch record file + QC outcome -> transaction.
//
// Flow of a write in wagmi, and the states the UI must show:
//   1. user submits            -> writeContract() opens the wallet popup
//   2. isPending               -> "waiting for signature"
//   3. wallet returns tx hash  -> useWaitForTransactionReceipt polls it
//   4. isConfirming            -> "transaction sent, mining"
//   5. isConfirmed             -> done, certificate is on-chain
// Any step can fail (user rejects, contract reverts): `error` renders
// the revert reason, including our custom errors.
import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useContract } from "../lib/useContract";
import { sha256File } from "../lib/hash";
import { QcResult, QC_LABELS } from "../lib/qc";

export function IssueCertificate() {
  const { isConnected } = useAccount();
  const { address: contractAddress, abi: contractAbi } = useContract();
  const [batchId, setBatchId] = useState("");
  const [docHash, setDocHash] = useState<`0x${string}` | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<number>(QcResult.Released);

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  async function onFileSelected(file: File | undefined) {
    reset();
    if (!file) {
      setDocHash(null);
      setFileName("");
      return;
    }
    setFileName(file.name);
    setDocHash(await sha256File(file)); // hashed locally, file never uploaded
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!docHash || !contractAddress) return;
    writeContract({
      address: contractAddress,
      abi: contractAbi,
      functionName: "issue",
      args: [batchId, docHash, result],
    });
  }

  return (
    <section className="card">
      <h2>Issue a certificate</h2>
      <p className="hint">
        The batch record is hashed in your browser; only the fingerprint is
        written on-chain, signed by your wallet.
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
          Batch record file
          <input
            type="file"
            onChange={(e) => onFileSelected(e.target.files?.[0])}
            required
          />
        </label>
        {docHash && (
          <p className="hash-line">
            SHA-256 of <strong>{fileName}</strong>: <code>{docHash}</code>
          </p>
        )}

        <label>
          QC outcome
          <select value={result} onChange={(e) => setResult(Number(e.target.value))}>
            <option value={QcResult.Released}>{QC_LABELS[QcResult.Released]}</option>
            <option value={QcResult.Rejected}>{QC_LABELS[QcResult.Rejected]}</option>
            <option value={QcResult.Quarantine}>{QC_LABELS[QcResult.Quarantine]}</option>
          </select>
        </label>

        <button type="submit" disabled={!isConnected || !docHash || isPending || isConfirming}>
          {!isConnected
            ? "Connect a wallet to issue"
            : isPending
            ? "Waiting for signature…"
            : isConfirming
            ? "Transaction sent, mining…"
            : "Issue certificate"}
        </button>
      </form>

      {isConfirmed && (
        <p className="success">
          ✅ Certificate issued — tx <code>{txHash?.slice(0, 18)}…</code>
        </p>
      )}
      {error && <p className="error-text">{(error as { shortMessage?: string }).shortMessage ?? error.message}</p>}
    </section>
  );
}
