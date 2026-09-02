import type { Address, Hex } from 'viem'

export interface WalletInspection {
  victim: Address
  chainId: number
  balanceWei: string
  balanceRon: string
  nonce: number
  code: Hex
  eip7702: boolean
  currentDelegate: Address | null
}

export interface RescuePlan {
  version: 1
  createdAt: string
  victim: Address
  chainId: number
  rpcUrl: string
  inspection: WalletInspection
  authorization: {
    chainId: number
    contractAddress: Address
    nonce: number
    rawMessage: Hex
    hash: Hex
  }
}
