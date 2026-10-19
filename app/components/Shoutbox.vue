<template>
  <section class="card overflow-hidden flex flex-col" :class="compact ? 'h-[26rem]' : 'h-[calc(100dvh-10rem)] min-h-[28rem]'">
    <!-- Channels -->
    <div class="shrink-0 flex items-center gap-1 px-2 border-b border-border overflow-x-auto" role="tablist" :aria-label="t('shoutbox.channels')">
      <h2 v-if="compact" class="px-2 text-sm font-semibold shrink-0">
        <NuxtLink to="/shoutbox" class="hover:underline underline-offset-2">{{ t('shoutbox.title') }}</NuxtLink>
      </h2>
      <button
        v-for="c in channels"
        :key="c.id"
        type="button"
        role="tab"
        class="shrink-0 px-3 py-3 text-sm border-b-2 -mb-px transition-colors"
        :class="c.id === activeId ? 'border-text-primary text-text-primary font-medium' : 'border-transparent text-text-muted hover:text-text-primary'"
        :aria-selected="c.id === activeId"
        :title="c.description ?? undefined"
        @click="selectChannel(c.id)"
      >
        <Icon v-if="!c.canWrite" name="ph:megaphone-simple" class="mr-1 -mt-0.5" aria-hidden="true" />{{ c.name }}
      </button>
    </div>

    <!-- Messages -->
    <div ref="scroller" class="flex-1 overflow-y-auto px-3 py-2" aria-live="polite" @scroll="onScroll">
      <p v-if="loadError" class="text-sm text-danger p-3" role="alert">{{ loadError }}</p>
      <template v-else-if="feed">
        <div v-if="feed.hasMore" class="text-center py-2">
          <button type="button" class="btn btn-ghost text-xs" :disabled="loadingOlder" @click="loadOlder">{{ t('shoutbox.loadEarlier') }}</button>
        </div>
        <p v-if="!feed.messages.length" class="text-sm text-text-muted p-3">{{ t('shoutbox.empty') }}</p>
        <article
          v-for="m in feed.messages"
          :key="m.id"
          class="group relative flex gap-2.5 rounded px-2 py-1.5 hover:bg-bg-hover/50"
        >
          <UserAvatar :name="m.author.username" :url="m.author.avatarUrl" size="sm" />
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <NuxtLink
                :to="`/users/${m.author.id}`"
                class="text-sm font-medium hover:underline underline-offset-2 truncate"
                :style="m.author.color ? { color: m.author.color } : undefined"
              >{{ m.author.username }}</NuxtLink>
              <Icon v-if="m.author.isStaff" name="ph:shield-check" class="text-xs text-text-muted shrink-0" :aria-label="t('shoutbox.staff')" />
              <time class="num text-2xs text-text-muted shrink-0" :datetime="m.createdAt" :title="formatFull(m.createdAt)">{{ formatTime(m.createdAt) }}</time>
            </div>
            <!-- Plain text: interpolated, never rendered as HTML -->
            <p v-if="m.body !== null" class="text-sm text-text-primary whitespace-pre-wrap break-words">{{ m.body }}</p>
            <p v-else class="text-sm italic text-text-muted">
              {{ m.deleted === 'moderation' ? t('shoutbox.deletedByModeration') : t('shoutbox.deleted') }}
            </p>

            <!-- Reactions -->
            <div v-if="m.body !== null && (m.reactions.length || feed.canReact)" class="flex flex-wrap items-center gap-1 mt-1">
              <button
                v-for="r in m.reactions"
                :key="r.emoji"
                type="button"
                class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors"
                :class="r.mine ? 'border-text-secondary bg-bg-hover' : 'border-border hover:bg-bg-hover/60'"
                :disabled="!feed.canReact"
                :aria-pressed="r.mine"
                :aria-label="t('shoutbox.reactionLabel', { emoji: r.emoji, n: r.count }, r.count)"
                @click="react(m.id, r.emoji)"
              >
                <span>{{ r.emoji }}</span><span class="num text-text-muted">{{ r.count }}</span>
              </button>
              <button
                v-if="feed.canReact"
                type="button"
                class="rounded-full border border-border px-1.5 py-0.5 text-xs text-text-muted hover:text-text-primary transition-opacity"
                :class="pickerFor === m.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'"
                :aria-label="t('shoutbox.addReaction')"
                :aria-expanded="pickerFor === m.id"
                @click="pickerFor = pickerFor === m.id ? null : m.id"
              >
                <Icon name="ph:smiley" class="block" aria-hidden="true" />
              </button>
            </div>
            <!-- Inline, not a popover: the scrolling list would clip it -->
            <div v-if="pickerFor === m.id" class="mt-1.5 card p-2 w-60">
              <div class="grid grid-cols-8 gap-0.5">
                <button
                  v-for="emoji in QUICK_EMOJIS"
                  :key="emoji"
                  type="button"
                  class="rounded hover:bg-bg-hover p-0.5 text-base"
                  @click="react(m.id, emoji)"
                >{{ emoji }}</button>
              </div>
              <form class="flex gap-1 mt-2" @submit.prevent="react(m.id, customEmoji)">
                <input v-model="customEmoji" type="text" maxlength="32" class="input flex-1 !py-1 text-sm" :placeholder="t('shoutbox.otherEmoji')" :aria-label="t('shoutbox.otherEmoji')" />
                <button type="submit" class="btn btn-secondary !py-1 !px-2 text-xs" :disabled="!customEmoji.trim()">OK</button>
              </form>
            </div>

            <!-- Moderation: mute form -->
            <form v-if="muteFor === m.id" class="flex flex-wrap items-center gap-2 mt-2 p-2 rounded border border-border bg-bg-primary" @submit.prevent="mute(m.author.id)">
              <select v-model.number="muteMinutes" class="input !py-1 text-xs" :aria-label="t('shoutbox.muteDuration')">
                <option v-for="d in MUTE_DURATIONS" :key="d" :value="d">{{ t(`shoutbox.durations.${d}`) }}</option>
              </select>
              <input v-model="muteReason" type="text" maxlength="200" class="input flex-1 min-w-[8rem] !py-1 text-xs" :placeholder="t('shoutbox.muteReason')" />
              <button type="submit" class="btn btn-primary !py-1 !px-2 text-xs">{{ t('shoutbox.mute') }}</button>
              <button type="button" class="btn btn-ghost !py-1 !px-2 text-xs" @click="muteFor = null">{{ t('shoutbox.cancel') }}</button>
            </form>
          </div>

          <!-- Message actions -->
          <div v-if="m.canDelete || canMute(m)" class="absolute right-1 top-1 hidden group-hover:flex group-focus-within:flex gap-0.5 card px-1 py-0.5">
            <button
              v-if="canMute(m)"
              type="button"
              class="p-1 rounded btn-ghost"
              :title="t('shoutbox.muteUser', { name: m.author.username })"
              :aria-label="t('shoutbox.muteUser', { name: m.author.username })"
              @click="openMute(m.id)"
            >
              <Icon name="ph:speaker-simple-slash" class="block text-xs" />
            </button>
            <button
              v-if="m.canDelete"
              type="button"
              class="p-1 rounded btn-ghost"
              :title="t('shoutbox.delete')"
              :aria-label="t('shoutbox.delete')"
              @click="remove(m.id)"
            >
              <Icon name="ph:trash" class="block text-xs" />
            </button>
          </div>
        </article>
      </template>
    </div>

    <!-- Compose -->
    <div class="shrink-0 border-t border-border p-2.5">
      <p v-if="mutedUntil" class="text-sm text-text-muted px-1 py-1.5">
        <Icon name="ph:speaker-simple-slash" class="mr-1 -mt-0.5" aria-hidden="true" />{{ t('shoutbox.mutedUntil', { date: formatFull(mutedUntil) }) }}
      </p>
      <p v-else-if="active && !active.canWrite" class="text-sm text-text-muted px-1 py-1.5">{{ t('shoutbox.readOnly') }}</p>
      <form v-else-if="active" class="flex items-end gap-2" @submit.prevent="send">
        <textarea
          v-model="draft"
          rows="1"
          class="input flex-1 resize-none max-h-28"
          :placeholder="t('shoutbox.placeholder', { channel: active.name })"
          :maxlength="MAX_LENGTH"
          :aria-label="t('shoutbox.placeholder', { channel: active.name })"
          @input="autoGrow"
          @keydown.enter.exact.prevent="send"
        />
        <button type="submit" class="btn btn-primary" :disabled="sending || !draft.trim()" :aria-label="t('shoutbox.send')">
          <Icon name="ph:paper-plane-right" aria-hidden="true" />
        </button>
      </form>
      <p v-if="error" class="text-sm text-danger mt-1.5 px-1" role="alert">{{ error }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Channel {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  canWrite: boolean;
  canReact: boolean;
}
interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}
interface Shout {
  id: string;
  body: string | null;
  createdAt: string;
  deleted: 'author' | 'moderation' | null;
  author: { id: string; username: string; avatarUrl: string | null; color: string | null; isStaff: boolean };
  reactions: Reaction[];
  canDelete: boolean;
}
interface Feed {
  messages: Shout[];
  hasMore: boolean;
  canWrite: boolean;
  canReact: boolean;
  canModerate: boolean;
}
type FeedResponse = { version: string | null } & ({ unchanged: true } | (Feed & { unchanged?: undefined }));

