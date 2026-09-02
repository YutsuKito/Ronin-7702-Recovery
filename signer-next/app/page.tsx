'use client'

import { useState } from 'react'
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHex,
  keccak256,
  recoverAddress,
  type Address,
  type Hex,
} from 'viem'
import { ronin } from 'viem/chains'
import { hashAuthorization } from 'viem/utils'

const RONIN_CHAIN_ID = 2020
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const OFFICIAL_RONIN_RPC_URL = 'https://api.roninchain.com/rpc'
const LOCKBOX_WS_URL = 'wss://lockbox.skymavis.com'

type RescuePlan = {
  version: 1
  createdAt: string
  victim: Address
  chainId: number
  rpcUrl: string
  inspection: {
    victim: Address
    chainId: number
    balanceWei: string
    balanceRon: string
    nonce: number
    code: Hex
    eip7702: boolean
    currentDelegate: Address | null
  }
  authorization: {
    chainId: number
    contractAddress: Address
    nonce: number
    rawMessage: Hex
    hash: Hex
  }
}

type SignedRescue = {
  version: 1
  createdAt: string
  victim: Address
  currentDelegate: Address | null
  authorizationNonce: number
  authorizationHash: Hex
  signature: Hex
  recoveredSigner: Address
}

type StatusState = {
  message: string
  type: 'info' | 'ok' | 'error'
}

function sameAddress(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase()
}

function validatePlan(candidate: unknown): RescuePlan {
  if (!candidate || typeof candidate !== 'object') throw new Error('Invalid rescue plan JSON.')

  const value = candidate as Partial<RescuePlan>
  const authorization = value.authorization
  const inspection = value.inspection

  if (value.version !== 1) throw new Error('Unsupported rescue plan version.')
  if (!value.victim || !isAddress(value.victim)) throw new Error('Invalid affected address.')
  if (value.chainId !== RONIN_CHAIN_ID) throw new Error('Plan is not for Ronin Mainnet.')
  if (!authorization || !inspection) throw new Error('Plan authorization/inspection is missing.')
  if (authorization.chainId !== RONIN_CHAIN_ID) throw new Error('Authorization chain ID is not 2020.')
  if (!isAddress(authorization.contractAddress) || !sameAddress(authorization.contractAddress, ZERO_ADDRESS)) {
    throw new Error('Refusing to sign: authorization target is not the zero address.')
  }
  if (!Number.isSafeInteger(authorization.nonce) || authorization.nonce < 0) {
    throw new Error('Authorization nonce is invalid.')
  }
  if (!inspection.eip7702 || !isHex(inspection.code) || !inspection.code.toLowerCase().startsWith('0xef0100')) {
    throw new Error('Plan does not describe an active EIP-7702 delegation.')
  }
  if (inspection.nonce !== authorization.nonce) {
    throw new Error('Inspection nonce and authorization nonce do not match.')
  }
  if (!isHex(authorization.rawMessage) || !authorization.rawMessage.toLowerCase().startsWith('0x05')) {
    throw new Error('Authorization raw message is invalid.')
  }
  if (!isHex(authorization.hash)) throw new Error('Authorization hash is invalid.')

  const rawHash = keccak256(authorization.rawMessage)
  if (rawHash.toLowerCase() !== authorization.hash.toLowerCase()) {
    throw new Error('Raw message hash does not match the rescue plan.')
  }

  const referenceHash = hashAuthorization({
    chainId: RONIN_CHAIN_ID,
    contractAddress: ZERO_ADDRESS,
    nonce: authorization.nonce,
  })
  if (referenceHash.toLowerCase() !== authorization.hash.toLowerCase()) {
    throw new Error('Viem authorization hash does not match the rescue plan.')
  }

  return value as RescuePlan
}

