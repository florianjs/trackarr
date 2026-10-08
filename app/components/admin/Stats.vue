<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <StatsCard
      :title="t('admin.stats.activeTorrents')"
      :value="stats?.live?.torrents ?? 0"
      icon="ph:package"
    />
    <StatsCard
      :title="t('admin.stats.totalPeers')"
      :value="stats?.cached?.peers ?? 0"
      icon="ph:users-three"
    />
    <StatsCard
      :title="t('common.seeders')"
      :value="stats?.cached?.seeders ?? 0"
      icon="ph:plant"
      variant="success"
    />
    <StatsCard
      :title="t('admin.stats.trackerStatus')"
      :value="stats?.status === 'running' ? t('admin.stats.operational') : t('admin.stats.offline')"
      :icon="stats?.status === 'running' ? 'ph:activity' : 'ph:warning-circle'"
      :variant="stats?.status === 'running' ? 'success' : 'error'"
    />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

defineProps<{
  stats: any;
}>();
</script>
