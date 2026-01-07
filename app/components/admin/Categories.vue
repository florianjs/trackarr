<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:tag-bold" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          Category Management
        </h3>
      </div>
    </div>
    <div class="card-body">
      <!-- Add Category Form -->
      <div class="flex gap-2 mb-6">
        <select
          v-model="parentCategoryId"
          class="input !py-2 text-xs font-bold uppercase tracking-wider w-48"
        >
          <option :value="null">Root Category</option>
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            ↳ {{ category.name }}
          </option>
        </select>
        <input
          v-model="newCategoryName"
          type="text"
          :placeholder="
            parentCategoryId
              ? 'New subcategory name...'
              : 'New category name...'
          "
          class="input flex-1 !py-2 text-xs font-bold uppercase tracking-wider"
          @keyup.enter="addCategory"
        />
        <button
          class="btn btn-primary !px-6 flex items-center gap-2 uppercase tracking-widest font-bold text-xs"
          :disabled="!newCategoryName.trim() || isAdding"
          @click="addCategory"
        >
          <Icon v-if="isAdding" name="ph:circle-notch" class="animate-spin" />
          <Icon v-else name="ph:plus-bold" />
          <span>Add</span>
        </button>
      </div>

      <div
        v-if="!categories || categories.length === 0"
        class="text-center py-12 border border-dashed border-border rounded bg-bg-primary/30"
      >
        <Icon name="ph:tag-slash" class="text-3xl text-text-muted mb-2" />
        <p
          class="text-[10px] font-bold text-text-muted uppercase tracking-widest"
        >
          No categories defined
        </p>
      </div>
      <div v-else class="space-y-3">
        <!-- Root Categories -->
        <div
          v-for="category in categories"
          :key="category.id"
          class="border border-border rounded overflow-hidden"
        >
          <!-- Parent Category -->
          <div
            class="flex items-center justify-between p-3 bg-bg-tertiary/50 hover:border-white/20 transition-colors group"
          >
            <div class="flex items-center gap-3">
              <button
                v-if="category.subcategories?.length"
                class="w-6 h-6 rounded bg-bg-primary border border-border flex items-center justify-center hover:border-white/30 transition-colors"
                @click="toggleCategory(category.id)"
              >
                <Icon
                  :name="
                    expandedCategories.has(category.id)
                      ? 'ph:caret-down-bold'
                      : 'ph:caret-right-bold'
                  "
                  class="text-text-muted text-xs"
                />
              </button>
              <div
                v-else
                class="w-6 h-6 rounded bg-bg-primary border border-border flex items-center justify-center"
              >
                <Icon name="ph:folder" class="text-text-muted text-xs" />
              </div>
              <div class="flex-1">
                <!-- Edit Mode -->
                <div v-if="editingId === category.id" class="flex items-center gap-2">
                  <input
                    v-model="editingName"
                    type="text"
                    class="input !py-1 !px-2 text-xs font-bold uppercase tracking-wider w-48"
                    @keyup.enter="saveEdit(category.id)"
                    @keyup.escape="cancelEdit"
                  />
                  <button
                    class="p-1 text-success hover:bg-success/10 rounded transition-colors"
                    :disabled="isSaving"
                    @click="saveEdit(category.id)"
                  >
                    <Icon v-if="isSaving" name="ph:circle-notch" class="animate-spin" />
                    <Icon v-else name="ph:check-bold" />
                  </button>
                  <button
                    class="p-1 text-text-muted hover:bg-bg-tertiary rounded transition-colors"
                    @click="cancelEdit"
                  >
                    <Icon name="ph:x-bold" />
                  </button>
                </div>
                <!-- Display Mode -->
                <template v-else>
                  <p
                    class="text-xs font-bold text-text-primary uppercase tracking-wider"
                  >
                    {{ category.name }}
                  </p>
                  <p class="text-[10px] font-mono text-text-muted">
                    {{ category.slug }}
                    <span
                      v-if="category.subcategories?.length"
                      class="ml-2 text-text-muted/60"
                    >
                      ({{ category.subcategories.length }} subcategories)
                    </span>
                  </p>
                </template>
              </div>
            </div>
            <div v-if="editingId !== category.id" class="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                class="p-2 text-text-muted hover:text-text-primary transition-colors rounded hover:bg-bg-tertiary"
                @click="startEdit(category)"
              >
                <Icon name="ph:pencil-bold" />
              </button>
              <button
                class="p-2 text-text-muted hover:text-error transition-colors rounded hover:bg-error/10"
                @click="deleteCategory(category.id)"
              >
                <Icon name="ph:trash-bold" />
              </button>
            </div>
          </div>

          <!-- Subcategories -->
          <div
            v-if="
              category.subcategories?.length &&
              expandedCategories.has(category.id)
            "
            class="border-t border-border bg-bg-primary/30"
          >
            <div
              v-for="subcategory in category.subcategories"
              :key="subcategory.id"
              class="flex items-center justify-between p-3 pl-12 hover:bg-bg-tertiary/30 transition-colors group border-b border-border/50 last:border-b-0"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-6 h-6 rounded bg-bg-primary border border-border flex items-center justify-center"
                >
                  <Icon name="ph:tag" class="text-text-muted text-xs" />
                </div>
                <div class="flex-1">
                  <!-- Edit Mode for Subcategory -->
                  <div v-if="editingId === subcategory.id" class="flex items-center gap-2">
                    <input
                      v-model="editingName"
                      type="text"
                      class="input !py-1 !px-2 text-xs font-bold uppercase tracking-wider w-48"
                      @keyup.enter="saveEdit(subcategory.id)"
                      @keyup.escape="cancelEdit"
                    />
                    <button
                      class="p-1 text-success hover:bg-success/10 rounded transition-colors"
                      :disabled="isSaving"
                      @click="saveEdit(subcategory.id)"
                    >
                      <Icon v-if="isSaving" name="ph:circle-notch" class="animate-spin" />
                      <Icon v-else name="ph:check-bold" />
                    </button>
                    <button
                      class="p-1 text-text-muted hover:bg-bg-tertiary rounded transition-colors"
                      @click="cancelEdit"
                    >
                      <Icon name="ph:x-bold" />
                    </button>
                  </div>
                  <!-- Display Mode for Subcategory -->
                  <template v-else>
                    <p
                      class="text-xs font-bold text-text-primary uppercase tracking-wider"
                    >
                      {{ subcategory.name }}
                    </p>
                    <p class="text-[10px] font-mono text-text-muted">
                      {{ subcategory.slug }}
                    </p>
                  </template>
                </div>
              </div>
              <div v-if="editingId !== subcategory.id" class="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <button
                  class="p-2 text-text-muted hover:text-text-primary transition-colors rounded hover:bg-bg-tertiary"
                  @click="startEdit(subcategory)"
                >
                  <Icon name="ph:pencil-bold" />
                </button>
                <button
                  class="p-2 text-text-muted hover:text-error transition-colors rounded hover:bg-error/10"
                  @click="deleteCategory(subcategory.id)"
                >
                  <Icon name="ph:trash-bold" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Subcategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  createdAt: string;
  subcategories?: Subcategory[];
}

