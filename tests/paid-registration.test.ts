import { describe, it, expect } from 'vitest';
import {
  availableCurrencies,
  fromAtomic,
  invoiceStatus,
  isValidPrice,
  parsePaidRegistration,
  paymentUri,
  registrationRequiresPayment,
  toAtomic,
  DEFAULT_PAID_REGISTRATION,
} from '../shared/utils/paidRegistration';
import { deriveBtcAddress, parseExtendedPublicKey, sumEsploraTxs } from '../server/utils/payments/btc';
import { sumMoneroTransfers } from '../server/utils/payments/xmr';
import { isSolanaAddress, newSolReference, solanaCredit } from '../server/utils/payments/sol';

// BIP84 test vector: "abandon abandon ... about", account m/84'/0'/0'
const ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';

describe('amounts', () => {
  it('converts decimals to the smallest unit and back', () => {
    expect(toAtomic('0.0005', 'btc')).toBe(50_000n);
    expect(toAtomic('1', 'xmr')).toBe(1_000_000_000_000n);
    expect(toAtomic('0.5', 'sol')).toBe(500_000_000n);
    expect(fromAtomic(50_000n, 'btc')).toBe('0.0005');
    expect(fromAtomic('1000000000000', 'xmr')).toBe('1');
    expect(fromAtomic(0n, 'sol')).toBe('0');
  });

  it('rejects malformed or too precise prices', () => {
    expect(isValidPrice('0.0005', 'btc')).toBe(true);
    expect(isValidPrice('0.000000001', 'btc')).toBe(false); // 9 decimals
    expect(isValidPrice('0', 'btc')).toBe(false);
    expect(isValidPrice('-1', 'sol')).toBe(false);
    expect(isValidPrice('1e3', 'sol')).toBe(false);
    expect(isValidPrice('', 'xmr')).toBe(false);
  });
});

describe('config', () => {
  it('falls back to defaults on broken input', () => {
    expect(parsePaidRegistration('not json')).toEqual(DEFAULT_PAID_REGISTRATION);
    expect(parsePaidRegistration(null)).toEqual(DEFAULT_PAID_REGISTRATION);
    expect(parsePaidRegistration({ pendingDays: 0, btc: { confirmations: -1 } }).pendingDays).toBe(7);
  });

  it('offers only coins that are on, priced and configured', () => {
    const config = parsePaidRegistration({
      enabled: true,
      btc: { enabled: true, price: '0.001', xpub: '' }, // no key
      xmr: { enabled: true, price: '0.1' },
      sol: { enabled: false, price: '1', address: 'x' },
    });
    expect(availableCurrencies(config)).toEqual(['xmr']);
  });

  it('asks for payment only when it applies', () => {
    const config = parsePaidRegistration({ enabled: true });
    const base = { isFirstUser: false, usedInvite: false, currencies: ['btc' as const] };
    expect(registrationRequiresPayment(config, base)).toBe(true);
    expect(registrationRequiresPayment(config, { ...base, isFirstUser: true })).toBe(false);
    expect(registrationRequiresPayment(config, { ...base, currencies: [] })).toBe(false);
    expect(registrationRequiresPayment(config, { ...base, usedInvite: true })).toBe(false);
    expect(
      registrationRequiresPayment({ ...config, invitesPay: true }, { ...base, usedInvite: true })
    ).toBe(true);
    expect(registrationRequiresPayment({ ...config, enabled: false }, base)).toBe(false);
  });
});

describe('invoice status', () => {
  it('is paid once enough is confirmed', () => {
    expect(invoiceStatus(100n, 100n, 0n)).toBe('paid');
    expect(invoiceStatus(100n, 120n, 0n)).toBe('paid');
    expect(invoiceStatus(100n, 50n, 50n)).toBe('confirming');
    expect(invoiceStatus(100n, 50n, 0n)).toBe('pending');
  });

  it('builds wallet links', () => {
    expect(paymentUri('btc', 'bc1qx', '0.001')).toBe('bitcoin:bc1qx?amount=0.001');
    expect(paymentUri('xmr', '8abc', '0.1')).toBe('monero:8abc?tx_amount=0.1');
    expect(paymentUri('sol', 'Addr', '1', 'Ref')).toBe('solana:Addr?amount=1&reference=Ref');
  });
});