defineProps<{ compact?: boolean }>();

const MAX_LENGTH = 500;
const POLL_MS = 4000;
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀', '🙏', '👏', '💯', '🚀', '🤔', '😍', '👎', '✅'];
const MUTE_DURATIONS = [10, 60, 1440, 10080] as const;
const STORAGE_KEY = 'shoutbox:channel';

const { t, locale } = useI18n();
const { user } = useUserSession();

const channels = ref<Channel[]>([]);
const mutedUntil = ref<string | null>(null);
const activeId = ref<string | null>(null);
const feed = ref<Feed | null>(null);
const version = ref<string | null>(null);
const loadError = ref('');
const error = ref('');
const draft = ref('');
const sending = ref(false);
const loadingOlder = ref(false);
const pickerFor = ref<string | null>(null);
const customEmoji = ref('');
const muteFor = ref<string | null>(null);
const muteMinutes = ref<number>(60);
const muteReason = ref('');
const scroller = ref<HTMLElement | null>(null);
let stickToBottom = true;

const active = computed(() => channels.value.find((c) => c.id === activeId.value) ?? null);

function apiError(err: unknown): string {
  return (err as { data?: { message?: string } }).data?.message ?? t('shoutbox.error');
}

function canMute(m: Shout): boolean {
  return Boolean(feed.value?.canModerate && !m.author.isStaff && m.author.id !== user.value?.id);
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function loadChannels() {
  try {
    const data = await $fetch<{ channels: Channel[]; mutedUntil: string | null }>('/api/shoutbox/channels');
    channels.value = data.channels;
    mutedUntil.value = data.mutedUntil;
    if (!channels.value.some((c) => c.id === activeId.value)) {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(STORAGE_KEY);
      } catch {
        // Storage unavailable: start on the first channel
      }
      activeId.value = channels.value.find((c) => c.id === saved)?.id ?? channels.value[0]?.id ?? null;
    }
  } catch (err) {
    loadError.value = apiError(err);
  }
}

