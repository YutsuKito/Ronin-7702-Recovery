import { createPublicClient, http } from 'viem'
import { ronin } from 'viem/chains'
import { getRpcUrl } from './config.js'

export const createRoninPublicClient = () =>
  createPublicClient({
    chain: ronin,
    transport: http(getRpcUrl()),
  })
