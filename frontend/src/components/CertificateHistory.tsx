// Certificate history — built entirely from EVENTS, not storage.
//
// Why events? A Solidity mapping cannot be iterated: storage answers
// "give me batch X" but not "list everything". Events are the standard
// answer: every issue() and revoke() emitted a log, logs live forever
// in the chain's history, and reading them is free. This is the same
// audit-trail idea as a GMP logbook: the current state is in storage,
// the full history is in the events.
//
// Two moving parts:
//   useQuery              — fetches and caches the full log history
//   useWatchContractEvent — subscribes to NEW events; on arrival it just
//                           invalidates the cache, and TanStack Query
//                           refetches. The table updates live, no manual
//                           state juggling.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { useContract } from "../lib/useContract";
import { QC_LABELS } from "../lib/qc";

type Row = {
  batchId: string;
  docHash: `0x${string}`;
  result: number;
  issuer: `0x${string}`;
  issuedAt: number; // unix seconds (from the block, not the event)
  revoked: boolean;
  revokeReason?: string;
};

const HISTORY_KEY = ["certificate-history"];

export function CertificateHistory() {
  const client = usePublicClient();
  const queryClient = useQueryClient();
  const { chainId, address: contractAddress, abi: contractAbi } = useContract();

  const { data: rows, isLoading, error } = useQuery({
    // chainId in the cache key: each network keeps its own history
    queryKey: [...HISTORY_KEY, chainId],
    enabled: !!client && !!contractAddress,
    queryFn: async (): Promise<Row[]> => {
      // All logs since the beginning of the chain. On a public network
      // you would start from the contract's deployment block instead
      // of 0 — scanning from genesis would be slow there.
      const [issued, revoked] = await Promise.all([
        client!.getContractEvents({
          address: contractAddress,
          abi: contractAbi,
          eventName: "CertificateIssued",
          fromBlock: 0n,
        }),
        client!.getContractEvents({
          address: contractAddress,
          abi: contractAbi,
          eventName: "CertificateRevoked",
          fromBlock: 0n,
        }),
      ]);

      // Join revocations onto issues via the indexed batchKey.
      const revokeByKey = new Map(
        revoked.map((log) => [log.args.batchKey, log.args.reason ?? ""])
      );

      // Events carry no timestamp — the BLOCK does. Fetch each unique
      // block once and look the timestamps up.
      const uniqueBlocks = [...new Set(issued.map((log) => log.blockNumber))];
      const blocks = await Promise.all(
        uniqueBlocks.map((blockNumber) => client!.getBlock({ blockNumber }))
      );
      const timeByBlock = new Map(blocks.map((b) => [b.number, Number(b.timestamp)]));

      return issued
        .map((log) => ({
          batchId: log.args.batchId ?? "",
          docHash: log.args.docHash ?? ("0x" as `0x${string}`),
          result: Number(log.args.result ?? 0),
          issuer: log.args.issuer ?? ("0x" as `0x${string}`),
          issuedAt: timeByBlock.get(log.blockNumber) ?? 0,
          revoked: revokeByKey.has(log.args.batchKey),
          revokeReason: revokeByKey.get(log.args.batchKey),
        }))
        .reverse(); // newest first
    },
  });

  // Live updates: when a new event lands, drop the cache and refetch.
  const refresh = () => queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
  useWatchContractEvent({
    address: contractAddress,
    abi: contractAbi,
    eventName: "CertificateIssued",
    onLogs: refresh,
  });
  useWatchContractEvent({
    address: contractAddress,
    abi: contractAbi,
    eventName: "CertificateRevoked",
    onLogs: refresh,
  });

  return (
    <section className="card history">
      <h2>Certificate history</h2>
      <p className="hint">
        Reconstructed from on-chain events — the audit trail nobody can edit.
        Revoked certificates stay visible, as they should.
      </p>

      {!contractAddress && (
        <p className="error-text">No deployment found for this network (chain {chainId}).</p>
      )}
      {isLoading && <p className="hint">Loading events…</p>}
      {error && <p className="error-text">{(error as Error).message}</p>}
      {rows && rows.length === 0 && <p className="hint">No certificates issued yet.</p>}

      {rows && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>QC</th>
                <th>Issued</th>
                <th>Issuer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.batchId} className={row.revoked ? "revoked" : ""}>
                  <td><strong>{row.batchId}</strong></td>
                  <td>{QC_LABELS[row.result] ?? row.result}</td>
                  <td>{new Date(row.issuedAt * 1000).toLocaleString()}</td>
                  <td><code>{row.issuer.slice(0, 6)}…{row.issuer.slice(-4)}</code></td>
                  <td>
                    {row.revoked ? (
                      <span className="badge ko" title={row.revokeReason}>
                        Revoked{row.revokeReason ? `: ${row.revokeReason}` : ""}
                      </span>
                    ) : (
                      <span className="badge ok">Active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