async function loadFeed(initial: boolean) {
  const channelId = activeId.value;
  if (!channelId) return;
  try {
    const data = await $fetch<FeedResponse>(`/api/shoutbox/channels/${channelId}/messages`, {
      query: initial || !version.value ? {} : { v: version.value },
    });
    // The member switched channel while this request was in flight
    if (channelId !== activeId.value || data.unchanged) return;
    const keepOlder = feed.value && !initial ? olderThanPage(feed.value.messages, data.messages) : [];
    feed.value = { ...data, messages: [...keepOlder, ...data.messages] };
    version.value = data.version;
    loadError.value = '';
    if (initial || stickToBottom) scrollToBottom();
  } catch (err) {
    if (initial) loadError.value = apiError(err);
  }
}

/** Messages loaded with "earlier" that a refresh of the latest page would drop */
function olderThanPage(current: Shout[], page: Shout[]): Shout[] {
  const first = page[0];
  if (!first) return [];
  return current.filter((m) => m.createdAt < first.createdAt);
}

async function loadOlder() {
  const oldest = feed.value?.messages[0];
  if (!feed.value || !oldest || !activeId.value) return;
  loadingOlder.value = true;
  const el = scroller.value;
  const fromBottom = el ? el.scrollHeight - el.scrollTop : 0;
  try {
    const data = await $fetch<Feed>(`/api/shoutbox/channels/${activeId.value}/messages`, {
      query: { before: oldest.createdAt },
    });
    feed.value = { ...feed.value, hasMore: data.hasMore, messages: [...data.messages, ...feed.value.messages] };
    // Keep the message the member was looking at in place
    await nextTick();
    if (el) el.scrollTop = el.scrollHeight - fromBottom;
  } catch (err) {
    error.value = apiError(err);
  } finally {
    loadingOlder.value = false;
  }
}

