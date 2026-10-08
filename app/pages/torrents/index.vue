<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ t('torrents.list.title') }}</h1>
        <p class="text-sm text-text-muted mt-0.5">
          {{ t('torrents.list.indexedCount', { count: pagination.total }, pagination.total) }}
        </p>
      </div>
      <button type="button" class="btn btn-primary" @click="showUploadModal = true">
        <Icon name="ph:upload-simple" aria-hidden="true" />{{ t('torrents.list.upload') }}
      </button>
    </div>

    <!-- Filters -->
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-3">
        <label class="relative flex-1 min-w-[14rem] max-w-lg">
          <span class="sr-only">{{ t('torrents.list.searchPlaceholder') }}</span>
          <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            class="input w-full !pl-9"
            :placeholder="t('torrents.list.searchPlaceholder')"
          />
        </label>
        <label class="flex items-center gap-2 text-sm text-text-muted">
          {{ t('torrents.list.sort') }}
          <select v-model="sort" class="input !py-1.5">
            <option value="uploaded:desc">{{ t('torrents.list.sortNewest') }}</option>
            <option value="uploaded:asc">{{ t('torrents.list.sortOldest') }}</option>
            <option value="size:desc">{{ t('torrents.list.sortLargest') }}</option>
            <option value="size:asc">{{ t('torrents.list.sortSmallest') }}</option>
            <option value="name:asc">{{ t('torrents.list.sortName') }}</option>
          </select>
        </label>
      </div>

      <!-- Categories -->
      <div class="flex gap-1.5 overflow-x-auto pb-1" role="tablist" :aria-label="t('sidebar.categories')">
        <button
          v-for="cat in [{ id: '', name: t('sidebar.allTorrents') }, ...topCategories]"
          :key="cat.id"
          type="button"
          role="tab"
          :aria-selected="activeTop === cat.id"
          class="shrink-0 px-3 py-1 rounded-full text-sm border transition-colors"
          :class="activeTop === cat.id
            ? 'bg-white text-black border-transparent'
            : 'border-border text-text-secondary hover:text-text-primary hover:border-border-hover'"
          @click="selectCategory(cat.id)"
        >{{ cat.name }}</button>
      </div>
      <div v-if="subcategories.length" class="flex gap-1.5 overflow-x-auto pb-1">
        <button
          v-for="sub in subcategories"
          :key="sub.id"
          type="button"
          class="shrink-0 px-2.5 py-0.5 rounded-full text-xs border transition-colors"
          :class="categoryId === sub.id
            ? 'border-text-primary text-text-primary'
            : 'border-border text-text-muted hover:text-text-primary'"
          @click="selectCategory(categoryId === sub.id ? activeTop : sub.id)"
        >{{ sub.name }}</button>
      </div>
    </div>

    <!-- Results -->
    <div class="card overflow-hidden" :aria-busy="pending">
      <div v-if="torrents.length" class="overflow-x-auto">
        <TorrentTable
          :torrents="torrents"
          :categories="flatCategories"
          :can-delete="isStaff"
          @deleted="() => refresh()"
        />
      </div>
      <div v-else class="p-10 text-center">
        <p class="text-sm text-text-primary">
          {{ search || categoryId ? t('torrents.list.noMatch') : t('torrents.list.noResults') }}
        </p>
        <div class="mt-4 flex justify-center gap-2">
          <button v-if="search || categoryId" type="button" class="btn btn-secondary" @click="clearFilters">
            {{ t('torrents.list.resetFilters') }}
          </button>
          <button v-else type="button" class="btn btn-primary" @click="showUploadModal = true">
            {{ t('torrents.list.upload') }}
          </button>
        </div>
      </div>

      <nav
        v-if="pagination.pages > 1"
        class="px-4 py-2.5 border-t border-border flex items-center justify-between"
        :aria-label="t('common.pageOf', { page: pagination.page, pages: pagination.pages })"
      >
        <p class="text-xs text-text-muted num">
          {{ t('common.pageOf', { page: pagination.page, pages: pagination.pages }) }}
        </p>
        <div class="flex gap-1">
          <button type="button" class="btn btn-secondary !px-2" :disabled="pagination.page <= 1" :aria-label="t('torrents.list.previous')" @click="page--">
            <Icon name="ph:caret-left" class="block" />
          </button>
          <button type="button" class="btn btn-secondary !px-2" :disabled="pagination.page >= pagination.pages" :aria-label="t('torrents.list.next')" @click="page++">
            <Icon name="ph:caret-right" class="block" />
          </button>
        </div>
      </nav>
    </div>

    <UploadTorrentModal :is-open="showUploadModal" @close="showUploadModal = false" @uploaded="() => refresh()" />
  </div>
</template>

<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import type { TorrentRow } from '~/components/TorrentTable.vue';

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  subcategories?: Category[];
}
interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { user } = useUserSession();
useHead({ title: () => t('torrents.list.title') });

const isStaff = computed(() => Boolean(user.value?.isAdmin || user.value?.isModerator));
const showUploadModal = ref(false);

// Filters live in the URL so results can be shared and survive reloads
const search = ref(typeof route.query.search === 'string' ? route.query.search : '');
const searchDebounced = refDebounced(search, 300);
const categoryId = ref(typeof route.query.categoryId === 'string' ? route.query.categoryId : '');
const sort = ref(typeof route.query.sort === 'string' ? route.query.sort : 'uploaded:desc');
const page = ref(Number(route.query.page) > 1 ? Number(route.query.page) : 1);

watch([searchDebounced, categoryId, sort], () => (page.value = 1));
watch([searchDebounced, categoryId, sort, page], () => {
  router.replace({
    query: {
      search: searchDebounced.value || undefined,
      categoryId: categoryId.value || undefined,
      sort: sort.value !== 'uploaded:desc' ? sort.value : undefined,
      page: page.value > 1 ? page.value : undefined,
    },
  });
});

const { data: categories } = await useFetch<Category[]>('/api/categories', { default: () => [] });

const { data, refresh, pending } = await useFetch<{ data: TorrentRow[]; pagination: Pagination }>(
  '/api/torrents',
  {
    query: computed(() => {
      const [sortBy, order] = sort.value.split(':');
      return {
        page: page.value,
        limit: 25,
        search: searchDebounced.value || undefined,
        categoryId: categoryId.value || undefined,
        sortBy,
        order,
      };
    }),
  }
);

const torrents = computed(() => data.value?.data ?? []);
const pagination = computed(() => data.value?.pagination ?? { page: 1, limit: 25, total: 0, pages: 0 });

const topCategories = computed(() => categories.value ?? []);
const flatCategories = computed(() =>
  topCategories.value.flatMap((c) => [c, ...(c.subcategories ?? [])])
);
const activeTop = computed(() => {
  if (!categoryId.value) return '';
  const parent = topCategories.value.find(
    (c) => c.id === categoryId.value || c.subcategories?.some((s) => s.id === categoryId.value)
  );
  return parent?.id ?? '';
});
const subcategories = computed(
  () => topCategories.value.find((c) => c.id === activeTop.value)?.subcategories ?? []
);

function selectCategory(id: string) {
  categoryId.value = id;
}

function clearFilters() {
  search.value = '';
  categoryId.value = '';
}

// The command palette sends ?search=; follow it when already on this page
watch(() => route.query.search, (q) => {
  const value = typeof q === 'string' ? q : '';
  if (value !== searchDebounced.value) search.value = value;
});
</script>
