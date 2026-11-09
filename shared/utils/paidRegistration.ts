/**
 * Paid registration: the admin sets a fixed price per coin, new accounts stay
 * locked (users.payment_pending) until the payment is confirmed on-chain.
 * Stored as one JSON setting, parsed leniently: unknown or broken values fall
 * back to the defaults. Shared between app and server.
 */

export const PAYMENT_CURRENCIES = ['btc', 'xmr', 'sol'] as const;
export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number];

/** Decimals of the smallest unit: satoshi, piconero, lamport */
export const CURRENCY_DECIMALS: Record<PaymentCurrency, number> = {
  btc: 8,
  xmr: 12,
  sol: 9,
};

export const CURRENCY_SYMBOLS: Record<PaymentCurrency, string> = {
  btc: 'BTC',
  xmr: 'XMR',
  sol: 'SOL',
};

export interface PaidRegistrationConfig {
  enabled: boolean;
  /** Accounts created with an invite code must pay too */
  invitesPay: boolean;
  /** Unpaid accounts that received nothing are deleted after this many days */
  pendingDays: number;
  btc: {
    enabled: boolean;
    price: string;
    /** Extended public key (xpub/zpub, tpub/vpub on testnet): BIP84 receive chain */
    xpub: string;
    confirmations: number;
    esploraUrl: string;
  };
  xmr: {
    enabled: boolean;
    price: string;
    confirmations: number;
  };
  sol: {
    enabled: boolean;
    price: string;
    address: string;
    rpcUrl: string;
  };
}

export const DEFAULT_PAID_REGISTRATION: PaidRegistrationConfig = {
  enabled: false,
  invitesPay: false,
  pendingDays: 7,
  btc: {
    enabled: false,
    price: '',
    xpub: '',
    confirmations: 2,
    esploraUrl: 'https://mempool.space/api',
  },
  xmr: { enabled: false, price: '', confirmations: 10 },
  sol: {
    enabled: false,
    price: '',
    address: '',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
  },
};

const DECIMAL = /^\d+(\.\d+)?$/;

/** A positive decimal amount with no more digits than the coin has */
export function isValidPrice(price: string, currency: PaymentCurrency): boolean {
  if (!DECIMAL.test(price)) return false;
  const fraction = price.split('.')[1] ?? '';
  if (fraction.length > CURRENCY_DECIMALS[currency]) return false;
  return toAtomic(price, currency) > 0n;
}

/** '0.0005' BTC -> 50000n satoshis. Throws on malformed input */
export function toAtomic(amount: string, currency: PaymentCurrency): bigint {
  if (!DECIMAL.test(amount)) throw new Error(`Invalid amount: ${amount}`);
  const decimals = CURRENCY_DECIMALS[currency];
  const [whole = '0', fraction = ''] = amount.split('.');
  if (fraction.length > decimals) throw new Error(`Too many decimals: ${amount}`);
  return BigInt(whole + fraction.padEnd(decimals, '0'));
}

/** 50000n satoshis -> '0.0005' (no trailing zeros) */
export function fromAtomic(atomic: bigint | string, currency: PaymentCurrency): string {
  const value = typeof atomic === 'bigint' ? atomic : BigInt(atomic);
  const decimals = CURRENCY_DECIMALS[currency];
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

const bool = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;
const str = (value: unknown, fallback: string) =>
  typeof value === 'string' ? value.trim() : fallback;
const int = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** Parse the stored JSON (or an already parsed object) with defaults */
export function parsePaidRegistration(raw: unknown): PaidRegistrationConfig {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
  }
  const root = obj(data);
  const btc = obj(root.btc);
  const xmr = obj(root.xmr);
  const sol = obj(root.sol);
  const d = DEFAULT_PAID_REGISTRATION;

  return {
    enabled: bool(root.enabled, d.enabled),
    invitesPay: bool(root.invitesPay, d.invitesPay),
    pendingDays: int(root.pendingDays, d.pendingDays, 1, 365),
    btc: {
      enabled: bool(btc.enabled, d.btc.enabled),
      price: str(btc.price, d.btc.price),
      xpub: str(btc.xpub, d.btc.xpub),
      confirmations: int(btc.confirmations, d.btc.confirmations, 0, 100),
      esploraUrl: str(btc.esploraUrl, d.btc.esploraUrl) || d.btc.esploraUrl,
    },
    xmr: {
      enabled: bool(xmr.enabled, d.xmr.enabled),
      price: str(xmr.price, d.xmr.price),
      confirmations: int(xmr.confirmations, d.xmr.confirmations, 0, 100),
    },
    sol: {
      enabled: bool(sol.enabled, d.sol.enabled),
      price: str(sol.price, d.sol.price),
      address: str(sol.address, d.sol.address),
      rpcUrl: str(sol.rpcUrl, d.sol.rpcUrl) || d.sol.rpcUrl,
    },
  };
}

