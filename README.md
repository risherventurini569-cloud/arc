## ArcSeal — Privacy-First On-Chain File Proof and Verification

ArcSeal is a privacy-first document proof and verification application built on Arc Testnet. It allows users to create an immutable on-chain timestamp and authenticity record for a file without uploading the original file to a server, backend, or smart contract.

Many important digital files—such as agreements, research records, design drafts, certificates, source materials, reports, and delivery documents—need a reliable way to prove when they existed and whether they were later modified. Traditional file storage platforms may store the original document centrally, creating privacy, ownership, and long-term verification concerns.

ArcSeal solves this by using local file hashing.

When a user selects a file, the browser calculates a SHA-256 content hash locally. The original file never leaves the user’s device. Only the cryptographic hash, issuer wallet address, timestamp, optional expiry time, and a lightweight metadata reference are recorded on Arc Testnet.

The main workflow is:

```text
Select File
→ Generate SHA-256 hash locally in the browser
→ Approve USDC registration fee
→ Seal the file fingerprint on Arc Testnet
→ Receive an immutable on-chain proof record
→ Anyone can verify the original file later
```

To verify a document, a user uploads the original file locally again. ArcSeal recalculates its hash and checks the ArcSealRegistry contract to determine whether the file was previously sealed, who issued the proof, when it was registered, whether the record has expired, and whether it has been revoked.

The project supports three main on-chain actions:

* **Seal**: Register a file fingerprint and create an immutable proof record.
* **Verify**: Check whether a locally hashed file matches an on-chain record.
* **Revoke**: Allow the original issuer to revoke a previously created proof record when necessary.

ArcSeal uses a transparent wallet-native payment model. Users approve a small USDC registration fee before creating a proof record, and the fee is transferred directly through the smart contract. The platform does not custody user assets, store private keys, upload source files, or sign transactions on behalf of users.

The application is built as a real Arc Testnet DApp with browser-wallet connection, Arc network detection and switching, USDC approval, wallet-signed transactions, pending/success/failure states, transaction hashes, and ArcScan links.

ArcSeal demonstrates a non-financial use case for Arc: privacy-preserving document verification, intellectual-property timestamping, research-data provenance, digital certificate validation, agreement proof, milestone evidence, and tamper-evident file records.
![Uploading 1c7bf19ed288acfa2fdef82c55ed67d2.png…]()
