# Ronin 7702 Recovery

Open-source defensive recovery toolkit for **Ronin accounts affected by malicious EIP-7702 delegations**, including legacy **Waypoint/keyless MPC wallets**.

The tool is designed for a recovery deadlock where a compromised account cannot safely receive RON because incoming funds may be swept. The affected account signs a **zero-address EIP-7702 deauthorization**, while a separate clean relayer pays gas.

> [!CAUTION]
> This is an independent community project and is **not an official Sky Mavis or Ronin product**. Use it only for accounts you own or are explicitly authorized to recover. Blockchain transactions are irreversible.

> [!IMPORTANT]
> Nobody helping with this project should ever ask for your seed phrase, victim private key, recovery password, email password, OTP, Waypoint token, or MPC/client shard.

## Security model

- The compromised account does **not** need to receive RON.
- The Waypoint recovery password, token and client shard stay in local browser memory.
- The local signer has no application backend and no broadcast button.
- The signer accepts only Ronin Mainnet (`chainId = 2020`) zero-address deauthorizations.
- The generated signature must recover exactly the victim address.
- Relay requires a separate clean wallet.
- Relay runs a fresh nonce/delegation/signature preflight before broadcast.
- The post-receipt check reads the victim's code at the **mined receipt block**, not at `latest`.
- A successful outer transaction receipt alone does **not** prove that an EIP-7702 authorization was applied.
- Broadcast requires two explicit opt-ins: `ALLOW_BROADCAST=true` and `--broadcast`.
- The relayer private key must derive exactly the `--relayer` address supplied to the command.

## Understand the compromise before recovery

**A malicious EIP-7702 delegation is not the same thing as an exposed signing key.** These situations have different security implications:

| Scenario | What deauthorization does | What to do next |
| --- | --- | --- |
| **Delegation-only compromise:** the owner was tricked into signing a malicious EIP-7702 authorization, but the seed/private key or Waypoint signing authority was not exposed. | Removes that delegation and its associated execution path. The already-consumed authorization cannot be replayed after the authority nonce advances. | Check transaction history, approvals and any other permissions or changes caused while delegated. The account is not automatically free of every other risk. |
| **Signing-authority compromise:** a private key, recoverable MPC signing capability, authenticated signing session or other relevant credential remains under attacker control. | Removes the current delegation but **does not revoke that independent signing authority**. The attacker might sign a new authorization or transfer assets. | Treat this as a time-sensitive rescue window. Move assets to a new, securely controlled wallet and follow the wallet provider's official credential/session recovery guidance. |

A stale authorization with an already-consumed nonce cannot be replayed as-is. However, a nonce can change **after preflight but before inclusion**, including through activity enabled by the currently delegated code. An attacker with independent signing authority may also produce fresh authorizations. Do not assume a successful preflight guarantees a successful on-chain deauthorization.

## Requirements

- Node.js 22+
- npm
- A clean Ronin/EVM wallet with a small amount of RON for the relayer
- For Waypoint/keyless wallets: your own Waypoint Client ID configured in the Ronin/Sky Mavis Developer Portal for `http://127.0.0.1:4173`

## Install

```bash
git clone https://github.com/YutsuKito/Ronin-7702-Recovery.git
cd Ronin-7702-Recovery
npm install
npm run typecheck
npm test
npm run signer:build
```

## Recovery flow

### 1. Inspect the affected account

```bash
npm run rescue -- inspect 0xYOUR_COMPROMISED_ADDRESS
```

An active EIP-7702 delegation normally appears as code beginning with `0xef0100`.

### 2. Prepare a zero-address deauthorization

```bash
npm run rescue -- prepare 0xYOUR_COMPROMISED_ADDRESS --out rescue-plan.json
```

`rescue-plan.json` contains public/on-chain data and the authorization payload. It contains no passwords, private keys, tokens, OTPs or MPC shards.

### 3. Sign locally with Waypoint/keyless MPC

```bash
npm run signer
```

Open:

```text
http://127.0.0.1:4173
```

Then:

