import {
  getAddress,
  isHex,
  parseSignature,
  recoverAddress,
  type Address,
  type Hex,
} from 'viem'
import type { RescuePlan } from './types.js'

export interface VerifiedSignature {
  recovered: Address
  r: Hex
  s: Hex
  yParity: 0 | 1
}

export async function verifyPlanSignature(
  plan: RescuePlan,
  signatureInput: string,
): Promise<VerifiedSignature> {
  if (!isHex(signatureInput) || signatureInput.length !== 132) {
    throw new Error('Expected a 65-byte Ethereum signature (0x + 130 hex chars).')
  }

  const signature = signatureInput as Hex
  const recovered = getAddress(
    await recoverAddress({
      hash: plan.authorization.hash,
      signature,
    }),
  )

  if (recovered.toLowerCase() !== plan.victim.toLowerCase()) {
    throw new Error(
      `Signature mismatch: recovered ${recovered}, expected ${plan.victim}`,
    )
  }

  const parsed = parseSignature(signature)
  if (parsed.yParity !== 0 && parsed.yParity !== 1) {
    throw new Error('Signature yParity must be 0 or 1.')
  }

  return {
    recovered,
    r: parsed.r,
    s: parsed.s,
    yParity: parsed.yParity,
  }
}
