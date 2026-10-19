<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="ph:pulse-bold" class="text-text-muted" />
          <h3 class="text-sm font-medium text-text-primary">
            {{ t('admin.trackerHealth.title') }}
          </h3>
        </div>
        <span
          class="px-2 py-0.5 text-xs font-bold rounded"
          :class="status ? 'bg-success/20 text-success' : 'bg-error/20 text-error'"
        >
          {{ status ? t('admin.trackerHealth.running') : t('admin.trackerHealth.unreachable') }}
        </span>
      </div>
    </div>
    <div v-if="status" class="card-body space-y-4">
      <p v-if="!status.published" class="text-xs text-warning">
        {{ t('admin.trackerHealth.warmingUp') }}
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div v-for="item in figures" :key="item.label" class="p-3 rounded border border-border bg-bg-tertiary/50">
          <p class="text-xs text-text-muted">{{ item.label }}</p>
          <p class="text-lg font-mono text-text-primary">{{ item.value }}</p>
        </div>
      </div>
      <div>
        <p class="text-xs font-medium text-text-muted mb-2">
          {{ t('admin.trackerHealth.rejected') }}
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div v-for="item in rejections" :key="item.label" class="p-3 rounded border border-border bg-bg-tertiary/50">
            <p class="text-xs text-text-muted">{{ item.label }}</p>
            <p class="text-lg font-mono text-text-primary">{{ item.value }}</p>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="card-body">
      <p class="text-xs text-text-muted text-center py-4">
        {{ t('admin.trackerHealth.unreachableHint') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, n } = useI18n();

interface TrackerStatus {
  uptimeSeconds: number;
  announces: number;
  swarms: number;
  seeders: number;
  leechers: number;
  pendingAccounting: number;
  published: boolean;
  announcesPerSecond: number;
  rejected: {
    invalidPasskey: number;
    unknownTorrent: number;
    tooManyPeers: number;
    blockedClient: number;
  };
  blockedClients: number;
}

const { data, refresh } = await useFetch<{ data: TrackerStatus | null }>(
  '/api/admin/tracker/status'
);
const status = computed(() => data.value?.data ?? null);

// Live figures: refresh while the dashboard is open
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => refresh(), 30_000);
});
onBeforeUnmount(() => clearInterval(timer));

function uptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const figures = computed(() => {
  const s = status.value;
  if (!s) return [];
  return [
    { label: t('admin.trackerHealth.announcesPerSecond'), value: n(s.announcesPerSecond) },
    { label: t('admin.trackerHealth.swarms'), value: n(s.swarms) },
    { label: t('admin.trackerHealth.seeders'), value: n(s.seeders) },
    { label: t('admin.trackerHealth.leechers'), value: n(s.leechers) },
    { label: t('admin.trackerHealth.pendingAccounting'), value: n(s.pendingAccounting) },
    { label: t('admin.trackerHealth.blockedNow'), value: n(s.blockedClients) },
    { label: t('admin.trackerHealth.uptime'), value: uptime(s.uptimeSeconds) },
  ];
});

const rejections = computed(() => {
  const s = status.value;
  if (!s) return [];
  return [
    { label: t('admin.trackerHealth.invalidPasskey'), value: n(s.rejected.invalidPasskey) },
    { label: t('admin.trackerHealth.unknownTorrent'), value: n(s.rejected.unknownTorrent) },
    { label: t('admin.trackerHealth.tooManyPeers'), value: n(s.rejected.tooManyPeers) },
    { label: t('admin.trackerHealth.blockedClients'), value: n(s.rejected.blockedClient) },
  ];
});
</script>
