<template>
  <div class="card overflow-hidden grid md:grid-cols-[19rem_1fr] h-[calc(100dvh-10rem)] min-h-[28rem]">
    <!-- Conversations -->
    <aside
      class="flex flex-col min-h-0 border-r border-border"
      :class="activeId || composing ? 'hidden md:flex' : 'flex'"
      :aria-label="t('messages.title')"
    >
      <div class="h-14 shrink-0 flex items-center justify-between gap-2 px-4 border-b border-border">
        <h1 class="text-base font-semibold">{{ t('messages.title') }}</h1>
        <NuxtLink :to="{ query: { new: '1' } }" class="btn btn-secondary !px-2.5" :title="t('messages.new')">
          <Icon name="ph:note-pencil" aria-hidden="true" />
          <span class="sr-only sm:not-sr-only">{{ t('messages.new') }}</span>
        </NuxtLink>
      </div>

      <ul v-if="conversations?.length" class="flex-1 overflow-y-auto divide-y divide-border">
        <li v-for="c in conversations" :key="c.id">
          <NuxtLink
            :to="{ query: { c: c.id } }"
            class="flex gap-3 px-4 py-3 hover:bg-bg-hover/60 transition-colors"
            :class="c.id === activeId && 'bg-bg-hover'"
            :aria-current="c.id === activeId ? 'page' : undefined"
          >
            <UserAvatar :name="c.other?.username" :url="c.other?.avatarUrl" />
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <span class="truncate text-sm" :class="c.unread ? 'font-semibold text-text-primary' : 'text-text-primary'">
                  {{ c.other?.username ?? t('messages.deletedUser') }}
                </span>
                <span class="num text-2xs text-text-muted shrink-0">{{ formatAge(String(c.lastMessageAt)) }}</span>
              </div>
              <p class="text-xs truncate" :class="c.unread ? 'text-text-secondary' : 'text-text-muted'">
                <span v-if="c.lastFromMe">{{ t('messages.you') }}</span>{{ c.preview }}
              </p>
            </div>
            <span v-if="c.unread" class="mt-1.5 w-2 h-2 rounded-full bg-white shrink-0" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
      <div v-else class="flex-1 p-6 text-sm text-text-muted">
        <p>{{ t('messages.empty') }}</p>
        <p class="mt-1">{{ t('messages.emptyHint') }}</p>
      </div>
    </aside>

    <!-- New conversation -->
    <section v-if="composing" class="flex flex-col min-h-0">
      <div class="h-14 shrink-0 flex items-center gap-2 px-4 border-b border-border">
        <NuxtLink to="/messages" class="md:hidden p-1.5 -ml-1.5 rounded btn-ghost" :aria-label="t('messages.back')">
          <Icon name="ph:arrow-left" class="block" />
        </NuxtLink>
        <h2 class="text-base font-semibold">{{ t('messages.new') }}</h2>
      </div>
      <form class="flex-1 flex flex-col gap-3 p-4" @submit.prevent="startConversation">
        <label class="block">
          <span class="text-xs text-text-muted">{{ t('messages.to') }}</span>
          <input v-model="draftTo" type="text" class="input w-full mt-1" :placeholder="t('messages.toPlaceholder')" autocomplete="off" required />
        </label>
        <textarea
          v-model="draft"
          class="input w-full flex-1 min-h-[8rem] resize-none"
          :placeholder="t('messages.bodyPlaceholder')"
          maxlength="5000"
          @keydown.enter.exact.prevent="startConversation"
        />
        <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
        <div class="flex items-center justify-between gap-3">
          <span class="hidden sm:block text-xs text-text-muted">{{ t('messages.sendHint') }}</span>
          <button type="submit" class="btn btn-primary ml-auto" :disabled="sending || !draft.trim() || !draftTo.trim()">
            <Icon name="ph:paper-plane-right" aria-hidden="true" />{{ sending ? t('messages.sending') : t('messages.send') }}
          </button>
        </div>
      </form>
    </section>

    <!-- Thread -->
    <section v-else-if="activeId && thread" class="flex flex-col min-h-0">
      <div class="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-border">
        <NuxtLink to="/messages" class="md:hidden p-1.5 -ml-1.5 rounded btn-ghost" :aria-label="t('messages.back')">
          <Icon name="ph:arrow-left" class="block" />
        </NuxtLink>
        <UserAvatar :name="thread.other?.username" :url="thread.other?.avatarUrl" size="sm" />
        <NuxtLink
          v-if="thread.other"
          :to="`/users/${thread.other.id}`"
          class="text-sm font-medium hover:underline underline-offset-2 truncate"
          :title="t('messages.profile')"
        >{{ thread.other.username }}</NuxtLink>
        <span v-else class="text-sm text-text-muted">{{ t('messages.deletedUser') }}</span>
        <div class="ml-auto flex items-center gap-1">
          <button
            v-if="thread.other"
            type="button"
            class="p-1.5 rounded btn-ghost"
            :title="thread.iBlocked ? t('messages.unblock') : t('messages.block')"
            :aria-label="thread.iBlocked ? t('messages.unblock') : t('messages.block')"
            @click="toggleBlock"
          >
            <Icon :name="thread.iBlocked ? 'ph:user-check' : 'ph:prohibit'" class="block" />
          </button>
          <button
            type="button"
            class="p-1.5 rounded btn-ghost"
            :title="t('messages.hide')"
            :aria-label="t('messages.hide')"
            @click="hideConversation"
          >
            <Icon name="ph:eye-slash" class="block" />
          </button>
        </div>
      </div>

      <div ref="scroller" class="flex-1 overflow-y-auto px-4 py-4 space-y-1" aria-live="polite">
        <div v-if="thread.hasMore" class="text-center pb-3">
          <button type="button" class="btn btn-ghost text-xs" @click="loadEarlier">{{ t('messages.loadEarlier') }}</button>
        </div>
        <template v-for="(m, i) in thread.messages" :key="m.id">
          <p
            v-if="i === 0 || dayKey(m.createdAt) !== dayKey(thread.messages[i - 1]!.createdAt)"
            class="text-center text-2xs text-text-muted py-2"
          >{{ formatDay(m.createdAt) }}</p>
          <div class="flex" :class="m.mine ? 'justify-end' : 'justify-start'">
            <div
              class="max-w-[min(34rem,85%)] rounded-lg px-3 py-2 text-sm"
              :class="m.mine ? 'bg-bg-hover text-text-primary' : 'bg-bg-primary border border-border text-text-primary'"
            >
              <!-- Plain text: interpolated, never rendered as HTML -->
              <p class="whitespace-pre-wrap break-words">{{ m.body }}</p>
              <p class="num text-2xs text-text-muted mt-1 text-right">{{ formatTime(m.createdAt) }}</p>
            </div>
          </div>
        </template>
      </div>

      <div class="shrink-0 border-t border-border p-3">
        <p v-if="thread.iBlocked" class="text-sm text-text-muted px-1 py-2">{{ t('messages.youBlocked') }}</p>
        <p v-else-if="thread.blockedMe" class="text-sm text-text-muted px-1 py-2">{{ t('messages.blockedYou') }}</p>
        <form v-else class="flex items-end gap-2" @submit.prevent="reply">
          <textarea
            v-model="draft"
            rows="1"
            class="input flex-1 resize-none max-h-40"
            :placeholder="t('messages.bodyPlaceholder')"
            maxlength="5000"
            :aria-label="t('messages.bodyPlaceholder')"
            @input="autoGrow"
            @keydown.enter.exact.prevent="reply"
          />
          <button type="submit" class="btn btn-primary" :disabled="sending || !draft.trim()" :aria-label="t('messages.send')">
            <Icon name="ph:paper-plane-right" aria-hidden="true" />
          </button>
        </form>
        <p v-if="error" class="text-sm text-danger mt-2" role="alert">{{ error }}</p>
      </div>
    </section>

    <!-- Nothing selected -->
    <section v-else class="hidden md:flex items-center justify-center p-6 text-sm text-text-muted">
      {{ t('messages.select') }}
    </section>
  </div>
