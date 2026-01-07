<template>
  <div class="space-y-4">
    <!-- Time Range Selector -->
    <div class="flex items-center gap-2">
      <span class="text-sm text-text-muted">View:</span>
      <div class="flex bg-bg-tertiary rounded-lg p-1 gap-1">
        <button
          v-for="range in timeRanges"
          :key="range.value"
          @click="selectedRange = range.value"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
          :class="
            selectedRange === range.value
              ? 'bg-white/10 text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          "
        >
          {{ range.label }}
        </button>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-bg-secondary p-4 rounded-lg border border-border">
        <h3
          class="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider"
        >
          Users & Torrents Growth
        </h3>
        <div class="h-64">
          <Line :data="growthData" :options="chartOptions" />
        </div>
      </div>
      <div class="bg-bg-secondary p-4 rounded-lg border border-border">
        <h3
          class="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider"
        >
          Peers & Seeders
        </h3>
        <div class="h-64">
          <Line :data="peersData" :options="chartOptions" />
        </div>
      </div>
      <div class="bg-bg-secondary p-4 rounded-lg border border-border">
        <h3
          class="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider"
        >
          Redis Memory Usage (MB)
        </h3>
        <div class="h-64">
          <Line :data="redisData" :options="chartOptions" />
        </div>
      </div>
      <div class="bg-bg-secondary p-4 rounded-lg border border-border">
        <h3
          class="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider"
        >
          Database Size (MB)
        </h3>
        <div class="h-64">
          <Line :data="dbData" :options="chartOptions" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const props = defineProps<{
  history: any[];
}>();

type TimeRange = 'hour' | 'day' | 'week' | 'month';

const timeRanges = [
  { value: 'hour' as TimeRange, label: 'Hour' },
  { value: 'day' as TimeRange, label: 'Day' },
  { value: 'week' as TimeRange, label: 'Week' },
  { value: 'month' as TimeRange, label: 'Month' },
];

const selectedRange = ref<TimeRange>('day');

// Filter history based on selected time range
const filteredHistory = computed(() => {
  const now = Date.now();
  const ranges: Record<TimeRange, number> = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };

  const cutoff = now - ranges[selectedRange.value];
  return props.history.filter((h) => new Date(h.createdAt).getTime() >= cutoff);
});

const formatDate = (date: string) => {
  const d = new Date(date);
  if (selectedRange.value === 'hour') {
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (selectedRange.value === 'day') {
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
  });
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(255, 255, 255, 0.05)',
      },
      ticks: {
        color: '#94a3b8',
        font: { size: 10 },
      },
    },
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: '#94a3b8',
        font: { size: 10 },
        maxTicksLimit: 8,
      },
    },
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        color: '#f8fafc',
        font: { size: 11 },
        usePointStyle: true,
      },
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    },
  },
};

const growthData = computed(() => ({
  labels: filteredHistory.value.map((h) => formatDate(h.createdAt)),
  datasets: [
    {
      label: 'Users',
      data: filteredHistory.value.map((h) => h.usersCount),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4,
    },
    {
      label: 'Torrents',
      data: filteredHistory.value.map((h) => h.torrentsCount),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.4,
    },
  ],
}));

const peersData = computed(() => ({
  labels: filteredHistory.value.map((h) => formatDate(h.createdAt)),
  datasets: [
    {
      label: 'Peers',
      data: filteredHistory.value.map((h) => h.peersCount),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      fill: true,
      tension: 0.4,
    },
    {
      label: 'Seeders',
      data: filteredHistory.value.map((h) => h.seedersCount),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      fill: true,
      tension: 0.4,
    },
  ],
}));

const redisData = computed(() => ({
  labels: filteredHistory.value.map((h) => formatDate(h.createdAt)),
  datasets: [
    {
      label: 'Redis Memory',
      data: filteredHistory.value.map((h) =>
        Number((h.redisMemoryUsage / 1024 / 1024).toFixed(2))
      ),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
      tension: 0.4,
    },
  ],
}));

const dbData = computed(() => ({
  labels: filteredHistory.value.map((h) => formatDate(h.createdAt)),
  datasets: [
    {
      label: 'DB Size',
      data: filteredHistory.value.map((h) =>
        Number((h.dbSize / 1024 / 1024).toFixed(2))
      ),
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6, 182, 212, 0.1)',
      fill: true,
      tension: 0.4,
    },
  ],
}));
</script>
