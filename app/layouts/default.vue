<template>
  <div class="min-h-screen bg-bg-primary text-text-primary">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] btn btn-primary"
    >
      {{ t('shell.skip') }}
    </a>

    <ShellAppSidebar :open="sidebarOpen" :branding="branding ?? null" @close="sidebarOpen = false" />

    <div class="lg:pl-60 min-h-screen flex flex-col">
      <!-- Top bar -->
      <header class="sticky top-0 z-20 h-14 shrink-0 flex items-center gap-3 px-4 sm:px-6 border-b border-border bg-bg-primary/90 backdrop-blur">
        <button
          type="button"
          class="p-1.5 -ml-1.5 rounded btn-ghost lg:hidden"
          :aria-label="t('shell.menu.open')"
          aria-controls="app-sidebar"
          :aria-expanded="sidebarOpen"
          @click="sidebarOpen = true"
        >
          <Icon name="ph:list" class="block text-lg" />
        </button>

        <!-- Search opens the command palette (⌘K or /) -->
        <button
          type="button"
          class="flex-1 max-w-md flex items-center gap-2.5 h-9 px-3 rounded border border-border bg-bg-secondary text-sm text-text-muted hover:border-border-hover transition-colors"
          @click="paletteOpen = true"
        >
          <Icon name="ph:magnifying-glass" aria-hidden="true" />
          <span class="truncate">
            <span class="sm:hidden">{{ t('shell.search.trigger') }}</span>
            <span class="hidden sm:inline">{{ t('shell.search.placeholder') }}</span>
          </span>
          <kbd class="hidden md:block ml-auto text-2xs num border border-border rounded px-1.5 py-0.5">{{ shortcut }}</kbd>
        </button>

        <div class="ml-auto flex items-center gap-2 sm:gap-4">
          <ClientOnly>
            <span
              v-if="freeleech"
              class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-free/15 text-free text-xs font-medium"
              :title="freeleechLabel"
            >
              <Icon name="ph:gift" aria-hidden="true" />
              <span class="hidden sm:inline">{{ freeleechLabel }}</span>
            </span>
          </ClientOnly>

          <ShellTransferMeter
            v-if="user"
            class="hidden sm:flex"
            :uploaded="transfer?.uploaded ?? user.uploaded"
            :downloaded="transfer?.downloaded ?? user.downloaded"
            :freeleech="Boolean(freeleech)"
            @refresh="refreshStats"
          />

          <ShellUserMenu @logout="handleLogout" />
        </div>
      </header>

      <!-- Announcement -->
      <ClientOnly>
        <div
          v-if="announcementReady && announcement?.enabled && announcement?.message && !announcementDismissed"
          class="border-b"
          :class="announcementStyle.box"
          role="status"
        >
          <div class="px-4 sm:px-6 py-2.5 flex items-center gap-3">
            <Icon :name="announcementStyle.icon" class="text-lg shrink-0" :class="announcementStyle.text" aria-hidden="true" />
            <p class="text-sm flex-1 text-text-primary">{{ announcement.message }}</p>
            <button
              type="button"
              class="p-1 rounded btn-ghost shrink-0"
              :title="t('layout.dismiss')"
              :aria-label="t('layout.dismiss')"
              @click="dismissAnnouncement"
            >
              <Icon name="ph:x" class="block text-sm" />
            </button>
          </div>
        </div>
      </ClientOnly>

      <main id="main" class="flex-1 w-full max-w-[1240px] px-4 sm:px-6 py-6 lg:py-8">
        <slot />
      </main>

      <footer class="border-t border-border px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
        <div class="flex items-center gap-3">
          <span
            class="[&>p]:inline [&>p]:m-0"
            v-html="branding?.footerText || `© ${new Date().getFullYear()} ${branding?.siteName || 'Trackarr'}`"
          />
          <span v-if="footerTagline" class="text-text-muted/80">{{ footerTagline }}</span>
        </div>
        <div class="flex items-center gap-4">
          <a
            v-for="link in footerLinks"
            :key="link.url"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            :title="link.label"
            :aria-label="link.label"
            class="text-text-muted hover:text-text-primary transition-colors"
          >
            <Icon :name="link.icon" class="block text-lg" />
          </a>
        </div>
      </footer>
    </div>

    <ShellCommandPalette v-model:open="paletteOpen" />
  </div>
</template>

<script setup lang="ts">
import type { FooterLink } from '~~/shared/utils/footerLinks';

const { t, locale } = useI18n();
const { user, clear, fetch } = useUserSession();
const router = useRouter();
const route = useRoute();

