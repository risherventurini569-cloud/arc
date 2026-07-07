import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  FileCheck2,
  FileKey2,
  FileLock2,
  Fingerprint,
  Hash,
  Inbox,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Network,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Stamp,
  UploadCloud,
  X,
} from 'lucide-react'
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'

import './styles.css'

declare global {
  interface Window {
    ethereum?: any
  }
}

const ARC = {
  id: 5042002,
  hexId: '0x4CF1D2',
  name: 'Arc Testnet',
  rpc: 'https://rpc.testnet.arc.network',
  explorer: 'https://testnet.arcscan.app',
  symbol: 'USDC',
  decimals: 6,
}

const USDC = '0x3600000000000000000000000000000000000000' as Address
const REGISTRY = (import.meta.env.VITE_ARC_SEAL_REGISTRY_ADDRESS || '') as Address

const erc20Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const

const registryAbi = [
  {
    type: 'function',
    name: 'registrationFee',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'seal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'manifestHash', type: 'bytes32' },
      { name: 'expiresAt', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revoke',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'verify',
    stateMutability: 'view',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [
      { name: 'issuer', type: 'address' },
      { name: 'sealedAt', type: 'uint64' },
      { name: 'expiresAt', type: 'uint64' },
      { name: 'revoked', type: 'bool' },
      { name: 'manifestHash', type: 'bytes32' },
    ],
  },
] as const

const publicClient = createPublicClient({ transport: http(ARC.rpc) })

type ProviderChoice = { name: string; provider: any; icon?: string }
type Notice = { tone: 'idle' | 'working' | 'success' | 'error'; title: string; body: string; tx?: string }
type SealResult = {
  issuer: Address
  sealedAt: bigint
  expiresAt: bigint
  revoked: boolean
  manifestHash: Hex
}

const initials = (address = '') => `${address.slice(0, 6)}…${address.slice(-4)}`
const safeAddress = (input: string): Address | null => /^0x[a-fA-F0-9]{40}$/.test(input) ? input as Address : null

function bytesToHex(bytes: ArrayBuffer): Hex {
  return `0x${Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('')}` as Hex
}

async function sha256(input: ArrayBuffer | string): Promise<Hex> {
  const buffer = typeof input === 'string' ? new TextEncoder().encode(input).buffer : input
  return bytesToHex(await crypto.subtle.digest('SHA-256', buffer))
}

function formatDate(time: bigint) {
  if (time === 0n) return 'No expiry'
  return new Date(Number(time) * 1000).toLocaleString()
}

function dateToUnix(date: string) {
  if (!date) return 0n
  return BigInt(Math.floor(new Date(`${date}T23:59:59`).getTime() / 1000))
}

function App() {
  const [drawer, setDrawer] = useState(false)
  const [mode, setMode] = useState<'seal' | 'verify'>('seal')
  const [account, setAccount] = useState<Address | null>(null)
  const [provider, setProvider] = useState<any>(null)
  const [providers, setProviders] = useState<ProviderChoice[]>([])
  const [walletOpen, setWalletOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileHash, setFileHash] = useState<Hex | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Agreement')
  const [expiresOn, setExpiresOn] = useState('')
  const [verifyFile, setVerifyFile] = useState<File | null>(null)
  const [verifyHash, setVerifyHash] = useState<Hex | null>(null)
  const [verifyResult, setVerifyResult] = useState<SealResult | null>(null)
  const [fee, setFee] = useState<bigint>(parseUnits('0.01', 6))
  const [notice, setNotice] = useState<Notice>({
    tone: 'idle',
    title: 'Ready to make a verifiable mark.',
    body: REGISTRY ? 'Hash a file locally, then seal only its fingerprint on Arc.' : 'Deploy the registry and add its address to .env to enable live sealing.',
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const verifyRef = useRef<HTMLInputElement>(null)

  const configured = Boolean(REGISTRY && safeAddress(REGISTRY))
  const isArc = useMemo(() => true, [])

  useEffect(() => {
    const found = new Map<any, ProviderChoice>()
    const handler = (event: any) => {
      const detail = event?.detail
      if (!detail?.provider) return
      found.set(detail.provider, { name: detail.info?.name || 'Browser wallet', provider: detail.provider, icon: detail.info?.icon })
      setProviders(Array.from(found.values()))
    }
    window.addEventListener('eip6963:announceProvider', handler)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    if (window.ethereum) {
      found.set(window.ethereum, { name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet', provider: window.ethereum })
      setProviders(Array.from(found.values()))
    }
    return () => window.removeEventListener('eip6963:announceProvider', handler)
  }, [])

  useEffect(() => {
    if (!configured) return
    publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'registrationFee' })
      .then(setFee)
      .catch(() => undefined)
  }, [configured])

  async function ensureArc(active: any) {
    const current = await active.request({ method: 'eth_chainId' })
    if (current?.toLowerCase() === ARC.hexId.toLowerCase()) return
    try {
      await active.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC.hexId }] })
    } catch (error: any) {
      if (error?.code !== 4902) throw error
      await active.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: ARC.hexId,
          chainName: ARC.name,
          rpcUrls: [ARC.rpc],
          nativeCurrency: { name: ARC.symbol, symbol: ARC.symbol, decimals: ARC.decimals },
          blockExplorerUrls: [ARC.explorer],
        }],
      })
    }
  }

  async function connect(choice: ProviderChoice) {
    try {
      setNotice({ tone: 'working', title: 'Connecting your signing device…', body: 'Your wallet will choose the account. ArcSeal never receives a private key.' })
      await ensureArc(choice.provider)
      const accounts = await choice.provider.request({ method: 'eth_requestAccounts' })
      if (!accounts?.[0]) throw new Error('No wallet account was returned.')
      setProvider(choice.provider)
      setAccount(accounts[0] as Address)
      setWalletOpen(false)
      setNotice({ tone: 'success', title: 'Wallet connected to Arc Testnet.', body: `Active account: ${initials(accounts[0])}` })
    } catch (error: any) {
      setNotice({ tone: 'error', title: 'Wallet connection did not complete.', body: error?.message || 'Please unlock your wallet and try again.' })
    }
  }

  async function hashSelected(fileToHash: File, target: 'seal' | 'verify') {
    try {
      const digest = await sha256(await fileToHash.arrayBuffer())
      if (target === 'seal') {
        setFile(fileToHash)
        setFileHash(digest)
        if (!title) setTitle(fileToHash.name.replace(/\.[^/.]+$/, ''))
        setNotice({ tone: 'success', title: 'Fingerprint prepared in this browser.', body: 'The original file stays on your device. Only this 32-byte digest can be sealed.' })
      } else {
        setVerifyFile(fileToHash)
        setVerifyHash(digest)
        setVerifyResult(null)
        setNotice({ tone: 'success', title: 'Verification fingerprint prepared.', body: 'Query Arc to determine whether this exact file has been sealed.' })
      }
    } catch {
      setNotice({ tone: 'error', title: 'The file could not be fingerprinted.', body: 'Try a smaller or different file format.' })
    }
  }

  async function sealDocument() {
    if (!configured) {
      setNotice({ tone: 'error', title: 'Registry address is not configured.', body: 'Deploy ArcSealRegistry, then add VITE_ARC_SEAL_REGISTRY_ADDRESS to .env and restart Vite.' })
      return
    }
    if (!fileHash || !file || !account || !provider) {
      setNotice({ tone: 'error', title: 'A file and connected wallet are required.', body: 'Prepare a local fingerprint and connect an Arc Testnet wallet first.' })
      return
    }
    try {
      await ensureArc(provider)
      const manifestHash = await sha256(JSON.stringify({
        schema: 'arcseal/1',
        title: title || file.name,
        category,
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
      }))
      const walletClient = createWalletClient({ transport: custom(provider) })
      setNotice({ tone: 'working', title: 'Checking your USDC permission…', body: 'ArcSeal charges the published registry fee directly to the configured recipient.' })
      const allowance = await publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account, REGISTRY],
      })
      if (allowance < fee) {
        setNotice({ tone: 'working', title: 'Approve the registry fee in your wallet.', body: `Approval required: ${formatUnits(fee, 6)} USDC.` })
        const approval = await walletClient.writeContract({
          account,
          chain: undefined,
          address: USDC,
          abi: erc20Abi,
          functionName: 'approve',
          args: [REGISTRY, fee],
        })
        await publicClient.waitForTransactionReceipt({ hash: approval })
      }
      setNotice({ tone: 'working', title: 'Seal this fingerprint on Arc.', body: 'Confirm the registry transaction in your wallet.' })
      const tx = await walletClient.writeContract({
        account,
        chain: undefined,
        address: REGISTRY,
        abi: registryAbi,
        functionName: 'seal',
        args: [fileHash, manifestHash, dateToUnix(expiresOn)],
      })
      await publicClient.waitForTransactionReceipt({ hash: tx })
      setNotice({ tone: 'success', title: 'Seal recorded on Arc Testnet.', body: 'The evidence record is now verifiable by the exact file fingerprint.', tx })
      setMode('verify')
      setVerifyFile(file)
      setVerifyHash(fileHash)
      setVerifyResult({ issuer: account, sealedAt: BigInt(Math.floor(Date.now() / 1000)), expiresAt: dateToUnix(expiresOn), revoked: false, manifestHash })
    } catch (error: any) {
      setNotice({ tone: 'error', title: 'No seal was recorded.', body: error?.shortMessage || error?.message || 'The transaction was rejected or reverted.' })
    }
  }

  async function verifyDocument() {
    if (!configured) {
      setNotice({ tone: 'error', title: 'Registry address is not configured.', body: 'Add the deployed registry address to .env before querying a live record.' })
      return
    }
    if (!verifyHash) {
      setNotice({ tone: 'error', title: 'Select the file you want to verify.', body: 'ArcSeal compares the local file fingerprint with the registry.' })
      return
    }
    try {
      setNotice({ tone: 'working', title: 'Searching the public registry…', body: 'This is a read-only Arc RPC request. No signature is required.' })
      const result = await publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'verify', args: [verifyHash] })
      const [issuer, sealedAt, expiresAt, revoked, manifestHash] = result
      if (issuer.toLowerCase() === '0x0000000000000000000000000000000000000000') {
        setVerifyResult(null)
        setNotice({ tone: 'error', title: 'No matching seal exists.', body: 'This exact fingerprint has not been registered in the configured registry.' })
        return
      }
      setVerifyResult({ issuer, sealedAt, expiresAt, revoked, manifestHash })
      setNotice({ tone: revoked ? 'error' : 'success', title: revoked ? 'A matching seal was found but revoked.' : 'An active matching seal was found.', body: 'The file hash matches the public Arc record exactly.' })
    } catch (error: any) {
      setNotice({ tone: 'error', title: 'Registry lookup failed.', body: error?.shortMessage || error?.message || 'Check your RPC connection and registry address.' })
    }
  }

  async function revokeDocument() {
    if (!configured || !verifyHash || !provider || !account) return
    try {
      await ensureArc(provider)
      setNotice({ tone: 'working', title: 'Submit revocation from the original issuer wallet.', body: 'Only the address that created this seal can revoke it.' })
      const walletClient = createWalletClient({ transport: custom(provider) })
      const tx = await walletClient.writeContract({ account, chain: undefined, address: REGISTRY, abi: registryAbi, functionName: 'revoke', args: [verifyHash] })
      await publicClient.waitForTransactionReceipt({ hash: tx })
      setVerifyResult((old) => old ? { ...old, revoked: true } : old)
      setNotice({ tone: 'success', title: 'Seal revoked on Arc Testnet.', body: 'The fingerprint remains visible for audit, now marked as revoked.', tx })
    } catch (error: any) {
      setNotice({ tone: 'error', title: 'Revocation did not complete.', body: error?.shortMessage || error?.message || 'Ensure you are connected with the original issuer account.' })
    }
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value)
    setNotice({ tone: 'success', title: 'Copied to clipboard.', body: 'You can now share the exact fingerprint without sharing the file.' })
  }

  const navItems = ['How it works', 'Registry', 'Privacy model']
  const liveFee = `${formatUnits(fee, 6)} USDC`
  const verifiedState = verifyResult && !verifyResult.revoked && (verifyResult.expiresAt === 0n || verifyResult.expiresAt > BigInt(Math.floor(Date.now() / 1000)))

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="brand-mark"><Stamp size={18} strokeWidth={2.5} /></span>
          <span>ArcSeal</span>
          <small>Registry</small>
        </a>
        <nav className="nav-links">
          {navItems.map((item) => <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}>{item}</a>)}
        </nav>
        <div className="top-actions">
          <span className="network-pill"><span className="pulse" />Arc Testnet</span>
          <button className="wallet-button" onClick={() => setWalletOpen(true)}>
            <LockKeyhole size={15} /> {account ? initials(account) : 'Connect wallet'}
          </button>
          <button className="mobile-menu" onClick={() => setDrawer(true)}><Menu size={19} /></button>
        </div>
      </header>

      <section id="top" className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span /> A public timestamp for a private file</div>
          <h1>Proof, <em>not</em><br />paperwork.</h1>
          <p className="hero-lede">Create a cryptographic fingerprint in your browser. Record only the proof on Arc. Verify an exact document years later without ever uploading it.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => document.getElementById('seal-studio')?.scrollIntoView({ behavior: 'smooth' })}>
              Make a seal <ArrowUpRight size={17} />
            </button>
            <a className="text-link" href="#how-it-works">See the method <ChevronRight size={16} /></a>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={15} /> Browser-local hashing</span>
            <span><Fingerprint size={15} /> Publicly verifiable</span>
            <span><LockKeyhole size={15} /> Non-custodial</span>
          </div>
        </div>

        <div className="seal-stage" aria-label="ArcSeal visual explainer">
          <div className="paper-sheet back-sheet"><span>FORM 08 / RECORD OF ORIGIN</span><i /></div>
          <div className="paper-sheet front-sheet">
            <div className="sheet-header"><span>ARCS / EVIDENCE OFFICE</span><span>ARC-5042002</span></div>
            <div className="sheet-title">Certificate of<br /><b>digital origin</b></div>
            <div className="sheet-lines"><span /><span /><span /><span /></div>
            <div className="sheet-footer"><span>Hash integrity: SHA-256</span><span>Network: Arc</span></div>
          </div>
          <div className="wax-seal"><div><Stamp size={35} /><span>SEALED</span></div></div>
          <div className="proof-tag"><Hash size={14} /> 32-byte proof · not the file</div>
        </div>
      </section>

      <section id="seal-studio" className="studio-shell">
        <div className="studio-heading">
          <div>
            <div className="section-kicker">Seal Studio</div>
            <h2>One fingerprint.<br />A durable public record.</h2>
          </div>
          <div className="mode-switch" role="tablist">
            <button className={mode === 'seal' ? 'active' : ''} onClick={() => setMode('seal')}><Stamp size={15} /> Seal</button>
            <button className={mode === 'verify' ? 'active' : ''} onClick={() => setMode('verify')}><ScanLine size={15} /> Verify</button>
          </div>
        </div>

        {mode === 'seal' ? (
          <div className="seal-workbench">
            <section className="drop-panel">
              <div className="panel-number">01 / LOCAL SOURCE</div>
              <input ref={fileRef} type="file" hidden onChange={(event) => event.target.files?.[0] && hashSelected(event.target.files[0], 'seal')} />
              <button className={`dropzone ${file ? 'is-filled' : ''}`} onClick={() => fileRef.current?.click()}>
                <span className="drop-icon">{file ? <FileCheck2 size={28} /> : <UploadCloud size={28} />}</span>
                <strong>{file ? file.name : 'Choose a document'}</strong>
                <small>{file ? `${(file.size / 1024).toFixed(1)} KB · fingerprint ready` : 'PDF, DOCX, image, CSV, or any local file'}</small>
                <span className="drop-privacy"><LockKeyhole size={13} /> Never leaves this device</span>
              </button>
              <div className="hash-card">
                <div><Hash size={15} /><span>Content fingerprint</span></div>
                <code>{fileHash || '— waiting for a local file —'}</code>
                {fileHash && <button aria-label="Copy file hash" onClick={() => copy(fileHash)}><Copy size={14} /></button>}
              </div>
            </section>

            <section className="details-panel">
              <div className="panel-number">02 / OPTIONAL CONTEXT</div>
              <label>Record title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Supplier agreement v2" /></label>
              <div className="field-grid">
                <label>Record type<select value={category} onChange={(e) => setCategory(e.target.value)}><option>Agreement</option><option>Invoice</option><option>Research note</option><option>Creative work</option><option>Compliance file</option><option>Other</option></select></label>
                <label>Expiry date <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} /></label>
              </div>
              <div className="manifest-note"><FileKey2 size={16} /><p>Title and file details are compressed into a second local manifest hash. They are not stored as readable text onchain.</p></div>
              <div className="fee-line"><span>Registry fee</span><b>{liveFee}</b><small>Direct USDC payment to registry recipient</small></div>
              <button className="seal-button" onClick={sealDocument} disabled={!fileHash || !account || !configured}>
                <Stamp size={17} /> {configured ? 'Approve & seal on Arc' : 'Registry address required'}
              </button>
              {!account && <button className="connect-inline" onClick={() => setWalletOpen(true)}>Connect an Arc wallet to sign <ChevronRight size={15} /></button>}
            </section>
          </div>
        ) : (
          <div className="verify-workbench">
            <section className="verify-input">
              <div className="panel-number">01 / PRESENT THE ORIGINAL</div>
              <input ref={verifyRef} type="file" hidden onChange={(event) => event.target.files?.[0] && hashSelected(event.target.files[0], 'verify')} />
              <button className={`verify-drop ${verifyFile ? 'is-filled' : ''}`} onClick={() => verifyRef.current?.click()}>
                <Fingerprint size={32} />
                <strong>{verifyFile ? verifyFile.name : 'Drop the file to verify'}</strong>
                <small>ArcSeal computes the same local SHA-256 fingerprint.</small>
              </button>
              <div className="verify-actions"><button className="primary dark" onClick={verifyDocument} disabled={!verifyHash || !configured}><ScanLine size={16} /> Check Arc registry</button>{verifyHash && <code>{verifyHash}</code>}</div>
            </section>
            <section className={`verification-card ${verifyResult ? (verifiedState ? 'valid' : 'invalid') : ''}`}>
              {!verifyResult ? <><div className="empty-mark"><CircleHelp size={27} /></div><h3>Awaiting verification</h3><p>Use the original file. A renamed, exported, or edited copy produces a different fingerprint.</p></> : <>
                <div className="result-top"><span className="result-icon">{verifiedState ? <BadgeCheck size={26} /> : <AlertCircle size={26} />}</span><span className="result-label">{verifiedState ? 'VALID MATCH' : verifyResult.revoked ? 'REVOKED MATCH' : 'EXPIRED MATCH'}</span></div>
                <h3>{verifiedState ? 'This exact file has an active seal.' : 'The file exists in the registry, but is not active.'}</h3>
                <dl><div><dt>Issuer</dt><dd>{initials(verifyResult.issuer)}</dd></div><div><dt>Sealed</dt><dd>{formatDate(verifyResult.sealedAt)}</dd></div><div><dt>Expiry</dt><dd>{formatDate(verifyResult.expiresAt)}</dd></div><div><dt>Manifest</dt><dd>{initials(verifyResult.manifestHash)}</dd></div></dl>
                <div className="result-actions"><a href={`${ARC.explorer}/address/${REGISTRY}`} target="_blank" rel="noreferrer">View registry <ArrowUpRight size={14} /></a>{account?.toLowerCase() === verifyResult.issuer.toLowerCase() && !verifyResult.revoked && <button onClick={revokeDocument}><X size={14} /> Revoke this seal</button>}</div>
              </>}
            </section>
          </div>
        )}

        <aside className={`notice ${notice.tone}`}>
          <span>{notice.tone === 'working' ? <LoaderCircle className="spin" size={18} /> : notice.tone === 'success' ? <Check size={18} /> : notice.tone === 'error' ? <AlertCircle size={18} /> : <Inbox size={18} />}</span>
          <div><strong>{notice.title}</strong><p>{notice.body}</p>{notice.tx && <a href={`${ARC.explorer}/tx/${notice.tx}`} target="_blank" rel="noreferrer">View transaction <ArrowUpRight size={14} /></a>}</div>
        </aside>
      </section>

      <section id="how-it-works" className="method-section">
        <div className="method-intro"><div className="section-kicker">The method</div><h2>File in.<br />Proof out.</h2><p>A document is not uploaded, published, or stored by ArcSeal. The browser calculates a precise fingerprint; the registry stores only that fingerprint, the issuer, and a timestamp.</p></div>
        <div className="method-steps">
          <article><span>01</span><FileLock2 size={24} /><h3>Hash locally</h3><p>Your browser calculates SHA-256 directly from the selected file.</p></article>
          <article><span>02</span><Stamp size={24} /><h3>Seal on Arc</h3><p>Your wallet signs an onchain record after a visible USDC approval.</p></article>
          <article><span>03</span><ScanLine size={24} /><h3>Verify exactly</h3><p>Any party hashes the original file and compares it with the public record.</p></article>
        </div>
      </section>

      <section id="registry" className="registry-band">
        <div className="registry-orb"><div><Network size={32} /><span>ARC</span></div></div>
        <div><div className="section-kicker">Registry rules</div><h2>Public proof.<br />Private source.</h2></div>
        <div className="registry-rules"><p><b>Immutable origin:</b> A content hash can be sealed once. Duplicate registrations revert.</p><p><b>Issuer control:</b> The address that issued a seal can revoke it, but not erase its audit trail.</p><p><b>Direct fee flow:</b> Any registration fee moves via USDC from the signer to the configured recipient—no backend custody.</p></div>
      </section>

      <section id="privacy-model" className="privacy-section">
        <div><div className="section-kicker">Privacy model</div><h2>The registry sees evidence,<br /><em>never the evidence file.</em></h2></div>
        <div className="privacy-grid"><div><LockKeyhole size={20} /><h3>No file uploads</h3><p>Hashing runs locally through the browser Web Crypto API.</p></div><div><Link2 size={20} /><h3>No private-key custody</h3><p>Every state change is signed by the wallet you select.</p></div><div><RefreshCcw size={20} /><h3>Verifiable revocation</h3><p>Revoked records remain visible for audit and due diligence.</p></div></div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark"><Stamp size={16} /></span><span>ArcSeal</span></a><p>Document evidence registry for Arc Testnet. Testnet only.</p><div><a href={`${ARC.explorer}`} target="_blank" rel="noreferrer">ArcScan <ArrowUpRight size={13} /></a><a href="https://docs.arc.network" target="_blank" rel="noreferrer">Arc Docs <ArrowUpRight size={13} /></a></div></footer>

      {walletOpen && <div className="modal-backdrop" onMouseDown={() => setWalletOpen(false)}><div className="wallet-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setWalletOpen(false)}><X size={18} /></button><div className="modal-seal"><Stamp size={22} /></div><h3>Choose a wallet</h3><p>Connect a browser wallet to create or revoke Arc records.</p><div className="wallet-list">{providers.length ? providers.map((choice) => <button key={choice.name} onClick={() => connect(choice)}>{choice.icon ? <img src={choice.icon} alt="" /> : <span className="wallet-fallback"><LockKeyhole size={16} /></span>}<span>{choice.name}</span><ChevronRight size={17} /></button>) : <div className="no-wallet"><AlertCircle size={17} /> No EIP-6963 wallet was found. Install MetaMask or OKX Wallet, then refresh.</div>}</div><small>ArcSeal never requests a recovery phrase or private key.</small></div></div>}
      {drawer && <div className="drawer"><button onClick={() => setDrawer(false)}><X size={20} /></button>{navItems.map((item) => <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`} onClick={() => setDrawer(false)}>{item}</a>)}<button className="wallet-button" onClick={() => { setDrawer(false); setWalletOpen(true) }}><LockKeyhole size={15} /> Connect wallet</button></div>}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
