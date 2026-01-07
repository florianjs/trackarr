<template>
  <div class="space-y-6">
    <!-- Stats Grid -->
    <AdminStats :stats="stats" />

    <!-- Historical Charts -->
    <div v-if="history && history.length > 0">
      <ClientOnly>
        <AdminCharts :history="history" />
      </ClientOnly>
    </div>
    <div
      v-else
      class="bg-bg-secondary p-8 rounded-lg border border-border text-center"
    >
      <Icon
        name="ph:chart-line"
        class="w-12 h-12 text-text-muted mx-auto mb-4"
      />
      <h3 class="text-lg font-medium text-text-primary">
        No historical data yet
      </h3>
      <p class="text-sm text-text-muted mt-1">
        Stats collection has just started. Check back in an hour.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Protocol Status -->
      <AdminProtocols :protocols="stats?.protocols" />

      <!-- Tracker Info -->
      <AdminEndpoints />
    </div>
  </div>
</template>

<script setup lang="ts">
interface TrackerStats {
  status: string;
  cached: {
    torrents: number;
    peers: number;
    seeders: number;
    updatedAt: number;
  };
  live: {
    torrents: number;
    peers: number;
  };
  protocols: {
    http: boolean;
    udp: boolean;
    ws: boolean;
  };
}

const { data: stats } = await useFetch<TrackerStats>('/api/admin/stats');
const { data: history } = await useFetch<any[]>('/api/admin/stats/history');
</script>
