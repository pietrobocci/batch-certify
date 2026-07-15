// Verify panel: batch id + (file OR pasted hash) -> on-chain check.
//
// Deliberately works WITHOUT a wallet: `useReadContract` goes through
// the HTTP transport configured in wagmi.ts, straight to the node.
// A regulator or customer can verify a document with nothing installed.
//
// Two reads happen once the user submits:
//   verify(batchId, docHash)  -> the boolean that matters
//   getCertificate(batchId)   -> details for context (issuer, date, QC)
import { useState } from "react";
import { useReadContract } from "wagmi";
import { useContract } from "../lib/useContract";
import { sha256File, isBytes32 } from "../lib/hash";
import { QC_LABELS } from "../lib/qc";

type Query = { batchId: string; docHash: `0x${string}` };

export function VerifyCertificate() {
  const { address: contractAddress, abi: contractAbi } = useContract();
  const [batchId, setBatchId] = useState("");
  const [hashInput, setHashInput] = useState("");
  const [fileName, setFileName] = useState("");
  // The reads run only after submit: `query` doubles as the "enabled" flag.
  const [query, setQuery] = useState<Query | null>(null);

  const { data: isValid, isFetching } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "verify",
    args: query ? [query.batchId, query.docHash] : undefined,
    query: { enabled: !!query },
  });

  // getCertificate reverts with CertificateNotFound for unknown ids:
  // that surfaces here as `certError`, which the UI turns into a message.
  const { data: cert, error: certError } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "getCertificate",
    args: query ? [query.batchId] : undefined,
    query: { enabled: !!query, retry: false },
  });

  async function onFileSelected(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setHashInput(await sha256File(file));
    setQuery(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isBytes32(hashInput)) return;
    setQuery({ batchId, docHash: hashInput });
  }

  return (
    <section className="card">
      <h2>Verify a document</h2>
      <p className="hint">
        No wallet needed. Pick the document you were given (hashed locally),
        or paste its SHA-256 directly.
      </p>

      <form onSubmit={onSubmit}>
        <label>
          Batch ID
          <input
            value={batchId}
            onChange={(e) => { setBatchId(e.target.value); setQuery(null); }}
            placeholder="LOT-2026-0042"
            required
          />
        </label>

        <label>
          Document file (optional if you paste the hash)
          <input type="file" onChange={(e) => onFileSelected(e.target.files?.[0])} />
        </label>
        {fileName && <p className="hash-line">Hashed <strong>{fileName}</strong></p>}

        <label>
          SHA-256 hash
          <input
            value={hashInput}
            onChange={(e) => { setHashInput(e.target.value); setQuery(null); }}
            placeholder="0x…64 hex chars"
            required
            pattern="0x[0-9a-fA-F]{64}"
          />
        </label>

        <button type="submit" disabled={isFetching}>
          {isFetching ? "Checking on-chain…" : "Verify"}
        </button>
      </form>

      {query && isValid !== undefined && (
        <div className={isValid ? "verdict ok" : "verdict ko"}>
          {isValid ? (
            <>✅ <strong>Authentic.</strong> This document matches the
            certificate issued for batch {query.batchId}.</>
          ) : (
            <>❌ <strong>Not valid.</strong> No active certificate for this
            batch matches this document.</>
          )}
        </div>
      )}

      {query && cert && (
        <dl className="cert-details">
          <div><dt>Issuer</dt><dd><code>{cert.issuer}</code></dd></div>
          <div><dt>Issued at</dt>
            <dd>{new Date(Number(cert.issuedAt) * 1000).toLocaleString()}</dd></div>
          <div><dt>QC outcome</dt><dd>{QC_LABELS[cert.result] ?? cert.result}</dd></div>
          <div><dt>Status</dt>
            <dd>{cert.revoked ? "⛔ Revoked" : "Active"}</dd></div>
          <div><dt>Stored hash</dt><dd><code>{cert.docHash}</code></dd></div>
        </dl>
      )}
      {query && certError && (
        <p className="hint">No certificate has ever been issued for this batch id.</p>
      )}
    </section>
  );
}
