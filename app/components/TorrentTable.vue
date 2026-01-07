<template>
  <table class="data-table">
    <thead>
      <tr>
        <th class="w-1/2">Name</th>
        <th v-if="!compact">Category</th>
        <th v-if="!compact">Hash</th>
        <th class="text-center w-16">
          <div class="flex items-center justify-center gap-1" title="Seeders">
            <Icon name="ph:arrow-up-bold" class="text-success" />
            <span>S</span>
          </div>
        </th>
        <th class="text-center w-16">
          <div class="flex items-center justify-center gap-1" title="Leechers">
            <Icon name="ph:arrow-down-bold" class="text-warning" />
            <span>L</span>
          </div>
        </th>
        <th v-if="!compact" class="text-center w-16">
          <div class="flex items-center justify-center gap-1" title="Completed">
            <Icon name="ph:check-bold" class="text-text-secondary" />
            <span>C</span>
          </div>
        </th>
        <th v-if="!compact">Size</th>
        <th class="text-right w-16">Age</th>
        <th v-if="admin" class="w-12"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="torrents.length === 0">
        <td
          :colspan="(compact ? 4 : 8) + (admin ? 1 : 0)"
          class="text-center text-text-muted py-8"
        >
          No torrents found
        </td>
      </tr>
      <tr
        v-for="torrent in torrents"
        :key="torrent.id"
        class="cursor-pointer"
        @click="navigateTo(`/torrents/${torrent.infoHash}`)"
      >
        <td>
          <div class="flex items-center gap-2">
            <Icon
              name="ph:file-zip"
              class="text-text-muted text-base shrink-0"
            />
            <span
              class="text-text-primary hover:text-white transition-colors font-medium truncate max-w-[300px] lg:max-w-[500px]"
              >{{ torrent.name }}</span
            >
          </div>
        </td>
        <td v-if="!compact">
          <span
            v-if="torrent.category"
            class="text-[10px] bg-bg-tertiary border border-border px-1.5 py-0.5 rounded-sm text-text-secondary uppercase font-bold tracking-wider"
          >
            {{ torrent.category.name }}
          </span>
          <span v-else class="text-xs text-text-muted">—</span>
        </td>
        <td v-if="!compact">
          <code
            class="truncate-hash text-text-muted bg-bg-tertiary/50 px-1 rounded"
            :title="torrent.infoHash"
          >
            {{ torrent.infoHash.slice(0, 8) }}...{{
              torrent.infoHash.slice(-4)
            }}
          </code>
        </td>
        <td class="text-center">
          <span class="stat-badge stat-seeders">
            <Icon name="ph:arrow-up-bold" class="text-[8px]" />
            {{ torrent.stats.seeders }}
          </span>
        </td>
        <td class="text-center">
          <span class="stat-badge stat-leechers">
            <Icon name="ph:arrow-down-bold" class="text-[8px]" />
            {{ torrent.stats.leechers }}
          </span>
        </td>
        <td v-if="!compact" class="text-center text-text-secondary font-mono">
          {{ torrent.stats.completed }}
        </td>
        <td v-if="!compact" class="text-text-secondary font-mono text-[10px]">
          {{ formatSize(torrent.size) }}
        </td>
        <td class="text-right text-text-muted text-[10px] font-mono">
          {{ formatAge(torrent.createdAt) }}
        </td>
        <td v-if="admin" class="text-center">
          <button
            class="text-text-muted hover:text-error transition-colors p-1.5 rounded hover:bg-error/10"
            title="Delete torrent"
            @click.stop="deleteTorrent(torrent)"
          >
            <Icon name="ph:trash" class="text-base" />
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
interface TorrentWithStats {
  id: string;
  infoHash: string;
  name: string;
  size: number;
  createdAt: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  stats: {
    seeders: number;
    leechers: number;
    completed: number;
  };
}

const props = defineProps<{
  torrents: TorrentWithStats[];
  compact?: boolean;
  admin?: boolean;
}>();

const emit = defineEmits<{
  deleted: [infoHash: string];
}>();

async function deleteTorrent(torrent: TorrentWithStats) {
  if (!confirm(`Delete "${torrent.name}"?`)) return;

  try {
    await fetch(`/api/torrents/${torrent.infoHash}`, { method: 'DELETE' });
    emit('deleted', torrent.infoHash);
  } catch (err) {
    console.error('Delete failed:', err);
    alert('Failed to delete torrent');
  }
}
</script>
