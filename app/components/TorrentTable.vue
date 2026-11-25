<template>
  <table class="data-table">
    <thead>
      <tr>
        <th v-if="selectable" class="w-8">
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate="someSelected && !allSelected"
            :aria-label="t('torrents.table.selectAll')"
            @change="emit('update:selected', toggleAll(selected ?? [], visibleHashes))"
          />
        </th>
        <th>{{ t('common.name') }}</th>
        <th class="text-right hidden sm:table-cell">{{ t('common.size') }}</th>
        <th class="text-right" :title="t('common.seeders')">
          <span class="text-seed" aria-hidden="true">↑</span><span class="sr-only">{{ t('common.seeders') }}</span>
        </th>
        <th class="text-right" :title="t('common.leechers')">
          <span class="text-leech" aria-hidden="true">↓</span><span class="sr-only">{{ t('common.leechers') }}</span>
        </th>
        <th class="text-right hidden md:table-cell" :title="t('common.completed')">
          <Icon name="ph:check" class="inline-block align-[-2px]" aria-hidden="true" /><span class="sr-only">{{ t('common.completed') }}</span>
        </th>
        <th class="text-right hidden md:table-cell">{{ t('torrents.table.age') }}</th>
        <th v-if="canDelete" class="w-10"><span class="sr-only">{{ t('common.delete') }}</span></th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="torrent in torrents"
        :key="torrent.id"
        class="group"
        :class="selected?.includes(torrent.infoHash) ? '[&>td]:bg-bg-hover/60' : ''"
      >
        <td v-if="selectable">
          <input
            type="checkbox"
            :checked="selected?.includes(torrent.infoHash)"
            :aria-label="t('torrents.table.select', { name: torrent.name })"
            @change="emit('update:selected', toggleSelection(selected ?? [], torrent.infoHash))"
          />
        </td>
        <td class="max-w-0 w-full">
          <div class="flex items-center gap-2 min-w-0">
            <NuxtLink
              :to="`/torrents/${torrent.infoHash}`"
              class="truncate text-text-primary hover:underline underline-offset-2"
            >{{ torrent.name }}</NuxtLink>
            <span
              v-if="torrent.isApproved === false"
              class="shrink-0 text-2xs px-1.5 rounded bg-leech/15 text-leech"
            >{{ t('torrents.table.pending') }}</span>
          </div>
          <p class="text-xs text-text-muted truncate">
            <span v-if="torrent.category">{{ categoryPath(torrent.category) }}</span>
            <span v-if="torrent.category && torrent.tags?.length">, </span>
            <span v-if="torrent.tags?.length">{{ torrent.tags.map((tag) => tag.name).join(', ') }}</span>
          </p>
        </td>
        <td class="num text-right text-text-secondary whitespace-nowrap hidden sm:table-cell">{{ formatSize(torrent.size) }}</td>
        <td class="num text-right" :class="torrent.stats.seeders > 0 ? 'text-seed' : 'text-text-muted'">{{ torrent.stats.seeders }}</td>
        <td class="num text-right" :class="torrent.stats.leechers > 0 ? 'text-leech' : 'text-text-muted'">{{ torrent.stats.leechers }}</td>
        <td class="num text-right text-text-secondary hidden md:table-cell">{{ torrent.stats.completed }}</td>
        <td class="num text-right text-text-muted whitespace-nowrap hidden md:table-cell">{{ formatAge(torrent.createdAt) }}</td>
        <td v-if="canDelete" class="text-right whitespace-nowrap">
          <button
            v-if="torrent.isApproved === false"
            type="button"
            class="p-1 rounded text-text-muted hover:text-seed hover:bg-seed/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            :title="t('common.approve')"
            :aria-label="t('common.approve')"
            @click="approveTorrent(torrent)"
          >
            <Icon name="ph:check" class="block" />
          </button>
          <button
            type="button"
            class="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            :title="t('torrents.table.deleteTorrent')"
            :aria-label="t('torrents.table.deleteTorrent')"
            @click="deleteTorrent(torrent)"
          >
            <Icon name="ph:trash" class="block" />
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { toggleAll, toggleSelection } from '~~/shared/utils/bulk';

interface CategoryRef {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface TorrentRow {
  id: string;
  infoHash: string;
  name: string;
  size: number;
  createdAt: string;
  isApproved?: boolean;
  category?: CategoryRef | null;
  tags?: { id: string; name: string }[];
  stats: { seeders: number; leechers: number; completed: number };
}

const props = defineProps<{
  torrents: TorrentRow[];
  categories?: { id: string; name: string }[];
  canDelete?: boolean;
  /** Staff: checkbox column for bulk actions (v-model:selected, info hashes) */
  selectable?: boolean;
  selected?: string[];
}>();

const emit = defineEmits<{
  deleted: [infoHash: string];
  approved: [infoHash: string];
  'update:selected': [selected: string[]];
}>();

const visibleHashes = computed(() => props.torrents.map((t) => t.infoHash));
const someSelected = computed(() => visibleHashes.value.some((h) => props.selected?.includes(h)));
const allSelected = computed(
  () => visibleHashes.value.length > 0 && visibleHashes.value.every((h) => props.selected?.includes(h))
);

async function approveTorrent(torrent: TorrentRow) {
  try {
    await $fetch(`/api/mod/torrents/${torrent.infoHash}/approve`, { method: 'POST' });
    emit('approved', torrent.infoHash);
  } catch {
    alert(t('torrents.table.approveFailed'));
  }
}
const { t } = useI18n();

/** "Movies / UHD" when the category has a parent */
function categoryPath(category: CategoryRef): string {
  const parent = category.parentId
    ? props.categories?.find((c) => c.id === category.parentId)
    : undefined;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

async function deleteTorrent(torrent: TorrentRow) {
  if (!confirm(t('torrents.table.confirmDelete', { name: torrent.name }))) return;
  try {
    await $fetch(`/api/torrents/${torrent.infoHash}`, { method: 'DELETE' });
    emit('deleted', torrent.infoHash);
  } catch {
    alert(t('torrents.table.deleteFailed'));
  }
}
</script>
