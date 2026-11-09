# Paid Registration

Trackarr can charge a sign-up fee in **Bitcoin**, **Monero** or **Solana**. The account is created at once but stays **locked**: its owner only sees the payment page, and the API, RSS feeds and Torznab refuse it. Once the payment is confirmed on the blockchain, the account is unlocked automatically.

Verification is self-hosted: no payment processor, and **no private key on the server**.

| Coin    | Receiving side                                    | How the payment is found                                  |
| ------- | ------------------------------------------------- | --------------------------------------------------------- |
| Bitcoin | A new address per invoice, from your **zpub/xpub** | Esplora API (`mempool.space` by default, or self-hosted)  |
| Monero  | A new subaddress per invoice                      | Your view-only `monero-wallet-rpc`                        |
| Solana  | Your address, with a Solana Pay `reference` key   | Solana JSON-RPC (`getSignaturesForAddress`)               |

## Setup

Open **Admin → Payments**:

1. Turn on **Paid registration**.
2. Choose whether **invited users pay too** (off: an invite code skips the payment).
3. Set the **payment delay**: locked accounts on which nothing arrived are deleted after it (the invite they used, if any, becomes usable again). Accounts with money on the way are never deleted: settle them by hand.
4. For each coin: switch it on, set a fixed price, then its receiving side (below).

Registration must still be open (or invite based): payment is an extra step, not a way in.

### Bitcoin

Paste the **extended public key** of a native SegWit (BIP84) account: `zpub…` (or `xpub…` from wallets that export BIP84 keys that way; `vpub`/`tpub` for testnet). Each invoice uses the next receive address `…/0/n`.

- Sparrow: *Settings → Keystores → Master fingerprint / xpub* of a Native SegWit wallet.
- Electrum: *Wallet → Information → Master Public Key*.

Use a **dedicated account** for registrations. Payments made to an address before its invoice was created are ignored anyway, so an address that was already used cannot unlock an account by itself.

::: warning Gap limit
Wallets stop scanning after 20 unused addresses. Unpaid invoices leave gaps: raise the gap limit of your wallet (for example to 1000) so it shows every payment.
:::

`Confirmations required` defaults to 2. The Esplora URL defaults to `https://mempool.space/api`; point it at your own instance (mempool, electrs/esplora) for privacy.

### Monero

The app asks a **view-only** wallet for a new subaddress per invoice and reads its incoming transfers. A view-only wallet cannot spend.

1. Create the view-only wallet from your primary address and **private view key** (Feather: *Wallet → Keys*):

   ```bash
   monero-wallet-cli --generate-from-view-key trackarr-view --daemon-address node.example.com:18089
   ```

2. Serve it with `monero-wallet-rpc` on the private Docker network, never on a public port (the app talks to it without a login):

   ```bash
   monero-wallet-rpc --wallet-file /wallet/trackarr-view --password-file /wallet/password \
     --daemon-address node.example.com:18089 --trusted-daemon \
     --rpc-bind-ip 0.0.0.0 --rpc-bind-port 18082 --confirm-external-bind --disable-rpc-login
   ```

3. Set `MONERO_WALLET_RPC_URL=http://monero-wallet-rpc:18082` in `.env` and restart the app. The admin page shows whether it is configured.

`Confirmations required` defaults to 10 (the Monero unlock time).

### Solana

Paste your **receiving address**. Each invoice gets a random Solana Pay `reference` key, carried by the wallet link on the payment page: this is how the transfer is matched to the account. A plain transfer copied by hand, without the reference, cannot be matched: unlock it from the admin page. Only native SOL is counted (no SPL tokens).

The public RPC (`https://api.mainnet-beta.solana.com`) is rate limited: use a dedicated RPC provider for a busy tracker. An account is unlocked once the transaction is finalized.

## How it works

- **Invoices**: one per account and coin, created when the user picks the coin. The amount is locked at creation: changing the price later does not affect it.
- **Underpayment**: what arrives is added up; the user can send the difference to the same address.
- **Watcher**: every `PAYMENT_CHECK_INTERVAL` ms (60 s by default) one app node checks every open invoice, unlocks paid accounts and deletes expired ones. The payment page also asks for a check every 30 s (at most once per 20 s per account).
- **Manual unlock**: *Admin → Payments → Locked accounts → Unlock*, for a late or off-chain payment. Recorded as manual.

## Environment

| Variable                 | Description                                                  | Default |
| ------------------------ | ------------------------------------------------------------ | ------- |
| `MONERO_WALLET_RPC_URL`  | View-only `monero-wallet-rpc` (empty: Monero is not offered) | -       |
| `PAYMENT_CHECK_INTERVAL` | Payment watcher interval in ms                               | `60000` |
