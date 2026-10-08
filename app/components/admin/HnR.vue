<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="ph:warning-bold" class="text-text-muted" />
          <h3
            class="text-sm font-medium text-text-primary"
          >
            {{ t('admin.hnr.title') }}
          </h3>
          <span
            v-if="hnrCount > 0"
            class="px-2 py-0.5 text-xs font-bold bg-error text-paper rounded-full"
          >
            {{ hnrCount }} HnR
          </span>
        </div>
        <div class="flex gap-2">
          <select v-model="statusFilter" class="input !py-1 text-xs">
            <option value="">{{ t('common.all') }}</option>
            <option value="hnr">{{ t('admin.hnr.hitAndRun') }}</option>
            <option value="pending">{{ t('admin.hnr.pending') }}</option>
            <option value="completed">{{ t('common.completed') }}</option>
          </select>
          <button
            @click="checkHnrs"
            :disabled="isChecking"
            class="btn btn-secondary !px-3 !py-1 text-xs"
            :title="t('admin.hnr.checkNew')"
          >
            <Icon
              :name="
                isChecking ? 'ph:circle-notch' : 'ph:arrows-clockwise-bold'
              "
              :class="{ 'animate-spin': isChecking }"
            />
          </button>
        </div>
      </div>
    </div>
    <div class="card-body">
      <div v-if="hnrData?.data && hnrData.data.length > 0" class="space-y-2">
        <div
          v-for="entry in hnrData.data"
          :key="entry.id"
          class="flex items-center justify-between p-3 rounded border border-border bg-bg-tertiary/50"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span
                class="px-2 py-0.5 text-xs font-bold rounded"
                :class="getStatusClass(entry)"
              >
                {{ getStatusLabel(entry) }}
              </span>
              <NuxtLink
                :to="`/users/${entry.user?.id}`"
                class="text-xs font-mono text-text-primary hover:text-accent transition-colors"
              >
                {{ entry.user?.username }}
              </NuxtLink>
            </div>
            <p class="text-xs text-text-muted truncate max-w-md">
              {{ entry.torrent?.name }}
            </p>
            <div
              class="flex items-center gap-4 mt-1 text-xs text-text-muted"
            >
              <span>
                {{ t('admin.hnr.seedTime') }}
                <span class="font-mono">{{
                  formatDuration(entry.seedTime)
                }}</span>
                / {{ formatDuration(entry.requiredSeedTime) }}
              </span>
              <span>
                {{
                  t('admin.hnr.downloadedAt', {
                    date: formatDate(entry.downloadedAt),
                  })
                }}
              </span>
            </div>
          </div>
          <div v-if="entry.isHnr && !entry.isExempt" class="flex gap-1">
            <button
              @click="handleAction(entry.id, 'clear')"
              class="p-1.5 rounded bg-success/10 text-success hover:bg-success/20 transition-colors"
              :title="t('admin.hnr.clear')"
            >
              <Icon name="ph:check-bold" class="w-4 h-4" />
            </button>
            <button
              @click="handleAction(entry.id, 'exempt')"
              class="p-1.5 rounded bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
              :title="t('admin.hnr.exempt')"
            >
              <Icon name="ph:shield-bold" class="w-4 h-4" />
            </button>
          </div>
          <span
            v-else-if="entry.isExempt"
            class="text-xs text-text-muted"
          >
            {{ t('admin.hnr.exempted') }}
          </span>
        </div>
      </div>
      <p v-else class="text-xs text-text-muted text-center py-4">
        {{ t('admin.hnr.empty') }}
      </p>

      <!-- Pagination -->
      <div
        v-if="hnrData?.pagination && hnrData.pagination.pages > 1"
        class="flex justify-center gap-2 mt-4"
      >
        <button
          @click="page--"
          :disabled="page <= 1"
          class="btn btn-secondary !px-3 !py-1 text-xs"
        >
          {{ t('common.previous') }}
        </button>
        <span class="text-xs text-text-muted self-center">
          {{ page }} / {{ hnrData.pagination.pages }}
        </span>
        <button
          @click="page++"
          :disabled="page >= hnrData.pagination.pages"
          class="btn btn-secondary !px-3 !py-1 text-xs"
        >
          {{ t('common.next') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n();

interface HnrEntry {
  id: string;
  userId: string;
  torrentId: string;
  downloadedAt: string;
  seedTime: number;
  requiredSeedTime: number;
  isHnr: boolean;
  isExempt: boolean;
  completedAt?: string;
  user?: { id: string; username: string };
  torrent?: { id: string; name: string };
}

interface HnrResponse {
  data: HnrEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const page = ref(1);
const statusFilter = ref('hnr');
const isChecking = ref(false);

const { data: hnrData, refresh } = await useFetch<HnrResponse>(
  '/api/admin/hnr',
  {
    query: computed(() => ({
      page: page.value,
      status: statusFilter.value || undefined,
    })),
  }
);

const hnrCount = computed(() => {
  if (statusFilter.value === 'hnr') {
    return hnrData.value?.pagination.total || 0;
  }
  return 0;
});

function getStatusClass(entry: HnrEntry) {
  if (entry.isExempt) return 'bg-text-muted/20 text-text-muted';
  if (entry.isHnr) return 'bg-error/20 text-error';
  if (entry.completedAt) return 'bg-success/20 text-success';
  return 'bg-warning/20 text-warning';
}

function getStatusLabel(entry: HnrEntry) {
  if (entry.isExempt) return t('admin.hnr.exempted');
  if (entry.isHnr) return 'HnR';
  if (entry.completedAt) return 'OK';
  return t('admin.hnr.pending');
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function checkHnrs() {
  isChecking.value = true;
  try {
    await $fetch('/api/admin/hnr?check=true');
    await refresh();
  } catch (error: any) {
    console.error('Failed to check HnRs:', error);
  } finally {
    isChecking.value = false;
  }
}

async function handleAction(id: string, action: 'clear' | 'exempt') {
  try {
    await $fetch(`/api/admin/hnr/${id}`, {
      method: 'PUT',
      body: { action },
    });
    await refresh();
  } catch (error: any) {
    console.error('Failed to update HnR:', error);
  }
}
</script>
