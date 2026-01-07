<template>
  <aside class="w-56 shrink-0 hidden lg:block">
    <div class="sticky top-20">
      <div class="flex items-center gap-2 px-3 py-2 mb-2">
        <Icon name="ph:folders-bold" class="text-text-muted" />
        <h3 class="text-xs font-bold uppercase tracking-wider">Categories</h3>
      </div>

      <nav class="space-y-0.5">
        <!-- All Torrents -->
        <button
          class="w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2"
          :class="[
            !selectedId
              ? 'bg-white/10 text-white'
              : 'text-text-secondary hover:bg-white/5 hover:text-white',
          ]"
          @click="$emit('select', '')"
        >
          <Icon name="ph:list-bold" class="text-sm" />
          <span>All Torrents</span>
        </button>

        <!-- Categories -->
        <div v-for="category in categories" :key="category.id">
          <button
            class="w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-between group"
            :class="[
              selectedId === category.id
                ? 'bg-white/10 text-white'
                : 'text-text-secondary hover:bg-white/5 hover:text-white',
            ]"
            @click="handleCategoryClick(category)"
          >
            <span class="flex items-center gap-2">
              <Icon :name="getCategoryIcon(category.slug)" class="text-sm" />
              <span>{{ category.name }}</span>
            </span>
            <Icon
              v-if="category.subcategories?.length"
              name="ph:caret-right-bold"
              class="text-[10px] text-text-muted transition-transform"
              :class="{ 'rotate-90': expandedIds.has(category.id) }"
            />
          </button>

          <!-- Subcategories -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 max-h-0"
            enter-to-class="opacity-100 max-h-96"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 max-h-96"
            leave-to-class="opacity-0 max-h-0"
          >
            <div
              v-if="expandedIds.has(category.id) && category.subcategories?.length"
              class="overflow-hidden ml-4 border-l border-border/50 pl-2 mt-0.5 space-y-0.5"
            >
              <button
                v-for="sub in category.subcategories"
                :key="sub.id"
                class="w-full text-left px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center gap-2"
                :class="[
                  selectedId === sub.id
                    ? 'bg-white/10 text-white'
                    : 'text-text-muted hover:bg-white/5 hover:text-text-secondary',
                ]"
                @click="$emit('select', sub.id)"
              >
                <span>{{ sub.name }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </nav>
    </div>
  </aside>
</template>

<script setup lang="ts">
interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  subcategories?: Category[];
}

const props = defineProps<{
  categories: Category[];
  selectedId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const expandedIds = ref<Set<string>>(new Set());

// Auto-expand parent if a subcategory is selected
watch(
  () => props.selectedId,
  (newId) => {
    if (!newId) return;
    for (const cat of props.categories) {
      if (cat.subcategories?.some((sub) => sub.id === newId)) {
        expandedIds.value.add(cat.id);
        break;
      }
    }
  },
  { immediate: true }
);

function handleCategoryClick(category: Category) {
  if (category.subcategories?.length) {
    // Toggle expand/collapse
    if (expandedIds.value.has(category.id)) {
      expandedIds.value.delete(category.id);
    } else {
      expandedIds.value.add(category.id);
    }
  }
  // Always emit select for the category
  emit('select', category.id);
}

function getCategoryIcon(slug: string): string {
  const icons: Record<string, string> = {
    movies: 'ph:film-slate-bold',
    tv: 'ph:television-bold',
    music: 'ph:music-notes-bold',
    games: 'ph:game-controller-bold',
    software: 'ph:app-window-bold',
    ebooks: 'ph:book-open-bold',
    anime: 'ph:shooting-star-bold',
    xxx: 'ph:prohibit-bold',
    other: 'ph:package-bold',
  };
  return icons[slug] || 'ph:folder-bold';
}
</script>
