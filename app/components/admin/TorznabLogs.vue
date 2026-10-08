<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="ph:list" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            {{ t('admin.torznabLogs.title') }}
          </h3>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-text-muted">
            {{ t('admin.torznabLogs.totalRequests', data?.total || 0) }}
          </span>
          <button
            @click="() => refresh()"
            :disabled="loading"
            class="p-1.5 bg-bg-tertiary border border-border rounded hover:border-white/20 transition-colors"
            :title="t('common.refresh')"
          >
            <Icon
              name="ph:arrows-clockwise"
              :class="['text-text-muted text-sm', loading && 'animate-spin']"
            />
          </button>
        </div>
      </div>
    </div>
    <div class="card-body">
      <AdminTorznabLogTable :logs="data?.logs" :loading="loading" />

      <!-- Pagination -->
      <div
        v-if="data?.total && data.total > limit"
        class="flex items-center justify-between mt-4 pt-4 border-t border-border"
      >
        <span class="text-xs text-text-muted">
          {{
            t('admin.torznabLogs.showing', {
              from: offset + 1,
              to: Math.min(offset + limit, data.total),
              total: data.total,
            })
          }}
        </span>
        <div class="flex items-center gap-2">
          <button
            @click="prevPage"
            :disabled="offset === 0"
            class="px-3 py-1 bg-bg-tertiary border border-border rounded text-xs disabled:opacity-50 hover:border-white/20 transition-colors"
          >
            {{ t('common.previous') }}
          </button>
          <button
            @click="nextPage"
            :disabled="offset + limit >= data.total"
            class="px-3 py-1 bg-bg-tertiary border border-border rounded text-xs disabled:opacity-50 hover:border-white/20 transition-colors"
          >
            {{ t('common.next') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

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

const limit = 50;
const offset = ref(0);

const {
  data,
  pending: loading,
  refresh,
} = await useFetch<{
  logs: LogEntry[];
  total: number;
}>('/api/admin/torznab/logs', {
  query: computed(() => ({ limit, offset: offset.value })),
});

function prevPage() {
  offset.value = Math.max(0, offset.value - limit);
}

function nextPage() {
  offset.value += limit;
}
</script>
