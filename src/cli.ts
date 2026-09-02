import 'dotenv/config'

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Command } from 'commander'
import { inspectWallet } from './inspect.js'
import { createRescuePlan } from './plan.js'
import { checkRelayRescuePlan, relayRescuePlan } from './relay.js'
import type { RescuePlan } from './types.js'
import { verifyPlanSignature } from './verify.js'

const program = new Command()
  .name('ronin-7702-recovery')
  .description('Defensive EIP-7702 recovery toolkit for Ronin')
  .version('0.3.0')

program.command('inspect')
  .description('Inspect current Ronin code, nonce, balance, and delegation')
  .argument('<address>', 'Affected Ronin/EVM address')
  .action(async (address: string) => {
    console.log(JSON.stringify(await inspectWallet(address), null, 2))
  })

program.command('prepare')
  .description('Create a dry-run zero-address deauthorization plan')
  .argument('<address>', 'Affected Ronin/EVM address')
  .option('-o, --out <path>', 'Output JSON path', 'rescue-plan.json')
  .action(async (address: string, options: { out: string }) => {
    const plan = await createRescuePlan(address)
    const output = resolve(options.out)
    await writeFile(output, `${JSON.stringify(plan, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    console.log(`Rescue plan written to: ${output}`)
    console.log(`Victim:           ${plan.victim}`)
    console.log(`Current delegate: ${plan.inspection.currentDelegate}`)
    console.log(`Nonce:            ${plan.authorization.nonce}`)
    console.log(`Raw message:      ${plan.authorization.rawMessage}`)
    console.log(`Authorization:    ${plan.authorization.hash}`)
    console.log('Broadcast:        DISABLED')
  })

program.command('verify')
  .description('Verify that a raw MPC signature recovers the affected address')
  .argument('<plan>', 'Path to rescue plan JSON')
  .requiredOption('--signature <hex>', '65-byte Ethereum authorization signature')
  .action(async (planPath: string, options: { signature: string }) => {
    const plan = await loadPlan(planPath)
    const verified = await verifyPlanSignature(plan, options.signature)
    console.log(`Recovered signer: ${verified.recovered}`)
    console.log(`Expected victim:  ${plan.victim}`)
    console.log('Signature:        VALID')
    console.log('Broadcast:        DISABLED')
  })

program.command('relay-check')
  .description('Run final relay preflight and gas estimate without broadcasting')
  .argument('<plan>', 'Path to rescue plan JSON')
  .requiredOption('--signature <hex>', '65-byte victim authorization signature')
  .requiredOption('--relayer <address>', 'Public address of the clean relayer wallet')
  .action(async (planPath: string, options: { signature: string; relayer: string }) => {
    const plan = await loadPlan(planPath)
    const result = await checkRelayRescuePlan(plan, options.signature, options.relayer)
    console.log(`Victim:                  ${result.victim}`)
    console.log(`Victim nonce:            ${result.victimNonce}`)
    console.log(`Current delegate:        ${result.currentDelegate}`)
    console.log(`Verified signer:         ${result.verifiedSigner}`)
    console.log(`Relayer:                 ${result.relayer}`)
    console.log(`Relayer balance:         ${result.relayerBalanceRon} RON`)
    console.log(`RPC gas estimate:        ${result.gasEstimate}`)
    console.log(`EIP-7702 minimum gas:    ${result.minimumGasLimit}`)
    console.log(`Recommended gas limit:   ${result.recommendedGasLimit}`)
    console.log(`RPC estimate too low:    ${result.rpcEstimateUnderMinimum ? 'YES' : 'NO'}`)
    console.log(`Gas price:               ${result.gasPriceWei} wei`)
    console.log(`Conservative max fee:    ${result.estimatedFeeRon} RON`)
    console.log(`Balance covers estimate: ${result.balanceCoversEstimate ? 'YES' : 'NO'}`)
    console.log('Broadcast:               DISABLED')
  })

program.command('relay')
  .description('Relay the signed deauthorization from a separate clean wallet')
  .argument('<plan>', 'Path to rescue plan JSON')
  .requiredOption('--signature <hex>', '65-byte victim authorization signature')
  .requiredOption('--relayer <address>', 'Expected public address of the clean relayer wallet')
  .option('--broadcast', 'Actually broadcast after all preflight checks', false)
  .action(async (planPath: string, options: { signature: string; relayer: string; broadcast: boolean }) => {
    const plan = await loadPlan(planPath)
    const result = await relayRescuePlan(plan, options.signature, options.relayer, options.broadcast)
    console.log(`Relayer:            ${result.relayer}`)
    console.log(`Transaction:        ${result.transactionHash}`)
    console.log(`Receipt:            ${result.receiptStatus}`)
    console.log(`Victim code after:  ${result.victimCodeAfter}`)
    console.log(`Delegation cleared: ${result.delegationCleared}`)
  })

async function loadPlan(path: string): Promise<RescuePlan> {
  const raw = await readFile(resolve(path), 'utf8')
  const plan = JSON.parse(raw) as RescuePlan
  if (plan.version !== 1) throw new Error(`Unsupported rescue plan version: ${String(plan.version)}`)
  return plan
}

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`ERROR: ${message}`)
  process.exitCode = 1
})
