<template>
  <div
    class="min-h-screen flex flex-col bg-bg-primary text-text-primary selection:bg-white selection:text-black"
  >
    <!-- Header -->
    <header
      class="sticky top-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-md"
    >
      <div
        class="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between"
      >
        <NuxtLink to="/" class="flex items-center gap-2.5 group">
          <div
            class="w-7 h-7 bg-white rounded-sm flex items-center justify-center transition-transform group-hover:rotate-12 overflow-hidden"
          >
            <img
              v-if="branding?.siteLogoImage"
              :src="branding.siteLogoImage"
              alt="Logo"
              class="w-full h-full object-contain"
            />
            <Icon
              v-else
              :name="branding?.siteLogo || 'ph:broadcast-bold'"
              class="text-black text-lg"
            />
          </div>
          <div class="flex flex-col leading-none">
            <span
              class="text-sm tracking-tighter transition-colors"
              :class="{
                'font-bold': branding?.siteNameBold ?? true,
                'font-medium': !(branding?.siteNameBold ?? true),
              }"
              :style="{ color: branding?.siteNameColor || '' }"
              v-html="branding?.siteName"
            ></span>
            <span class="text-[10px] text-text-muted font-mono"
              v-html="branding?.siteSubtitle"
            ></span>
          </div>
        </NuxtLink>

        <nav class="flex items-center gap-1">
          <NuxtLink
            v-for="link in visibleNavLinks"
            :key="link.to"
            :to="link.to"
            class="px-3 py-1.5 text-xs font-medium rounded transition-all hover:bg-white/5"
            active-class="bg-white/10 text-white"
          >
            <div class="flex items-center gap-2">
              <Icon :name="link.icon" class="text-base" />
              <span>{{ t(link.labelKey) }}</span>
            </div>
          </NuxtLink>
        </nav>

        <div class="flex items-center gap-3">
          <!-- User Stats -->
          <div
            v-if="user"
            class="hidden sm:flex items-center gap-4 px-3 py-1 border-l border-border ml-2"
          >
            <div class="flex flex-col items-end leading-tight">
              <div class="flex items-center gap-1.5">
                <Icon
                  name="ph:arrow-up-bold"
                  class="text-[10px] text-success"
                />
                <span class="text-[11px] font-mono text-text-secondary">{{
                  formatSize(user.uploaded)
                }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <Icon
                  name="ph:arrow-down-bold"
                  class="text-[10px] text-error"
                />
                <span class="text-[11px] font-mono text-text-secondary">{{
                  formatSize(user.downloaded)
                }}</span>
              </div>
            </div>
            <div class="flex flex-col items-center leading-tight">
              <span
                class="text-[9px] text-text-muted uppercase font-bold tracking-tighter"
                >{{ t('common.ratio') }}</span
              >
              <span :class="['text-xs font-mono font-bold', ratioColor]">
                {{ calculateRatio(user.uploaded, user.downloaded) }}
              </span>
            </div>
            <button
              @click="refreshStats"
              class="p-1 rounded hover:bg-white/5 text-text-muted hover:text-text-secondary transition-colors"
              :title="t('layout.refreshStats')"
            >
              <Icon name="ph:arrows-clockwise" class="text-xs" />
            </button>
          </div>

          <!-- Language -->
          <LanguageSwitcher class="hidden md:inline-flex ml-2" />

          <!-- User Menu -->
          <div class="relative" ref="userMenuRef">
            <button
              @click="toggleUserMenu"
              class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
            >
              <div
                class="w-7 h-7 rounded-full bg-bg-tertiary border border-border flex items-center justify-center overflow-hidden"
              >
                <Icon
                  name="ph:user-circle-light"
                  class="text-xl text-text-secondary"
                />
              </div>
              <span class="text-sm font-medium">{{ user?.username }}</span>
              <Icon name="ph:caret-down" class="text-xs text-text-muted" />
            </button>

            <!-- Dropdown -->
            <Transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="transform scale-95 opacity-0"
              enter-to-class="transform scale-100 opacity-100"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="transform scale-100 opacity-100"
              leave-to-class="transform scale-95 opacity-0"
            >
              <div
                v-if="showUserMenu"
                class="absolute right-0 top-full mt-1 w-56 bg-bg-secondary border border-border rounded-lg shadow-xl overflow-hidden z-50"
              >
                <div class="px-4 py-3 border-b border-border">
                  <p class="text-sm font-medium">
                    {{ user?.username }}
                  </p>
                  <div
                    v-if="user?.isAdmin || user?.isModerator"
                    class="mt-1 flex gap-1"
                  >
                    <span
                      v-if="user?.isAdmin"
                      class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-white/10 rounded text-text-secondary"
                    >
                      {{ t('common.admin') }}
                    </span>
                    <span
                      v-if="user?.isModerator"
                      class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-white/10 rounded text-text-secondary"
                    >
                      {{ t('common.moderator') }}
                    </span>
                  </div>
                </div>
                <div class="py-1">
                  <div class="px-4 py-2">
                    <p
                      class="text-[10px] uppercase tracking-wider text-text-muted mb-1"
                    >
                      {{ t('layout.passkey') }}
                    </p>
                    <code
                      class="text-xs font-mono text-text-secondary break-all"
                      >{{ passkey ?? '…' }}</code
                    >
                  </div>
                  <NuxtLink
                    to="/shop"
                    class="flex items-center justify-between px-4 py-2 text-xs text-text-secondary hover:text-white hover:bg-bg-tertiary/50 transition-colors"
                    @click="showUserMenu = false"
                  >
                    <span class="flex items-center gap-2">
                      <Icon name="ph:coins" />
                      {{ t('bonus.menu.shop') }}
                    </span>
                    <span v-if="bonusPoints !== null" class="font-mono text-accent">
                      {{ t('bonus.points', { n: Math.floor(bonusPoints).toLocaleString(locale) }) }}
                    </span>
                  </NuxtLink>
                </div>
                <div class="border-t border-border py-2 px-4">
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <p
                        class="text-[10px] uppercase tracking-wider text-text-muted mb-0.5"
                      >
                        {{ t('common.uploaded') }}
                      </p>
                      <p class="text-xs font-mono text-success">
                        {{ formatSize(user?.uploaded || 0) }}
                      </p>
                    </div>
                    <div>
                      <p
                        class="text-[10px] uppercase tracking-wider text-text-muted mb-0.5"
                      >
                        {{ t('common.downloaded') }}
                      </p>
                      <p class="text-xs font-mono text-error">
                        {{ formatSize(user?.downloaded || 0) }}
                      </p>
                    </div>
                    <div class="col-span-2">
                      <p
                        class="text-[10px] uppercase tracking-wider text-text-muted mb-0.5"
                      >
                        {{ t('common.ratio') }}
                      </p>
                      <p class="text-xs font-mono" :class="ratioColor">
                        {{ calculateRatio(user?.uploaded, user?.downloaded) }}
                      </p>
                    </div>
                  </div>
                </div>
                <div class="border-t border-border py-1">
                  <button
                    @click="handleLogout"
                    class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <Icon name="ph:sign-out" />
                    {{ t('layout.signOut') }}
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </header>

    <!-- Announcement Banner -->
    <ClientOnly>
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="
            announcementReady &&
            announcement?.enabled &&
            announcement?.message &&
            !announcementDismissed
          "
          :class="[
            'border-b',
            announcementStyles[announcement.type || 'info'].bg,
            announcementStyles[announcement.type || 'info'].border,
          ]"
        >
          <div
            class="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3"
          >
            <Icon
              :name="announcementStyles[announcement.type || 'info'].icon"
              :class="[
                'text-lg flex-shrink-0',
                announcementStyles[announcement.type || 'info'].text,
              ]"
            />
            <p
              :class="[
                'text-sm flex-1',
                announcementStyles[announcement.type || 'info'].text,
              ]"
            >
              {{ announcement.message }}
            </p>
            <button
              @click="dismissAnnouncement"
              class="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
              :title="t('layout.dismiss')"
            >
              <Icon
                name="ph:x"
                :class="[
                  'text-sm',
                  announcementStyles[announcement.type || 'info'].text,
                ]"
              />
            </button>
          </div>
        </div>
      </Transition>
    </ClientOnly>

    <!-- Global freeleech -->
    <ClientOnly>
      <div v-if="freeleech?.active" class="border-b border-success/30 bg-success/10">
        <div class="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3">
          <Icon name="ph:gift" class="text-lg flex-shrink-0 text-success" />
          <p class="text-sm flex-1 text-success">
            {{
              freeleech.until
                ? t('freeleech.bannerUntil', {
                    date: new Date(freeleech.until).toLocaleString(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })
                : t('freeleech.banner')
            }}
          </p>
        </div>
      </div>
    </ClientOnly>

    <!-- Main Content -->
    <main class="flex-grow max-w-[1400px] w-full mx-auto px-4 py-6">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-border mt-auto py-6 bg-bg-secondary/30">
      <div
        class="max-w-[1400px] mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4"
      >
        <div
          class="flex items-center gap-4 text-[10px] text-text-muted font-mono uppercase tracking-widest"
        >
          <span
            class="[&>p]:inline [&>p]:m-0"
            v-html="
              branding?.footerText ||
              `© ${new Date().getFullYear()} ${(branding?.siteName || 'Trackarr')}`
            "
          ></span>
          <span class="w-1 h-1 bg-border rounded-full"></span>
          <span>{{ t('layout.p2pProtocol') }}</span>
          <span class="w-1 h-1 bg-border rounded-full md:hidden"></span>
          <!-- Header switcher is hidden on small screens -->
          <LanguageSwitcher class="md:hidden" />
        </div>
        <div class="flex gap-6">
          <a
            href="https://n0w.me/"
            target="_blank"
            rel="noopener"
            class="text-text-muted hover:text-white transition-colors"
            ><Icon name="ph:globe" class="text-xl"
          /></a>
          <a
            href="https://github.com/florianjs/trackarr"
            target="_blank"
            rel="noopener"
            class="text-text-muted hover:text-white transition-colors"
            ><Icon name="ph:github-logo" class="text-xl"
          /></a>
          <a
            href="https://discord.gg/GRFu35djvz"
            target="_blank"
            rel="noopener"
            class="text-text-muted hover:text-white transition-colors"
            ><Icon name="ph:discord-logo" class="text-xl"
          /></a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n();
const { user, clear, fetch } = useUserSession();

// Passkey is not part of the client session: fetch it on demand
const passkey = ref<string | null>(null);
const bonusPoints = ref<number | null>(null);

// Global freeleech banner, refreshed periodically so it disappears on time
const freeleech = ref<{ active: boolean; until: string | null } | null>(null);
async function loadFreeleech() {
  if (!user.value) return;
  freeleech.value = await $fetch<{ active: boolean; until: string | null }>(
    '/api/freeleech'
  ).catch(() => null);
}
let freeleechTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  loadFreeleech();
  freeleechTimer = setInterval(loadFreeleech, 5 * 60 * 1000);
});
onUnmounted(() => clearInterval(freeleechTimer));
const router = useRouter();

