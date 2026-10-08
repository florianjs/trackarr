<template>
  <table class="data-table">
    <thead>
      <tr>
        <th class="w-1/2">{{ t('common.name') }}</th>
        <th v-if="!compact">{{ t('common.category') }}</th>
        <th v-if="!compact">{{ t('torrents.table.hash') }}</th>
        <th class="text-center w-16">
          <div class="flex items-center justify-center gap-1" :title="t('common.seeders')">
            <Icon name="ph:arrow-up-bold" class="text-success" />
            <span>{{ t('torrents.table.seedersShort') }}</span>
          </div>
        </th>
        <th class="text-center w-16">
          <div class="flex items-center justify-center gap-1" :title="t('common.leechers')">
            <Icon name="ph:arrow-down-bold" class="text-warning" />
            <span>{{ t('torrents.table.leechersShort') }}</span>
          </div>
        </th>
        <th v-if="!compact" class="text-center w-16">
          <div class="flex items-center justify-center gap-1" :title="t('common.completed')">
            <Icon name="ph:check-bold" class="text-text-secondary" />
            <span>{{ t('torrents.table.completedShort') }}</span>
          </div>
        </th>
        <th v-if="!compact">{{ t('common.size') }}</th>
        <th class="text-right w-16">{{ t('torrents.table.age') }}</th>
        <th v-if="admin" class="w-12"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="torrents.length === 0">
        <td
          :colspan="(compact ? 4 : 8) + (admin ? 1 : 0)"
          class="text-center text-text-muted py-8"
        >
          {{ t('torrents.table.empty') }}
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
            {{ getCategoryDisplayName(torrent.category) }}
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
            :title="t('torrents.table.deleteTorrent')"
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
const { t } = useI18n();

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

const { data: categories } = await useFetch('/api/categories');

const props = defineProps<{
  torrents: TorrentWithStats[];
  compact?: boolean;
  admin?: boolean;
}>();

const emit = defineEmits<{
  deleted: [infoHash: string];
}>();

function getCategoryDisplayName(category) {
  let displayName = category.name;

  const parent = categories.value.find(
    (cat) => cat.id === category.parentId
  );

  if (parent) {
    displayName = `${parent.name}/${displayName}`;
  }

  return displayName;
}

async function deleteTorrent(torrent: TorrentWithStats) {
  if (!confirm(t('torrents.table.confirmDelete', { name: torrent.name }))) return;

  try {
    await fetch(`/api/torrents/${torrent.infoHash}`, { method: 'DELETE' });
    emit('deleted', torrent.infoHash);
  } catch (err) {
    console.error('Delete failed:', err);
    alert(t('torrents.table.deleteFailed'));
  }
}
</script>
