<template>
  <div class="max-w-4xl mx-auto">
    <NuxtLink
      to="/torrents"
      class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-white mb-6 transition-colors"
    >
      <Icon name="ph:arrow-left-bold" />
      Back to torrents
    </NuxtLink>

    <div v-if="pending" class="flex justify-center py-12">
      <Icon
        name="ph:spinner-bold"
        class="w-8 h-8 animate-spin text-text-muted"
      />
    </div>

    <div v-else-if="error" class="card">
      <div class="card-body text-center py-12">
        <Icon
          name="ph:user-bold"
          class="w-12 h-12 text-text-muted mx-auto mb-4"
        />
        <p class="text-text-muted">User not found</p>
      </div>
    </div>

    <template v-else-if="user">
      <!-- User Header -->
      <div class="card mb-6">
        <div class="card-body !p-6">
          <div class="flex items-start gap-6">
            <!-- Avatar -->
            <div
              class="w-20 h-20 bg-bg-tertiary rounded-lg flex items-center justify-center border border-border shrink-0"
            >
              <Icon name="ph:user-bold" class="w-10 h-10 text-text-muted" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <h1 class="text-2xl font-bold text-text-primary">
                  {{ user.username }}
                </h1>
                <span
                  v-if="user.isAdmin"
                  class="text-[10px] font-bold bg-red-500/20 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded-sm uppercase tracking-wider"
                >
                  Admin
                </span>
                <span
                  v-else-if="user.isModerator"
                  class="text-[10px] font-bold bg-blue-500/20 border border-blue-500/30 text-blue-400 px-1.5 py-0.5 rounded-sm uppercase tracking-wider"
                >
                  Mod
                </span>
              </div>

              <div class="flex flex-wrap gap-6 text-sm">
                <div>
                  <span
                    class="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-0.5"
                    >Member since</span
                  >
                  <span class="text-text-secondary">{{
                    formatDate(user.createdAt)
                  }}</span>
                </div>
                <div>
                  <span
                    class="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-0.5"
                    >Last seen</span
                  >
                  <span class="text-text-secondary">{{
                    formatAge(user.lastSeen)
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="card">
          <div class="card-body text-center">
            <span
              class="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-1"
              >Ratio</span
            >
            <span class="text-2xl font-bold" :class="ratioClass">{{
              ratioFormatted
            }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-body text-center">
            <span
              class="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-1"
              >Uploaded</span
            >
            <span class="text-2xl font-bold text-green-400">{{
              formatSize(user.uploaded)
            }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-body text-center">
            <span
              class="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-1"
              >Downloaded</span
            >
            <span class="text-2xl font-bold text-yellow-400">{{
              formatSize(user.downloaded)
            }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-body text-center">
            <span
              class="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-1"
              >Uploads</span
            >
            <span class="text-2xl font-bold text-text-primary">{{
              user.uploadsCount
            }}</span>
          </div>
        </div>
      </div>

      <!-- User's Torrents -->
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <h2 class="font-bold text-text-primary">Uploaded Torrents</h2>
        </div>
        <div class="card-body !p-0">
          <div v-if="uploadsPending" class="flex justify-center py-8">
            <Icon
              name="ph:spinner-bold"
              class="w-6 h-6 animate-spin text-text-muted"
            />
          </div>
          <div
            v-else-if="!uploads?.data?.length"
            class="text-center py-8 text-text-muted text-sm"
          >
            No uploads yet
          </div>
          <table v-else class="w-full">
            <thead>
              <tr
                class="text-left text-[10px] font-bold text-text-muted uppercase tracking-widest border-b border-border"
              >
                <th class="px-4 py-3">Name</th>
                <th class="px-4 py-3 text-right">Size</th>
                <th class="px-4 py-3 text-center">S/L</th>
                <th class="px-4 py-3 text-right">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="torrent in uploads.data"
                :key="torrent.id"
                class="border-b border-border/50 hover:bg-bg-secondary/50 transition-colors"
              >
                <td class="px-4 py-3">
                  <NuxtLink
                    :to="`/torrents/${torrent.infoHash}`"
                    class="text-sm font-medium text-text-primary hover:text-white transition-colors line-clamp-1"
                  >
                    {{ torrent.name }}
                  </NuxtLink>
                  <div class="text-[10px] text-text-muted">
                    {{ torrent.category?.name || 'Uncategorized' }}
                  </div>
                </td>
                <td class="px-4 py-3 text-right text-sm text-text-secondary">
                  {{ formatSize(torrent.size) }}
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="text-green-400 text-sm">{{
                    torrent.stats.seeders
                  }}</span>
                  <span class="text-text-muted mx-1">/</span>
                  <span class="text-yellow-400 text-sm">{{
                    torrent.stats.leechers
                  }}</span>
                </td>
                <td class="px-4 py-3 text-right text-sm text-text-muted">
                  {{ formatAge(torrent.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div
            v-if="uploads?.pagination && uploads.pagination.pages > 1"
            class="flex justify-center gap-2 p-4 border-t border-border"
          >
            <button
              class="btn btn-secondary text-xs"
              :disabled="uploadsPage <= 1"
              @click="uploadsPage--"
            >
              Previous
            </button>
            <span class="flex items-center px-3 text-sm text-text-muted">
              {{ uploadsPage }} / {{ uploads.pagination.pages }}
            </span>
            <button
              class="btn btn-secondary text-xs"
              :disabled="uploadsPage >= uploads.pagination.pages"
              @click="uploadsPage++"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatSize, formatDate, formatAge } from '~/utils/format';

interface UserProfile {
  id: string;
  username: string;
  isAdmin: boolean;
  isModerator: boolean;
  uploaded: number;
  downloaded: number;
  createdAt: string;
  lastSeen: string;
  ratio: number | null;
  uploadsCount: number;
}

interface TorrentItem {
  id: string;
  infoHash: string;
  name: string;
  size: number;
  createdAt: string;
  category?: { name: string } | null;
  stats: { seeders: number; leechers: number; completed: number };
}

interface UploadsResponse {
  data: TorrentItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const route = useRoute();
const userId = computed(() => route.params.id as string);

// Fetch user profile
const {
  data: user,
  pending,
  error,
} = await useFetch<UserProfile>(() => `/api/users/${userId.value}`);

// Fetch user uploads with pagination
const uploadsPage = ref(1);
const { data: uploads, pending: uploadsPending } =
  await useFetch<UploadsResponse>(() => `/api/users/${userId.value}/uploads`, {
    query: { page: uploadsPage, limit: 10 },
    watch: [uploadsPage],
  });

// Ratio formatting
const ratioFormatted = computed(() => {
  if (!user.value) return '0.00';
  if (user.value.ratio === null) return '∞';
  return user.value.ratio.toFixed(2);
});

const ratioClass = computed(() => {
  if (!user.value) return 'text-text-primary';
  const r = user.value.ratio;
  if (r === null || r >= 2) return 'text-green-400';
  if (r >= 1) return 'text-white';
  if (r >= 0.5) return 'text-yellow-400';
  return 'text-red-400';
});

// Page meta
useHead({
  title: user.value?.username
    ? `${user.value.username} - Profile`
    : 'User Profile',
});
</script>
