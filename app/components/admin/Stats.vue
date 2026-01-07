<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <StatsCard
      title="Active Torrents"
      :value="stats?.live?.torrents ?? 0"
      icon="ph:package"
    />
    <StatsCard
      title="Total Peers"
      :value="stats?.cached?.peers ?? 0"
      icon="ph:users-three"
    />
    <StatsCard
      title="Seeders"
      :value="stats?.cached?.seeders ?? 0"
      icon="ph:plant"
      variant="success"
    />
    <StatsCard
      title="Tracker Status"
      :value="stats?.status === 'running' ? 'Operational' : 'Offline'"
      :icon="stats?.status === 'running' ? 'ph:activity' : 'ph:warning-circle'"
      :variant="stats?.status === 'running' ? 'success' : 'error'"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  stats: any;
}>();
</script>
