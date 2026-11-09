<template>
  <AuthShell>
    <div class="bg-bg-secondary border border-border rounded-lg p-6">
      <h2 class="text-lg font-semibold mb-2">{{ t('payments.page.title') }}</h2>
      <p class="text-text-muted text-sm mb-6">{{ t('payments.page.intro') }}</p>

      <div v-if="!status" class="text-text-muted text-sm flex items-center gap-2">
        <Icon name="ph:spinner" class="animate-spin" />
        {{ t('payments.page.loading') }}
      </div>

      <template v-else>
        <div
          v-if="status.options.length === 0 && status.invoices.length === 0"
          class="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 text-sm"
        >
          {{ t('payments.page.unavailable') }}
        </div>

        <!-- Coin choice -->
        <div v-if="status.options.length > 0" class="mb-6">
          <p class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            {{ t('payments.page.chooseCurrency') }}
          </p>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="option in status.options"
              :key="option.currency"
              type="button"
              :disabled="busy"
              class="border rounded px-3 py-2 text-sm transition-colors disabled:opacity-50"
              :class="
                selected === option.currency
                  ? 'border-text-primary bg-bg-tertiary text-text-primary'
                  : 'border-border text-text-muted hover:text-text-primary'
              "
              @click="choose(option.currency)"
            >
              <span class="block font-semibold">{{ option.currency.toUpperCase() }}</span>
              <span class="block text-xs font-mono">{{ option.price }}</span>
            </button>
          </div>
        </div>

        <!-- Invoice -->
        <div v-if="invoice" class="space-y-4">
          <div
            class="p-3 rounded border text-sm flex items-center gap-2"
            :class="statusClass(invoice.status)"
          >
            <Icon :name="invoice.status === 'confirming' ? 'ph:hourglass' : 'ph:clock'" />
            <span>{{ t(`payments.status.${invoice.status}`) }}</span>
          </div>

          <div>
            <p class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
              {{ t('payments.page.amountDue') }}
            </p>
            <div class="flex items-center gap-2">
              <code class="flex-1 bg-bg-tertiary border border-border rounded px-3 py-2 text-sm font-mono">
                {{ invoice.due }} {{ invoice.currency.toUpperCase() }}
              </code>
              <button type="button" class="text-text-muted hover:text-text-primary" @click="copy(invoice.due)">
                <Icon :name="copied === invoice.due ? 'ph:check' : 'ph:copy'" />
              </button>
            </div>
            <p v-if="invoice.received !== '0' || invoice.unconfirmed !== '0'" class="text-xs text-text-muted mt-1">
              {{ t('payments.page.seen', { confirmed: invoice.received, unconfirmed: invoice.unconfirmed, total: invoice.amount }) }}
            </p>
          </div>

          <div>
            <p class="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">
              {{ t('payments.page.address') }}
            </p>
            <div class="flex items-center gap-2">
              <code class="flex-1 bg-bg-tertiary border border-border rounded px-3 py-2 text-xs font-mono break-all">
                {{ invoice.address }}
              </code>
              <button type="button" class="text-text-muted hover:text-text-primary" @click="copy(invoice.address)">
                <Icon :name="copied === invoice.address ? 'ph:check' : 'ph:copy'" />
              </button>
            </div>
          </div>

          <div
            v-if="invoice.currency === 'sol'"
            class="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 text-xs"
          >
            {{ t('payments.page.solanaReference') }}
          </div>

          <a
            :href="invoice.uri"
            class="block w-full text-center bg-white text-black font-medium py-2.5 rounded hover:bg-gray-200 transition-colors"
          >
            {{ t('payments.page.openWallet') }}
          </a>

          <p class="text-xs text-text-muted">
            {{ confirmationsHint }}
          </p>
        </div>

        <div v-if="error" class="text-red-400 text-sm mt-4">{{ error }}</div>

        <div class="mt-6 pt-6 border-t border-border space-y-3">
          <button
            type="button"
            :disabled="busy || status.invoices.length === 0"
            class="w-full border border-border text-sm py-2 rounded hover:bg-bg-tertiary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            @click="check"
          >
            <Icon v-if="busy" name="ph:spinner" class="animate-spin" />
            {{ t('payments.page.checkNow') }}
          </button>
          <p class="text-xs text-text-muted text-center">
            {{ t('payments.page.deadline', { date: deadline }) }}
          </p>
          <button type="button" class="w-full text-xs text-text-muted hover:text-text-primary" @click="logout">
            {{ t('payments.page.logout') }}
          </button>
        </div>
      </template>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import type { PaymentCurrency } from '~~/shared/utils/paidRegistration';

