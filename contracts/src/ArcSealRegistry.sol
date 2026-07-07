// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/// @title ArcSealRegistry
/// @notice A non-custodial document-fingerprint registry for Arc Testnet.
/// @dev Files never enter this contract. A browser computes a SHA-256 digest locally,
///      and the digest plus a metadata manifest digest is sealed onchain.
contract ArcSealRegistry {
    struct Seal {
        address issuer;
        uint64 sealedAt;
        uint64 expiresAt;
        bool revoked;
        bytes32 manifestHash;
    }

    IERC20 public immutable usdc;
    address public immutable feeRecipient;
    uint256 public immutable registrationFee;

    mapping(bytes32 => Seal) private seals;

    event SealCreated(
        bytes32 indexed contentHash,
        address indexed issuer,
        bytes32 indexed manifestHash,
        uint64 expiresAt,
        uint256 fee
    );
    event SealRevoked(bytes32 indexed contentHash, address indexed issuer);

    error ZeroAddress();
    error InvalidFeeRecipient();
    error DuplicateSeal();
    error MissingSeal();
    error NotIssuer();
    error TransferFailed();
    error ExpiryInPast();

    constructor(address usdc_, address feeRecipient_, uint256 registrationFee_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        if (feeRecipient_ == address(0)) revert InvalidFeeRecipient();
        usdc = IERC20(usdc_);
        feeRecipient = feeRecipient_;
        registrationFee = registrationFee_;
    }

    /// @notice Charges the fixed registration fee directly to the configured recipient,
    ///         then writes an immutable document fingerprint record.
    function seal(bytes32 contentHash, bytes32 manifestHash, uint64 expiresAt) external {
        if (seals[contentHash].issuer != address(0)) revert DuplicateSeal();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert ExpiryInPast();

        if (registrationFee != 0) {
            bool ok = usdc.transferFrom(msg.sender, feeRecipient, registrationFee);
            if (!ok) revert TransferFailed();
        }

        seals[contentHash] = Seal({
            issuer: msg.sender,
            sealedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false,
            manifestHash: manifestHash
        });

        emit SealCreated(contentHash, msg.sender, manifestHash, expiresAt, registrationFee);
    }

    /// @notice Only the original issuer can revoke a fingerprint.
    function revoke(bytes32 contentHash) external {
        Seal storage record = seals[contentHash];
        if (record.issuer == address(0)) revert MissingSeal();
        if (record.issuer != msg.sender) revert NotIssuer();
        record.revoked = true;
        emit SealRevoked(contentHash, msg.sender);
    }

    /// @notice Read-only public verification endpoint.
    function verify(bytes32 contentHash)
        external
        view
        returns (
            address issuer,
            uint64 sealedAt,
            uint64 expiresAt,
            bool revoked,
            bytes32 manifestHash
        )
    {
        Seal memory record = seals[contentHash];
        return (
            record.issuer,
            record.sealedAt,
            record.expiresAt,
            record.revoked,
            record.manifestHash
        );
    }
}
