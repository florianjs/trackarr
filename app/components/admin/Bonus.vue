<template>
  <div class="space-y-6">
    <div v-if="message" class="text-xs px-3 py-2 rounded border" :class="message.ok ? 'border-success/30 bg-success/10 text-success' : 'border-error/30 bg-error/10 text-error'">
      {{ message.text }}
    </div>

    <!-- Earning rules -->
    <div class="card">
      <div class="card-header">
        <h3 class="text-xs font-bold uppercase tracking-wider text-text-primary">{{ t('bonus.admin.settings') }}</h3>
      </div>
      <div v-if="settings" class="card-body space-y-4">
        <label class="flex items-center gap-2 text-sm">
          <input v-model="settings.enabled" type="checkbox" />
          {{ t('bonus.admin.enabled') }}
        </label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label v-for="field in numberFields" :key="field" class="space-y-1">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t(`bonus.admin.${field}`) }}</span>
            <input v-model.number="settings[field]" type="number" min="0" step="any" class="input w-full !py-2 text-xs font-mono" />
          </label>
        </div>
        <button class="btn btn-primary !py-2 text-xs" :disabled="saving" @click="saveSettings">{{ t('bonus.admin.save') }}</button>
      </div>
    </div>

    <!-- Shop items -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="text-xs font-bold uppercase tracking-wider text-text-primary">{{ t('bonus.admin.items') }}</h3>
        <button class="btn btn-secondary !py-1.5 !px-3 text-xs" @click="editItem()">
          <Icon name="ph:plus-bold" class="mr-1" />{{ t('bonus.admin.addItem') }}
        </button>
      </div>
      <div class="card-body space-y-3">
        <!-- Editor -->
        <div v-if="draft" class="p-4 rounded border border-border bg-bg-tertiary/50 space-y-3">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {{ draft.id ? t('bonus.admin.editItem') : t('bonus.admin.addItem') }}
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="space-y-1">
              <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.admin.name') }}</span>
              <input v-model="draft.name" type="text" maxlength="100" class="input w-full !py-2 text-xs" />
            </label>
            <label class="space-y-1">
              <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.admin.type') }}</span>
              <select v-model="draft.type" class="input w-full !py-2 text-xs">
                <option v-for="type in itemTypes" :key="type" :value="type">{{ t(`bonus.admin.types.${type}`) }}</option>
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.admin.price') }}</span>
              <input v-model.number="draft.price" type="number" min="1" class="input w-full !py-2 text-xs font-mono" />
            </label>
            <label v-if="draft.type === 'upload_credit'" class="space-y-1">
              <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.admin.valueGb') }}</span>
              <input v-model.number="draft.valueGb" type="number" min="0.1" step="0.1" class="input w-full !py-2 text-xs font-mono" />
            </label>
            <label v-else-if="draft.type === 'invite'" class="space-y-1">
              <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.admin.valueInvites') }}</span>
              <input v-model.number="draft.valueInvites" type="number" min="1" class="input w-full !py-2 text-xs font-mono" />
            </label>
            <label class="space-y-1 sm:col-span-2">
              <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.admin.description') }}</span>
              <input v-model="draft.description" type="text" maxlength="500" class="input w-full !py-2 text-xs" />
            </label>
            <label class="space-y-1">
              <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.admin.sortOrder') }}</span>
              <input v-model.number="draft.sortOrder" type="number" min="0" class="input w-full !py-2 text-xs font-mono" />
            </label>
            <label class="flex items-center gap-2 text-sm self-end pb-2">
              <input v-model="draft.isActive" type="checkbox" />
              {{ t('bonus.admin.active') }}
            </label>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary !py-2 text-xs" :disabled="saving || !draft.name.trim()" @click="saveItem">{{ t('bonus.admin.save') }}</button>
            <button class="btn btn-secondary !py-2 text-xs" @click="draft = null">{{ t('bonus.bounties.form.cancel') }}</button>
          </div>
        </div>

        <table v-if="items?.length" class="w-full text-xs">
          <tbody>
            <tr v-for="item in items" :key="item.id" class="border-b border-border last:border-0">
              <td class="py-2 pr-3">
                <span class="font-bold" :class="item.isActive ? 'text-text-primary' : 'text-text-muted line-through'">{{ item.name }}</span>
                <span class="text-text-muted"> · {{ t(`bonus.admin.types.${item.type}`) }}</span>
              </td>
              <td class="py-2 pr-3 font-mono text-text-muted">{{ describeValue(item) }}</td>
              <td class="py-2 pr-3 font-mono font-bold">{{ item.price }}</td>
              <td class="py-2 text-right whitespace-nowrap">
                <button class="text-text-muted hover:text-white mr-3" :title="t('bonus.admin.editItem')" @click="editItem(item)"><Icon name="ph:pencil-simple-bold" /></button>
                <button class="text-text-muted hover:text-error" :title="t('bonus.admin.delete')" @click="deleteItem(item)"><Icon name="ph:trash-bold" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Grant -->
    <div class="card">
      <div class="card-header">
        <h3 class="text-xs font-bold uppercase tracking-wider text-text-primary">{{ t('bonus.admin.grant') }}</h3>
      </div>
      <div class="card-body grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <label class="space-y-1 sm:col-span-1">
          <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.admin.grantUser') }}</span>
          <input v-model="grant.userId" type="text" class="input w-full !py-2 text-xs font-mono" />
        </label>
        <label class="space-y-1">
          <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.admin.grantAmount') }}</span>
          <input v-model.number="grant.amount" type="number" class="input w-full !py-2 text-xs font-mono" />
        </label>
        <label class="space-y-1">
          <span class="text-[10px] font-bold uppercase tracking-widest text-text-muted">{{ t('bonus.admin.grantReason') }}</span>
          <input v-model="grant.reason" type="text" maxlength="200" class="input w-full !py-2 text-xs" />
        </label>
        <button class="btn btn-primary !py-2 text-xs" :disabled="saving || !grant.userId || !grant.amount || !grant.reason.trim()" @click="applyGrant">
          {{ t('bonus.admin.grantSubmit') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface BonusSettings {
  enabled: boolean;
  pointsPerSeedDay: number;
  maxSeedingTorrents: number;
  pointsPerUpload: number;
  bountyMinPoints: number;
}

interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  type: 'upload_credit' | 'invite' | 'gif_avatar';
  price: number;
  value: number;
  isActive: boolean;
  sortOrder: number;
}

interface Draft {
  id?: string;
  name: string;
  description: string;
  type: ShopItem['type'];
  price: number;
  valueGb: number;
  valueInvites: number;
  isActive: boolean;
  sortOrder: number;
}

const GB = 1024 ** 3;
const itemTypes = ['upload_credit', 'invite', 'gif_avatar'] as const;
const numberFields = ['pointsPerSeedDay', 'maxSeedingTorrents', 'pointsPerUpload', 'bountyMinPoints'] as const;

const { t } = useI18n();

const { data: settings } = await useFetch<BonusSettings>('/api/admin/bonus/settings');
const { data: items, refresh: refreshItems } = await useFetch<ShopItem[]>('/api/admin/shop/items', { default: () => [] });

const saving = ref(false);
const message = ref<{ ok: boolean; text: string } | null>(null);
const draft = ref<Draft | null>(null);
const grant = reactive({ userId: '', amount: 0, reason: '' });

async function run(fn: () => Promise<string | void>) {
  saving.value = true;
  message.value = null;
  try {
    const text = await fn();
    message.value = { ok: true, text: text || t('bonus.admin.saved') };
  } catch (err) {
    message.value = { ok: false, text: (err as { data?: { message?: string } }).data?.message ?? 'Error' };
  } finally {
    saving.value = false;
  }
}

function describeValue(item: ShopItem): string {
  if (item.type === 'upload_credit') return formatSize(item.value);
  if (item.type === 'invite') return `×${item.value}`;
  return '';
}

function saveSettings() {
  return run(async () => {
    settings.value = await $fetch<BonusSettings>('/api/admin/bonus/settings', { method: 'PUT', body: settings.value! });
  });
}

function editItem(item?: ShopItem) {
  draft.value = {
    id: item?.id,
    name: item?.name ?? '',
    description: item?.description ?? '',
    type: item?.type ?? 'upload_credit',
    price: item?.price ?? 100,
    valueGb: item?.type === 'upload_credit' ? item.value / GB : 10,
    valueInvites: item?.type === 'invite' ? item.value : 1,
    isActive: item?.isActive ?? true,
    sortOrder: item?.sortOrder ?? 0,
  };
}

function saveItem() {
  const d = draft.value!;
  const value =
    d.type === 'upload_credit' ? Math.round(d.valueGb * GB) : d.type === 'invite' ? d.valueInvites : 0;
  const body = {
    name: d.name.trim(),
    description: d.description.trim() || null,
    type: d.type,
    price: d.price,
    value,
    isActive: d.isActive,
    sortOrder: d.sortOrder,
  };
  return run(async () => {
    await $fetch(d.id ? `/api/admin/shop/items/${d.id}` : '/api/admin/shop/items', {
      method: d.id ? 'PUT' : 'POST',
      body,
    });
    draft.value = null;
    await refreshItems();
  });
}

function deleteItem(item: ShopItem) {
  if (!confirm(t('bonus.admin.confirmDelete', { name: item.name }))) return;
  return run(async () => {
    await $fetch(`/api/admin/shop/items/${item.id}`, { method: 'DELETE' });
    await refreshItems();
  });
}

function applyGrant() {
  return run(async () => {
    const res = await $fetch<{ points: number }>(`/api/admin/users/${grant.userId.trim()}/bonus`, {
      method: 'POST',
      body: { amount: grant.amount, reason: grant.reason.trim() },
    });
    grant.amount = 0;
    grant.reason = '';
    return t('bonus.admin.granted', { points: Math.floor(res.points) });
  });
}
</script>