</template>

<script setup lang="ts">
interface ConversationRow {
  id: string;
  lastMessageAt: string;
  other: { id: string; username: string; avatarUrl: string | null } | null;
  preview: string;
  lastFromMe: boolean;
  unread: boolean;
}
interface Message {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  mine: boolean;
}
interface Thread {
  id: string;
  other: { id: string; username: string; avatarUrl: string | null } | null;
  iBlocked: boolean;
  blockedMe: boolean;
  hasMore: boolean;
  messages: Message[];
}

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const { refresh: refreshUnread } = useUnreadMessages();
useHead({ title: () => t('messages.title') });

const activeId = computed(() => (typeof route.query.c === 'string' ? route.query.c : null));
const composing = computed(() => route.query.new === '1' || typeof route.query.to === 'string');

const { data: conversations, refresh: refreshList } = await useFetch<ConversationRow[]>('/api/messages', {
  default: () => [],
});

const thread = ref<Thread | null>(null);
const scroller = ref<HTMLElement | null>(null);
const draft = ref('');
const draftTo = ref(typeof route.query.to === 'string' ? route.query.to : '');
const sending = ref(false);
const error = ref<string | null>(null);

function errorText(err: unknown): string {
  return (err as { data?: { message?: string } }).data?.message ?? 'Error';
}

