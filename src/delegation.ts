import { getAddress, type Address, type Hex } from 'viem'
import { EIP7702_DELEGATION_PREFIX } from './config.js'

const DELEGATION_CODE_RE = /^0xef0100[0-9a-fA-F]{40}$/

export type DelegationInfo =
  | { active: false; code: Hex }
  | { active: true; code: Hex; delegate: Address }

export function parseDelegationCode(code: Hex | undefined): DelegationInfo {
  const normalized = (code ?? '0x') as Hex

  if (!DELEGATION_CODE_RE.test(normalized)) {
    return { active: false, code: normalized }
  }

  const delegate = getAddress(`0x${normalized.slice(EIP7702_DELEGATION_PREFIX.length)}`)

  return {
    active: true,
    code: normalized,
    delegate,
  }
}
