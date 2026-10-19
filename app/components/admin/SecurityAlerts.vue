<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="ph:shield-warning-bold" class="text-text-muted" />
          <h3 class="text-sm font-medium text-text-primary">
            {{ t('admin.securityAlerts.title') }}
          </h3>
          <span
            v-if="alerts.length > 0"
            class="px-2 py-0.5 text-xs font-bold bg-error text-paper rounded-full"
          >
            {{ alerts.length }}
          </span>
        </div>
        <button
          v-if="alerts.length > 0"
          class="btn btn-secondary !px-3 !py-1 text-xs"
          @click="clearAlerts"
        >
          {{ t('admin.securityAlerts.clear') }}
        </button>
      </div>
      <p class="text-xs text-text-muted mt-1">
        {{ t('admin.securityAlerts.hint') }}
      </p>
    </div>
    <div class="card-body">
      <div v-if="alerts.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="(alert, index) in alerts"
          :key="`${alert.timestamp}-${index}`"
          class="p-3 rounded border border-border bg-bg-tertiary/50"
        >
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span
              class="px-2 py-0.5 text-xs font-bold rounded"
              :class="severityClass(alert.severity)"
            >
              {{ t(`admin.securityAlerts.severity.${alert.severity}`) }}
            </span>
            <span class="text-sm font-medium text-text-primary">
              {{ alert.title }}
            </span>
          </div>
          <p class="text-xs text-text-muted mb-1 break-words">
            {{ alert.description }}
          </p>
          <div class="flex items-center gap-4 text-xs text-text-muted flex-wrap">
            <span>{{ formatDate(alert.timestamp) }}</span>
            <span v-if="alert.ip" class="font-mono">{{ alert.ip }}</span>
            <span v-if="alert.endpoint" class="font-mono truncate max-w-full">
              {{ alert.endpoint }}
            </span>
            <span v-if="alert.details?.username" class="font-mono">
              {{ alert.details.username }}
            </span>
          </div>
        </div>
      </div>
      <p v-else class="text-xs text-text-muted text-center py-4">
        {{ t('admin.securityAlerts.empty') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n();

interface SecurityAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  ip?: string;
  endpoint?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

const { data, refresh } = await useFetch<{ data: SecurityAlert[] }>(
  '/api/admin/security/alerts'
);
const alerts = computed(() => data.value?.data ?? []);

function severityClass(severity: SecurityAlert['severity']) {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'bg-error/20 text-error';
    case 'medium':
      return 'bg-warning/20 text-warning';
    default:
      return 'bg-text-muted/20 text-text-muted';
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function clearAlerts() {
  await $fetch('/api/admin/security/alerts', { method: 'DELETE' });
  await refresh();
}
</script>