1. Load `rescue-plan.json`.
2. Enter your own Waypoint Client ID.
3. Complete the official Waypoint popup authorization.
4. Enter the keyless recovery password locally.
5. Sign the zero-address deauthorization.
6. Confirm that `recoveredSigner` exactly equals the affected address.
7. Save `signed-rescue-XXXXXXXX.json` locally.

See [`docs/LOCAL_SIGNER.md`](docs/LOCAL_SIGNER.md).

### 4. Verify the signature independently

```bash
npm run rescue -- verify rescue-plan.json --signature 0xYOUR_SIGNATURE
```

The command aborts unless the signature recovers exactly the victim address.

### 5. Run relay preflight without broadcasting

```bash
npm run rescue -- relay-check rescue-plan.json \
  --signature 0xYOUR_SIGNATURE \
  --relayer 0xYOUR_CLEAN_RELAYER_ADDRESS
```

This checks the current delegation, nonce, signer, relayer balance and gas budget without using a relayer private key and without broadcasting.

Ronin RPCs may under-estimate a one-authorization EIP-7702 transaction as 21,000 gas. The tool enforces the protocol minimum of 46,000 gas and currently uses a conservative 60,000 gas limit for the simple zero-data relay.

### 6. Broadcast only after every preflight passes

Set the private key of the **clean relayer only** in your local environment. Never use the victim wallet key here and never paste a private key into an issue, screenshot or chat.

```text
RELAYER_PRIVATE_KEY=0x...
ALLOW_BROADCAST=true
```

Then:

```bash
npm run rescue -- relay rescue-plan.json \
  --signature 0xYOUR_SIGNATURE \
  --relayer 0xYOUR_CLEAN_RELAYER_ADDRESS \
  --broadcast
```

The tool refuses to broadcast if the relayer private key derives a different address than `--relayer`.

### 7. Verify cleanup

The relay command checks the affected account's code at `receipt.blockNumber`, and prints the receipt block and whether the delegation was cleared. An invalid/stale EIP-7702 authorization can be **skipped while the relayer transaction receipt still says `success`**. If the block-specific check fails, the CLI reports failure: **do not blindly rebroadcast the same authorization**.

This historical-state check requires an RPC that supports `eth_getCode` at the inclusion block. If that RPC query fails, verification is inconclusive; examine the mined transaction and account before taking any further action.

You can independently inspect the current state afterward:

```bash
npm run rescue -- inspect 0xYOUR_COMPROMISED_ADDRESS
```

A successful cleanup should show:

```text
code: "0x"
eip7702: false
currentDelegate: null
```

## After recovery

Whether deauthorization restores exclusive control depends on the **compromise type**, not merely the receipt status. For delegation-only phishing, removal can eliminate the attacker's delegated execution path, but approvals and other side effects may remain. If any signing authority or credential was compromised, the attacker may be able to sign again, so prioritize transferring assets to a newly secured wallet. Never assume a credential/session rotation worked without confirmation from the relevant wallet provider.

## Waypoint implementation note

EIP-7702 authorization must be signed over the protocol authorization payload. It must **not** be replaced with `personal_sign`, which adds the EIP-191 message prefix.

The local signer pins `@sky-mavis/waypoint` and uses a narrow alias to the SDK's internal raw MPC signing primitive. This internal API is not a stable public export, so dependency upgrades require review and end-to-end testing.

## Public incident hygiene

When opening issues, use synthetic or masked examples where possible. Do not publish recovery passwords, OTPs, tokens, shards, seed phrases, private keys, `.env` files, or screenshots containing secrets.

## Development status

- [x] Ronin on-chain inspection
- [x] EIP-7702 delegation parser
- [x] Zero-address authorization builder
- [x] Authorization hash self-check
- [x] Waypoint/keyless local MPC signing flow
- [x] Signature recovery and victim verification
- [x] Sponsored clean-wallet relay
- [x] Dry-run relay preflight
- [x] Relayer-address/private-key match guard
- [x] Successful end-to-end Ronin Mainnet recovery completed during development

## License

MIT. See [`LICENSE`](LICENSE).