const showUserMenu = ref(false);
const userMenuRef = ref<HTMLElement | null>(null);

// Fetch site branding
const { data: branding } = await useFetch<{
  siteName: string;
  siteLogo: string;
  siteLogoImage: string | null;
  siteFavicon: string | null;
  siteSubtitle: string | null;
  siteNameColor: string | null;
  siteNameBold: boolean | undefined;
  authTitle: string | null;
  authSubtitle: string | null;
  footerText: string | null;
  pageTitleSuffix: string | null;
}>('/api/branding');

// Set dynamic favicon and title template
useHead({
  titleTemplate: computed(() => {
    const suffix =
      branding.value?.pageTitleSuffix ||
      `- ${branding.value?.siteName?.replace(/<[^>]*>/g, '') || 'TRACKARR'}`;
    return (title?: string) =>
      title ? `${title} ${suffix}` : suffix.replace(/^- /, '');
  }),
  link: [
    {
      rel: 'icon',
      type: computed(() => {
        const url = branding.value?.siteFavicon;
        if (!url) return 'image/x-icon';
        if (url.endsWith('.svg')) return 'image/svg+xml';
        if (url.endsWith('.png')) return 'image/png';
        if (url.endsWith('.webp')) return 'image/webp';
        return 'image/x-icon';
      }),
      href: computed(() => branding.value?.siteFavicon || '/favicon.ico'),
    },
  ],
});

