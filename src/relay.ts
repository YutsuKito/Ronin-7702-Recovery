import {
  createWalletClient,
  formatEther,
  getAddress,
  http,
  type Address,
  type Hex,
  type SignedAuthorization,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { ronin } from 'viem/chains'
import { createRoninPublicClient } from './client.js'
import { getRpcUrl, RONIN_CHAIN_ID, ZERO_ADDRESS } from './config.js'
import { inspectWallet } from './inspect.js'
import type { RescuePlan } from './types.js'
import { verifyPlanSignature } from './verify.js'

const EIP7702_BASE_INTRINSIC_GAS = 21_000n
const EIP7702_PER_AUTH_INTRINSIC_GAS = 25_000n
const EIP7702_MIN_GAS_LIMIT = EIP7702_BASE_INTRINSIC_GAS + EIP7702_PER_AUTH_INTRINSIC_GAS
const EIP7702_RECOMMENDED_GAS_LIMIT = 60_000n

export interface RelayResult {
  transactionHash: Hex
  relayer: Address
  receiptStatus: 'success' | 'reverted'
  victimCodeAfter: Hex
  delegationCleared: boolean
}

export interface RelayCheckResult {
  victim: Address
  victimNonce: number
  currentDelegate: Address
  verifiedSigner: Address
  relayer: Address
  relayerBalanceWei: bigint
  relayerBalanceRon: string
  gasEstimate: bigint
  minimumGasLimit: bigint
  recommendedGasLimit: bigint
  rpcEstimateUnderMinimum: boolean
  gasPriceWei: bigint
  estimatedFeeWei: bigint
  estimatedFeeRon: string
  balanceCoversEstimate: boolean
}

function readRelayerPrivateKey(): Hex {
  const value = process.env.RELAYER_PRIVATE_KEY?.trim()
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('RELAYER_PRIVATE_KEY must be a 32-byte hex private key in the local environment.')
  }
  return value as Hex
}

async function prepareSignedAuthorization(plan: RescuePlan, signature: string) {
  if (plan.chainId !== RONIN_CHAIN_ID || plan.authorization.chainId !== RONIN_CHAIN_ID) {
    throw new Error('Plan is not for Ronin Mainnet chain ID 2020.')
  }
  if (plan.authorization.contractAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
    throw new Error('Refusing to relay: authorization target is not the zero address.')
  }

  const fresh = await inspectWallet(plan.victim)
  const currentDelegate = fresh.currentDelegate

  if (!fresh.eip7702 || !currentDelegate) {
    throw new Error('Preflight failed: victim no longer has an active EIP-7702 delegation.')
  }
  if (fresh.nonce !== plan.authorization.nonce) {
    throw new Error(`Preflight failed: nonce changed from ${plan.authorization.nonce} to ${fresh.nonce}. Prepare and sign a new plan.`)
  }
  if (fresh.code.toLowerCase() !== plan.inspection.code.toLowerCase()) {
    throw new Error('Preflight failed: victim delegation code changed after the plan was created.')
  }

  const verified = await verifyPlanSignature(plan, signature)
  const authorization: SignedAuthorization = {
    chainId: RONIN_CHAIN_ID,
    address: ZERO_ADDRESS,
    nonce: plan.authorization.nonce,
    r: verified.r,
    s: verified.s,
    yParity: verified.yParity,
  }

  return { fresh, currentDelegate, verified, authorization }
}

export async function checkRelayRescuePlan(
  plan: RescuePlan,
  signature: string,
  relayerInput: string,
): Promise<RelayCheckResult> {
  const relayer = getAddress(relayerInput)
  const { fresh, currentDelegate, verified, authorization } = await prepareSignedAuthorization(plan, signature)
  const publicClient = createRoninPublicClient()

  const [relayerBalanceWei, gasPriceWei] = await Promise.all([
    publicClient.getBalance({ address: relayer }),
    publicClient.getGasPrice(),
  ])

  const gasEstimate = await publicClient.estimateGas({
    account: relayer,
    to: relayer,
    value: 0n,
    authorizationList: [authorization],
  })

  const rpcEstimateUnderMinimum = gasEstimate < EIP7702_MIN_GAS_LIMIT
  const recommendedGasLimit = gasEstimate > EIP7702_RECOMMENDED_GAS_LIMIT ? gasEstimate : EIP7702_RECOMMENDED_GAS_LIMIT
  const estimatedFeeWei = recommendedGasLimit * gasPriceWei

  return {
    victim: plan.victim,
    victimNonce: fresh.nonce,
    currentDelegate,
    verifiedSigner: verified.recovered,
    relayer,
    relayerBalanceWei,
    relayerBalanceRon: formatEther(relayerBalanceWei),
    gasEstimate,
    minimumGasLimit: EIP7702_MIN_GAS_LIMIT,
    recommendedGasLimit,
    rpcEstimateUnderMinimum,
    gasPriceWei,
    estimatedFeeWei,
    estimatedFeeRon: formatEther(estimatedFeeWei),
    balanceCoversEstimate: relayerBalanceWei >= estimatedFeeWei,
  }
}

export async function relayRescuePlan(
  plan: RescuePlan,
  signature: string,
  relayerInput: string,
  broadcastFlag: boolean,
): Promise<RelayResult> {
  if (!broadcastFlag || process.env.ALLOW_BROADCAST !== 'true') {
    throw new Error('Broadcast is disabled. Both --broadcast and ALLOW_BROADCAST=true are required.')
  }

  const expectedRelayer = getAddress(relayerInput)
  const account = privateKeyToAccount(readRelayerPrivateKey())
  if (account.address.toLowerCase() !== expectedRelayer.toLowerCase()) {
    throw new Error(`RELAYER_PRIVATE_KEY derives ${account.address}, but --relayer expects ${expectedRelayer}. Refusing to broadcast.`)
  }

  const { authorization } = await prepareSignedAuthorization(plan, signature)
  const publicClient = createRoninPublicClient()
  const [relayerBalanceWei, gasPriceWei] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.getGasPrice(),
  ])
  const maxEstimatedFeeWei = EIP7702_RECOMMENDED_GAS_LIMIT * gasPriceWei

  if (relayerBalanceWei < maxEstimatedFeeWei) {
    throw new Error(
      `Relayer balance is too low for the conservative ${EIP7702_RECOMMENDED_GAS_LIMIT.toString()} gas limit. ` +
      `Balance=${formatEther(relayerBalanceWei)} RON, estimated max fee=${formatEther(maxEstimatedFeeWei)} RON.`,
    )
  }

  const walletClient = createWalletClient({
    account,
    chain: ronin,
    transport: http(getRpcUrl()),
  })

  const transactionHash = await walletClient.sendTransaction({
    account,
    to: account.address,
    value: 0n,
    gas: EIP7702_RECOMMENDED_GAS_LIMIT,
    authorizationList: [authorization],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash })
  const after = await inspectWallet(plan.victim)

  return {
    transactionHash,
    relayer: account.address,
    receiptStatus: receipt.status,
    victimCodeAfter: after.code,
    delegationCleared: after.code === '0x',
  }
}
