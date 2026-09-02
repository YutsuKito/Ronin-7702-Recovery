import {
  concatHex,
  keccak256,
  toHex,
  type Hex,
} from 'viem'
import { hashAuthorization, toRlp } from 'viem/utils'
import { RONIN_CHAIN_ID, ZERO_ADDRESS } from './config.js'

export interface BuiltDeauthorization {
  chainId: number
  contractAddress: typeof ZERO_ADDRESS
  nonce: number
  rawMessage: Hex
  hash: Hex
}

export function buildDeauthorization(nonce: number): BuiltDeauthorization {
  if (!Number.isSafeInteger(nonce) || nonce < 0) {
    throw new Error(`Unsafe or invalid account nonce: ${nonce}`)
  }

  const rlp = toRlp([
    toHex(RONIN_CHAIN_ID),
    ZERO_ADDRESS,
    toHex(nonce),
  ])

  const rawMessage = concatHex(['0x05', rlp])
  const hash = keccak256(rawMessage)

  const referenceHash = hashAuthorization({
    chainId: RONIN_CHAIN_ID,
    contractAddress: ZERO_ADDRESS,
    nonce,
  })

  if (hash.toLowerCase() !== referenceHash.toLowerCase()) {
    throw new Error(
      `Authorization encoding mismatch: raw=${hash}, viem=${referenceHash}`,
    )
  }

  return {
    chainId: RONIN_CHAIN_ID,
    contractAddress: ZERO_ADDRESS,
    nonce,
    rawMessage,
    hash,
  }
}
