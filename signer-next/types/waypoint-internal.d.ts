declare module '@waypoint-internal-sign' {
  import type { Hex } from 'viem'

  export function _sign(params: {
    rawMessage: Hex
    waypointToken: string
    clientShard: string
    wasmUrl: string
    wsUrl: string
  }): Promise<Hex>
}
