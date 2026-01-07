<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <div
      class="flex items-center gap-2 text-text-muted text-xs font-mono uppercase tracking-widest"
    >
      <NuxtLink to="/forum" class="hover:text-white transition-colors"
        >Forum</NuxtLink
      >
      <Icon name="ph:caret-right" />
      <span>New Topic</span>
    </div>

    <h1 class="text-2xl font-bold tracking-tight">Create New Topic</h1>

    <div class="bg-bg-secondary border border-border rounded-lg p-8 space-y-6">
      <div class="space-y-2">
        <label
          class="block text-[10px] uppercase tracking-widest text-text-muted font-bold"
          >Category</label
        >
        <select
          v-model="form.categoryId"
          class="w-full bg-bg-tertiary border border-border rounded px-4 py-2.5 text-sm focus:outline-none focus:border-white/40 transition-colors appearance-none"
        >
          <option value="" disabled>Select a category</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
      </div>

      <div class="space-y-2">
        <label
          class="block text-[10px] uppercase tracking-widest text-text-muted font-bold"
          >Title</label
        >
        <input
          v-model="form.title"
          type="text"
          class="w-full bg-bg-tertiary border border-border rounded px-4 py-2.5 text-sm focus:outline-none focus:border-white/40 transition-colors"
          placeholder="What's on your mind?"
        />
      </div>

      <div class="space-y-2">
        <label
          class="block text-[10px] uppercase tracking-widest text-text-muted font-bold"
          >Content</label
        >
        <textarea
          v-model="form.content"
          class="w-full bg-bg-tertiary border border-border rounded px-4 py-3 text-sm focus:outline-none focus:border-white/40 transition-colors h-64 resize-none"
          placeholder="Write your post content here..."
        ></textarea>
      </div>

      <div class="flex justify-end gap-4 pt-4">
        <button
          @click="router.back()"
          class="px-6 py-2 bg-bg-tertiary text-white text-xs font-bold uppercase tracking-wider rounded hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="!isFormValid || submitting"
          class="px-8 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {{ submitting ? 'Creating...' : 'Create Topic' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter();
const route = useRoute();
const { data: categories } = await useFetch('/api/forum/categories');

const form = ref({
  categoryId: (route.query.categoryId as string) || '',
  title: '',
  content: '',
});

const submitting = ref(false);

const isFormValid = computed(() => {
  return (
    form.value.categoryId &&
    form.value.title.trim() &&
    form.value.content.trim()
  );
});

async function handleSubmit() {
  if (!isFormValid.value) return;

  submitting.value = true;
  try {
    const topic = await $fetch('/api/forum/topics', {
      method: 'POST',
      body: form.value,
    });
    router.push(`/forum/topic/${topic?.id}`);
  } catch (e) {
    console.error(e);
  } finally {
    submitting.value = false;
  }
}
</script>
