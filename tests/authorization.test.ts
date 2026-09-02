import { describe, expect, it } from 'vitest'
import { keccak256 } from 'viem'
import { buildDeauthorization } from '../src/authorization.js'
import { RONIN_CHAIN_ID, ZERO_ADDRESS } from '../src/config.js'

describe('buildDeauthorization', () => {
  it('builds a canonical Ronin zero-address authorization using synthetic input', () => {
    const syntheticNonce = 7
    const result = buildDeauthorization(syntheticNonce)

    expect(result.chainId).toBe(RONIN_CHAIN_ID)
    expect(result.contractAddress).toBe(ZERO_ADDRESS)
    expect(result.nonce).toBe(syntheticNonce)
    expect(result.rawMessage.startsWith('0x05')).toBe(true)
    expect(result.hash).toBe(keccak256(result.rawMessage))
  })

  it('rejects unsafe nonces', () => {
    expect(() => buildDeauthorization(Number.MAX_SAFE_INTEGER + 1)).toThrow()
    expect(() => buildDeauthorization(-1)).toThrow()
  })
})
