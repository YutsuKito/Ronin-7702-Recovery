import { describe, expect, it, vi } from 'vitest'
import { checkDeauthorizationAtReceiptBlock } from '../src/receipt-verification.js'

describe('checkDeauthorizationAtReceiptBlock', () => {
  const receiptBlockNumber = 12345n
  const delegatedCode = `0xef0100${'1'.repeat(40)}` as const

  it('confirms removal using the receipt block rather than the latest block', async () => {
    const readCode = vi.fn().mockResolvedValue(undefined) // viem uses undefined for empty code
    const result = await checkDeauthorizationAtReceiptBlock(
      { status: 'success', blockNumber: receiptBlockNumber },
      readCode,
    )

    expect(readCode).toHaveBeenCalledExactlyOnceWith(receiptBlockNumber)
    expect(result).toEqual({
      receiptBlockNumber,
      victimCodeAfter: '0x',
      delegationCleared: true,
    })
  })

  it('accepts an explicit empty-code response', async () => {
    const result = await checkDeauthorizationAtReceiptBlock(
      { status: 'success', blockNumber: receiptBlockNumber },
      async () => '0x',
    )
    expect(result.delegationCleared).toBe(true)
  })

  it('does not report success when an authorization was skipped but the outer receipt succeeded', async () => {
    const result = await checkDeauthorizationAtReceiptBlock(
      { status: 'success', blockNumber: receiptBlockNumber },
      async () => delegatedCode,
    )
    expect(result.delegationCleared).toBe(false)
    expect(result.victimCodeAfter).toBe(delegatedCode)
  })

  it('does not report success for a reverted relay even if the address has no code', async () => {
    const result = await checkDeauthorizationAtReceiptBlock(
      { status: 'reverted', blockNumber: receiptBlockNumber },
      async () => undefined,
    )
    expect(result.delegationCleared).toBe(false)
  })

  it('propagates an RPC error rather than claiming delegation cleanup', async () => {
    await expect(
      checkDeauthorizationAtReceiptBlock(
        { status: 'success', blockNumber: receiptBlockNumber },
        async () => { throw new Error('historical block unavailable') },
      ),
    ).rejects.toThrow('historical block unavailable')
  })
})