async function freshPreflight(plan: RescuePlan) {
  const publicClient = createPublicClient({
    chain: ronin,
    transport: http(OFFICIAL_RONIN_RPC_URL),
  })

  const [chainId, code, nonce] = await Promise.all([
    publicClient.getChainId(),
    publicClient.getCode({ address: plan.victim }),
    publicClient.getTransactionCount({ address: plan.victim }),
  ])

  if (chainId !== RONIN_CHAIN_ID) throw new Error(`Unexpected chain ID: ${chainId}`)
  if (nonce !== plan.authorization.nonce) {
    throw new Error(`Plan is stale: account nonce changed from ${plan.authorization.nonce} to ${nonce}. Generate a new rescue plan.`)
  }
  if (!code || code.toLowerCase() !== plan.inspection.code.toLowerCase()) {
    throw new Error('Plan is stale: EIP-7702 code/delegate changed. Generate a new rescue plan.')
  }
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return String(error)
  const output = [error.message]
  const seen = new Set<unknown>([error])
  let current: unknown = error

  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== 'object' || !('cause' in current)) break
    const cause = (current as { cause?: unknown }).cause
    if (!cause || seen.has(cause)) break
    seen.add(cause)
    output.push(cause instanceof Error ? `Cause ${depth + 1}: ${cause.name}: ${cause.message}` : `Cause ${depth + 1}: ${String(cause)}`)
    current = cause
  }

  return output.join('\n')
}

