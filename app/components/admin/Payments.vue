<template>
  <div class="space-y-6">
    <!-- Settings -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:currency-btc" class="text-text-muted" />
          <h3 class="text-sm font-medium text-text-primary">{{ t('payments.admin.title') }}</h3>
        </div>
      </div>
      <div v-if="config" class="card-body">
        <SettingsGroup :label="t('payments.admin.enabledLabel')" :description="t('payments.admin.enabledDescription')">
          <ToggleSwitch v-model="config.enabled" />
        </SettingsGroup>

        <SettingsGroup :label="t('payments.admin.invitesPayLabel')" :description="t('payments.admin.invitesPayDescription')">
          <ToggleSwitch v-model="config.invitesPay" />
        </SettingsGroup>

        <SettingsGroup :label="t('payments.admin.pendingDaysLabel')" :description="t('payments.admin.pendingDaysDescription')">
          <input v-model.number="config.pendingDays" type="number" min="1" max="365" :class="inputClass" class="md:w-32" />
        </SettingsGroup>

        <!-- Bitcoin -->
        <div class="mt-6 pt-6 border-t border-border">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-sm font-semibold text-text-primary">Bitcoin (BTC)</h4>
            <ToggleSwitch v-model="config.btc.enabled" />
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="block">
              <span :class="labelClass">{{ t('payments.admin.price') }} (BTC)</span>
              <input v-model="config.btc.price" type="text" inputmode="decimal" placeholder="0.0005" :class="inputClass" />
            </label>
            <label class="block">
              <span :class="labelClass">{{ t('payments.admin.confirmations') }}</span>
              <input v-model.number="config.btc.confirmations" type="number" min="0" max="100" :class="inputClass" />
            </label>
            <label class="block md:col-span-2">
              <span :class="labelClass">{{ t('payments.admin.xpub') }}</span>
              <input v-model="config.btc.xpub" type="text" placeholder="zpub6..." :class="inputClass" />
              <span class="block text-xs text-text-muted mt-1">{{ t('payments.admin.xpubHint') }}</span>
            </label>
            <label class="block md:col-span-2">
              <span :class="labelClass">{{ t('payments.admin.esploraUrl') }}</span>
              <input v-model="config.btc.esploraUrl" type="url" :class="inputClass" />
            </label>
          </div>
        </div>

        <!-- Monero -->
        <div class="mt-6 pt-6 border-t border-border">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-sm font-semibold text-text-primary">Monero (XMR)</h4>
            <ToggleSwitch v-model="config.xmr.enabled" />
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="block">
              <span :class="labelClass">{{ t('payments.admin.price') }} (XMR)</span>
              <input v-model="config.xmr.price" type="text" inputmode="decimal" placeholder="0.1" :class="inputClass" />
            </label>
            <label class="block">
              <span :class="labelClass">{{ t('payments.admin.confirmations') }}</span>
              <input v-model.number="config.xmr.confirmations" type="number" min="0" max="100" :class="inputClass" />
            </label>
          </div>
          <p v-if="!monero?.configured" class="text-xs mt-3 text-amber-400">
            <Icon name="ph:warning" class="inline-block align-[-2px] mr-1" />
            {{ t('payments.admin.moneroMissing') }}
          </p>
          <div v-else-if="monero.ready" class="text-xs mt-3 text-success space-y-1">
            <p>
              <Icon name="ph:check-circle" class="inline-block align-[-2px] mr-1" />
              {{ t('payments.admin.moneroReady', { height: monero.height ?? 0 }) }}
            </p>
            <p class="font-mono text-text-muted break-all">{{ monero.address }}</p>
          </div>
          <!-- Wallet RPC running, no wallet yet: create the view-only wallet -->
          <div v-else class="mt-4 p-4 rounded border border-border bg-bg-tertiary/40 space-y-3">
            <p class="text-xs text-text-muted">{{ t('payments.admin.moneroCreateIntro') }}</p>
            <label class="block">
              <span :class="labelClass">{{ t('payments.admin.moneroAddress') }}</span>
              <input v-model="walletForm.address" type="text" placeholder="4..." :class="inputClass" />
            </label>
            <label class="block">
              <span :class="labelClass">{{ t('payments.admin.moneroViewKey') }}</span>
              <input v-model="walletForm.viewKey" type="password" autocomplete="off" :class="inputClass" />
            </label>
            <label class="block">
              <span :class="labelClass">{{ t('payments.admin.moneroRestoreHeight') }}</span>
              <input v-model.number="walletForm.restoreHeight" type="number" min="0" :class="inputClass" />
              <span class="block text-xs text-text-muted mt-1">{{ t('payments.admin.moneroRestoreHeightHint') }}</span>
            </label>
            <div v-if="walletError" class="text-red-400 text-xs">{{ walletError }}</div>
            <button
              type="button"
              :disabled="creatingWallet"
              class="text-xs border border-border rounded px-3 py-1.5 hover:bg-bg-tertiary disabled:opacity-50 flex items-center gap-2"
              @click="createWallet"
            >
              <Icon v-if="creatingWallet" name="ph:circle-notch" class="animate-spin" />
              {{ t('payments.admin.moneroCreate') }}
            </button>
          </div>
        </div>

        <!-- Solana -->
        <div class="mt-6 pt-6 border-t border-border">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-sm font-semibold text-text-primary">Solana (SOL)</h4>
            <ToggleSwitch v-model="config.sol.enabled" />
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="block">
              <span :class="labelClass">{{ t('payments.admin.price') }} (SOL)</span>
              <input v-model="config.sol.price" type="text" inputmode="decimal" placeholder="0.5" :class="inputClass" />
            </label>
            <label class="block">
              <span :class="labelClass">{{ t('payments.admin.solAddress') }}</span>
              <input v-model="config.sol.address" type="text" :class="inputClass" />
            </label>
            <label class="block md:col-span-2">
              <span :class="labelClass">{{ t('payments.admin.solRpcUrl') }}</span>
              <input v-model="config.sol.rpcUrl" type="url" :class="inputClass" />
            </label>
          </div>
        </div>

        <div v-if="saveError" class="text-red-400 text-sm mt-4">{{ saveError }}</div>

        <button
          type="button"
          :disabled="saving"
          class="mt-6 w-full text-xs font-bold py-2.5 rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          :class="saved ? 'bg-success text-paper' : 'bg-text-primary text-bg-primary hover:opacity-90'"
          @click="save"
        >
          <Icon v-if="saving" name="ph:circle-notch" class="animate-spin" />
          <Icon v-else-if="saved" name="ph:check-bold" />
          {{ saving ? t('common.saving') : saved ? t('common.saved') : t('common.saveConfiguration') }}
        </button>
      </div>
    </div>

    <!-- Locked accounts -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:hourglass" class="text-text-muted" />
          <h3 class="text-sm font-medium text-text-primary">{{ t('payments.admin.pendingTitle') }}</h3>
        </div>
      </div>
      <div class="card-body">
        <p v-if="!list?.pending.length" class="text-sm text-text-muted">{{ t('payments.admin.noPending') }}</p>
        <div v-for="user in list?.pending" :key="user.id" class="py-3 border-b border-border last:border-0">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-text-primary">{{ user.username }}</p>
              <p class="text-xs text-text-muted">{{ formatDate(user.createdAt) }}</p>
            </div>
            <button
              type="button"
              :disabled="approving === user.id"
              class="text-xs border border-border rounded px-3 py-1.5 hover:bg-bg-tertiary disabled:opacity-50"
              @click="approve(user.id)"
            >
              {{ t('payments.admin.approve') }}
            </button>
          </div>
          <ul v-if="user.invoices.length" class="mt-2 space-y-1">
            <li v-for="invoice in user.invoices" :key="invoice.id" class="text-xs text-text-muted font-mono">
              {{ invoice.currency.toUpperCase() }} · {{ invoice.received }} / {{ invoice.amount }}
              <span v-if="invoice.unconfirmed !== '0'">(+{{ invoice.unconfirmed }})</span>
              · {{ t(`payments.status.${invoice.status}`) }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Recent payments -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:receipt" class="text-text-muted" />
          <h3 class="text-sm font-medium text-text-primary">{{ t('payments.admin.paidTitle') }}</h3>
        </div>
      </div>
      <div class="card-body">
        <p v-if="!list?.paid.length" class="text-sm text-text-muted">{{ t('payments.admin.noPaid') }}</p>
        <div
          v-for="payment in list?.paid"
          :key="payment.id"
          class="py-2 border-b border-border last:border-0 flex items-center justify-between gap-3 text-sm"
        >
          <span class="text-text-primary">{{ payment.username }}</span>
          <span class="text-xs font-mono text-text-muted">
            {{ payment.received }} {{ payment.currency.toUpperCase() }}
            <span v-if="payment.approvedBy" class="ml-1 text-accent">{{ t('payments.admin.manual') }}</span>
          </span>
          <span class="text-xs text-text-muted">{{ payment.paidAt ? formatDate(payment.paidAt) : '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PaidRegistrationConfig, PaymentCurrency } from '~~/shared/utils/paidRegistration';

interface InvoiceRow {
  id: string;
  currency: PaymentCurrency;
  amount: string;
  received: string;
  unconfirmed: string;
  status: 'pending' | 'confirming' | 'paid' | 'cancelled';
  paidAt: string | null;
}

interface PaymentList {
  pending: { id: string; username: string; createdAt: string; invoices: InvoiceRow[] }[];
  paid: (InvoiceRow & { username: string; approvedBy: string | null })[];
}

const { t, locale } = useI18n();

const inputClass =
  'w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-white/20 font-mono';
const labelClass = 'block text-xs font-medium text-text-muted mb-1';

interface MoneroStatus {
  configured: boolean;
  ready: boolean;
  address: string | null;
  height: number | null;
  error: string | null;
}

const config = ref<PaidRegistrationConfig | null>(null);
const monero = ref<MoneroStatus | null>(null);
const walletForm = reactive({ address: '', viewKey: '', restoreHeight: 0 });
const walletError = ref('');
const creatingWallet = ref(false);
const list = ref<PaymentList | null>(null);
const saving = ref(false);
const saved = ref(false);
const saveError = ref('');
const approving = ref<string | null>(null);

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value);
}

async function loadList() {
  list.value = await $fetch<PaymentList>('/api/admin/payments');
}

onMounted(async () => {
  const settings = await $fetch<{ config: PaidRegistrationConfig }>('/api/admin/payments/settings');
  config.value = settings.config;
  await Promise.all([loadList(), loadMonero()]);
});

async function loadMonero() {
  monero.value = await $fetch<MoneroStatus>('/api/admin/payments/monero');
}

async function createWallet() {
  creatingWallet.value = true;
  walletError.value = '';
  try {
    monero.value = await $fetch<MoneroStatus>('/api/admin/payments/monero', {
      method: 'POST',
      body: walletForm,
    });
    // The view key is only needed once: do not keep it in the page
    walletForm.viewKey = '';
  } catch (err: any) {
    walletError.value = err.data?.message || t('payments.admin.saveFailed');
  } finally {
    creatingWallet.value = false;
  }
}

async function save() {
  if (!config.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    const result = await $fetch<{ config: PaidRegistrationConfig }>('/api/admin/payments/settings', {
      method: 'PUT',
      body: config.value,
    });
    config.value = result.config;
    saved.value = true;
    setTimeout(() => (saved.value = false), 2000);
  } catch (err: any) {
    saveError.value = err.data?.message || t('payments.admin.saveFailed');
  } finally {
    saving.value = false;
  }
}

async function approve(userId: string) {
  approving.value = userId;
  try {
    await $fetch(`/api/admin/payments/${userId}/approve`, { method: 'POST' });
    await loadList();
  } finally {
    approving.value = null;
  }
}
</script>