const sidebarOpen = ref(false);
const paletteOpen = ref(false);
watch(() => route.fullPath, () => (sidebarOpen.value = false));

const shortcut = ref('Ctrl K');
onMounted(() => {
  if (/Mac|iPhone|iPad/.test(navigator.platform)) shortcut.value = '⌘K';
});

// ---------------------------------------------------------------------------
// Global freeleech. Reloaded when the user changes (sign in/out) and every
// 5 minutes; the end date is checked locally so it disappears on time.
// ---------------------------------------------------------------------------
type FreeleechBanner = { active: boolean; until: string | null };
const freeleechState = ref<FreeleechBanner | null>(null);
const freeleechNow = ref(Date.now());
const freeleech = computed(() => {
  const state = freeleechState.value;
  if (!state) return null;
  const active = isFreeleechActive(
    { enabled: state.active, until: state.until },
    new Date(freeleechNow.value)
  );
  return active ? state : null;
});
const freeleechLabel = computed(() => {
  if (!freeleech.value?.until) return t('shell.freeleech.pill');
  const time = new Date(freeleech.value.until).toLocaleString(locale.value, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return t('shell.freeleech.until', { time });
});
async function loadFreeleech() {
  if (!user.value) {
    freeleechState.value = null;
    return;
  }
  freeleechState.value = await $fetch<FreeleechBanner>('/api/freeleech').catch(
    () => null
  );
}
let freeleechPoll: ReturnType<typeof setInterval> | undefined;
let freeleechTick: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  watch(() => user.value?.id, loadFreeleech, { immediate: true });
  freeleechPoll = setInterval(loadFreeleech, 5 * 60 * 1000);
  freeleechTick = setInterval(() => (freeleechNow.value = Date.now()), 30 * 1000);
});
onUnmounted(() => {
  clearInterval(freeleechPoll);
  clearInterval(freeleechTick);
});

// ---------------------------------------------------------------------------
// Branding, title and favicon
// ---------------------------------------------------------------------------
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
  footerLinks?: FooterLink[];
  footerTagline?: string | null;
}>('/api/branding');

// Footer links and tagline are editable by admins (Admin > Branding)
const footerLinks = computed(
  () => branding.value?.footerLinks ?? DEFAULT_FOOTER_LINKS
);
const footerTagline = computed(() => {
  const tagline = branding.value?.footerTagline;
  return tagline === null || tagline === undefined
    ? t('layout.p2pProtocol')
    : tagline;
});

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

// ---------------------------------------------------------------------------
// Announcement (dismissed per message, for the browser session)
// ---------------------------------------------------------------------------
const { data: announcement } = await useFetch<{
  enabled: boolean;
  message?: string;
  type?: 'info' | 'warning' | 'error';
}>('/api/announcement');

const announcementDismissed = ref(false);
const announcementReady = ref(false);

const announcementStyles = {
  info: { box: 'bg-bg-secondary border-border', text: 'text-text-secondary', icon: 'ph:info' },
  warning: { box: 'bg-leech/10 border-leech/30', text: 'text-leech', icon: 'ph:warning' },
  error: { box: 'bg-danger/10 border-danger/30', text: 'text-danger', icon: 'ph:warning-circle' },
};
const announcementStyle = computed(
  () => announcementStyles[announcement.value?.type || 'info']
);

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function dismissAnnouncement() {
  announcementDismissed.value = true;
  if (announcement.value?.message) {
    sessionStorage.setItem(`announcement_dismissed_${hashString(announcement.value.message)}`, 'true');
  }
}

onMounted(() => {
  if (announcement.value?.message) {
    announcementDismissed.value =
      sessionStorage.getItem(`announcement_dismissed_${hashString(announcement.value.message)}`) === 'true';
  }
  nextTick(() => (announcementReady.value = true));
});

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
// Live upload/download for the meter: the sealed session only holds the
// values from sign-in, so read them from the database
const transfer = ref<{ uploaded: number; downloaded: number } | null>(null);
async function refreshStats() {
  const status = await $fetch<{ user: { uploaded: number; downloaded: number } | null }>(
    '/api/auth/status'
  ).catch(() => null);
  transfer.value = status?.user
    ? { uploaded: status.user.uploaded, downloaded: status.user.downloaded }
    : null;
  await fetch();
}
let transferPoll: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  refreshStats();
  transferPoll = setInterval(refreshStats, 5 * 60 * 1000);
});
onUnmounted(() => clearInterval(transferPoll));

async function handleLogout() {
  await clear();
  router.push('/auth/login');
}
</script>
