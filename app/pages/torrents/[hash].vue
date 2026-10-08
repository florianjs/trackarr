<template>
  <div v-if="torrent">
    <NuxtLink
      to="/torrents"
      class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-white mb-6 transition-colors"
    >
      <Icon name="ph:arrow-left-bold" />
      {{ t('torrents.detail.backToIndex') }}
    </NuxtLink>

    <!-- Torrent Header -->
    <div class="card mb-6 overflow-hidden">
      <div class="card-body !p-6">
        <div
          class="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span
                class="text-[10px] font-bold bg-bg-tertiary border border-border px-1.5 py-0.5 rounded-sm text-text-muted uppercase tracking-wider"
                >{{ t('torrents.detail.object') }}</span
              >
              <span class="text-[10px] font-mono text-text-muted">{{
                torrent.id
              }}</span>
            </div>
            <h2 class="text-2xl font-bold text-text-primary tracking-tight">
              {{ torrent.name }}
            </h2>
            <!-- Category Badge + external database links (#47) -->
            <div
              v-if="torrent.category || externalLinks.length"
              class="mt-2 flex flex-wrap items-center gap-2"
            >
              <span
                v-if="torrent.category"
                class="text-[10px] font-bold bg-bg-tertiary border border-border px-2 py-1 rounded-sm text-text-secondary uppercase tracking-wider"
              >
                {{ torrent.category.name }}
              </span>
              <a
                v-for="link in externalLinks"
                :key="link.label"
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[10px] font-bold border border-border px-2 py-1 rounded-sm text-text-secondary uppercase tracking-wider hover:text-white hover:border-white/30 transition-colors inline-flex items-center gap-1"
              >
                {{ link.label }}
                <Icon name="ph:arrow-square-out-bold" />
              </a>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Edit Button (owner/mod/admin only) -->
            <button
              v-if="canEdit"
              class="btn btn-secondary flex items-center gap-2 !py-2 text-xs font-bold uppercase tracking-wider"
              @click="showEditModal = true"
            >
              <Icon name="ph:pencil-simple-bold" />
              <span>{{ t('common.edit') }}</span>
            </button>
            <!-- Delete Button (owner/mod/admin only) -->
            <button
              v-if="canDelete"
              class="btn btn-secondary flex items-center gap-2 !py-2 text-xs font-bold uppercase tracking-wider text-error hover:bg-error/10"
              @click="confirmDelete"
            >
              <Icon name="ph:trash-bold" />
              <span>{{ t('common.delete') }}</span>
            </button>
            <button
              class="btn btn-secondary flex items-center gap-2 !py-2 text-xs font-bold uppercase tracking-wider"
              @click="copyHash"
            >
              <Icon name="ph:copy-bold" />
              <span>{{ t('torrents.detail.copyHash') }}</span>
            </button>
            <a
              :href="`/api/torrents/${torrent.infoHash}/download`"
              class="btn btn-primary flex items-center gap-2 !py-2 text-xs font-bold uppercase tracking-wider"
              download
            >
              <Icon name="ph:download-simple-bold" />
              <span>{{ t('torrents.detail.download') }}</span>
            </a>
          </div>
        </div>

        <div class="mt-6 pt-6 border-t border-border/50 flex flex-wrap gap-6">
          <div class="flex flex-col">
            <span
              class="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1"
              >{{ t('torrents.detail.infoHash') }}</span
            >
            <code
              class="text-xs font-mono text-text-secondary bg-bg-tertiary/50 px-2 py-1 rounded border border-border/50"
            >
              {{ torrent.infoHash }}
            </code>
          </div>
          <div class="flex flex-col">
            <span
              class="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1"
              >{{ t('torrents.detail.createdAt') }}</span
            >
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono text-text-secondary">{{
                formatDate(torrent.createdAt)
              }}</span>
              <span
                class="text-[10px] bg-bg-tertiary border border-border px-1.5 py-0.5 rounded-sm text-text-muted font-bold"
              >
                {{ formatAge(torrent.createdAt) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatsCard
        :title="t('common.seeders')"
        :value="torrent.stats.seeders"
        icon="ph:arrow-up-bold"
        variant="success"
      />
      <StatsCard
        :title="t('common.leechers')"
        :value="torrent.stats.leechers"
        icon="ph:arrow-down-bold"
        variant="warning"
      />
      <StatsCard
        :title="t('common.completed')"
        :value="torrent.stats.completed"
        icon="ph:check-circle-bold"
      />
      <StatsCard
        :title="t('torrents.detail.totalSize')"
        :value="formatSize(torrent.size)"
        icon="ph:database-bold"
      />
    </div>

    <!-- Description -->
    <div v-if="torrent.description" class="card mb-6">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:article-bold" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            {{ t('common.description') }}
          </h3>
        </div>
      </div>
      <div class="card-body !p-6">
        <ClientOnly>
          <div
            class="prose prose-invert prose-xs max-w-none description-content"
            v-html="renderedDescription"
          ></div>
        </ClientOnly>
      </div>
    </div>

    <!-- Peer List -->
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <Icon name="ph:users-bold" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            {{ t('torrents.detail.activeSwarm', { count: torrent.peers.length }) }}
          </h3>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('torrents.detail.endpoint') }}</th>
              <th>{{ t('torrents.detail.type') }}</th>
              <th>{{ t('common.uploaded') }}</th>
              <th>{{ t('common.downloaded') }}</th>
              <th class="text-right">{{ t('torrents.detail.lastSeen') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="torrent.peers.length === 0">
              <td
                colspan="5"
                class="text-center text-text-muted py-12 font-mono text-xs uppercase tracking-widest"
              >
                {{ t('torrents.detail.noPeers') }}
              </td>
            </tr>
            <tr v-for="peer in torrent.peers" :key="peer.id">
              <td class="font-mono text-xs">
                <span class="text-text-muted"
                  >{{ peer.id.slice(0, 12) }}...</span
                >
                <span class="text-text-muted">:{{ peer.port }}</span>
              </td>
              <td>
                <span
                  class="stat-badge"
                  :class="peer.isSeeder ? 'stat-seeders' : 'stat-leechers'"
                >
                  <Icon
                    :name="
                      peer.isSeeder ? 'ph:arrow-up-bold' : 'ph:arrow-down-bold'
                    "
                    class="text-[8px]"
                  />
                  {{ peer.isSeeder ? t('torrents.detail.seeder') : t('torrents.detail.leecher') }}
                </span>
              </td>
              <td class="text-text-secondary font-mono text-[10px]">
                {{ formatSize(peer.uploaded) }}
              </td>
              <td class="text-text-secondary font-mono text-[10px]">
                {{ formatSize(peer.downloaded) }}
              </td>
              <td class="text-text-muted font-mono text-[10px] text-right">
                {{ formatAge(peer.lastSeen) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Edit Modal -->
    <EditTorrentModal
      :is-open="showEditModal"
      :torrent="editableTorrent"
      @close="showEditModal = false"
      @saved="handleSaved"
    />

    <!-- Delete Confirmation Dialog -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="showDeleteConfirm = false"
      >
        <div
          class="bg-bg-secondary border border-border rounded shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        >
          <div
            class="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-tertiary/50"
          >
            <Icon name="ph:warning-circle-bold" class="text-error" />
            <h3
              class="text-xs font-bold uppercase tracking-widest text-text-primary"
            >
              {{ t('torrents.detail.confirmDeleteTitle') }}
            </h3>
          </div>
          <div class="p-6">
            <p class="text-sm text-text-secondary mb-4">
              {{ t('torrents.detail.confirmDeleteText') }}
            </p>
            <p
              class="text-xs font-mono text-text-muted bg-bg-tertiary p-2 rounded border border-border mb-6 truncate"
            >
              {{ torrent.name }}
            </p>
            <div v-if="deleteError" class="mb-4 text-xs text-error">
              {{ deleteError }}
            </div>
            <div class="flex gap-2">
              <button
                class="btn btn-secondary flex-1 text-[10px] font-bold uppercase tracking-widest"
                :disabled="isDeleting"
                @click="showDeleteConfirm = false"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                class="btn btn-primary flex-1 text-[10px] font-bold uppercase tracking-widest bg-error hover:bg-error/80 flex items-center justify-center gap-2"
                :disabled="isDeleting"
                @click="deleteTorrent"
              >
                <Icon
                  v-if="isDeleting"
                  name="ph:circle-notch"
                  class="animate-spin"
                />
                <span>{{ isDeleting ? t('common.deleting') : t('common.delete') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">

interface Peer {
  id: string;
  port: number;
  isSeeder: boolean;
  uploaded: number;
  downloaded: number;
  lastSeen: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  newznabId?: number | null;
}

interface TorrentDetail {
  id: string;
  infoHash: string;
  name: string;
  size: number;
  description: string | null;
  uploaderId: string | null;
  categoryId: string | null;
  category: Category | null;
  imdbId: string | null;
  tmdbId: number | null;
  tvdbId: number | null;
  createdAt: string;
  stats: {
    seeders: number;
    leechers: number;
    completed: number;
  };
  peers: Peer[];
}

const { t } = useI18n();
const route = useRoute();
const hash = route.params.hash as string;

const {
  data: torrent,
  error,
  refresh,
} = await useFetch<TorrentDetail>(`/api/torrents/${hash}`);

// Get current user session
const { loggedIn, user } = useUserSession();

// Edit/delete state
const showEditModal = ref(false);
const showDeleteConfirm = ref(false);
const isDeleting = ref(false);
const deleteError = ref<string | null>(null);

// Compute permissions
const canEdit = computed(() => {
  if (!loggedIn.value || !user.value) return false;
  const isOwner = torrent.value?.uploaderId === user.value.id;
  return isOwner || user.value.isAdmin || user.value.isModerator;
});

const canDelete = computed(() => {
  if (!loggedIn.value || !user.value) return false;
  const isOwner = torrent.value?.uploaderId === user.value.id;
  return isOwner || user.value.isAdmin || user.value.isModerator;
});

// Editable data for modal
const editableTorrent = computed(() => ({
  infoHash: torrent.value?.infoHash || '',
  name: torrent.value?.name || '',
  description: torrent.value?.description || null,
  categoryId: torrent.value?.categoryId || null,
  imdbId: torrent.value?.imdbId ?? null,
  tmdbId: torrent.value?.tmdbId ?? null,
  tvdbId: torrent.value?.tvdbId ?? null,
}));

const externalLinks = computed(() => {
  const tor = torrent.value;
  if (!tor) return [];
  const links: { label: string; href: string }[] = [];
  if (tor.imdbId) links.push({ label: 'IMDb', href: imdbUrl(tor.imdbId) });
  if (tor.tmdbId) {
    // Torznab TV categories are 5000-5999
    const newznabId = tor.category?.newznabId ?? 0;
    const kind = tor.tvdbId || (newznabId >= 5000 && newznabId < 6000) ? 'tv' : 'movie';
    links.push({ label: 'TMDb', href: tmdbUrl(tor.tmdbId, kind) });
  }
  if (tor.tvdbId) links.push({ label: 'TheTVDB', href: tvdbUrl(tor.tvdbId) });
  return links;
});

const renderedDescription = computed(() => {
  return renderMarkdown(torrent.value?.description);
});

if (error.value || !torrent.value) {
  throw createError({ statusCode: 404, message: t('torrents.detail.notFound') });
}

async function copyHash() {
  await navigator.clipboard.writeText(torrent.value!.infoHash);
}

function confirmDelete() {
  deleteError.value = null;
  showDeleteConfirm.value = true;
}

async function deleteTorrent() {
  isDeleting.value = true;
  deleteError.value = null;

  try {
    await $fetch(`/api/torrents/${torrent.value!.infoHash}`, {
      method: 'DELETE',
    });
    // Navigate back to torrents list
    navigateTo('/torrents');
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string }; message?: string };
    deleteError.value =
      fetchError.data?.message ||
      fetchError.message ||
      t('torrents.detail.deleteFailed');
  } finally {
    isDeleting.value = false;
  }
}

async function handleSaved() {
  // Refresh torrent data
  await refresh();
}
</script>

<style scoped>
.description-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.description-content :deep(p) {
  margin-bottom: 1rem;
}

.description-content :deep(p:last-child) {
  margin-bottom: 0;
}

.description-content :deep(a) {
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.description-content :deep(ul),
.description-content :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.description-content :deep(li) {
  margin-bottom: 0.25rem;
}
</style>
