<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <Icon name="ph:tag-bold" class="text-text-muted" />
        <h3
          class="text-xs font-bold uppercase tracking-wider text-text-primary"
        >
          {{ t('admin.categories.title') }}
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
          <option :value="null">{{ t('admin.categories.rootCategory') }}</option>
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
              ? t('admin.categories.newSubcategoryPlaceholder')
              : t('admin.categories.newCategoryPlaceholder')
          "
          class="input flex-1 !py-2 text-xs font-bold uppercase tracking-wider"
          @keyup.enter="addCategory"
        />
        <input
          v-model.number="newCategoryNewznabId"
          type="number"
          :placeholder="t('admin.categories.newznabId')"
          min="1000"
          max="9999"
          class="input w-28 !py-2 text-xs font-bold tracking-wider"
          :title="t('admin.categories.newznabIdHint')"
        />
        <button
          class="btn btn-primary !px-6 flex items-center gap-2 uppercase tracking-widest font-bold text-xs"
          :disabled="!newCategoryName.trim() || isAdding"
          @click="addCategory"
        >
          <Icon v-if="isAdding" name="ph:circle-notch" class="animate-spin" />
          <Icon v-else name="ph:plus-bold" />
          <span>{{ t('common.add') }}</span>
        </button>
      </div>

      <div
        v-if="!categories || categories.length === 0"
        class="text-center py-12 border border-dashed border-border rounded bg-bg-primary/30"
      >
        <Icon name="ph:tag-slash" class="text-3xl text-text-muted mb-2" />
        <p
          class="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4"
        >
          {{ t('admin.categories.empty') }}
        </p>
        <button
          class="btn btn-primary !px-4 !py-2 text-xs font-bold uppercase tracking-wider"
          :disabled="isSeeding"
          @click="seedCategories"
        >
          <Icon
            v-if="isSeeding"
            name="ph:circle-notch"
            class="animate-spin mr-2"
          />
          <Icon v-else name="ph:plant" class="mr-2" />
          {{ t('admin.categories.seed') }}
        </button>
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
                <div
                  v-if="editingId === category.id"
                  class="flex items-center gap-2"
                >
                  <input
                    v-model="editingName"
                    type="text"
                    class="input !py-1 !px-2 text-xs font-bold uppercase tracking-wider w-40"
                    @keyup.enter="saveEdit(category.id)"
                    @keyup.escape="cancelEdit"
                  />
                  <input
                    v-model.number="editingNewznabId"
                    type="number"
                    :placeholder="t('admin.categories.nzId')"
                    min="1000"
                    max="9999"
                    class="input !py-1 !px-2 text-xs font-bold tracking-wider w-20"
                    :title="t('admin.categories.newznabIdTitle')"
                  />
                  <button
                    class="p-1 text-success hover:bg-success/10 rounded transition-colors"
                    :disabled="isSaving"
                    @click="saveEdit(category.id)"
                  >
                    <Icon
                      v-if="isSaving"
                      name="ph:circle-notch"
                      class="animate-spin"
                    />
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
                    <span
                      v-if="category.newznabId"
                      class="text-text-muted font-mono text-[10px] ml-2"
                    >
                      [{{ category.newznabId }}]
                    </span>
                  </p>
                  <p class="text-[10px] font-mono text-text-muted">
                    {{ category.slug }}
                    <span
                      v-if="category.subcategories?.length"
                      class="ml-2 text-text-muted/60"
                    >
                      ({{
                        t(
                          'admin.categories.subcategoriesCount',
                          category.subcategories.length
                        )
                      }})
                    </span>
                  </p>
                </template>
              </div>
            </div>
            <div
              v-if="editingId !== category.id"
              class="flex items-center gap-1 opacity-0 group-hover:opacity-100"
            >
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
                  <div
                    v-if="editingId === subcategory.id"
                    class="flex items-center gap-2"
                  >
                    <input
                      v-model="editingName"
                      type="text"
                      class="input !py-1 !px-2 text-xs font-bold uppercase tracking-wider w-40"
                      @keyup.enter="saveEdit(subcategory.id)"
                      @keyup.escape="cancelEdit"
                    />
                    <input
                      v-model.number="editingNewznabId"
                      type="number"
                      :placeholder="t('admin.categories.nzId')"
                      min="1000"
                      max="9999"
                      class="input !py-1 !px-2 text-xs font-bold tracking-wider w-20"
                      :title="t('admin.categories.newznabIdTitle')"
                    />
                    <button
                      class="p-1 text-success hover:bg-success/10 rounded transition-colors"
                      :disabled="isSaving"
                      @click="saveEdit(subcategory.id)"
                    >
                      <Icon
                        v-if="isSaving"
                        name="ph:circle-notch"
                        class="animate-spin"
                      />
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
                      <span
                        v-if="subcategory.newznabId"
                        class="text-text-muted font-mono text-[10px] ml-2"
                      >
                        [{{ subcategory.newznabId }}]
                      </span>
                    </p>
                    <p class="text-[10px] font-mono text-text-muted">
                      {{ subcategory.slug }}
                    </p>
                  </template>
                </div>
              </div>
              <div
                v-if="editingId !== subcategory.id"
                class="flex items-center gap-1 opacity-0 group-hover:opacity-100"
              >
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
const { t } = useI18n();

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  newznabId: number | null;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  newznabId: number | null;
  createdAt: string;
  subcategories?: Subcategory[];
}

