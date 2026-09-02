# Local Waypoint signer

The local signer exists for legacy Ronin Waypoint/keyless MPC accounts that cannot export a traditional private key.

EIP-7702 deauthorization must be signed for the protocol authorization payload:

```text
0x05 || RLP([chainId, zeroAddress, accountNonce])
```

`personal_sign` is not a valid substitute because it applies the EIP-191 message prefix.

## Security boundary

The signer:

- binds to `http://127.0.0.1:4173`;
- has no application backend;
- accepts only a `rescue-plan.json` compatible with this project;
- accepts only Ronin Mainnet (`chainId = 2020`);
- accepts only the zero address as the EIP-7702 authorization target;
- re-checks the affected account nonce and delegation code before signing;
- uses the official Ronin RPC for the signer preflight rather than trusting an RPC URL embedded in a file;
- verifies that the recovered Waypoint account matches the affected address;
- verifies that the final signature recovers the same address;
- cannot broadcast a transaction.

The recovery password, Waypoint token and client shard are kept only in browser memory during the signing flow. They are not included in `rescue-plan.json` or `signed-rescue-*.json`.

## Waypoint Client ID

Create your own application in the Ronin/Sky Mavis Developer Portal and enable Wallet & Authentication / Waypoint as appropriate.

Configure the local origin and redirect:

```text
http://127.0.0.1:4173
```

A Client ID is an application identifier, not a wallet secret. Do not publish correlation keys, tokens, passwords or shards.

## Run

```bash
npm install
npm run typecheck
npm test
npm run signer:build
npm run signer
```

Open:

```text
http://127.0.0.1:4173
```

Then load the current rescue plan, authorize Waypoint, enter the recovery password locally and sign the deauthorization.

The expected success condition is:

```text
recoveredSigner == victim
Broadcast remains DISABLED
```

Save the generated `signed-rescue-*.json` locally and continue with the CLI `verify` and `relay-check` steps.

## Internal SDK dependency

The public Waypoint API does not expose the exact raw signing method required here as a stable public export. The project pins `@sky-mavis/waypoint` `4.2.2` and maps a narrow internal module:

```text
@sky-mavis/waypoint/dist/module/headless/action/sign.js
```

The integration is security-sensitive. Do not upgrade Waypoint without reviewing the upstream raw signing behavior and repeating typecheck, tests, signer build and a disposable-account end-to-end test.

## Troubleshooting

If Waypoint authorization works but MPC initialization fails, capture only the error code/message. Never paste tokens, passwords, shards, private keys or full authenticated network payloads into an issue.

If the account nonce or delegate changes after a plan was prepared, discard the old plan and signature and generate a new one.
