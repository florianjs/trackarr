<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-2 pl-1 pr-2 py-1 rounded btn-ghost"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="t('shell.user.open')"
      @click="toggle"
    >
      <span class="w-7 h-7 rounded-full bg-bg-tertiary border border-border overflow-hidden flex items-center justify-center">
        <img v-if="avatarUrl" :src="avatarUrl" alt="" class="w-full h-full object-cover" />
        <Icon v-else name="ph:user" class="text-text-muted" />
      </span>
      <span class="hidden sm:block text-sm font-medium text-text-primary max-w-[10rem] truncate">{{ user?.username }}</span>
      <Icon name="ph:caret-down" class="text-xs text-text-muted" aria-hidden="true" />
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="open"
        class="absolute right-0 top-full mt-2 w-72 card shadow-lg shadow-scrim/10 overflow-hidden z-50"
        role="menu"
      >
        <div class="px-4 py-3 border-b border-border">
          <p class="text-sm font-medium truncate">{{ user?.username }}</p>
          <p v-if="user?.isAdmin || user?.isModerator" class="text-xs text-text-muted">
            {{ user?.isAdmin ? t('common.admin') : t('common.moderator') }}
          </p>
        </div>

        <!-- Passkey: needed for torrent clients, copy it in one click -->
        <div class="px-4 py-3 border-b border-border">
          <p class="text-xs text-text-muted mb-1">{{ t('shell.user.passkey') }}</p>
          <div class="flex items-center gap-2">
            <code class="num text-xs text-text-secondary truncate flex-1">{{ passkey ?? '…' }}</code>
            <button
              type="button"
              class="p-1 rounded btn-ghost shrink-0"
              :disabled="!passkey"
              :title="copied ? t('shell.user.copied') : t('shell.user.copy')"
              :aria-label="t('shell.user.copy')"
              @click="copyPasskey"
            >
              <Icon :name="copied ? 'ph:check' : 'ph:copy'" class="block text-sm" />
            </button>
          </div>
        </div>

        <div class="py-1 border-b border-border">
          <NuxtLink
            to="/shop"
            class="flex items-center justify-between px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            role="menuitem"
            @click="open = false"
          >
            <span class="flex items-center gap-2"><Icon name="ph:coins" class="text-text-muted" />{{ t('shell.nav.shop') }}</span>
            <span v-if="points !== null" class="num text-xs text-free">{{ t('shell.user.points', { n: Math.floor(points).toLocaleString(locale) }) }}</span>
          </NuxtLink>
          <NuxtLink
            v-if="user"
            :to="`/users/${user.id}`"
            class="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            role="menuitem"
            @click="open = false"
          >
            <Icon name="ph:user" class="text-text-muted" />{{ t('shell.nav.profile') }}
          </NuxtLink>
        </div>

        <div class="px-4 py-3 border-b border-border space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-muted">{{ t('shell.user.theme') }}</span>
            <ThemeSwitcher />
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-muted">{{ t('shell.user.language') }}</span>
            <LanguageSwitcher />
          </div>
        </div>

        <button
          type="button"
          class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger/10"
          role="menuitem"
          @click="emit('logout')"
        >
          <Icon name="ph:sign-out" />{{ t('shell.user.signOut') }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ logout: [] }>();
const { t, locale } = useI18n();
const { user } = useUserSession();

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const passkey = ref<string | null>(null);
const points = ref<number | null>(null);
const avatarUrl = ref<string | null>(null);
const copied = ref(false);

// Passkey and balance are not in the client session: load them on demand.
// The balance changes while seeding, so it is refreshed on every opening.
async function loadAccount() {
  const me = await $fetch<{ enabled: boolean; points: number; avatarUrl: string | null }>('/api/bonus/me').catch(() => null);
  if (me) {
    points.value = me.enabled ? me.points : null;
    avatarUrl.value = me.avatarUrl;
  }
}

function toggle() {
  open.value = !open.value;
  if (!open.value) return;
  if (!passkey.value) {
    $fetch<{ passkey: string }>('/api/auth/passkey')
      .then((res) => (passkey.value = res.passkey))
      .catch(() => {});
  }
  loadAccount();
}

async function copyPasskey() {
  if (!passkey.value) return;
  try {
    await navigator.clipboard.writeText(passkey.value);
  } catch {
    // Clipboard unavailable (insecure context) or denied: keep the button as is
    return;
  }
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

function onClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false;
}

onMounted(() => {
  loadAccount();
  document.addEventListener('click', onClickOutside);
  document.addEventListener('keydown', onKeydown);
});
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside);
  document.removeEventListener('keydown', onKeydown);
});

// Another account signed in: drop what belonged to the previous one
watch(() => user.value?.id, (id) => {
  passkey.value = null;
  points.value = null;
  avatarUrl.value = null;
  if (id) loadAccount();
  else open.value = false;
});
</script>
