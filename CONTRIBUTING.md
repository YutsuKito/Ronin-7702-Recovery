# Contributing

Contributions that improve defensive wallet recovery, validation, documentation and test coverage are welcome.

## Safety requirements

- Never commit real user credentials, seeds, private keys, recovery passwords, OTPs, tokens or MPC shards.
- Use synthetic addresses/nonces/delegates in tests and documentation.
- Do not weaken the zero-address-only signing guard.
- Do not add `personal_sign` as a fallback for EIP-7702 authorization.
- Do not remove fresh on-chain preflight checks from the relay path.
- Keep broadcast opt-in and explicit.

## Local checks

```bash
npm install
npm run typecheck
npm test
npm run signer:build
```

## Waypoint upgrades

The project uses an internal raw MPC signing implementation from a pinned `@sky-mavis/waypoint` version. Any dependency upgrade must include review of that implementation and an end-to-end test with a disposable account before mainnet use.

## Pull requests

Explain the security impact of the change, include tests where practical, and use synthetic values in examples.
