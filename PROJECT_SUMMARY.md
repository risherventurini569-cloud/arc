# ArcSeal — Project Summary

## One-line description

ArcSeal is a privacy-preserving, browser-local document fingerprint registry that lets users create and verify non-custodial evidence records on Arc Testnet.

## The problem

Organizations often need to prove that a specific agreement, research draft, creative file, compliance record, or business artifact existed in a precise form at a particular time. Existing workflows depend on screenshots, emailed attachments, private storage, or centralized timestamping vendors. They either expose the document or make verification dependent on the original system.

## The solution

ArcSeal computes a SHA-256 fingerprint inside the browser. The original file never leaves the device. The application writes only the fingerprint and minimal integrity metadata to Arc Testnet. Later, any party can upload the original file locally, recompute the fingerprint, and obtain a public match result from the registry.

## Key workflows

```text
Local file → SHA-256 browser fingerprint → USDC approval → Arc seal transaction
Original file → local re-hash → public Arc verification
Original issuer wallet → revoke a seal while preserving the audit trail
```

## Why Arc

ArcSeal uses Arc Testnet for EVM-compatible wallet transactions, public contract state, and visible stablecoin fee settlement. The app uses the official Arc Testnet USDC ERC-20 interface for the registry `Approve → transferFrom` fee flow.

## Technical implementation

- React + TypeScript + Vite frontend
- viem for wallet and contract interaction
- EIP-6963 browser-wallet discovery
- Arc Testnet chain detection and add/switch flow
- Web Crypto API SHA-256 hashing in the browser
- Solidity `ArcSealRegistry` smart contract
- explicit USDC approval, transaction status, hash, and ArcScan link
- no backend key custody, file storage, or transaction relaying

## Visual identity

ArcSeal is deliberately distinct from common crypto terminals. It uses a parchment, ink, wax-seal, archive-record visual language with an editorial Seal Studio and a separate verification workspace. The product is designed around proof-of-origin rather than trading, payments, invoices, procurement, or lending.