const { data: categories, refresh } =
  await useFetch<Category[]>('/api/categories');

const newCategoryName = ref('');
const parentCategoryId = ref<string | null>(null);
const isAdding = ref(false);
const expandedCategories = ref(new Set<string>());
const editingId = ref<string | null>(null);
const editingName = ref('');
const isSaving = ref(false);

function toggleCategory(id: string) {
  if (expandedCategories.value.has(id)) {
    expandedCategories.value.delete(id);
  } else {
    expandedCategories.value.add(id);
  }
}

function startEdit(category: Category | Subcategory) {
  editingId.value = category.id;
  editingName.value = category.name;
}

function cancelEdit() {
  editingId.value = null;
  editingName.value = '';
}

async function saveEdit(id: string) {
  if (!editingName.value.trim() || isSaving.value) return;

  isSaving.value = true;
  try {
    await (globalThis as any).$fetch(`/api/admin/categories/${id}`, {
      method: 'PUT',
      body: {
        name: editingName.value.trim(),
      },
    });
    editingId.value = null;
    editingName.value = '';
    await refresh();
  } catch (error: any) {
    alert(error.data?.message || 'Failed to update category');
  } finally {
    isSaving.value = false;
  }
}

async function addCategory() {
  if (!newCategoryName.value.trim() || isAdding.value) return;

  isAdding.value = true;
  try {
    await $fetch('/api/admin/categories', {
      method: 'POST',
      body: {
        name: newCategoryName.value.trim(),
        parentId: parentCategoryId.value,
      },
    });
    newCategoryName.value = '';

    // Expand parent if adding subcategory
    if (parentCategoryId.value) {
      expandedCategories.value.add(parentCategoryId.value);
    }

    await refresh();
  } catch (error: any) {
    alert(error.data?.message || 'Failed to add category');
  } finally {
    isAdding.value = false;
  }
}

async function deleteCategory(id: string) {
  if (!confirm('Are you sure you want to delete this category?')) return;

  try {
    await $fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE',
    });
    await refresh();
  } catch (error: any) {
    alert(error.data?.message || 'Failed to delete category');
  }
}
</script>