async function scrollToBottom() {
  await nextTick();
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight });
}

async function loadThread(scroll = true) {
  if (!activeId.value) {
    thread.value = null;
    return;
  }
  const atBottom =
    !scroller.value ||
    scroller.value.scrollHeight - scroller.value.scrollTop - scroller.value.clientHeight < 80;
  const data = await $fetch<Thread>(`/api/messages/${activeId.value}`).catch(() => null);
  if (!data) {
    router.replace('/messages');
    return;
  }
  // Keep earlier pages already loaded
  const known = thread.value?.id === data.id ? thread.value.messages : [];
  const newest = new Set(data.messages.map((m) => m.id));
  thread.value = { ...data, messages: [...known.filter((m) => !newest.has(m.id)), ...data.messages] };
  refreshUnread();
  if (scroll || atBottom) scrollToBottom();
}

async function loadEarlier() {
  if (!thread.value?.messages.length) return;
  const before = thread.value.messages[0]!.createdAt;
  const page = await $fetch<Thread>(`/api/messages/${thread.value.id}`, { query: { before } });
  const height = scroller.value?.scrollHeight ?? 0;
  thread.value = { ...thread.value, hasMore: page.hasMore, messages: [...page.messages, ...thread.value.messages] };
  await nextTick();
  // Keep the reading position when older messages are prepended
  if (scroller.value) scroller.value.scrollTop += scroller.value.scrollHeight - height;
}

watch(activeId, () => {
  draft.value = '';
  error.value = null;
  thread.value = null;
  loadThread();
}, { immediate: true });

watch(() => route.query.to, (to) => {
  if (typeof to === 'string') draftTo.value = to;
});

async function reply() {
  if (!thread.value || !draft.value.trim() || sending.value) return;
  sending.value = true;
  error.value = null;
  try {
    await $fetch(`/api/messages/${thread.value.id}`, { method: 'POST', body: { body: draft.value } });
    draft.value = '';
    await Promise.all([loadThread(), refreshList()]);
  } catch (err) {
    error.value = errorText(err);
  } finally {
    sending.value = false;
  }
}

async function startConversation() {
  if (!draft.value.trim() || !draftTo.value.trim() || sending.value) return;
  sending.value = true;
  error.value = null;
  try {
    const res = await $fetch<{ conversationId: string }>('/api/messages', {
      method: 'POST',
      body: { to: draftTo.value.trim(), body: draft.value },
    });
    draft.value = '';
    await refreshList();
    router.push({ query: { c: res.conversationId } });
  } catch (err) {
    error.value = errorText(err);
  } finally {
    sending.value = false;
  }
}

async function toggleBlock() {
  if (!thread.value?.other) return;
  const blocked = !thread.value.iBlocked;
  if (blocked && !confirm(t('messages.confirmBlock', { name: thread.value.other.username }))) return;
  error.value = null;
  try {
    await $fetch('/api/messages/block', { method: 'POST', body: { userId: thread.value.other.id, blocked } });
    thread.value.iBlocked = blocked;
  } catch (err) {
    error.value = errorText(err);
  }
}

async function hideConversation() {
  if (!thread.value || !confirm(t('messages.confirmHide'))) return;
  error.value = null;
  try {
    await $fetch(`/api/messages/${thread.value.id}`, { method: 'DELETE' });
  } catch (err) {
    error.value = errorText(err);
    return;
  }
  await refreshList();
  router.replace('/messages');
}

function autoGrow(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

const dayKey = (iso: string) => new Date(iso).toDateString();
const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(locale.value, { weekday: 'long', day: 'numeric', month: 'long' });
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });

// New messages while the page is open
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  poll = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    refreshList();
    if (activeId.value) loadThread(false);
  }, 15_000);
});
onUnmounted(() => clearInterval(poll));
</script>
