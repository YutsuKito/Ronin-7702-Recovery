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
- Broadcast requires two explicit opt-ins: `ALLOW_BROADCAST=true` and `--broadcast`.
- The relayer private key must derive exactly the `--relayer` address supplied to the command.

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

Removing the delegation creates a **rescue window**. It does not prove that every credential or active session related to the old wallet is safe. Move valuable assets to a newly secured wallet and rotate credentials/sessions as appropriate.

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
