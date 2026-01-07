<template>
  <div class="flex gap-6">
    <!-- Category Sidebar -->
    <CategorySidebar
      :categories="categories ?? []"
      :selected-id="selectedCategory"
      @select="handleCategorySelect"
    />

    <!-- Main Content -->
    <div class="flex-1 min-w-0 py-8">
      <!-- Search Header -->
      <div class="mb-12 text-center lg:text-left">
        <h1
          class="text-3xl font-black text-text-primary tracking-tighter uppercase mb-4"
        >
          Search <span class="text-text-muted">Torrents</span>
        </h1>
        <div class="max-w-2xl lg:mx-0 mx-auto">
          <SearchBar
            v-model="searchQuery"
            placeholder="Search by name, tag or infohash..."
            size="lg"
            :loading="pending"
            @search="handleSearch"
          />
        </div>
      </div>

      <!-- Results Section -->
      <div v-if="searchQuery || selectedCategory" class="space-y-6">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-2">
            <Icon name="ph:list-bullets-bold" class="text-text-muted" />
            <h3 class="text-xs font-bold uppercase tracking-wider">
              Search Results
              <span v-if="pagination.total > 0" class="text-text-muted ml-1">
                ({{ pagination.total }})
              </span>
            </h3>
          </div>

          <div class="flex items-center gap-4">
            <div
              class="text-[10px] font-mono text-text-muted uppercase tracking-widest"
            >
              Sort by: <span class="text-text-primary">Newest</span>
            </div>
          </div>
        </div>

        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <TorrentTable
              v-if="torrents.length > 0"
              :torrents="torrents"
              :compact="false"
            />
            <div v-else-if="!pending" class="p-20 text-center">
              <div
                class="w-16 h-16 bg-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4 border border-border"
              >
                <Icon
                  name="ph:magnifying-glass-x"
                  class="text-3xl text-text-muted"
                />
              </div>
              <h3
                class="text-sm font-bold text-text-primary uppercase tracking-wider"
              >
                No results found
              </h3>
              <p
                class="text-xs text-text-muted mt-1 font-mono max-w-xs mx-auto"
              >
                We couldn't find any torrents matching your search criteria. Try
                different keywords or filters.
              </p>
            </div>
            <div v-else class="p-20 text-center">
              <Icon
                name="ph:circle-notch"
                class="animate-spin h-8 w-8 text-text-muted mx-auto mb-4"
              />
              <p
                class="text-xs text-text-muted font-mono uppercase tracking-widest"
              >
                Searching database...
              </p>
            </div>
          </div>

          <!-- Pagination -->
          <div
            v-if="pagination.pages > 1"
            class="px-4 py-3 border-t border-border flex items-center justify-between bg-bg-secondary/50"
          >
            <p
              class="text-[10px] font-mono text-text-muted uppercase tracking-widest"
            >
              Page {{ pagination.page }} / {{ pagination.pages }}
            </p>
            <div class="flex gap-1">
              <button
                class="btn btn-secondary !py-1 !px-2 text-[10px] uppercase font-bold"
                :disabled="pagination.page <= 1"
                @click="goToPage(pagination.page - 1)"
              >
                <Icon name="ph:caret-left-bold" />
              </button>
              <button
                class="btn btn-secondary !py-1 !px-2 text-[10px] uppercase font-bold"
                :disabled="pagination.page >= pagination.pages"
                @click="goToPage(pagination.page + 1)"
              >
                <Icon name="ph:caret-right-bold" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State / Trending -->
      <div v-else class="mt-12">
        <div class="flex items-center gap-2 mb-6 px-1">
          <Icon name="ph:trend-up-bold" class="text-text-muted" />
          <h3 class="text-xs font-bold uppercase tracking-wider">
            Trending Torrents
          </h3>
        </div>
        <div class="card overflow-hidden">
          <TorrentTable :torrents="trendingTorrents" :compact="true" />
        </div>
      </div>
    </div>
  </div>
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

const route = useRoute();
const router = useRouter();

const searchQuery = ref((route.query.q as string) || '');
const selectedCategory = ref((route.query.c as string) || '');
const page = ref(parseInt((route.query.p as string) || '1', 10));

// Fetch categories
const { data: categories } = await useFetch<any[]>('/api/categories');

// Fetch branding for page title
const { data: branding } = await useFetch<{
  siteName: string;
  pageTitleSuffix: string | null;
}>('/api/branding');

// Fetch torrents
const {
  data: torrentsData,
  pending,
  refresh,
} = await useFetch<{
  data: TorrentWithStats[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}>('/api/torrents', {
  query: computed(() => ({
    search: searchQuery.value,
    category: selectedCategory.value,
    page: page.value,
    limit: 20,
  })),
  watch: [searchQuery, selectedCategory, page],
});

// Fetch trending (just recent for now)
const { data: trendingData } = await useFetch<{ data: TorrentWithStats[] }>(
  '/api/torrents',
  {
    query: { limit: 10 },
  }
);

const torrents = computed(() => torrentsData.value?.data ?? []);
const pagination = computed(
  () => torrentsData.value?.pagination ?? { page: 1, pages: 1, total: 0 }
);
const trendingTorrents = computed(() => trendingData.value?.data ?? []);

const searchBarRef = ref(null);

function handleSearch() {
  page.value = 1;
  updateUrl();
}

function handleCategorySelect(id: string) {
  selectedCategory.value = id;
  page.value = 1;
  updateUrl();
}

function goToPage(p: number) {
  page.value = p;
  updateUrl();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateUrl() {
  router.replace({
    query: {
      q: searchQuery.value || undefined,
      c: selectedCategory.value || undefined,
      p: page.value > 1 ? page.value : undefined,
    },
  });
}

// Sync with URL on load and back/forward
watch(
  () => route.query,
  (newQuery) => {
    searchQuery.value = (newQuery.q as string) || '';
    selectedCategory.value = (newQuery.c as string) || '';
    page.value = parseInt((newQuery.p as string) || '1', 10);
  },
  { deep: true }
);

useHead({
  title: computed(
    () =>
      `Search Torrents ${branding.value?.pageTitleSuffix || `- ${branding.value?.siteName || 'OpenTracker'}`}`
  ),
});
</script>
