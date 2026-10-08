<template>
  <div class="space-y-6">
    <div v-if="pending" class="animate-pulse space-y-6">
      <div class="h-8 w-64 bg-bg-secondary rounded"></div>
      <div class="space-y-4">
        <div
          v-for="i in 3"
          :key="i"
          class="h-32 bg-bg-secondary rounded border border-border"
        ></div>
      </div>
    </div>

    <div v-else-if="topic" class="space-y-6">
      <div class="flex justify-between items-start">
        <div>
          <div
            class="flex items-center gap-2 text-text-muted text-xs mb-2"
          >
            <NuxtLink to="/forum" class="hover:text-white transition-colors"
              >{{ t('forum.title') }}</NuxtLink
            >
            <Icon name="ph:caret-right" />
            <NuxtLink
              :to="`/forum/category/${topic.category.id}`"
              class="hover:text-white transition-colors"
              >{{ topic.category.name }}</NuxtLink
            >
            <Icon name="ph:caret-right" />
            <span>{{ t('forum.topic.breadcrumb') }}</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Icon
              v-if="topic.isPinned"
              name="ph:push-pin-fill"
              class="text-white text-xl"
            />
            <Icon
              v-if="topic.isLocked"
              name="ph:lock-fill"
              class="text-text-muted text-xl"
            />
            {{ topic.title }}
          </h1>
        </div>
        <div v-if="user?.isAdmin || user?.isModerator" class="flex gap-2">
          <button
            @click="handleTogglePin"
            class="px-3 py-1.5 bg-bg-secondary border border-border text-xs font-bold rounded hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <Icon
              :name="topic.isPinned ? 'ph:push-pin-slash' : 'ph:push-pin'"
            />
            {{ topic.isPinned ? t('forum.topic.unpin') : t('forum.topic.pin') }}
          </button>
          <button
            @click="handleToggleLock"
            class="px-3 py-1.5 bg-bg-secondary border border-border text-xs font-bold rounded hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <Icon :name="topic.isLocked ? 'ph:lock-open' : 'ph:lock'" />
            {{ topic.isLocked ? t('forum.topic.unlock') : t('forum.topic.lock') }}
          </button>
          <button
            @click="handleDeleteTopic"
            class="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded hover:bg-red-500/20 transition-colors flex items-center gap-2"
          >
            <Icon name="ph:trash" />
            {{ t('common.delete') }}
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <div
          v-for="post in topic.posts"
          :key="post.id"
          :id="`post-${post.id}`"
          class="bg-bg-secondary border border-border rounded-lg overflow-hidden flex flex-col md:flex-row"
        >
          <!-- Author Sidebar -->
          <div
            class="w-full md:w-48 bg-bg-tertiary/30 p-6 border-b md:border-b-0 md:border-r border-border flex flex-row md:flex-col items-center md:items-start gap-4"
          >
            <UserAvatar :name="post.author.username" :url="post.author.avatarUrl" />
            <div class="flex-1 min-w-0">
              <NuxtLink :to="`/users/${post.author.id}`" class="block font-medium text-sm truncate hover:underline underline-offset-2">
                {{ post.author.username }}
              </NuxtLink>
              <div class="flex flex-wrap gap-1 mt-1">
                <span
                  v-if="post.author.isAdmin"
                  class="text-2xs px-1.5 rounded border border-border text-text-secondary"
                  >{{ t('common.admin') }}</span
                >
                <span
                  v-if="post.author.isModerator"
                  class="text-2xs px-1.5 rounded border border-border text-text-secondary"
                  >{{ t('forum.topic.modBadge') }}</span
                >
              </div>
            </div>
          </div>

          <!-- Post Content -->
          <div class="flex-1 p-6 flex flex-col relative group">
            <div
              class="text-xs text-text-muted mb-3 flex justify-between items-center"
            >
              <span>{{ t('forum.topic.postedOn', { date: formatDate(post.createdAt) }) }}</span>
              <button
                v-if="user?.isAdmin || user?.isModerator"
                @click="handleDeletePost(post.id)"
                class="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400 p-1"
                :title="t('forum.topic.deletePost')"
              >
                <Icon name="ph:trash" class="text-lg" />
              </button>
            </div>
            <div
              class="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap flex-1"
            >
              {{ post.content }}
            </div>
          </div>
        </div>
      </div>

      <!-- Reply Section -->
      <div
        v-if="!topic.isLocked || user?.isAdmin || user?.isModerator"
        class="mt-8 space-y-4"
      >
        <h3 class="text-lg font-bold">{{ t('forum.topic.replyTitle') }}</h3>
        <div
          class="bg-bg-secondary border border-border rounded-lg p-6 space-y-4"
        >
          <textarea
            v-model="replyContent"
            class="w-full bg-bg-tertiary border border-border rounded px-4 py-3 text-sm focus:outline-none focus:border-white/40 transition-colors h-48 resize-none"
            :placeholder="t('forum.topic.replyPlaceholder')"
          ></textarea>
          <div class="flex justify-end">
            <button
              @click="handlePostReply"
              :disabled="!replyContent.trim() || posting"
              class="px-6 py-2 bg-white text-black text-xs font-bold rounded hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {{ posting ? t('forum.topic.posting') : t('forum.topic.postReply') }}
            </button>
          </div>
        </div>
      </div>
      <div
        v-else
        class="mt-8 p-6 bg-bg-tertiary/30 border border-border border-dashed rounded-lg text-center text-text-muted italic"
      >
        {{ t('forum.topic.locked') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n();
const route = useRoute();
const { user } = useUserSession();
const {
  data: topic,
  pending,
  refresh,
} = await useFetch(`/api/forum/topics/${route.params.id}`);

const replyContent = ref('');
const posting = ref(false);

async function handlePostReply() {
  if (!topic.value || !replyContent.value.trim()) return;

  posting.value = true;
  try {
    await $fetch('/api/forum/posts', {
      method: 'POST',
      body: {
        topicId: topic.value.id,
        content: replyContent.value,
      },
    });
    replyContent.value = '';
    await refresh();
  } catch (e) {
    console.error(e);
  } finally {
    posting.value = false;
  }
}

async function handleTogglePin() {
  if (!topic.value) return;
  try {
    await $fetch(`/api/forum/topics/${topic.value.id}/pin`, {
      method: 'PUT',
      body: { isPinned: !topic.value.isPinned },
    });
    await refresh();
  } catch (e) {
    console.error(e);
  }
}

async function handleToggleLock() {
  if (!topic.value) return;
  try {
    await $fetch(`/api/forum/topics/${topic.value.id}/lock`, {
      method: 'PUT',
      body: { isLocked: !topic.value.isLocked },
    });
    await refresh();
  } catch (e) {
    console.error(e);
  }
}

async function handleDeleteTopic() {
  if (!topic.value || !confirm(t('forum.confirmDeleteTopic')))
    return;
  try {
    await $fetch(`/api/forum/topics/${topic.value.id}`, {
      method: 'DELETE',
    });
    navigateTo(`/forum/category/${topic.value.categoryId}`);
  } catch (e) {
    console.error(e);
  }
}

async function handleDeletePost(postId: string) {
  if (!confirm(t('forum.topic.confirmDeletePost'))) return;
  try {
    const res = await $fetch<{ message: string }>(
      `/api/forum/posts/${postId}`,
      {
        method: 'DELETE',
      }
    );
    if (res.message.includes('Topic deleted')) {
      navigateTo(`/forum/category/${topic.value?.categoryId}`);
    } else {
      await refresh();
    }
  } catch (e) {
    console.error(e);
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>