// Fetch announcement
const { data: announcement } = await useFetch<{
  enabled: boolean;
  message?: string;
  type?: 'info' | 'warning' | 'error';
}>('/api/announcement');

const announcementDismissed = ref(false);
const announcementReady = ref(false);

// Simple hash function for announcement message
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

const announcementStyles = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: 'ph:info',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    icon: 'ph:warning',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: 'ph:warning-circle',
  },
};

function dismissAnnouncement() {
  announcementDismissed.value = true;
  if (import.meta.client && announcement.value?.message) {
    const messageHash = hashString(announcement.value.message);
    sessionStorage.setItem(`announcement_dismissed_${messageHash}`, 'true');
  }
}

onMounted(() => {
  if (import.meta.client && announcement.value?.message) {
    const messageHash = hashString(announcement.value.message);
    announcementDismissed.value =
      sessionStorage.getItem(`announcement_dismissed_${messageHash}`) ===
      'true';
  }
  // Use nextTick to ensure transition is applied after DOM is ready
  nextTick(() => {
    announcementReady.value = true;
  });
});

// Refresh user stats from database
async function refreshStats() {
  await $fetch('/api/auth/status');
  await fetch();
}

const navLinks = [
  { to: '/', labelKey: 'nav.dashboard', icon: 'ph:squares-four', adminOnly: false },
  {
    to: '/search',
    labelKey: 'nav.search',
    icon: 'ph:magnifying-glass',
    adminOnly: false,
  },
  { to: '/torrents', labelKey: 'nav.torrents', icon: 'ph:files', adminOnly: false },
  {
    to: '/forum',
    labelKey: 'nav.forum',
    icon: 'ph:chat-centered-text',
    adminOnly: false,
  },
  { to: '/shop', labelKey: 'bonus.nav.shop', icon: 'ph:storefront', adminOnly: false },
  { to: '/bounties', labelKey: 'bonus.nav.bounties', icon: 'ph:target', adminOnly: false },
  { to: '/admin', labelKey: 'nav.admin', icon: 'ph:shield-check', adminOnly: true },
  { to: '/mod', labelKey: 'nav.mod', icon: 'ph:shield', modOnly: true },
];

