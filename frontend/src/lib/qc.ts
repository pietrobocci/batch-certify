// Mirror of the contract's QcResult enum. Solidity enums travel as
// plain uint8 over the ABI, so the mapping to labels lives here.
export const QcResult = {
  None: 0,
  Released: 1,
  Rejected: 2,
  Quarantine: 3,
} as const;

export const QC_LABELS: Record<number, string> = {
  [QcResult.None]: "—",
  [QcResult.Released]: "Released",
  [QcResult.Rejected]: "Rejected",
  [QcResult.Quarantine]: "Quarantine",
};
