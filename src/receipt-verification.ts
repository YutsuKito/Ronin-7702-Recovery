import type { Hex, TransactionReceipt } from 'viem'

type MinedReceipt = Pick<TransactionReceipt, 'blockNumber' | 'status'>

export interface DeauthorizationBlockCheck {
  receiptBlockNumber: bigint
  victimCodeAfter: Hex
  delegationCleared: boolean
}

/**
 * Read the affected account code at the block that includes the relay transaction.
 * A successful outer EIP-7702 transaction does not guarantee that an authorization
 * tuple was applied: an invalid/stale authorization can be skipped.
 *
 * viem getCode returns undefined for empty code, equivalent to eth_getCode = '0x'.
 */
export async function checkDeauthorizationAtReceiptBlock(
  receipt: MinedReceipt,
  getCodeAtBlock: (blockNumber: bigint) => Promise<Hex | undefined>,
): Promise<DeauthorizationBlockCheck> {
  const code = await getCodeAtBlock(receipt.blockNumber)
  const victimCodeAfter = code ?? '0x'

  return {
    receiptBlockNumber: receipt.blockNumber,
    victimCodeAfter,
    delegationCleared: receipt.status === 'success' && victimCodeAfter === '0x',
  }
}
