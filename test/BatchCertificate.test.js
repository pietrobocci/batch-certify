const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// QcResult enum, mirrored from the contract (Solidity enums are just uint8)
const Qc = { None: 0, Released: 1, Rejected: 2, Quarantine: 3 };

// A realistic document fingerprint: in production this would be the
// SHA-256 of the batch record file; any 32-byte value works on-chain.
const DOC_HASH = ethers.keccak256(ethers.toUtf8Bytes("batch record content"));
const OTHER_HASH = ethers.keccak256(ethers.toUtf8Bytes("tampered content"));

describe("BatchCertificate", function () {
  // Deploys a fresh contract and prepares three actors:
  //   admin  — manages roles, cannot issue
  //   issuer — granted ISSUER_ROLE, does the actual work
  //   anyone — no roles at all (a verifier, or an attacker)
  async function deploy() {
    const [admin, issuer, anyone] = await ethers.getSigners();
    const contract = await ethers.deployContract("BatchCertificate", [admin.address]);
    await contract.connect(admin).grantRole(await contract.ISSUER_ROLE(), issuer.address);
    return { contract, admin, issuer, anyone };
  }

  describe("issue", function () {
    it("stores the certificate and emits CertificateIssued", async function () {
      const { contract, issuer } = await loadFixture(deploy);

      await expect(
        contract.connect(issuer).issue("LOT-2026-0042", DOC_HASH, Qc.Released)
      )
        .to.emit(contract, "CertificateIssued")
        .withArgs(
          "LOT-2026-0042",
          ethers.keccak256(ethers.toUtf8Bytes("LOT-2026-0042")),
          DOC_HASH,
          Qc.Released,
          issuer.address
        );

      const cert = await contract.getCertificate("LOT-2026-0042");
      expect(cert.docHash).to.equal(DOC_HASH);
      expect(cert.issuer).to.equal(issuer.address);
      expect(cert.result).to.equal(Qc.Released);
      expect(cert.revoked).to.equal(false);
      expect(cert.issuedAt).to.be.greaterThan(0);
    });

    it("rejects an account without ISSUER_ROLE", async function () {
      const { contract, anyone, admin } = await loadFixture(deploy);

      // A random account cannot issue...
      await expect(
        contract.connect(anyone).issue("LOT-1", DOC_HASH, Qc.Released)
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");

      // ...and neither can the admin: managing roles and issuing are
      // deliberately separate responsibilities.
      await expect(
        contract.connect(admin).issue("LOT-1", DOC_HASH, Qc.Released)
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });

    it("rejects a duplicate batch id", async function () {
      const { contract, issuer } = await loadFixture(deploy);
      await contract.connect(issuer).issue("LOT-1", DOC_HASH, Qc.Released);

      await expect(
        contract.connect(issuer).issue("LOT-1", OTHER_HASH, Qc.Released)
      ).to.be.revertedWithCustomError(contract, "CertificateAlreadyExists");
    });

    it("rejects QcResult.None and an empty hash", async function () {
      const { contract, issuer } = await loadFixture(deploy);

      await expect(
        contract.connect(issuer).issue("LOT-1", DOC_HASH, Qc.None)
      ).to.be.revertedWithCustomError(contract, "InvalidQcResult");

      await expect(
        contract.connect(issuer).issue("LOT-1", ethers.ZeroHash, Qc.Released)
      ).to.be.revertedWithCustomError(contract, "InvalidDocHash");
    });
  });

  describe("verify", function () {
    it("returns true for the original document, false for a tampered one", async function () {
      const { contract, issuer, anyone } = await loadFixture(deploy);
      await contract.connect(issuer).issue("LOT-1", DOC_HASH, Qc.Released);

      // Anyone can verify — no role, no transaction, no gas.
      expect(await contract.connect(anyone).verify("LOT-1", DOC_HASH)).to.equal(true);
      expect(await contract.connect(anyone).verify("LOT-1", OTHER_HASH)).to.equal(false);
    });

    it("returns false for an unknown batch id", async function () {
      const { contract, anyone } = await loadFixture(deploy);
      expect(await contract.connect(anyone).verify("NO-SUCH-LOT", DOC_HASH)).to.equal(false);
    });

    it("returns false after revocation", async function () {
      const { contract, issuer } = await loadFixture(deploy);
      await contract.connect(issuer).issue("LOT-1", DOC_HASH, Qc.Released);
      await contract.connect(issuer).revoke("LOT-1", "issued by mistake");

      expect(await contract.verify("LOT-1", DOC_HASH)).to.equal(false);
    });
  });

  describe("revoke", function () {
    it("marks the certificate as revoked and emits the event", async function () {
      const { contract, issuer } = await loadFixture(deploy);
      await contract.connect(issuer).issue("LOT-1", DOC_HASH, Qc.Released);

      await expect(contract.connect(issuer).revoke("LOT-1", "wrong batch record"))
        .to.emit(contract, "CertificateRevoked")
        .withArgs(
          "LOT-1",
          ethers.keccak256(ethers.toUtf8Bytes("LOT-1")),
          "wrong batch record",
          issuer.address
        );

      // The record is still there (audit trail), just flagged.
      const cert = await contract.getCertificate("LOT-1");
      expect(cert.revoked).to.equal(true);
      expect(cert.docHash).to.equal(DOC_HASH);
    });

    it("cannot revoke twice, nor revoke a missing certificate", async function () {
      const { contract, issuer } = await loadFixture(deploy);
      await contract.connect(issuer).issue("LOT-1", DOC_HASH, Qc.Released);
      await contract.connect(issuer).revoke("LOT-1", "first");

      await expect(
        contract.connect(issuer).revoke("LOT-1", "second")
      ).to.be.revertedWithCustomError(contract, "CertificateIsRevoked");

      await expect(
        contract.connect(issuer).revoke("LOT-99", "ghost")
      ).to.be.revertedWithCustomError(contract, "CertificateNotFound");
    });

    it("requires ISSUER_ROLE", async function () {
      const { contract, issuer, anyone } = await loadFixture(deploy);
      await contract.connect(issuer).issue("LOT-1", DOC_HASH, Qc.Released);

      await expect(
        contract.connect(anyone).revoke("LOT-1", "attack")
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });
  });

  describe("roles", function () {
    it("admin can grant and revoke ISSUER_ROLE", async function () {
      const { contract, admin, anyone } = await loadFixture(deploy);
      const role = await contract.ISSUER_ROLE();

      await contract.connect(admin).grantRole(role, anyone.address);
      await contract.connect(anyone).issue("LOT-1", DOC_HASH, Qc.Released); // now allowed

      await contract.connect(admin).revokeRole(role, anyone.address);
      await expect(
        contract.connect(anyone).issue("LOT-2", DOC_HASH, Qc.Released)
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });

    it("non-admin cannot grant roles", async function () {
      const { contract, issuer, anyone } = await loadFixture(deploy);
      await expect(
        contract.connect(issuer).grantRole(await contract.ISSUER_ROLE(), anyone.address)
      ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });
  });

  describe("getCertificate", function () {
    it("reverts for an unknown batch id", async function () {
      const { contract } = await loadFixture(deploy);
      await expect(
        contract.getCertificate("NO-SUCH-LOT")
      ).to.be.revertedWithCustomError(contract, "CertificateNotFound");
    });
  });
});