const visibleNavLinks = computed(() =>
  navLinks.filter((link) => {
    if (link.adminOnly && !user.value?.isAdmin) return false;
    if (link.modOnly && !user.value?.isAdmin && !user.value?.isModerator)
      return false;
    return true;
  })
);

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value;
  if (showUserMenu.value && !passkey.value) {
    $fetch<{ passkey: string }>('/api/auth/passkey')
      .then((res) => (passkey.value = res.passkey))
      .catch(() => {});
  }
  // Balance changes while seeding: refresh each time the menu opens
  if (showUserMenu.value) {
    $fetch<{ enabled: boolean; points: number }>('/api/bonus/me')
      .then((res) => (bonusPoints.value = res.enabled ? res.points : null))
      .catch(() => {});
  }
}

// Close on outside click
function handleClickOutside(event: MouseEvent) {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
    showUserMenu.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

async function handleLogout() {
  showUserMenu.value = false;
  passkey.value = null;
  await clear();
  router.push('/auth/login');
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function calculateRatio(up = 0, down = 0) {
  if (down === 0) return up > 0 ? '∞' : '0.00';
  return (up / down).toFixed(2);
}

const ratioColor = computed(() => {
  const up = user.value?.uploaded ?? 0;
  const down = user.value?.downloaded ?? 0;
  if (down === 0) return up > 0 ? 'text-success' : 'text-text-secondary';

  const ratio = up / down;
  if (ratio < 0.5) return 'text-error';
  if (ratio < 1.0) return 'text-warning';
  return 'text-success';
});
</script>
