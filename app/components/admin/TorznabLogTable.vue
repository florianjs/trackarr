<template>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead v-if="!compact">
        <tr class="border-b border-border">
          <th
            class="text-left text-[10px] font-bold uppercase tracking-widest text-text-muted py-2 px-2"
          >
            {{ t('admin.torznabLogs.time') }}
          </th>
          <th
            class="text-left text-[10px] font-bold uppercase tracking-widest text-text-muted py-2 px-2"
          >
            {{ t('common.user') }}
          </th>
          <th
            class="text-left text-[10px] font-bold uppercase tracking-widest text-text-muted py-2 px-2"
          >
            {{ t('admin.torznabLogs.function') }}
          </th>
          <th
            class="text-left text-[10px] font-bold uppercase tracking-widest text-text-muted py-2 px-2"
          >
            {{ t('admin.torznabLogs.query') }}
          </th>
          <th
            class="text-center text-[10px] font-bold uppercase tracking-widest text-text-muted py-2 px-2"
          >
            {{ t('admin.torznabLogs.results') }}
          </th>
          <th
            class="text-right text-[10px] font-bold uppercase tracking-widest text-text-muted py-2 px-2"
          >
            {{ t('admin.torznabLogs.duration') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-if="loading"
          v-for="i in 5"
          :key="i"
          class="border-b border-border/50"
        >
          <td colspan="6" class="py-2 px-2">
            <div class="h-4 bg-bg-tertiary rounded animate-pulse"></div>
          </td>
        </tr>
        <tr
          v-else
          v-for="(log, index) in logs"
          :key="index"
          class="border-b border-border/50"
          :class="log.error && 'bg-red-500/5'"
        >
          <td class="py-2 px-2">
            <span class="text-xs text-text-muted font-mono">
              {{ formatTime(log.timestamp) }}
            </span>
          </td>
          <td class="py-2 px-2">
            <code
              class="text-[10px] font-mono text-text-muted bg-bg-tertiary px-1 py-0.5 rounded"
            >
              {{ log.passkey }}
            </code>
          </td>
          <td class="py-2 px-2">
            <span
              class="px-1.5 py-0.5 rounded text-[10px] font-medium"
              :class="getFunctionClass(log.function)"
            >
              {{ log.function }}
            </span>
          </td>
          <td class="py-2 px-2 max-w-[200px]">
            <span
              class="text-xs text-text-primary truncate block"
              :title="log.query"
            >
              {{ log.query || '—' }}
            </span>
          </td>
          <td class="py-2 px-2 text-center">
            <span
              v-if="log.error"
              class="text-xs text-red-400"
              :title="log.error"
            >
              {{ t('common.error') }}
            </span>
            <span v-else class="text-xs text-text-muted">
              {{ log.resultCount }}
            </span>
          </td>
          <td class="py-2 px-2 text-right">
            <span
              class="text-xs font-mono"
              :class="getResponseTimeClass(log.responseTime)"
            >
              {{ log.responseTime }}ms
            </span>
          </td>
        </tr>
        <tr v-if="!loading && (!logs || logs.length === 0)">
          <td colspan="6" class="py-8 text-center text-text-muted text-sm">
            {{ t('admin.torznabLogs.empty') }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n();

interface LogEntry {
  timestamp: number;
  passkey: string;
  function: string;
  query?: string;
  ip: string;
  userAgent?: string;
  responseTime: number;
  resultCount: number;
  error?: string;
}

defineProps<{
  logs?: LogEntry[];
  loading?: boolean;
  compact?: boolean;
}>();

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getFunctionClass(func: string): string {
  switch (func) {
    case 'search':
      return 'bg-blue-500/20 text-blue-400';
    case 'tvsearch':
      return 'bg-purple-500/20 text-purple-400';
    case 'movie':
      return 'bg-pink-500/20 text-pink-400';
    case 'caps':
      return 'bg-gray-500/20 text-gray-400';
    case 'download':
      return 'bg-green-500/20 text-green-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

function getResponseTimeClass(time: number): string {
  if (time < 100) return 'text-success';
  if (time < 500) return 'text-yellow-400';
  return 'text-red-400';
}
</script>
