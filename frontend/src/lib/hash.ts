// Client-side document hashing.
//
// The file is hashed IN THE BROWSER with the Web Crypto API: its content
// never leaves the user's machine — only the 32-byte fingerprint goes
// on-chain. This is the whole point of hash anchoring.
//
// SHA-256 is used (not keccak256) because it is the universal standard
// for document fingerprints: anyone can re-compute it with standard
// tools (`sha256sum`, PowerShell Get-FileHash) without touching any
// blockchain tooling. The contract stores the hash as opaque bytes32.
export async function sha256File(file: File): Promise<`0x${string}`> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

/** True if the string is a well-formed 32-byte hex hash. */
export function isBytes32(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
