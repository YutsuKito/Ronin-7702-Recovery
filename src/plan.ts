import { getRpcUrl, RONIN_CHAIN_ID } from './config.js'
import { buildDeauthorization } from './authorization.js'
import { inspectWallet } from './inspect.js'
import type { RescuePlan } from './types.js'

export async function createRescuePlan(address: string): Promise<RescuePlan> {
  const inspection = await inspectWallet(address)

  if (!inspection.eip7702 || !inspection.currentDelegate) {
    throw new Error('No active EIP-7702 delegation found on this account.')
  }

  const authorization = buildDeauthorization(inspection.nonce)

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    victim: inspection.victim,
    chainId: RONIN_CHAIN_ID,
    rpcUrl: getRpcUrl(),
    inspection,
    authorization,
  }
}