function selectChannel(id: string) {
  if (id === activeId.value) return;
  activeId.value = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Not remembered: fine
  }
}

watch(activeId, () => {
  feed.value = null;
  version.value = null;
  pickerFor.value = null;
  muteFor.value = null;
  error.value = '';
  loadFeed(true);
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function send() {
  const body = draft.value.trim();
  if (!body || !activeId.value || sending.value) return;
  sending.value = true;
  error.value = '';
  try {
    await $fetch(`/api/shoutbox/channels/${activeId.value}/messages`, { method: 'POST', body: { body } });
    draft.value = '';
    stickToBottom = true;
    await loadFeed(false);
  } catch (err) {
    error.value = apiError(err);
    // Muted in the meantime: show the banner
    const until = (err as { data?: { data?: { mutedUntil?: string } } }).data?.data?.mutedUntil;
    if (until) mutedUntil.value = until;
  } finally {
    sending.value = false;
  }
}

async function react(messageId: string, emoji: string) {
  const value = emoji.trim();
  if (!value) return;
  pickerFor.value = null;
  customEmoji.value = '';
  try {
    await $fetch(`/api/shoutbox/messages/${messageId}/reactions`, { method: 'POST', body: { emoji: value } });
    await loadFeed(false);
  } catch (err) {
    error.value = apiError(err);
  }
}

async function remove(messageId: string) {
  try {
    await $fetch(`/api/shoutbox/messages/${messageId}`, { method: 'DELETE' });
    await loadFeed(false);
  } catch (err) {
    error.value = apiError(err);
  }
}

function openMute(messageId: string) {
  muteFor.value = messageId;
  muteMinutes.value = 60;
  muteReason.value = '';
}

async function mute(userId: string) {
  try {
    await $fetch('/api/mod/shoutbox/mutes', {
      method: 'POST',
      body: { userId, minutes: muteMinutes.value, reason: muteReason.value || undefined },
    });
    muteFor.value = null;
  } catch (err) {
    error.value = apiError(err);
  }
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function onScroll() {
  const el = scroller.value;
  if (el) stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
}

async function scrollToBottom() {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
}

function autoGrow(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
}

const formatTime = (iso: string) => {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(locale.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const formatFull = (iso: string) =>
  new Date(iso).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' });

// ---------------------------------------------------------------------------
// Polling: only while the tab is visible; an unchanged channel costs an
// empty response
// ---------------------------------------------------------------------------

let poll: ReturnType<typeof setInterval> | undefined;
let channelsPoll: ReturnType<typeof setInterval> | undefined;
onMounted(async () => {
  await loadChannels();
  poll = setInterval(() => {
    if (document.visibilityState === 'visible') loadFeed(false);
  }, POLL_MS);
  // Rights, new channels and mutes change rarely
  channelsPoll = setInterval(() => {
    if (document.visibilityState === 'visible') loadChannels();
  }, 60_000);
});
onUnmounted(() => {
  clearInterval(poll);
  clearInterval(channelsPoll);
});
</script>
