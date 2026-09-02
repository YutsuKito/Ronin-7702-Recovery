# Security model

## Goal

Clear a malicious Ronin EIP-7702 delegation without funding the affected account and without handing wallet secrets to a rescue service.

## Trust boundaries

### Affected account

Signs only a zero-address EIP-7702 authorization. For Waypoint/keyless accounts, recovery password and MPC material remain local to the browser process used for signing.

### Local signer

Has no application backend and no transaction broadcast capability. It validates chain, target, nonce, current delegation code and recovered signer.

### Clean relayer

Pays gas for the outer type-`0x04` transaction. The affected account does not need a RON balance. The relay private key is never required by the signer UI.

### Ronin RPC

Used for public on-chain state. The relay code compensates for observed under-estimation of the intrinsic gas of a one-authorization EIP-7702 transaction by enforcing a protocol floor and conservative gas limit.

## Main failure conditions

The workflow aborts when:

- the chain is not Ronin Mainnet;
- the authorization target is not the zero address;
- the nonce changes after the plan is generated;
- the current delegation code changes;
- the signature does not recover the affected address;
- the relayer key does not match the expected relayer address;
- the relayer lacks the conservative gas budget;
- either broadcast opt-in is missing.

## Non-goals

This project does not claim to:

- make a previously compromised wallet permanently safe;
- revoke ERC-20/ERC-721 approvals unrelated to EIP-7702;
- recover lost recovery passwords or private keys;
- act as an official Ronin/Sky Mavis support service;
- custody user secrets or assets.
