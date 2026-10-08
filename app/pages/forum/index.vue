<template>
  <div class="space-y-6">
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('forum.title') }}</h1>
        <p class="text-text-muted text-sm">
          {{ t('forum.index.subtitle') }}
        </p>
      </div>
      <div v-if="user?.isAdmin">
        <button
          @click="showCreateCategory = true"
          class="px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-white/90 transition-colors flex items-center gap-2"
        >
          <Icon name="ph:plus-bold" />
          {{ t('forum.index.newCategory') }}
        </button>
      </div>
    </div>

    <div v-if="pending" class="space-y-4">
      <div
        v-for="i in 3"
        :key="i"
        class="h-24 bg-bg-secondary animate-pulse rounded-lg border border-border"
      ></div>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="category in categories"
        :key="category.id"
        class="bg-bg-secondary border border-border rounded-lg overflow-hidden group hover:border-white/20 transition-colors"
      >
        <NuxtLink :to="`/forum/category/${category.id}`" class="block p-6">
          <div class="flex justify-between items-start">
            <div>
              <h2
                class="text-lg font-bold group-hover:text-white transition-colors"
              >
                {{ category.name }}
              </h2>
              <p class="text-text-muted text-sm mt-1">
                {{ category.description }}
              </p>
            </div>
            <div class="text-right">
              <div
                class="text-xs font-mono text-text-muted uppercase tracking-widest"
              >
                {{ t('forum.index.lastActivity') }}
              </div>
              <div v-if="category.topics?.[0]" class="text-sm mt-1">
                {{ formatDate(category.topics[0].updatedAt) }}
              </div>
              <div v-else class="text-sm mt-1 text-text-muted italic">
                {{ t('forum.index.noTopics') }}
              </div>
            </div>
          </div>
        </NuxtLink>
        <!-- Admin Actions -->
        <div
          v-if="user?.isAdmin"
          class="flex justify-end gap-2 px-6 pb-4 -mt-2"
        >
          <button
            @click.prevent="openEditModal(category)"
            class="p-2 text-text-muted hover:text-white hover:bg-white/10 rounded transition-colors"
            :title="t('forum.index.editCategory')"
          >
            <Icon name="ph:pencil-bold" class="text-sm" />
          </button>
          <button
            @click.prevent="confirmDelete(category)"
            class="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
            :title="t('forum.index.deleteCategory')"
          >
            <Icon name="ph:trash-bold" class="text-sm" />
          </button>
        </div>
      </div>
    </div>

    <!-- Create Category Modal -->
    <div
      v-if="showCreateCategory"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim/80 backdrop-blur-sm"
    >
      <div
        class="bg-bg-secondary border border-border rounded-lg w-full max-w-md p-6 space-y-4"
      >
        <h3 class="text-lg font-bold">{{ t('forum.index.createTitle') }}</h3>
        <div class="space-y-4">
          <div>
            <label
              class="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5 font-bold"
              >{{ t('common.name') }}</label
            >
            <input
              v-model="newCategory.name"
              type="text"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
              :placeholder="t('forum.index.namePlaceholder')"
            />
          </div>
          <div>
            <label
              class="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5 font-bold"
              >{{ t('common.description') }}</label
            >
            <textarea
              v-model="newCategory.description"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors h-24 resize-none"
              :placeholder="t('forum.index.descriptionPlaceholder')"
            ></textarea>
          </div>
          <div>
            <label
              class="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5 font-bold"
              >{{ t('forum.index.order') }}</label
            >
            <input
              v-model.number="newCategory.order"
              type="number"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>
        </div>
        <div class="flex gap-3 pt-2">
          <button
            @click="showCreateCategory = false"
            class="flex-1 px-4 py-2 bg-bg-tertiary text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-white/5 transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="handleCreateCategory"
            :disabled="creating"
            class="flex-1 px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {{ creating ? t('common.creating') : t('common.create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Category Modal -->
    <div
      v-if="showEditCategory"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim/80 backdrop-blur-sm"
    >
      <div
        class="bg-bg-secondary border border-border rounded-lg w-full max-w-md p-6 space-y-4"
      >
        <h3 class="text-lg font-bold">{{ t('forum.index.editTitle') }}</h3>
        <div class="space-y-4">
          <div>
            <label
              class="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5 font-bold"
              >{{ t('common.name') }}</label
            >
            <input
              v-model="editCategory.name"
              type="text"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>
          <div>
            <label
              class="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5 font-bold"
              >{{ t('common.description') }}</label
            >
            <textarea
              v-model="editCategory.description"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors h-24 resize-none"
            ></textarea>
          </div>
          <div>
            <label
              class="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5 font-bold"
              >{{ t('forum.index.order') }}</label
            >
            <input
              v-model.number="editCategory.order"
              type="number"
              class="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>
        </div>
        <div class="flex gap-3 pt-2">
          <button
            @click="showEditCategory = false"
            class="flex-1 px-4 py-2 bg-bg-tertiary text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-white/5 transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="handleUpdateCategory"
            :disabled="updating"
            class="flex-1 px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {{ updating ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim/80 backdrop-blur-sm"
    >
      <div
        class="bg-bg-secondary border border-border rounded-lg w-full max-w-md p-6 space-y-4"
      >
        <h3 class="text-lg font-bold text-red-400">{{ t('forum.index.deleteTitle') }}</h3>
        <i18n-t keypath="forum.index.deleteConfirm" tag="p" class="text-text-muted text-sm">
          <template #name>
            <strong class="text-white">{{ categoryToDelete?.name }}</strong>
          </template>
        </i18n-t>
        <div class="flex gap-3 pt-2">
          <button
            @click="showDeleteConfirm = false"
            class="flex-1 px-4 py-2 bg-bg-tertiary text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-white/5 transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            @click="handleDeleteCategory"
            :disabled="deleting"
            class="flex-1 px-4 py-2 bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {{ deleting ? t('common.deleting') : t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ForumCategory {
  id: string;
  name: string;
  description: string | null;
  order: number;
  topics?: { updatedAt: string }[];
}

