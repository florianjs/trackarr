<template>
  <div v-if="torrent" class="space-y-6">
    <NuxtLink to="/torrents" class="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
      <Icon name="ph:arrow-left" aria-hidden="true" />{{ t('torrents.detail.backToIndex') }}
    </NuxtLink>

    <!-- Header -->
    <header class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-xl sm:text-2xl font-semibold tracking-tight break-words">{{ torrent.name }}</h1>
        <p class="mt-1.5 text-sm text-text-muted">
          <span v-if="torrent.category">{{ torrent.category.name }}</span>
          <span v-if="torrent.category"> · </span>
          <span class="num">{{ formatSize(torrent.size) }}</span>
          <span> · </span>
          <span :title="formatDate(torrent.createdAt)">{{ formatAge(torrent.createdAt) }}</span>
          <template v-if="torrent.uploader">
            <span> · </span>
            <i18n-t keypath="torrents.detail.uploadedBy" tag="span" scope="global">
              <template #user>
                <NuxtLink :to="`/users/${torrent.uploader.id}`" class="text-text-secondary hover:underline underline-offset-2">{{ torrent.uploader.username }}</NuxtLink>
              </template>
            </i18n-t>
          </template>
        </p>
        <div v-if="torrent.tags.length || externalLinks.length" class="mt-3 flex flex-wrap items-center gap-1.5">
          <span v-for="tag in torrent.tags" :key="tag.id" class="text-xs px-2 py-0.5 rounded-full bg-bg-tertiary border border-border text-text-secondary">
            {{ tag.name }}
          </span>
          <a
            v-for="link in externalLinks"
            :key="link.label"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs px-2 py-0.5 rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-border-hover inline-flex items-center gap-1"
          >{{ link.label }}<Icon name="ph:arrow-square-out" aria-hidden="true" /></a>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <a :href="`/api/torrents/${torrent.infoHash}/download`" class="btn btn-primary" download>
          <Icon name="ph:download-simple" aria-hidden="true" />{{ t('torrents.detail.download') }}
        </a>
        <button v-if="canEdit" type="button" class="btn btn-secondary" @click="showEditModal = true">
          <Icon name="ph:pencil-simple" aria-hidden="true" />{{ t('common.edit') }}
        </button>
        <button type="button" class="btn btn-ghost !px-2" :title="t('torrents.detail.report')" :aria-label="t('torrents.detail.report')" @click="showReport = true">
          <Icon name="ph:flag" class="block" />
        </button>
        <button
          v-if="canEdit"
          type="button"
          class="btn btn-ghost !px-2 hover:!text-danger"
          :title="t('common.delete')"
          :aria-label="t('common.delete')"
          @click="confirmDelete"
        >
          <Icon name="ph:trash" class="block" />
        </button>
      </div>
    </header>

    <!-- Swarm -->
    <section class="card grid grid-cols-3 divide-x divide-border" :aria-label="t('torrents.detail.swarm')">
      <div class="p-4">
        <p class="text-xs text-text-muted">{{ t('common.seeders') }}</p>
        <p class="num text-2xl font-medium mt-1" :class="torrent.stats.seeders ? 'text-seed' : 'text-text-muted'">{{ torrent.stats.seeders }}</p>
      </div>
      <div class="p-4">
        <p class="text-xs text-text-muted">{{ t('common.leechers') }}</p>
        <p class="num text-2xl font-medium mt-1" :class="torrent.stats.leechers ? 'text-leech' : 'text-text-muted'">{{ torrent.stats.leechers }}</p>
      </div>
      <div class="p-4">
        <p class="text-xs text-text-muted">{{ t('common.completed') }}</p>
        <p class="num text-2xl font-medium mt-1">{{ torrent.stats.completed }}</p>
      </div>
      <div class="col-span-3 !border-l-0 h-1 flex bg-bg-hover" aria-hidden="true">
        <template v-if="torrent.stats.seeders + torrent.stats.leechers > 0">
          <span class="bg-seed" :style="{ width: `${seedShare}%` }" />
          <span class="bg-leech flex-1" />
        </template>
      </div>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6 min-w-0">
        <!-- Description -->
        <section v-if="torrent.description" class="card">
          <h2 class="card-header text-sm font-medium">{{ t('common.description') }}</h2>
          <div class="card-body">
            <ClientOnly>
              <div class="description-content text-sm leading-6 text-text-secondary" v-html="renderedDescription" />
            </ClientOnly>
          </div>
        </section>

        <!-- Comments -->
        <section class="card">
          <h2 class="card-header text-sm font-medium">
            {{ t('torrents.detail.comments', { n: torrent.comments.length }, torrent.comments.length) }}
          </h2>
          <ul v-if="torrent.comments.length" class="divide-y divide-border">
            <li v-for="comment in torrent.comments" :key="comment.id" class="px-4 py-3 group">
              <div class="flex items-baseline gap-2">
                <NuxtLink v-if="comment.author" :to="`/users/${comment.author.id}`" class="text-sm font-medium hover:underline underline-offset-2">{{ comment.author.username }}</NuxtLink>
                <span class="text-xs text-text-muted" :title="formatDate(comment.createdAt)">{{ formatAge(comment.createdAt) }}</span>
                <button
                  v-if="canDeleteComment(comment)"
                  type="button"
                  class="ml-auto p-1 rounded text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 focus:opacity-100"
                  :title="t('common.delete')"
                  :aria-label="t('common.delete')"
                  @click="deleteComment(comment.id)"
                >
                  <Icon name="ph:trash" class="block text-sm" />
                </button>
              </div>
              <p class="mt-1 text-sm text-text-secondary whitespace-pre-wrap break-words">{{ comment.content }}</p>
            </li>
          </ul>
          <form class="p-4 border-t border-border first:border-t-0" @submit.prevent="postComment">
            <label class="sr-only" for="comment-body">{{ t('torrents.detail.commentPlaceholder') }}</label>
            <textarea
              id="comment-body"
              v-model="newComment"
              rows="3"
              maxlength="5000"
              class="input w-full resize-y"
              :placeholder="t('torrents.detail.commentPlaceholder')"
            />
            <div class="mt-2 flex items-center justify-between gap-3">
              <p v-if="commentError" class="text-sm text-danger" role="alert">{{ commentError }}</p>
              <button type="submit" class="btn btn-secondary ml-auto" :disabled="posting || !newComment.trim()">
                {{ t('torrents.detail.postComment') }}
              </button>
            </div>
          </form>
        </section>
      </div>

      <aside class="space-y-6">
        <!-- Details -->
        <section class="card">
          <h2 class="card-header text-sm font-medium">{{ t('torrents.detail.details') }}</h2>
          <dl class="card-body space-y-3 text-sm">
            <div>
              <dt class="text-xs text-text-muted">{{ t('torrents.detail.infoHash') }}</dt>
              <dd class="flex items-center gap-2 mt-0.5">
                <code class="num text-xs text-text-secondary break-all">{{ torrent.infoHash }}</code>
                <button type="button" class="p-1 rounded btn-ghost shrink-0" :title="copied ? t('shell.user.copied') : t('torrents.detail.copyHash')" :aria-label="t('torrents.detail.copyHash')" @click="copyHash">
                  <Icon :name="copied ? 'ph:check' : 'ph:copy'" class="block text-sm" />
                </button>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-text-muted">{{ t('torrents.detail.createdAt') }}</dt>
              <dd class="mt-0.5 text-text-secondary">{{ formatDate(torrent.createdAt) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-text-muted">{{ t('torrents.detail.totalSize') }}</dt>
              <dd class="mt-0.5 num text-text-secondary">{{ formatSize(torrent.size) }}</dd>
            </div>
          </dl>
        </section>

        <!-- Peers -->
        <details class="card group/peers">
          <summary class="card-header cursor-pointer list-none text-sm font-medium">
            <span>{{ t('torrents.detail.activeSwarm', { count: torrent.peers.length }) }}</span>
            <Icon name="ph:caret-down" class="text-text-muted transition-transform group-open/peers:rotate-180" aria-hidden="true" />
          </summary>
          <p v-if="!torrent.peers.length" class="card-body text-sm text-text-muted">{{ t('torrents.detail.noPeers') }}</p>
          <ul v-else class="divide-y divide-border max-h-80 overflow-y-auto">
            <li v-for="peer in torrent.peers" :key="peer.id" class="px-4 py-2 flex items-center gap-3 text-xs">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="peer.isSeeder ? 'bg-seed' : 'bg-leech'" aria-hidden="true" />
              <span class="num text-text-muted truncate">{{ peer.id.slice(0, 10) }}…</span>
              <span class="ml-auto text-text-muted">{{ peer.isSeeder ? t('torrents.detail.seeder') : t('torrents.detail.leecher') }}</span>
              <span class="num text-text-muted w-14 text-right">{{ formatAge(peer.lastSeen) }}</span>
            </li>
          </ul>
        </details>
      </aside>
    </div>

    <EditTorrentModal :is-open="showEditModal" :torrent="editableTorrent" @close="showEditModal = false" @saved="refresh" />
    <ReportModal :is-open="showReport" target-type="torrent" :target-id="torrent.id" @close="showReport = false" @submitted="showReport = false" />

    <!-- Delete confirmation -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-scrim/60 p-4"
        @click.self="showDeleteConfirm = false"
      >
        <div class="card w-full max-w-sm shadow-2xl" role="alertdialog" aria-modal="true" :aria-label="t('torrents.detail.confirmDeleteTitle')">
          <div class="card-body space-y-3">
            <h2 class="text-base font-semibold">{{ t('torrents.detail.confirmDeleteTitle') }}</h2>
            <p class="text-sm text-text-secondary">{{ t('torrents.detail.confirmDeleteText') }}</p>
            <p class="num text-xs text-text-muted truncate">{{ torrent.name }}</p>
            <p v-if="deleteError" class="text-sm text-danger" role="alert">{{ deleteError }}</p>
            <div class="flex justify-end gap-2 pt-1">
              <button type="button" class="btn btn-secondary" :disabled="isDeleting" @click="showDeleteConfirm = false">{{ t('common.cancel') }}</button>
              <button type="button" class="btn bg-danger text-white hover:bg-danger/85" :disabled="isDeleting" @click="deleteTorrent">
                <Icon v-if="isDeleting" name="ph:circle-notch" class="animate-spin" aria-hidden="true" />
                {{ isDeleting ? t('common.deleting') : t('common.delete') }}
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
interface Comment {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  author: { id: string; username: string } | null;
}
interface TorrentDetail {
  id: string;
  infoHash: string;
  name: string;
  size: number;
  description: string | null;
  uploaderId: string | null;
  uploader: { id: string; username: string } | null;
  categoryId: string | null;
  category: Category | null;
  imdbId: string | null;
  tmdbId: number | null;
  tvdbId: number | null;
  createdAt: string;
  tags: { id: string; name: string }[];
  comments: Comment[];
  stats: { seeders: number; leechers: number; completed: number };
  peers: Peer[];
}

const { t } = useI18n();
const route = useRoute();
const hash = route.params.hash as string;

const { data: torrent, error, refresh } = await useFetch<TorrentDetail>(`/api/torrents/${hash}`);
if (error.value || !torrent.value) {
  throw createError({ statusCode: 404, message: t('torrents.detail.notFound') });
}
useHead({ title: () => torrent.value?.name ?? '' });

const { user } = useUserSession();
const isStaff = computed(() => Boolean(user.value?.isAdmin || user.value?.isModerator));
const canEdit = computed(() => Boolean(user.value && (torrent.value?.uploaderId === user.value.id || isStaff.value)));
const canDeleteComment = (comment: Comment) => Boolean(user.value && (comment.authorId === user.value.id || isStaff.value));

const showEditModal = ref(false);
const showReport = ref(false);
const showDeleteConfirm = ref(false);
const isDeleting = ref(false);
const deleteError = ref<string | null>(null);
const copied = ref(false);

const seedShare = computed(() => {
  const { seeders, leechers } = torrent.value!.stats;
  return seeders + leechers > 0 ? Math.round((seeders / (seeders + leechers)) * 100) : 0;
});

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

const renderedDescription = computed(() => renderMarkdown(torrent.value?.description));

async function copyHash() {
  await navigator.clipboard.writeText(torrent.value!.infoHash).catch(() => {});
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

// Comments
const newComment = ref('');
const posting = ref(false);
const commentError = ref<string | null>(null);

async function postComment() {
  if (!newComment.value.trim()) return;
  posting.value = true;
  commentError.value = null;
  try {
    await $fetch(`/api/torrents/${hash}/comments`, { method: 'POST', body: { content: newComment.value.trim() } });
    newComment.value = '';
    await refresh();
  } catch (err) {
    commentError.value = (err as { data?: { message?: string } }).data?.message ?? t('torrents.detail.commentFailed');
  } finally {
    posting.value = false;
  }
}

async function deleteComment(id: string) {
  if (!confirm(t('torrents.detail.confirmDeleteComment'))) return;
  await $fetch(`/api/torrents/comments/${id}`, { method: 'DELETE' });
  await refresh();
}

// Delete torrent
function confirmDelete() {
  deleteError.value = null;
  showDeleteConfirm.value = true;
}

async function deleteTorrent() {
  isDeleting.value = true;
  deleteError.value = null;
  try {
    await $fetch(`/api/torrents/${torrent.value!.infoHash}`, { method: 'DELETE' });
    navigateTo('/torrents');
  } catch (err) {
    deleteError.value = (err as { data?: { message?: string } }).data?.message ?? t('torrents.detail.deleteFailed');
  } finally {
    isDeleting.value = false;
  }
}
</script>

<style scoped>
.description-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  border: 1px solid rgb(var(--line));
}
.description-content :deep(p),
.description-content :deep(ul),
.description-content :deep(ol),
.description-content :deep(blockquote),
.description-content :deep(pre) {
  margin-bottom: 0.75rem;
}
.description-content :deep(:last-child) {
  margin-bottom: 0;
}
.description-content :deep(a) {
  color: rgb(var(--ink));
  text-decoration: underline;
  text-underline-offset: 2px;
}
.description-content :deep(strong) {
  color: rgb(var(--ink));
  font-weight: 600;
}
.description-content :deep(ul),
.description-content :deep(ol) {
  padding-left: 1.25rem;
  list-style: revert;
}
.description-content :deep(code) {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.85em;
}
.description-content :deep(blockquote) {
  border-left: 2px solid rgb(var(--line-strong));
  padding-left: 0.75rem;
}
</style>
