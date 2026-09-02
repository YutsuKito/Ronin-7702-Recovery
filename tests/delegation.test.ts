import { describe, expect, it } from 'vitest'
import { parseDelegationCode } from '../src/delegation.js'

describe('parseDelegationCode', () => {
  it('extracts a synthetic EIP-7702 delegate', () => {
    const syntheticDelegate = '1111111111111111111111111111111111111111'
    const result = parseDelegationCode(`0xef0100${syntheticDelegate}`)

    expect(result.active).toBe(true)
    if (result.active) {
      expect(result.delegate.toLowerCase()).toBe(`0x${syntheticDelegate}`)
    }
  })

  it('treats empty code as no active delegation', () => {
    expect(parseDelegationCode('0x')).toEqual({ active: false, code: '0x' })
  })

  it('does not accept arbitrary contract bytecode as a 7702 indicator', () => {
    expect(parseDelegationCode('0x6001600055').active).toBe(false)
  })
})
