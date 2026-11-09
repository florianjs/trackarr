import { redis } from '../redis/client';
import { claim } from '../redis/claim';
import { getPaidRegistration } from '../utils/settings';
import {
  listOpenInvoices,
  purgeUnpaidAccounts,
  refreshInvoice,
} from '../utils/payments/invoices';

/**
 * Paid registration: polls the chains for open invoices and unlocks the
 * accounts once paid, then deletes locked accounts left unpaid too long.
 * With several app nodes, only the first to claim an interval runs it.
 */
export default defineNitroPlugin(() => {
  const INTERVAL = parseInt(process.env.PAYMENT_CHECK_INTERVAL || '60000', 10);
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      if (!(await claim(redis, 'job:payment-watcher', INTERVAL * 0.9))) return;
      const config = await getPaidRegistration();
      const invoices = await listOpenInvoices();

      // One at a time: public APIs (mempool.space, Solana RPC) rate-limit
      for (const invoice of invoices) {
        try {
          await refreshInvoice(invoice, config);
        } catch (err) {
          console.error(
            `[Payments] Check failed for ${invoice.currency} invoice ${invoice.id}:`,
            (err as Error).message
          );
        }
      }

      const purged = await purgeUnpaidAccounts(config.pendingDays);
      if (purged > 0) console.log(`[Payments] Deleted ${purged} unpaid account(s)`);
    } catch (err) {
      console.error('[Payments] Watcher failed:', err);
    } finally {
      running = false;
    }
  };

  setTimeout(run, 15_000);
  setInterval(run, INTERVAL);
});
