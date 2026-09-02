import { getAddress, type Address } from 'viem'

export const RONIN_CHAIN_ID = 2020
export const DEFAULT_RONIN_RPC_URL = 'https://api.roninchain.com/rpc'
export const ZERO_ADDRESS = getAddress(
  '0x0000000000000000000000000000000000000000',
) as Address
export const EIP7702_DELEGATION_PREFIX = '0xef0100'

export const getRpcUrl = (): string =>
  process.env.RONIN_RPC_URL?.trim() || DEFAULT_RONIN_RPC_URL
