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
            class="w-7 h-7 bg-white rounded-sm flex items-center justify-center transition-transform group-hover:rotate-12"
          >
            <Icon :name="branding?.siteLogo || 'ph:broadcast-bold'" class="text-black text-lg" />
          </div>
          <div class="flex flex-col leading-none">
            <span class="text-sm font-bold tracking-tighter uppercase"
              >{{ branding?.siteName || 'OpenTracker' }}</span
            >
            <span class="text-[10px] text-text-muted font-mono"
              >v0.1.0-alpha</span
            >
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
              <span>{{ link.label }}</span>
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
                >Ratio</span
              >
              <span :class="['text-xs font-mono font-bold', ratioColor]">
                {{ calculateRatio(user.uploaded, user.downloaded) }}
              </span>
            </div>
            <button
              @click="refreshStats"
              class="p-1 rounded hover:bg-white/5 text-text-muted hover:text-text-secondary transition-colors"
              title="Refresh stats"
            >
              <Icon name="ph:arrows-clockwise" class="text-xs" />
            </button>
          </div>

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
                  <p class="text-xs text-text-muted truncate">
                    {{ user?.email }}
                  </p>
                  <div
                    v-if="user?.isAdmin || user?.isModerator"
                    class="mt-1 flex gap-1"
                  >
                    <span
                      v-if="user?.isAdmin"
                      class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-white/10 rounded text-text-secondary"
                    >
                      Admin
                    </span>
                    <span
                      v-if="user?.isModerator"
                      class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-white/10 rounded text-text-secondary"
                    >
                      Moderator
                    </span>
                  </div>
                </div>
                <div class="py-1">
                  <div class="px-4 py-2">
                    <p
                      class="text-[10px] uppercase tracking-wider text-text-muted mb-1"
                    >
                      Passkey
                    </p>
                    <code
                      class="text-xs font-mono text-text-secondary break-all"
                      >{{ user?.passkey }}</code
                    >
                  </div>
                </div>
                <div class="border-t border-border py-2 px-4">
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <p
                        class="text-[10px] uppercase tracking-wider text-text-muted mb-0.5"
                      >
                        Uploaded
                      </p>
                      <p class="text-xs font-mono text-success">
                        {{ formatSize(user?.uploaded || 0) }}
                      </p>
                    </div>
                    <div>
                      <p
                        class="text-[10px] uppercase tracking-wider text-text-muted mb-0.5"
                      >
                        Downloaded
                      </p>
                      <p class="text-xs font-mono text-error">
                        {{ formatSize(user?.downloaded || 0) }}
                      </p>
                    </div>
                    <div class="col-span-2">
                      <p
                        class="text-[10px] uppercase tracking-wider text-text-muted mb-0.5"
                      >
                        Ratio
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
                    Sign Out
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </header>

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
          <span>&copy; 2025 OPENTRACKER</span>
          <span class="w-1 h-1 bg-border rounded-full"></span>
          <span>P2P PROTOCOL</span>
        </div>
        <div class="flex gap-6">
          <a href="https://n0w.me/" target="_blank" rel="noopener" class="text-text-muted hover:text-white transition-colors"
            ><Icon name="ph:globe" class="text-xl"
          /></a>
          <a href="https://github.com/florianjs/opentracker" target="_blank" rel="noopener" class="text-text-muted hover:text-white transition-colors"
            ><Icon name="ph:github-logo" class="text-xl"
          /></a>
          <a href="https://discord.gg/GRFu35djvz" target="_blank" rel="noopener" class="text-text-muted hover:text-white transition-colors"
            ><Icon name="ph:discord-logo" class="text-xl"
          /></a>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { user, clear, fetch } = useUserSession();
const router = useRouter();

const showUserMenu = ref(false);
const userMenuRef = ref<HTMLElement | null>(null);

// Fetch site branding
const { data: branding } = await useFetch<{ siteName: string; siteLogo: string }>('/api/branding');

// Refresh user stats from database
async function refreshStats() {
  await $fetch('/api/auth/status');
  await fetch();
}

const navLinks = [
  { to: '/', label: 'Dashboard', icon: 'ph:squares-four', adminOnly: false },
  {
    to: '/search',
    label: 'Search',
    icon: 'ph:magnifying-glass',
    adminOnly: false,
  },
  { to: '/torrents', label: 'Torrents', icon: 'ph:files', adminOnly: false },
  {
    to: '/forum',
    label: 'Forum',
    icon: 'ph:chat-centered-text',
    adminOnly: false,
  },
  { to: '/admin', label: 'Admin', icon: 'ph:shield-check', adminOnly: true },
  { to: '/mod', label: 'Mod', icon: 'ph:shield', modOnly: true },
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
