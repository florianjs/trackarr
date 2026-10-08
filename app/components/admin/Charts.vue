<template>
  <div class="space-y-4">
    <!-- Time Range Selector -->
    <div class="flex items-center gap-2">
      <span class="text-sm text-text-muted">{{ t('admin.charts.view') }}</span>
      <div class="flex bg-bg-tertiary rounded-lg p-1 gap-1">
        <button
          v-for="range in timeRanges"
          :key="range.value"
          @click="selectedRange = range.value"
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
          :class="selectedRange === range.value
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
          class="text-sm font-bold text-text-primary mb-4"
        >
          {{ t('admin.charts.growth') }}
        </h3>
        <div class="h-64">
          <Line :data="growthData" :options="chartOptions" />
        </div>
      </div>
      <div class="bg-bg-secondary p-4 rounded-lg border border-border">
        <h3
          class="text-sm font-bold text-text-primary mb-4"
        >
          {{ t('admin.charts.peersSeeders') }}
        </h3>
        <div class="h-64">
          <Line :data="peersData" :options="chartOptions" />
        </div>
      </div>
      <div class="bg-bg-secondary p-4 rounded-lg border border-border">
        <h3
          class="text-sm font-bold text-text-primary mb-4"
        >
          {{ t('admin.charts.redisMemoryUsage') }}
        </h3>
        <div class="h-64">
          <Line :data="redisData" :options="chartOptions" />
        </div>
      </div>
      <div class="bg-bg-secondary p-4 rounded-lg border border-border">
        <h3
          class="text-sm font-bold text-text-primary mb-4"
        >
          {{ t('admin.charts.databaseSize') }}
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

const { t } = useI18n();
const { preference } = useTheme();

// Chart.js draws on canvas, so it needs concrete colors: read the theme tokens
const tokens = ref<Record<string, string>>({});
function readTokens() {
  const style = getComputedStyle(document.documentElement);
  tokens.value = Object.fromEntries(
    ['ink', 'ink-2', 'ink-3', 'line', 'seed', 'leech'].map((name) => [
      name,
      style.getPropertyValue(`--${name}`).trim(),
    ])
  );
}
function color(name: string, alpha = 1): string {
  const channels = tokens.value[name];
  return channels ? `rgb(${channels} / ${alpha})` : 'transparent';
}
let media: MediaQueryList | undefined;
onMounted(() => {
  readTokens();
  media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', readTokens);
});
onBeforeUnmount(() => media?.removeEventListener('change', readTokens));
watch(preference, () => nextTick(readTokens));

const props = defineProps<{
  history: any[];
}>();

type TimeRange = 'hour' | 'day' | 'week' | 'month';

const timeRanges = computed(() => [
  { value: 'hour' as TimeRange, label: t('admin.charts.hour') },
  { value: 'day' as TimeRange, label: t('admin.charts.day') },
  { value: 'week' as TimeRange, label: t('admin.charts.week') },
  { value: 'month' as TimeRange, label: t('admin.charts.month') },
]);

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

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: color('line', 0.6),
      },
      ticks: {
        color: color('ink-3'),
        font: { size: 10 },
      },
    },
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: color('ink-3'),
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
        color: color('ink-2'),
        font: { size: 11 },
        usePointStyle: true,
      },
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    },
  },
}));

const growthData = computed(() => ({
  labels: filteredHistory.value.map((h) => formatDate(h.createdAt)),
  datasets: [
    {
      label: t('admin.charts.users'),
      data: filteredHistory.value.map((h) => h.usersCount),
      borderColor: color('ink'),
      backgroundColor: color('ink', 0.05),
      fill: true,
      tension: 0.4,
    },
    {
      label: t('admin.charts.torrents'),
      data: filteredHistory.value.map((h) => h.torrentsCount),
      borderColor: color('ink-3'),
      backgroundColor: color('ink-3', 0.05),
      fill: true,
      tension: 0.4,
    },
  ],
}));

const peersData = computed(() => ({
  labels: filteredHistory.value.map((h) => formatDate(h.createdAt)),
  datasets: [
    {
      label: t('admin.charts.peers'),
      data: filteredHistory.value.map((h) => h.peersCount),
      borderColor: color('leech'),
      backgroundColor: color('leech', 0.05),
      fill: true,
      tension: 0.4,
    },
    {
      label: t('common.seeders'),
      data: filteredHistory.value.map((h) => h.seedersCount),
      borderColor: color('seed'),
      backgroundColor: color('seed', 0.05),
      fill: true,
      tension: 0.4,
    },
  ],
}));

const redisData = computed(() => ({
  labels: filteredHistory.value.map((h) => formatDate(h.createdAt)),
  datasets: [
    {
      label: t('admin.charts.redisMemory'),
      data: filteredHistory.value.map((h) =>
        Number((h.redisMemoryUsage / 1024 / 1024).toFixed(2))
      ),
      borderColor: color('ink'),
      backgroundColor: color('ink', 0.05),
      fill: true,
      tension: 0.4,
    },
  ],
}));

const dbData = computed(() => ({
  labels: filteredHistory.value.map((h) => formatDate(h.createdAt)),
  datasets: [
    {
      label: t('admin.charts.dbSize'),
      data: filteredHistory.value.map((h) =>
        Number((h.dbSize / 1024 / 1024).toFixed(2))
      ),
      borderColor: color('ink'),
      backgroundColor: color('ink', 0.05),
      fill: true,
      tension: 0.4,
    },
  ],
}));
</script>
