// Revokes a certificate — handy for demos and manual testing.
//
// Usage (env vars, since hardhat run does not forward CLI args):
//   BATCH_ID=LOT-2026-0007 REASON="issued by mistake" npm run revoke
// PowerShell:
//   $env:BATCH_ID="LOT-2026-0007"; $env:REASON="issued by mistake"; npm run revoke
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const { waitForNode } = require("./helpers/wait-for-node");

async function main() {
  const batchId = process.env.BATCH_ID;
  const reason = process.env.REASON ?? "";
  if (!batchId) throw new Error("Set BATCH_ID (and optionally REASON).");

  await waitForNode(ethers.provider);

  // deployed.json maps chainId -> deployment (multichain, see deploy.js)
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const deployments = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployed.json"), "utf8")
  );
  if (!deployments[chainId]) {
    throw new Error(`No deployment for chainId ${chainId}: run the deploy first.`);
  }
  const contract = await ethers.getContractAt(
    "BatchCertificate",
    deployments[chainId].address
  );

  console.log(`Revoking ${batchId} (reason: "${reason}")...`);
  await (await contract.revoke(batchId, reason)).wait();
  console.log("Done. The history table in the UI updates on its own.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
