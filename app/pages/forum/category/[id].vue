<template>
  <div class="space-y-6">
    <div v-if="pending" class="animate-pulse space-y-6">
      <div class="h-8 w-48 bg-bg-secondary rounded"></div>
      <div class="space-y-4">
        <div
          v-for="i in 5"
          :key="i"
          class="h-16 bg-bg-secondary rounded border border-border"
        ></div>
      </div>
    </div>

    <div v-else-if="category" class="space-y-6">
      <div class="flex justify-between items-end">
        <div>
          <div
            class="flex items-center gap-2 text-text-muted text-xs font-mono uppercase tracking-widest mb-2"
          >
            <NuxtLink to="/forum" class="hover:text-white transition-colors"
              >Forum</NuxtLink
            >
            <Icon name="ph:caret-right" />
            <span>Category</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight">{{ category.name }}</h1>
          <p class="text-text-muted text-sm">{{ category.description }}</p>
        </div>
        <div>
          <NuxtLink
            :to="`/forum/new-topic?categoryId=${category.id}`"
            class="px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            <Icon name="ph:plus-bold" />
            New Topic
          </NuxtLink>
        </div>
      </div>

      <div
        class="bg-bg-secondary border border-border rounded-lg overflow-hidden"
      >
        <div
          class="grid grid-cols-12 px-6 py-3 border-b border-border bg-bg-tertiary/50 text-[10px] uppercase tracking-widest font-bold text-text-muted"
        >
          <div class="col-span-7">Topic</div>
          <div class="col-span-2 text-center">Replies</div>
          <div class="col-span-3 text-right">Last Post</div>
        </div>

        <div
          v-if="category.topics.length === 0"
          class="p-12 text-center text-text-muted italic"
        >
          No topics in this category yet.
        </div>

        <div
          v-for="topic in category.topics"
          :key="topic.id"
          class="grid grid-cols-12 px-6 py-4 border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors items-center group"
        >
          <div class="col-span-7 flex items-center gap-4">
            <div class="flex-shrink-0">
              <Icon
                v-if="topic.isPinned"
                name="ph:push-pin-fill"
                class="text-white text-lg"
              />
              <Icon
                v-else-if="topic.isLocked"
                name="ph:lock-fill"
                class="text-text-muted text-lg"
              />
              <Icon
                v-else
                name="ph:chat-centered-text"
                class="text-text-secondary text-lg"
              />
            </div>
            <div>
              <NuxtLink
                :to="`/forum/topic/${topic.id}`"
                class="font-bold hover:text-white transition-colors block"
              >
                {{ topic.title }}
              </NuxtLink>
              <div
                class="text-xs text-text-muted mt-0.5 flex items-center gap-2"
              >
                by
                <span class="text-text-secondary">{{
                  topic.author.username
                }}</span>
                • {{ formatDate(topic.createdAt) }}
                <button
                  v-if="user?.isAdmin || user?.isModerator"
                  @click.stop.prevent="handleDeleteTopic(topic.id)"
                  class="text-red-500 hover:text-red-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete Topic"
                >
                  <Icon name="ph:trash" />
                </button>
              </div>
            </div>
          </div>
          <div class="col-span-2 text-center font-mono text-sm">
            {{ topic.replyCount }}
          </div>
          <div class="col-span-3 text-right">
            <div v-if="topic.posts?.[0]" class="text-xs">
              <div class="text-text-secondary">
                {{ formatDate(topic.updatedAt) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const { user } = useUserSession();
const {
  data: category,
  pending,
  refresh,
} = await useFetch(`/api/forum/categories/${route.params.id}`);

async function handleDeleteTopic(topicId: string) {
  if (!confirm('Are you sure you want to delete this topic?')) return;
  try {
    await $fetch(`/api/forum/topics/${topicId}`, {
      method: 'DELETE',
    });
    await refresh();
  } catch (e) {
    console.error(e);
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
</script>
