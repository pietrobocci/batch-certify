// Issues demo certificates so the UI has something to verify.
//
// Usage (after npm run deploy):  npm run seed
//
//   LOT-2026-0042 — hash of docs/sample-batch-record.txt, Released.
//                   Upload that file in the Verify panel: Authentic.
//   LOT-2026-0007 — Rejected batch, hash of an in-memory string.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("hardhat");
const { waitForNode } = require("./helpers/wait-for-node");

// Same algorithm the frontend uses (Web Crypto SHA-256): the fingerprint
// of a file is identical no matter who computes it — that's the contract
// (pun intended) between issuer and verifier.
const sha256 = (buf) => "0x" + crypto.createHash("sha256").update(buf).digest("hex");

async function main() {
  await waitForNode(ethers.provider);

  const { address } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed.json"), "utf8")
  );
  const contract = await ethers.getContractAt("BatchCertificate", address);

  const sampleFile = path.join(__dirname, "..", "docs", "sample-batch-record.txt");
  const sampleHash = sha256(fs.readFileSync(sampleFile));

  console.log(`Issuing LOT-2026-0042 (Released) — hash ${sampleHash}`);
  await (await contract.issue("LOT-2026-0042", sampleHash, 1 /* Released */)).wait();

  const rejectedHash = sha256(Buffer.from("rejected batch record, demo only"));
  console.log(`Issuing LOT-2026-0007 (Rejected) — hash ${rejectedHash}`);
  await (await contract.issue("LOT-2026-0007", rejectedHash, 2 /* Rejected */)).wait();

  console.log("\nSeed complete. Try the Verify panel with docs/sample-batch-record.txt");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
