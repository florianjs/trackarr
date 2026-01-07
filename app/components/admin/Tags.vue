<template>
  <div class="card">
    <div class="card-header">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon name="ph:tag-bold" class="text-text-muted" />
          <h3
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            Tags
          </h3>
        </div>
        <button
          @click="showAddModal = true"
          class="btn btn-primary !px-3 !py-1 text-[10px]"
        >
          <Icon name="ph:plus-bold" class="mr-1" />
          Add Tag
        </button>
      </div>
    </div>
    <div class="card-body">
      <div v-if="tags && tags.length > 0" class="flex flex-wrap gap-2">
        <div
          v-for="tag in tags"
          :key="tag.id"
          class="group flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-bg-tertiary/50"
        >
          <span
            class="w-3 h-3 rounded-full"
            :style="{ backgroundColor: tag.color }"
          ></span>
          <span
            class="text-xs font-bold uppercase tracking-wider text-text-primary"
          >
            {{ tag.name }}
          </span>
          <button
            @click="deleteTag(tag.id)"
            class="opacity-0 group-hover:opacity-100 text-error hover:text-error/80 transition-opacity"
          >
            <Icon name="ph:x-bold" class="w-3 h-3" />
          </button>
        </div>
      </div>
      <p v-else class="text-xs text-text-muted text-center py-4">
        No tags configured
      </p>
    </div>

    <!-- Add Tag Modal -->
    <Teleport to="body">
      <div
        v-if="showAddModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm"
        @click.self="showAddModal = false"
      >
        <div class="card w-full max-w-md">
          <div class="card-header">
            <h3
              class="text-xs font-bold uppercase tracking-wider text-text-primary"
            >
              Add New Tag
            </h3>
          </div>
          <div class="card-body space-y-4">
            <div>
              <label
                class="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1 block"
              >
                Name
              </label>
              <input
                v-model="newTag.name"
                type="text"
                class="input w-full"
                placeholder="e.g., 1080p"
              />
            </div>
            <div>
              <label
                class="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1 block"
              >
                Slug
              </label>
              <input
                v-model="newTag.slug"
                type="text"
                class="input w-full font-mono"
                placeholder="e.g., 1080p"
              />
            </div>
            <div>
              <label
                class="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1 block"
              >
                Color
              </label>
              <div class="flex gap-2">
                <input
                  v-model="newTag.color"
                  type="color"
                  class="w-10 h-10 rounded border border-border cursor-pointer"
                />
                <input
                  v-model="newTag.color"
                  type="text"
                  class="input flex-1 font-mono"
                  placeholder="#6b7280"
                />
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button @click="showAddModal = false" class="btn btn-secondary">
                Cancel
              </button>
              <button
                @click="createTag"
                :disabled="!newTag.name || !newTag.slug || isCreating"
                class="btn btn-primary"
              >
                <Icon
                  v-if="isCreating"
                  name="ph:circle-notch"
                  class="animate-spin mr-1"
                />
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
interface Tag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

const { data: tags, refresh } = await useFetch<Tag[]>('/api/tags');

const showAddModal = ref(false);
const isCreating = ref(false);
const newTag = ref({
  name: '',
  slug: '',
  color: '#6b7280',
});

// Auto-generate slug from name
watch(
  () => newTag.value.name,
  (name) => {
    if (name && !newTag.value.slug) {
      newTag.value.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
  }
);

async function createTag() {
  if (!newTag.value.name || !newTag.value.slug) return;
  isCreating.value = true;
  try {
    await $fetch('/api/admin/tags', {
      method: 'POST',
      body: newTag.value,
    });
    await refresh();
    showAddModal.value = false;
    newTag.value = { name: '', slug: '', color: '#6b7280' };
  } catch (error: any) {
    console.error('Failed to create tag:', error);
  } finally {
    isCreating.value = false;
  }
}

async function deleteTag(id: string) {
  if (!confirm('Delete this tag?')) return;
  try {
    await $fetch(`/api/admin/tags/${id}`, { method: 'DELETE' });
    await refresh();
  } catch (error: any) {
    console.error('Failed to delete tag:', error);
  }
}
</script>