describe('bitcoin', () => {
  it('derives BIP84 receive addresses', () => {
    expect(deriveBtcAddress(ZPUB, 0)).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    expect(deriveBtcAddress(ZPUB, 1)).toBe('bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
  });

  it('refuses private and unknown keys', () => {
    expect(() => parseExtendedPublicKey('xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi')).toThrow(/private/i);
    expect(() => parseExtendedPublicKey('ypub123')).toThrow(/Unsupported/);
  });

  it('splits received amounts by confirmation depth', () => {
    const address = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
    const receipt = sumEsploraTxs(
      [
        { txid: 'a', status: { confirmed: true, block_height: 100 }, vout: [{ scriptpubkey_address: address, value: 30_000 }] },
        { txid: 'b', status: { confirmed: true, block_height: 102 }, vout: [{ scriptpubkey_address: address, value: 10_000 }] },
        { txid: 'c', status: { confirmed: false }, vout: [{ scriptpubkey_address: address, value: 5_000 }] },
        { txid: 'd', status: { confirmed: true, block_height: 90 }, vout: [{ scriptpubkey_address: 'other', value: 99 }] },
      ],
      address,
      102,
      2
    );
    expect(receipt).toEqual({ confirmed: 30_000n, unconfirmed: 15_000n, txids: ['a', 'b', 'c'] });
  });
});

describe('monero', () => {
  it('counts only the invoice subaddress', () => {
    const receipt = sumMoneroTransfers(
      [
        { txid: 'a', amount: 7, confirmations: 12, subaddr_index: { major: 0, minor: 3 } },
        { txid: 'b', amount: 2, confirmations: 4, subaddr_index: { major: 0, minor: 3 } },
        { txid: 'c', amount: 100, confirmations: 50, subaddr_index: { major: 0, minor: 4 } },
      ],
      [{ txid: 'd', amount: 1, subaddr_index: { major: 0, minor: 3 } }],
      3,
      10
    );
    expect(receipt).toEqual({ confirmed: 7n, unconfirmed: 3n, txids: ['a', 'b', 'd'] });
  });
});

describe('solana', () => {
  it('reads the recipient balance change, static and loaded keys', () => {
    const tx = {
      meta: {
        err: null,
        preBalances: [5_000_000_000, 1_000, 0],
        postBalances: [4_499_995_000, 500_001_000, 0],
        loadedAddresses: { writable: [], readonly: [] },
      },
      transaction: { message: { accountKeys: ['payer', 'shop', 'reference'] } },
    };
    expect(solanaCredit(tx, 'shop')).toBe(500_000_000n);
    expect(solanaCredit(tx, 'payer')).toBe(0n);
    expect(solanaCredit({ ...tx, meta: { ...tx.meta, err: { InstructionError: [] } } }, 'shop')).toBe(0n);
  });

  it('makes valid unique references', () => {
    const a = newSolReference();
    expect(isSolanaAddress(a)).toBe(true);
    expect(a).not.toBe(newSolReference());
    expect(isSolanaAddress('not-base58-0OIl')).toBe(false);
  });
});

describe('payments made before the invoice', () => {
  it('ignores older bitcoin blocks but keeps the mempool', () => {
    const address = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
    const receipt = sumEsploraTxs(
      [
        { txid: 'old', status: { confirmed: true, block_height: 10, block_time: 1_000 }, vout: [{ scriptpubkey_address: address, value: 50_000 }] },
        { txid: 'new', status: { confirmed: true, block_height: 20, block_time: 5_000 }, vout: [{ scriptpubkey_address: address, value: 20_000 }] },
        { txid: 'mem', status: { confirmed: false }, vout: [{ scriptpubkey_address: address, value: 1_000 }] },
      ],
      address,
      30,
      1,
      4_000
    );
    expect(receipt).toEqual({ confirmed: 20_000n, unconfirmed: 1_000n, txids: ['new', 'mem'] });
  });

  it('ignores older monero transfers', () => {
    const receipt = sumMoneroTransfers(
      [
        { txid: 'old', amount: 9, confirmations: 99, timestamp: 1_000, subaddr_index: { major: 0, minor: 1 } },
        { txid: 'new', amount: 4, confirmations: 99, timestamp: 5_000, subaddr_index: { major: 0, minor: 1 } },
      ],
      [],
      1,
      10,
      4_000
    );
    expect(receipt).toEqual({ confirmed: 4n, unconfirmed: 0n, txids: ['new'] });
  });
});
