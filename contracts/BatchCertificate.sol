// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title BatchCertificate — on-chain certificates for production batches
/// @notice Anchors a fingerprint (hash) of a batch record on-chain together
///         with the QC outcome, the issuer's address and a timestamp.
///         The raw batch data never touches the chain: only its hash does,
///         so anyone holding the original document can prove it has not
///         been altered since certification, without disclosing it.
/// @dev    Design choices, in the spirit of GMP data integrity (ALCOA+):
///         - certificates are never deleted or overwritten: errors are
///           handled by revoking and issuing a new certificate, so the
///           full history stays auditable (events are the audit trail);
///         - who can issue is controlled with role-based access
///           (OpenZeppelin AccessControl): only ISSUER_ROLE can write,
///           the admin only manages roles.
contract BatchCertificate is AccessControl {
    /// @notice Role required to issue and revoke certificates.
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /// @notice QC outcome of the batch. `None` marks "no certificate".
    enum QcResult {
        None,
        Released,
        Rejected,
        Quarantine
    }

    struct Certificate {
        bytes32 docHash;   // hash (e.g. SHA-256) of the full batch record
        address issuer;    // who issued it (msg.sender, signature-backed)
        uint64 issuedAt;   // block timestamp at issuance
        QcResult result;   // QC outcome
        bool revoked;      // true = no longer valid (audit trail kept)
    }

    /// @dev Keyed by keccak256 of the human-readable batch id, so the
    ///      storage key has a fixed size regardless of id length.
    mapping(bytes32 => Certificate) private _certificates;

    event CertificateIssued(
        string batchId,
        bytes32 indexed batchKey,
        bytes32 docHash,
        QcResult result,
        address indexed issuer
    );

    event CertificateRevoked(
        string batchId,
        bytes32 indexed batchKey,
        string reason,
        address indexed revokedBy
    );

    error CertificateAlreadyExists(string batchId);
    error CertificateNotFound(string batchId);
    error CertificateIsRevoked(string batchId);
    error InvalidQcResult();
    error InvalidDocHash();

    /// @param admin Account that manages roles (grants/revokes ISSUER_ROLE).
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Issue a certificate for a production batch.
    /// @param batchId  Human-readable batch identifier (e.g. "LOT-2026-0042").
    /// @param docHash  Hash of the complete batch record document.
    /// @param result   QC outcome; must not be `None`.
    function issue(
        string calldata batchId,
        bytes32 docHash,
        QcResult result
    ) external onlyRole(ISSUER_ROLE) {
        if (result == QcResult.None) revert InvalidQcResult();
        if (docHash == bytes32(0)) revert InvalidDocHash();

        bytes32 key = _key(batchId);
        if (_certificates[key].result != QcResult.None) {
            revert CertificateAlreadyExists(batchId);
        }

        _certificates[key] = Certificate({
            docHash: docHash,
            issuer: msg.sender,
            issuedAt: uint64(block.timestamp),
            result: result,
            revoked: false
        });

        emit CertificateIssued(batchId, key, docHash, result, msg.sender);
    }

    /// @notice Revoke a certificate (e.g. issued by mistake). The record
    ///         stays on-chain for auditability; a new certificate for the
    ///         same batch id can NOT be issued — issue under a corrected id.
    function revoke(
        string calldata batchId,
        string calldata reason
    ) external onlyRole(ISSUER_ROLE) {
        bytes32 key = _key(batchId);
        Certificate storage cert = _certificates[key];

        if (cert.result == QcResult.None) revert CertificateNotFound(batchId);
        if (cert.revoked) revert CertificateIsRevoked(batchId);

        cert.revoked = true;
        emit CertificateRevoked(batchId, key, reason, msg.sender);
    }

    /// @notice Full certificate data for a batch id (for UIs and audits).
    function getCertificate(
        string calldata batchId
    ) external view returns (Certificate memory cert) {
        cert = _certificates[_key(batchId)];
        if (cert.result == QcResult.None) revert CertificateNotFound(batchId);
    }

    /// @notice Core verification: does `docHash` match the certificate
    ///         issued for `batchId`, and is that certificate still valid?
    /// @dev    Read-only and free to call: any party holding the original
    ///         document can verify it independently.
    /// @return valid True only if a certificate exists, is not revoked
    ///         and its stored hash equals `docHash`.
    function verify(
        string calldata batchId,
        bytes32 docHash
    ) external view returns (bool valid) {
        Certificate storage cert = _certificates[_key(batchId)];
        return
            cert.result != QcResult.None &&
            !cert.revoked &&
            cert.docHash == docHash;
    }

    /// @dev Fixed-size storage key from a human-readable batch id.
    function _key(string calldata batchId) private pure returns (bytes32) {
        return keccak256(bytes(batchId));
    }
}
