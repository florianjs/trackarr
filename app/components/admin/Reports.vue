<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="ph:flag-bold" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            Reports
          </h3>
          <span
            v-if="pendingCount > 0"
            class="px-2 py-0.5 text-[10px] font-bold bg-error text-white rounded-full"
          >
            {{ pendingCount }}
          </span>
        </div>
        <div class="flex gap-2">
          <select v-model="statusFilter" class="input !py-1 text-xs">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>
    </div>
    <div class="card-body">
      <div v-if="reports?.data && reports.data.length > 0" class="space-y-3">
        <div
          v-for="report in reports.data"
          :key="report.id"
          class="p-3 rounded border border-border bg-bg-tertiary/50"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span
                  class="px-2 py-0.5 text-[10px] font-bold uppercase rounded"
                  :class="getStatusClass(report.status)"
                >
                  {{ report.status }}
                </span>
                <span
                  class="px-2 py-0.5 text-[10px] font-mono bg-bg-primary rounded border border-border"
                >
                  {{ report.targetType }}
                </span>
              </div>
              <p class="text-xs font-bold text-text-primary mb-1">
                {{ report.reason }}
              </p>
              <p v-if="report.details" class="text-[10px] text-text-muted mb-2">
                {{ report.details }}
              </p>
              <div class="flex items-center gap-4 text-[10px] text-text-muted">
                <span>
                  By:
                  <span class="font-mono">{{ report.reporter?.username }}</span>
                </span>
                <span>
                  {{ formatDate(report.createdAt) }}
                </span>
              </div>
            </div>
            <div v-if="report.status === 'pending'" class="flex gap-1">
              <button
                @click="resolveReport(report.id, 'resolved')"
                class="p-1.5 rounded bg-success/10 text-success hover:bg-success/20 transition-colors"
                title="Resolve"
              >
                <Icon name="ph:check-bold" class="w-4 h-4" />
              </button>
              <button
                @click="resolveReport(report.id, 'dismissed')"
                class="p-1.5 rounded bg-text-muted/10 text-text-muted hover:bg-text-muted/20 transition-colors"
                title="Dismiss"
              >
                <Icon name="ph:x-bold" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="text-xs text-text-muted text-center py-4">
        No reports found
      </p>

      <!-- Pagination -->
      <div
        v-if="reports?.pagination && reports.pagination.pages > 1"
        class="flex justify-center gap-2 mt-4"
      >
        <button
          @click="page--"
          :disabled="page <= 1"
          class="btn btn-secondary !px-3 !py-1 text-[10px]"
        >
          Prev
        </button>
        <span class="text-xs text-text-muted self-center">
          {{ page }} / {{ reports.pagination.pages }}
        </span>
        <button
          @click="page++"
          :disabled="page >= reports.pagination.pages"
          class="btn btn-secondary !px-3 !py-1 text-[10px]"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Report {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
  status: string;
  createdAt: string;
  reporter?: { id: string; username: string };
}

interface ReportsResponse {
  data: Report[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const page = ref(1);
const statusFilter = ref('pending');

const { data: reports, refresh } = await useFetch<ReportsResponse>(
  '/api/admin/reports',
  {
    query: computed(() => ({
      page: page.value,
      status: statusFilter.value || undefined,
    })),
  }
);

const pendingCount = computed(() => {
  if (statusFilter.value === 'pending') {
    return reports.value?.pagination.total || 0;
  }
  return 0;
});

function getStatusClass(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-warning/20 text-warning';
    case 'resolved':
      return 'bg-success/20 text-success';
    case 'dismissed':
      return 'bg-text-muted/20 text-text-muted';
    default:
      return 'bg-bg-primary text-text-muted';
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function resolveReport(id: string, status: 'resolved' | 'dismissed') {
  try {
    await $fetch(`/api/admin/reports/${id}`, {
      method: 'PUT',
      body: { status },
    });
    await refresh();
  } catch (error: any) {
    console.error('Failed to resolve report:', error);
  }
}
</script>
