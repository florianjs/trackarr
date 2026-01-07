<template>
  <div class="flex gap-6">
    <!-- Category Sidebar -->
    <CategorySidebar
      :categories="categories ?? []"
      :selected-id="selectedCategory"
      @select="handleCategorySelect"
    />

    <!-- Main Content -->
    <div class="flex-1 min-w-0">
      <!-- Page Header -->
      <div
        class="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <h2
            class="text-xl font-bold text-text-primary tracking-tight uppercase"
          >
            Torrent Index
          </h2>
          <p class="text-xs text-text-muted font-mono mt-0.5">
            {{ pagination.total }} objects indexed in database
          </p>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap items-center gap-2">
          <SearchBar
            v-model="search"
            placeholder="Search by name or hash..."
            class="w-full md:w-64"
            :loading="pending"
            @search="doSearch"
          />
          <button
            class="btn btn-primary flex items-center gap-2 !py-1.5"
            @click="showUploadModal = true"
          >
            <Icon name="ph:plus-bold" />
            <span>Upload</span>
          </button>
        </div>
      </div>

      <!-- Torrents Table -->
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <TorrentTable
            v-if="torrents.length > 0"
            :torrents="torrents"
            admin
            @deleted="() => refresh()"
          />
          <div v-else class="p-16 text-center">
            <div
              class="w-16 h-16 bg-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4 border border-border"
            >
              <Icon name="ph:magnifying-glass" class="text-3xl text-text-muted" />
            </div>
            <h3
              class="text-sm font-bold text-text-primary uppercase tracking-wider"
            >
              No results found
            </h3>
            <p class="text-xs text-text-muted mt-1 font-mono">
              The search query did not match any indexed torrents.
            </p>
            <button
              v-if="search || selectedCategory"
              class="btn btn-secondary mt-6 text-xs uppercase tracking-widest font-bold"
              @click="clearFilters"
            >
              Reset Filters
            </button>
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

    <!-- Upload Modal -->
    <UploadTorrentModal
      :is-open="showUploadModal"
      @close="showUploadModal = false"
      @uploaded="onUploaded"
    />
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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const route = useRoute();
const router = useRouter();

const search = ref((route.query.search as string) || '');
const page = ref(parseInt((route.query.page as string) || '1', 10));
const selectedCategory = ref((route.query.categoryId as string) || '');

const showUploadModal = ref(false);

const { data: categories } = await useFetch('/api/categories');

const { data, refresh, pending } = await useFetch<{
  data: TorrentWithStats[];
  pagination: Pagination;
}>('/api/torrents', {
  query: computed(() => ({
    page: page.value,
    limit: 25,
    search: search.value || undefined,
    categoryId: selectedCategory.value || undefined,
  })),
});

function onUploaded() {
  refresh();
}

const torrents = computed(() => data.value?.data ?? []);
const pagination = computed(
  () => data.value?.pagination ?? { page: 1, limit: 25, total: 0, pages: 0 }
);

function doSearch() {
  page.value = 1;
  router.push({
    query: {
      search: search.value || undefined,
      categoryId: selectedCategory.value || undefined,
      page: undefined,
    },
  });
  refresh();
}

function handleCategorySelect(id: string) {
  selectedCategory.value = id;
  doSearch();
}

function clearFilters() {
  search.value = '';
  selectedCategory.value = '';
  doSearch();
}

function goToPage(p: number) {
  page.value = p;
  router.push({ query: { ...route.query, page: p > 1 ? p : undefined } });
  refresh();
}
</script>
