<template>
  <div class="border-t border-border p-4 space-y-4">
    <div v-if="pending && !data" class="text-center text-text-muted py-4">
      <Icon name="ph:circle-notch" class="animate-spin" />
    </div>
    <template v-else-if="data">
      <!-- Current and resulting totals -->
      <div class="grid grid-cols-3 gap-3">
        <div v-for="stat in summary" :key="stat.id" class="rounded border border-border bg-bg-secondary p-3">
          <p class="text-xs text-text-muted">{{ stat.label }}</p>
          <p class="num text-lg font-medium" :class="stat.class">{{ stat.current }}</p>
          <p v-if="stat.next !== stat.current" class="num text-xs text-text-muted">→ {{ stat.next }}</p>
        </div>
      </div>

      <form class="grid gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))_auto]" @submit.prevent="submit">
        <div v-for="field in fields" :key="field" class="space-y-1">
          <span class="text-xs font-bold text-text-muted">{{ t(`admin.users.stats.${field}`) }}</span>
          <div class="flex gap-1">
            <select v-model="form[field].remove" class="input !py-2 text-xs w-auto" :aria-label="t('admin.users.stats.operation')">
              <option :value="false">+ {{ t('admin.users.stats.add') }}</option>
              <option :value="true">− {{ t('admin.users.stats.remove') }}</option>
            </select>
            <input
              v-model.number="form[field].amount"
              type="number"
              min="0"
              step="any"
              class="input !py-2 text-xs font-mono flex-1 min-w-0"
              :aria-label="t(`admin.users.stats.${field}`)"
            />
            <select v-model="form[field].unit" class="input !py-2 text-xs w-auto" :aria-label="t('admin.users.stats.unit')">
              <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
            </select>
          </div>
        </div>
        <div class="space-y-1 md:col-span-3">
          <span class="text-xs font-bold text-text-muted">{{ t('admin.users.stats.reason') }}</span>
          <div class="flex gap-2">
            <input
              v-model="form.reason"
              type="text"
              maxlength="200"
              class="input !py-2 text-xs flex-1"
              :placeholder="t('admin.users.stats.reasonPlaceholder')"
            />
            <button type="submit" class="btn btn-primary !py-2 text-xs" :disabled="!canSubmit || saving">
              <Icon v-if="saving" name="ph:circle-notch" class="animate-spin" />
              {{ t('admin.users.stats.apply') }}
            </button>
          </div>
        </div>
      </form>

      <div v-if="data.adjustments.length">
        <p class="text-xs font-bold text-text-muted mb-2">{{ t('admin.users.stats.history') }}</p>
        <ul class="divide-y divide-border border border-border rounded text-xs">
          <li v-for="a in data.adjustments" :key="a.id" class="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="num text-text-muted">{{ formatDate(a.createdAt) }}</span>
            <span v-if="a.uploadedDelta" class="num text-seed">↑ {{ signed(a.uploadedDelta) }}</span>
            <span v-if="a.downloadedDelta" class="num text-leech">↓ {{ signed(a.downloadedDelta) }}</span>
            <span class="text-text-secondary flex-1 min-w-0 break-words">{{ a.reason }}</span>
            <span class="text-text-muted">{{ a.admin ?? t('admin.users.stats.deletedAdmin') }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useNotificationStore } from '~/stores/notifications';
import { STAT_UNITS, applyStatDelta, ratioOf, toBytes, type StatUnit } from '~~/shared/utils/statAdjust';

interface StatsResponse {
  uploaded: number;
  downloaded: number;
  adjustments: {
    id: string;
    uploadedDelta: number;
    downloadedDelta: number;
    reason: string;
    createdAt: string;
    admin: string | null;
  }[];
}

const props = defineProps<{ userId: string; username: string }>();
const { t } = useI18n();
const notifications = useNotificationStore();

const units = Object.keys(STAT_UNITS) as StatUnit[];
const fields = ['uploaded', 'downloaded'] as const;

const { data, pending, refresh } = await useFetch<StatsResponse>(() => `/api/admin/users/${props.userId}/stats`, {
  lazy: true,
});

const emptyField = () => ({ remove: false, amount: 0, unit: 'GB' as StatUnit });
const form = reactive({ uploaded: emptyField(), downloaded: emptyField(), reason: '' });

const deltas = computed(() => ({
  uploaded: toBytes(form.uploaded.amount, form.uploaded.unit, form.uploaded.remove),
  downloaded: toBytes(form.downloaded.amount, form.downloaded.unit, form.downloaded.remove),
}));
const canSubmit = computed(
  () => (deltas.value.uploaded !== 0 || deltas.value.downloaded !== 0) && form.reason.trim().length > 0
);

const formatRatio = (r: number) => (r === Infinity ? '∞' : r.toFixed(2));
const signed = (bytes: number) => `${bytes < 0 ? '−' : '+'}${formatSize(Math.abs(bytes))}`;

// What the totals and ratio become once applied
const summary = computed(() => {
  const up = data.value?.uploaded ?? 0;
  const down = data.value?.downloaded ?? 0;
  const nextUp = applyStatDelta(up, deltas.value.uploaded).value;
  const nextDown = applyStatDelta(down, deltas.value.downloaded).value;
  const nextRatio = ratioOf(nextUp, nextDown);
  return [
    { id: 'uploaded', label: t('common.uploaded'), class: 'text-seed', current: formatSize(up), next: formatSize(nextUp) },
    { id: 'downloaded', label: t('common.downloaded'), class: 'text-leech', current: formatSize(down), next: formatSize(nextDown) },
    {
      id: 'ratio',
      label: t('common.ratio'),
      class: nextRatio < 1 && nextDown > 0 ? 'text-danger' : 'text-text-primary',
      current: formatRatio(ratioOf(up, down)),
      next: formatRatio(nextRatio),
    },
  ];
});

const saving = ref(false);
async function submit() {
  if (!canSubmit.value) return;
  saving.value = true;
  try {
    await $fetch(`/api/admin/users/${props.userId}/stats`, {
      method: 'POST',
      body: { uploadedDelta: deltas.value.uploaded, downloadedDelta: deltas.value.downloaded, reason: form.reason.trim() },
    });
    Object.assign(form, { uploaded: emptyField(), downloaded: emptyField(), reason: '' });
    notifications.success(t('admin.users.stats.applied', { name: props.username }));
    await refresh();
  } catch (error) {
    const message = (error as { data?: { message?: string } }).data?.message;
    notifications.error(t('admin.users.stats.failed'), message);
  } finally {
    saving.value = false;
  }
}
</script>
