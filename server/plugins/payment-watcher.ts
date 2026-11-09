import { redis } from '../redis/client';
import { claim } from '../redis/claim';
import { getPaidRegistration } from '../utils/settings';
import { parseCheckInterval } from '../../shared/utils/paidRegistration';
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
  const INTERVAL = parseCheckInterval(process.env.PAYMENT_CHECK_INTERVAL);
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      if (!(await claim(redis, 'job:payment-watcher', INTERVAL * 0.9))) return;
      const config = await getPaidRegistration();
      const invoices = await listOpenInvoices();

      // One at a time: public APIs (mempool.space, Solana RPC) rate-limit
      const failedUsers = new Set<string>();
      for (const invoice of invoices) {
        try {
          await refreshInvoice(invoice, config);
        } catch (err) {
          failedUsers.add(invoice.userId);
          console.error(
            `[Payments] Check failed for ${invoice.currency} invoice ${invoice.id}:`,
            (err as Error).message
          );
        }
      }

      const purged = await purgeUnpaidAccounts(config.pendingDays, [...failedUsers]);
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