/**
 * Coins that can be offered: switched on, with a valid price and the receiving
 * side configured (Monero also needs MONERO_WALLET_RPC_URL, checked on the server)
 */
export function availableCurrencies(config: PaidRegistrationConfig): PaymentCurrency[] {
  const out: PaymentCurrency[] = [];
  if (config.btc.enabled && config.btc.xpub && isValidPrice(config.btc.price, 'btc')) out.push('btc');
  if (config.xmr.enabled && isValidPrice(config.xmr.price, 'xmr')) out.push('xmr');
  if (config.sol.enabled && config.sol.address && isValidPrice(config.sol.price, 'sol')) out.push('sol');
  return out;
}

/** Whether a new account must pay before it is unlocked */
export function registrationRequiresPayment(
  config: PaidRegistrationConfig,
  options: { isFirstUser: boolean; usedInvite: boolean; currencies: PaymentCurrency[] }
): boolean {
  if (options.isFirstUser || !config.enabled) return false;
  if (options.currencies.length === 0) return false;
  return !options.usedInvite || config.invitesPay;
}

export type InvoiceStatus = 'pending' | 'confirming' | 'paid' | 'cancelled';

/**
 * Status from what the chain shows: paid once enough is confirmed, confirming
 * while the rest waits for confirmations, pending otherwise (underpaid: the
 * user can send the difference to the same address)
 */
export function invoiceStatus(amount: bigint, confirmed: bigint, unconfirmed: bigint): InvoiceStatus {
  if (confirmed >= amount) return 'paid';
  if (confirmed + unconfirmed >= amount) return 'confirming';
  return 'pending';
}

/** Wallet link (BIP21, Monero URI, Solana Pay) with the amount still due */
export function paymentUri(
  currency: PaymentCurrency,
  address: string,
  amountDue: string,
  reference?: string | null
): string {
  switch (currency) {
    case 'btc':
      return `bitcoin:${address}?amount=${amountDue}`;
    case 'xmr':
      return `monero:${address}?tx_amount=${amountDue}`;
    case 'sol':
      return `solana:${address}?amount=${amountDue}${reference ? `&reference=${reference}` : ''}`;
  }
}

export const DEFAULT_CHECK_INTERVAL_MS = 60_000;
export const MIN_CHECK_INTERVAL_MS = 5_000;
// setInterval turns larger delays into 1 ms
export const MAX_CHECK_INTERVAL_MS = 2_147_483_647;

/**
 * PAYMENT_CHECK_INTERVAL in ms: digits only, from 5 s to the setInterval
 * limit, otherwise the default ("60s", "0" or a huge value must not turn the
 * watcher into a tight loop)
 */
export function parseCheckInterval(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw.trim())) return DEFAULT_CHECK_INTERVAL_MS;
  const value = Number(raw.trim());
  return value >= MIN_CHECK_INTERVAL_MS && value <= MAX_CHECK_INTERVAL_MS
    ? value
    : DEFAULT_CHECK_INTERVAL_MS;
}
