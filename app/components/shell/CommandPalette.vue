<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[60] bg-scrim/50 flex items-start justify-center px-4 pt-[12vh]"
        @mousedown.self="close"
      >
        <div
          class="w-full max-w-xl card shadow-2xl shadow-scrim/20 overflow-hidden"
          role="dialog"
          aria-modal="true"
          :aria-label="t('shell.search.trigger')"
        >
          <div class="flex items-center gap-3 px-4 border-b border-border">
            <Icon name="ph:magnifying-glass" class="text-text-muted shrink-0" aria-hidden="true" />
            <input
              ref="input"
              v-model="query"
              type="text"
              class="flex-1 bg-transparent py-3.5 text-[15px] text-text-primary placeholder-text-muted focus:outline-none focus-visible:ring-0"
              :placeholder="t('shell.search.placeholder')"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="palette-results"
              :aria-activedescendant="items[active] ? `palette-item-${active}` : undefined"
              @keydown.down.prevent="move(1)"
              @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="choose(items[active])"
              @keydown.esc.prevent="close"
            />
            <kbd class="hidden sm:block text-2xs num text-text-muted border border-border rounded px-1.5 py-0.5">Esc</kbd>
          </div>

          <ul id="palette-results" class="max-h-[50vh] overflow-y-auto py-2" role="listbox">
            <template v-for="(section, s) in sections" :key="s">
              <li v-if="section.items.length" class="px-4 pt-2 pb-1 text-xs text-text-muted" role="presentation">
                {{ section.title }}
              </li>
              <li
                v-for="item in section.items"
                :id="`palette-item-${item.index}`"
                :key="item.key"
                role="option"
                :aria-selected="item.index === active"
                class="mx-2 px-2 py-2 rounded flex items-center gap-3 cursor-pointer text-sm"
                :class="item.index === active ? 'bg-bg-hover text-text-primary' : 'text-text-secondary'"
                @mousemove="active = item.index"
                @click="choose(item)"
              >
                <Icon :name="item.icon" class="shrink-0 text-text-muted" aria-hidden="true" />
                <span class="truncate flex-1">{{ item.label }}</span>
                <span v-if="item.meta" class="num text-xs text-text-muted shrink-0">{{ item.meta }}</span>
              </li>
            </template>
            <li v-if="query.trim() && loading" class="px-4 py-3 text-sm text-text-muted">{{ t('shell.search.loading') }}</li>
            <li v-else-if="query.trim() && !torrents.length && !pageItems.length" class="px-4 py-3 text-sm text-text-muted">
              {{ t('shell.search.empty', { q: query.trim() }) }}
            </li>
          </ul>

          <div class="hidden sm:flex items-center gap-2 px-4 py-2 border-t border-border text-xs text-text-muted">
            <kbd class="num border border-border rounded px-1">↑</kbd><kbd class="num border border-border rounded px-1">↓</kbd>
            {{ t('shell.search.hint') }}
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { refDebounced } from '@vueuse/core';

interface PaletteItem {
  key: string;
  label: string;
  icon: string;
  meta?: string;
  to: string;
  index: number;
}
interface TorrentHit {
  infoHash: string;
  name: string;
  size: number;
  stats?: { seeders: number; leechers: number };
}

const open = defineModel<boolean>('open', { required: true });
const { t } = useI18n();
const router = useRouter();
const { user } = useUserSession();

const input = ref<HTMLInputElement | null>(null);
const query = ref('');
const debounced = refDebounced(query, 200);
const active = ref(0);
const loading = ref(false);
const torrents = ref<TorrentHit[]>([]);

const pages = computed(() => [
  { key: 'home', label: t('shell.nav.home'), icon: 'ph:house', to: '/' },
  { key: 'torrents', label: t('shell.nav.torrents'), icon: 'ph:files', to: '/torrents' },
  { key: 'bounties', label: t('shell.nav.bounties'), icon: 'ph:target', to: '/bounties' },
  { key: 'forum', label: t('shell.nav.forum'), icon: 'ph:chats-circle', to: '/forum' },
  { key: 'messages', label: t('messages.nav'), icon: 'ph:chat-circle-text', to: '/messages' },
  { key: 'shop', label: t('shell.nav.shop'), icon: 'ph:coins', to: '/shop' },
  { key: 'invites', label: t('shell.nav.invites'), icon: 'ph:envelope-simple', to: '/invites' },
  ...(user.value?.isAdmin || user.value?.isModerator
    ? [{ key: 'mod', label: t('shell.nav.mod'), icon: 'ph:shield', to: '/mod' }]
    : []),
  ...(user.value?.isAdmin
    ? [{ key: 'admin', label: t('shell.nav.admin'), icon: 'ph:gear-six', to: '/admin' }]
    : []),
]);

const pageItems = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q ? pages.value.filter((p) => p.label.toLowerCase().includes(q)) : pages.value;
});

const sections = computed(() => {
  let index = 0;
  const torrentItems: PaletteItem[] = torrents.value.map((tr) => ({
    key: tr.infoHash,
    label: tr.name,
    icon: 'ph:file',
    meta: tr.stats ? `↑${tr.stats.seeders} ↓${tr.stats.leechers}` : undefined,
    to: `/torrents/${tr.infoHash}`,
    index: index++,
  }));
  const seeAll: PaletteItem[] = query.value.trim()
    ? [{
        key: 'see-all',
        label: t('shell.search.seeAll', { q: query.value.trim() }),
        icon: 'ph:magnifying-glass',
        to: `/torrents?search=${encodeURIComponent(query.value.trim())}`,
        index: index++,
      }]
    : [];
  const navItems: PaletteItem[] = pageItems.value.map((p) => ({ ...p, index: index++ }));
  return [
    { title: t('shell.search.torrents'), items: [...torrentItems, ...seeAll] },
    { title: t('shell.search.pages'), items: navItems },
  ];
});

const items = computed(() => sections.value.flatMap((s) => s.items));

// Bumped on every new search and on reset, so late answers are dropped
let requestId = 0;

watch(debounced, async (q) => {
  active.value = 0;
  const id = ++requestId;
  const term = q.trim();
  if (term.length < 2) {
    torrents.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  const res = await $fetch<{ data: TorrentHit[] }>('/api/torrents', {
    query: { search: term, limit: 6 },
  }).catch(() => ({ data: [] as TorrentHit[] }));
  if (id !== requestId || term !== query.value.trim()) return;
  torrents.value = res.data;
  loading.value = false;
});

function move(delta: number) {
  const count = items.value.length;
  if (count) active.value = (active.value + delta + count) % count;
}

function choose(item: PaletteItem | undefined) {
  if (!item) return;
  close();
  router.push(item.to);
}

function close() {
  open.value = false;
}

// Focus moves into the palette on open and back to where it was on close
let returnFocus: HTMLElement | null = null;

watch(open, async (isOpen) => {
  requestId++;
  loading.value = false;
  if (isOpen) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    query.value = '';
    torrents.value = [];
    active.value = 0;
    await nextTick();
    input.value?.focus();
  } else {
    returnFocus?.focus();
    returnFocus = null;
  }
});

// ⌘K / Ctrl+K anywhere, and "/" outside text fields
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  const typing = target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    open.value = !open.value;
  } else if (event.key === '/' && !typing && !open.value) {
    event.preventDefault();
    open.value = true;
  }
}
onMounted(() => document.addEventListener('keydown', onKeydown));
onUnmounted(() => document.removeEventListener('keydown', onKeydown));
</script>