const { data: categories, refresh } =
  await useFetch<Category[]>('/api/categories');

const newCategoryName = ref('');
const newCategoryNewznabId = ref<number | null>(null);
const parentCategoryId = ref<string | null>(null);
const isAdding = ref(false);
const expandedCategories = ref(new Set<string>());
const editingId = ref<string | null>(null);
const editingName = ref('');
const editingNewznabId = ref<number | null>(null);
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
  editingNewznabId.value = category.newznabId;
}

function cancelEdit() {
  editingId.value = null;
  editingName.value = '';
  editingNewznabId.value = null;
}

async function saveEdit(id: string) {
  if (!editingName.value.trim() || isSaving.value) return;

  isSaving.value = true;
  try {
    await (globalThis as any).$fetch(`/api/admin/categories/${id}`, {
      method: 'PUT',
      body: {
        name: editingName.value.trim(),
        newznabId: editingNewznabId.value,
      },
    });
    editingId.value = null;
    editingName.value = '';
    editingNewznabId.value = null;
    await refresh();
  } catch (error: any) {
    alert(error.data?.message || t('admin.categories.updateFailed'));
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
        newznabId: newCategoryNewznabId.value,
      },
    });
    newCategoryName.value = '';
    newCategoryNewznabId.value = null;

    // Expand parent if adding subcategory
    if (parentCategoryId.value) {
      expandedCategories.value.add(parentCategoryId.value);
    }

    await refresh();
  } catch (error: any) {
    alert(error.data?.message || t('admin.categories.addFailed'));
  } finally {
    isAdding.value = false;
  }
}

async function deleteCategory(id: string) {
  if (!confirm(t('admin.categories.confirmDelete'))) return;

  try {
    await $fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE',
    });
    await refresh();
  } catch (error: any) {
    alert(error.data?.message || t('admin.categories.deleteFailed'));
  }
}

const isSeeding = ref(false);

async function seedCategories() {
  if (
    !confirm(t('admin.categories.confirmSeed'))
  )
    return;

  isSeeding.value = true;
  try {
    const result = await (globalThis as any).$fetch(
      '/api/admin/categories/seed',
      {
        method: 'POST',
      }
    );
    await refresh();
    alert(t('admin.categories.seeded', result.created));
  } catch (error: any) {
    alert(error.data?.message || t('admin.categories.seedFailed'));
  } finally {
    isSeeding.value = false;
  }
}
</script>
