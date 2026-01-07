<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="ph:clock-bold" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            Pending Torrents
          </h3>
        </div>
        <button
          @click="loadPending"
          class="btn btn-ghost !p-2"
          :disabled="isLoading"
        >
          <Icon
            name="ph:arrows-clockwise-bold"
            :class="{ 'animate-spin': isLoading }"
          />
        </button>
      </div>
    </div>
    <div class="card-body">
      <div v-if="pending.length > 0" class="space-y-3">
        <div
          v-for="torrent in pending"
          :key="torrent.id"
          class="p-4 bg-bg-tertiary/50 rounded border border-border"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <NuxtLink
                :to="`/torrents/${torrent.infoHash}`"
                class="text-sm font-bold text-text-primary hover:text-accent-primary transition-colors block truncate"
              >
                {{ torrent.name }}
              </NuxtLink>
              <div
                class="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-text-muted"
              >
                <span class="flex items-center gap-1">
                  <Icon name="ph:user-bold" />
                  {{ torrent.uploader?.username || 'Unknown' }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon name="ph:folder-bold" />
                  {{ torrent.category?.name || 'Uncategorized' }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon name="ph:hard-drives-bold" />
                  {{ formatSize(torrent.size) }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon name="ph:calendar-bold" />
                  {{ formatDate(torrent.createdAt) }}
                </span>
              </div>
              <p
                v-if="torrent.description"
                class="text-xs text-text-muted mt-2 line-clamp-2"
              >
                {{ torrent.description }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                @click="approve(torrent)"
                :disabled="processingId === torrent.id"
                class="btn btn-primary !px-3 !py-1.5 flex items-center gap-1 text-xs uppercase tracking-wider font-bold"
              >
                <Icon
                  v-if="processingId === torrent.id"
                  name="ph:circle-notch"
                  class="animate-spin"
                />
                <Icon v-else name="ph:check-bold" />
                <span>Approve</span>
              </button>
              <button
                @click="reject(torrent)"
                :disabled="processingId === torrent.id"
                class="btn !px-3 !py-1.5 flex items-center gap-1 text-xs uppercase tracking-wider font-bold bg-error/10 text-error hover:bg-error/20 border border-error/30"
              >
                <Icon name="ph:x-bold" />
                <span>Reject</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        v-else-if="!isLoading"
        class="text-center py-12 border border-dashed border-border rounded bg-bg-primary/30"
      >
        <Icon
          name="ph:check-circle-bold"
          class="w-12 h-12 text-success/50 mx-auto mb-3"
        />
        <p
          class="text-xs font-bold text-text-muted uppercase tracking-widest"
        >
          No pending torrents
        </p>
        <p class="text-[10px] text-text-muted/70 mt-1">
          All torrents have been moderated
        </p>
      </div>
      <div v-if="isLoading" class="flex justify-center py-12">
        <Icon
          name="ph:circle-notch"
          class="animate-spin text-text-muted w-6 h-6"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface PendingTorrent {
  id: string;
  infoHash: string;
  name: string;
  size: number;
  description?: string;
  createdAt: string;
  uploader?: {
    id: string;
    username: string;
  };
  category?: {
    id: string;
    name: string;
  };
}

const pending = ref<PendingTorrent[]>([]);
const isLoading = ref(true);
const processingId = ref<string | null>(null);

async function loadPending() {
  isLoading.value = true;
  try {
    pending.value = (await $fetch('/api/mod/torrents/pending')) as PendingTorrent[];
  } catch (error: any) {
    console.error('Failed to load pending torrents:', error);
  } finally {
    isLoading.value = false;
  }
}

async function approve(torrent: PendingTorrent) {
  processingId.value = torrent.id;
  try {
    await $fetch(`/api/mod/torrents/${torrent.infoHash}/approve`, {
      method: 'POST',
    });
    pending.value = pending.value.filter((t) => t.id !== torrent.id);
  } catch (error: any) {
    alert(error.data?.message || 'Failed to approve torrent');
  } finally {
    processingId.value = null;
  }
}

async function reject(torrent: PendingTorrent) {
  const reason = prompt('Reason for rejection (optional):');
  if (reason === null) return; // User cancelled

  processingId.value = torrent.id;
  try {
    await $fetch(`/api/mod/torrents/${torrent.infoHash}/reject`, {
      method: 'POST',
      body: { reason },
    });
    pending.value = pending.value.filter((t) => t.id !== torrent.id);
  } catch (error: any) {
    alert(error.data?.message || 'Failed to reject torrent');
  } finally {
    processingId.value = null;
  }
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(() => {
  loadPending();
});
</script>