export default function SignerPage() {
  const [plan, setPlan] = useState<RescuePlan>()
  const [clientId, setClientId] = useState('')
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [waypointToken, setWaypointToken] = useState<string>()
  const [signedRescue, setSignedRescue] = useState<SignedRescue>()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<StatusState>({
    message: 'Load rescue-plan.json. This interface has no application backend and cannot broadcast transactions.',
    type: 'info',
  })

  async function loadPlan(file?: File) {
    setPlan(undefined)
    setWaypointToken(undefined)
    setSignedRescue(undefined)
    setRecoveryPassword('')
    if (!file) return

    setBusy(true)
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const validated = validatePlan(parsed)
      await freshPreflight(validated)
      setPlan(validated)
      setStatus({ message: 'Plan validated and current on-chain state confirmed. Nothing has been signed.', type: 'ok' })
    } catch (error) {
      setStatus({ message: errorMessage(error), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function authorizeWaypoint() {
    if (!plan) return
    if (!clientId.trim()) {
      setStatus({ message: 'Enter your Ronin Waypoint Client ID.', type: 'error' })
      return
    }

    setBusy(true)
    setWaypointToken(undefined)
    setSignedRescue(undefined)
    try {
      setStatus({ message: 'Opening the official Ronin Waypoint authorization popup...', type: 'info' })
      const { authorize } = await import('@sky-mavis/waypoint')
      const auth = await authorize({
        mode: 'popup',
        clientId: clientId.trim(),
        scopes: ['openid', 'profile', 'email', 'wallet'],
        redirectUrl: window.location.origin,
      })

      if (!auth.token) throw new Error('Waypoint did not return an ID token.')

      const candidates = [auth.address, auth.secondaryAddress].filter(
        (address): address is Address => Boolean(address),
      )
      if (candidates.length > 0 && !candidates.some(address => sameAddress(address, plan.victim))) {
        throw new Error('The authenticated Waypoint account does not expose the affected address from the rescue plan.')
      }

      setWaypointToken(auth.token)
      setStatus({ message: 'Waypoint authorized. Token is kept only in memory. Enter the keyless recovery password locally.', type: 'ok' })
    } catch (error) {
      setStatus({ message: errorMessage(error), type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function signDeauthorization() {
    if (!plan || !waypointToken) {
      setStatus({ message: 'Rescue plan or Waypoint session is missing. Authorize again.', type: 'error' })
      return
    }
    if (!recoveryPassword) {
      setStatus({ message: 'Enter the keyless wallet recovery password.', type: 'error' })
      return
    }

    setBusy(true)
    setSignedRescue(undefined)
    try {
      setStatus({ message: 'Running a fresh on-chain preflight...', type: 'info' })
      await freshPreflight(plan)

      const [{ HeadlessClient, WASM_URL }, { _sign }] = await Promise.all([
        import('@sky-mavis/waypoint/headless'),
        import('@waypoint-internal-sign'),
      ])

      const client = HeadlessClient.create({
        chainId: RONIN_CHAIN_ID,
        overrideRpcUrl: OFFICIAL_RONIN_RPC_URL,
      })

      setStatus({ message: 'Recovering the client shard locally through Waypoint...', type: 'info' })
      const connected = await client.connectWithPassword({ waypointToken, recoveryPassword })

      const connectedAddress = getAddress(connected.address)
      const expectedAddress = getAddress(plan.victim)
      if (!sameAddress(connectedAddress, expectedAddress)) {
        throw new Error('Recovered Waypoint wallet does not match the affected address in the rescue plan.')
      }

      setStatus({ message: 'MPC address confirmed. Signing only the EIP-7702 zero-address deauthorization...', type: 'info' })
      const signature = await _sign({
        rawMessage: plan.authorization.rawMessage,
        waypointToken,
        clientShard: connected.clientShard,
        wasmUrl: WASM_URL,
        wsUrl: LOCKBOX_WS_URL,
      })

      if (!isHex(signature) || signature.length !== 132) {
        throw new Error('Waypoint returned an invalid 65-byte Ethereum signature.')
      }

      const recovered = getAddress(await recoverAddress({ hash: plan.authorization.hash, signature }))
      if (!sameAddress(recovered, expectedAddress)) {
        throw new Error('Signature verification failed: recovered signer does not equal the affected address.')
      }

      const result: SignedRescue = {
        version: 1,
        createdAt: new Date().toISOString(),
        victim: expectedAddress,
        currentDelegate: plan.inspection.currentDelegate,
        authorizationNonce: plan.authorization.nonce,
        authorizationHash: plan.authorization.hash,
        signature,
        recoveredSigner: recovered,
      }

      setSignedRescue(result)
      setStatus({ message: 'VALID SIGNATURE: recovered signer exactly matches the affected wallet. Broadcast remains DISABLED.', type: 'ok' })
    } catch (error) {
      setStatus({ message: errorMessage(error), type: 'error' })
    } finally {
      setRecoveryPassword('')
      setWaypointToken(undefined)
      setBusy(false)
    }
  }

  function downloadSignedRescue() {
    if (!signedRescue) return
    const blob = new Blob([`${JSON.stringify(signedRescue, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `signed-rescue-${signedRescue.victim.slice(2, 10)}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">RONIN 7702 RECOVERY</p>
        <h1>Waypoint Local Signer</h1>
        <p>Signs exclusively a Ronin EIP-7702 zero-address deauthorization. There is no application backend and no broadcast path in this UI.</p>
      </header>

      <section className="warning">
        <strong>Security:</strong> never send a recovery password, OTP, Waypoint token, client shard, seed phrase or private key to GitHub, chat, logs or third parties.
      </section>

      <section className="card">
        <h2>1. Load plan</h2>
        <label>
          rescue-plan.json
          <input type="file" accept="application/json,.json" disabled={busy} onChange={event => void loadPlan(event.target.files?.[0])} />
        </label>
        {plan ? <pre className="output">{JSON.stringify({
          victim: plan.victim,
          chainId: plan.chainId,
          nonce: plan.authorization.nonce,
          currentDelegate: plan.inspection.currentDelegate,
          target: plan.authorization.contractAddress,
          rawMessage: plan.authorization.rawMessage,
          authorizationHash: plan.authorization.hash,
        }, null, 2)}</pre> : null}
      </section>

      <section className="card">
        <h2>2. Authorize Waypoint</h2>
        <label>
          Ronin Waypoint Client ID
          <input type="text" value={clientId} disabled={busy} onChange={event => setClientId(event.target.value)} placeholder="Your Developer Portal Client ID" autoComplete="off" />
        </label>
        <button type="button" disabled={busy || !plan} onClick={() => void authorizeWaypoint()}>Authorize with Ronin Waypoint</button>
        <p className="hint">The Client ID is not a secret, but your application must allow http://127.0.0.1:4173 as origin/redirect.</p>
      </section>

      <section className="card">
        <h2>3. Recover shard and sign</h2>
        <label>
          Keyless wallet recovery password
          <input type="password" value={recoveryPassword} disabled={busy || !waypointToken} onChange={event => setRecoveryPassword(event.target.value)} placeholder="Not persisted" autoComplete="off" />
        </label>
        <button type="button" disabled={busy || !waypointToken} onClick={() => void signDeauthorization()}>Sign deauthorization</button>
      </section>

      <section className="card">
        <h2>4. Local verification</h2>
        <div className="status" data-type={status.type}>{status.message}</div>
        {signedRescue ? <pre className="output">{JSON.stringify(signedRescue, null, 2)}</pre> : null}
        <div className="row">
          <button type="button" disabled={!signedRescue} onClick={downloadSignedRescue}>Save signed-rescue.json</button>
          <span className="small">The file contains public/on-chain information and the EIP-7702 authorization signature, but no recovery password, token or shard.</span>
        </div>
      </section>

      <footer>Broadcast: <strong>DISABLED</strong>. Relay is a separate CLI step.</footer>
    </main>
  )
}
