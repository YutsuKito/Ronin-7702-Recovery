import {
  formatEther,
  getAddress,
  isAddress,
  type Address,
} from 'viem'
import { createRoninPublicClient } from './client.js'
import { RONIN_CHAIN_ID } from './config.js'
import { parseDelegationCode } from './delegation.js'
import type { WalletInspection } from './types.js'

export async function inspectWallet(addressInput: string): Promise<WalletInspection> {
  if (!isAddress(addressInput)) {
    throw new Error(`Invalid address: ${addressInput}`)
  }

  const victim = getAddress(addressInput) as Address
  const client = createRoninPublicClient()

  const [chainId, code, nonce, balance] = await Promise.all([
    client.getChainId(),
    client.getCode({ address: victim }),
    client.getTransactionCount({ address: victim, blockTag: 'latest' }),
    client.getBalance({ address: victim, blockTag: 'latest' }),
  ])

  if (chainId !== RONIN_CHAIN_ID) {
    throw new Error(`Wrong chain: expected ${RONIN_CHAIN_ID}, got ${chainId}`)
  }

  const delegation = parseDelegationCode(code)

  return {
    victim,
    chainId,
    balanceWei: balance.toString(),
    balanceRon: formatEther(balance),
    nonce,
    code: delegation.code,
    eip7702: delegation.active,
    currentDelegate: delegation.active ? delegation.delegate : null,
  }
}