const { t, locale } = useI18n();
const { user } = useUserSession();
const {
  data: categories,
  pending,
  refresh,
} = await useFetch<ForumCategory[]>('/api/forum/categories');

// Create
const showCreateCategory = ref(false);
const creating = ref(false);
const newCategory = ref({
  name: '',
  description: '',
  order: 0,
});

async function handleCreateCategory() {
  if (!newCategory.value.name) return;

  creating.value = true;
  try {
    await $fetch('/api/forum/categories', {
      method: 'POST',
      body: newCategory.value,
    });
    showCreateCategory.value = false;
    newCategory.value = { name: '', description: '', order: 0 };
    await refresh();
  } catch (e) {
    console.error(e);
  } finally {
    creating.value = false;
  }
}

// Edit
const showEditCategory = ref(false);
const updating = ref(false);
const editCategory = ref({
  id: '',
  name: '',
  description: '',
  order: 0,
});

function openEditModal(category: ForumCategory) {
  editCategory.value = {
    id: category.id,
    name: category.name,
    description: category.description || '',
    order: category.order,
  };
  showEditCategory.value = true;
}

async function handleUpdateCategory() {
  if (!editCategory.value.name) return;

  updating.value = true;
  try {
    await $fetch(`/api/forum/categories/${editCategory.value.id}` as '/api/forum/categories/:id', {
      method: 'PUT',
      body: {
        name: editCategory.value.name,
        description: editCategory.value.description,
        order: editCategory.value.order,
      },
    } as any);
    showEditCategory.value = false;
    await refresh();
  } catch (e) {
    console.error(e);
  } finally {
    updating.value = false;
  }
}

// Delete
const showDeleteConfirm = ref(false);
const deleting = ref(false);
const categoryToDelete = ref<ForumCategory | null>(null);

function confirmDelete(category: ForumCategory) {
  categoryToDelete.value = category;
  showDeleteConfirm.value = true;
}

async function handleDeleteCategory() {
  if (!categoryToDelete.value) return;

  deleting.value = true;
  try {
    await $fetch(`/api/forum/categories/${categoryToDelete.value.id}` as '/api/forum/categories/:id', {
      method: 'DELETE',
    } as any);
    showDeleteConfirm.value = false;
    categoryToDelete.value = null;
    await refresh();
  } catch (e) {
    console.error(e);
  } finally {
    deleting.value = false;
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>
