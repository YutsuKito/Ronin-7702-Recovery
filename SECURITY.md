# Security policy

This project handles a high-risk wallet recovery workflow. Treat all authentication and signing material as sensitive.

## Never disclose or commit

Do not place any of the following in GitHub issues, discussions, commits, screenshots, logs, chats or support messages:

- seed phrases
- private keys
- recovery passwords
- email passwords
- OTPs / 2FA codes
- Waypoint tokens
- MPC/client shards
- `.env` files
- authenticated browser storage exports

A maintainer or helper does not need these secrets to diagnose a normal issue.

## Relayer key

Use a separate clean wallet funded only as needed for the rescue. Keep `RELAYER_PRIVATE_KEY` only in your local environment or ignored `.env` file.

The relay command verifies that the loaded private key derives exactly the address provided through `--relayer` before broadcasting.

## Broadcast safety

Broadcast requires both:

1. `ALLOW_BROADCAST=true`; and
2. the CLI `--broadcast` flag.

Immediately before broadcast the tool re-checks the victim's current delegation/code and nonce and re-verifies that the authorization signature recovers the victim address.

## Waypoint/keyless signing

Never substitute `personal_sign` for the EIP-7702 authorization signature. The signer must sign the exact EIP-7702 authorization payload and verify the recovered address locally.

The public project uses an internal raw-signing module from the pinned Waypoint SDK. Treat dependency changes as security-sensitive.

## Reporting a vulnerability

Open a GitHub issue only when the report contains no secrets or active credentials. For a report that could expose a live secret, do not paste the secret as evidence. Describe the affected component, reproduction conditions and expected behavior using synthetic values.

## After recovery

A cleared EIP-7702 delegation is a rescue window, not proof that the old wallet is fully trustworthy. Move valuable assets to a newly secured wallet and rotate credentials/sessions as appropriate.