definePageMeta({
  layout: false,
});

interface Invoice {
  id: string;
  currency: PaymentCurrency;
  address: string;
  amount: string;
  received: string;
  unconfirmed: string;
  due: string;
  status: 'pending' | 'confirming' | 'paid' | 'cancelled';
  uri: string;
}

interface PaymentStatus {
  paymentPending: boolean;
  deadline: string;
  options: { currency: PaymentCurrency; price: string; confirmations: number | null }[];
  invoices: Invoice[];
}

const { t, locale } = useI18n();
const { fetch: fetchSession, clear } = useUserSession();
const router = useRouter();

const status = ref<PaymentStatus | null>(null);
const selected = ref<PaymentCurrency | null>(null);
const busy = ref(false);
const error = ref('');
const copied = ref('');

const openInvoices = computed(() =>
  (status.value?.invoices ?? []).filter((i) => i.status === 'pending' || i.status === 'confirming')
);
const invoice = computed(() => openInvoices.value.find((i) => i.currency === selected.value) ?? null);

const deadline = computed(() =>
  status.value ? new Date(status.value.deadline).toLocaleDateString(locale.value) : ''
);

const confirmationsHint = computed(() => {
  const option = status.value?.options.find((o) => o.currency === selected.value);
  if (!option || option.confirmations === null) return t('payments.page.finalizedHint');
  return t('payments.page.confirmationsHint', { count: option.confirmations });
});

function statusClass(value: Invoice['status']) {
  return value === 'confirming'
    ? 'bg-accent/10 border-accent/20 text-accent'
    : 'bg-bg-tertiary border-border text-text-secondary';
}

async function apply(next: PaymentStatus) {
  status.value = next;
  if (!next.paymentPending) {
    // Rewrites the session cookie with the unlocked state, then reload it
    await $fetch('/api/auth/status');
    await fetchSession();
    await router.push('/');
    return;
  }
  if (!selected.value) {
    selected.value = openInvoices.value.at(-1)?.currency ?? null;
  }
}

async function load() {
  try {
    await apply(await $fetch<PaymentStatus>('/api/payment/status'));
  } catch (err: any) {
    error.value = err.data?.message || t('payments.page.failed');
  }
}

async function choose(currency: PaymentCurrency) {
  selected.value = currency;
  if (invoice.value) return;
  busy.value = true;
  error.value = '';
  try {
    await apply(
      await $fetch<PaymentStatus>('/api/payment/invoice', { method: 'POST', body: { currency } })
    );
  } catch (err: any) {
    error.value = err.data?.message || t('payments.page.failed');
  } finally {
    busy.value = false;
  }
}

async function check() {
  busy.value = true;
  error.value = '';
  try {
    await apply(await $fetch<PaymentStatus>('/api/payment/check', { method: 'POST' }));
  } catch (err: any) {
    error.value = err.data?.message || t('payments.page.failed');
  } finally {
    busy.value = false;
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = text;
    setTimeout(() => (copied.value = ''), 1500);
  } catch {
    // Clipboard refused (insecure context): the text stays selectable
  }
}

async function logout() {
  await clear();
  await router.push('/auth/login');
}

// The server reads the chain every minute; ask it to look now and then
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(async () => {
  await load();
  timer = setInterval(() => {
    if (openInvoices.value.length > 0 && !busy.value) void check();
  }, 30_000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>
