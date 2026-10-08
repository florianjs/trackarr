<template>
  <!-- Mobile backdrop -->
  <div
    v-if="open"
    class="fixed inset-0 z-40 bg-scrim/50 lg:hidden"
    aria-hidden="true"
    @click="emit('close')"
  />

  <aside
    id="app-sidebar"
    class="fixed inset-y-0 left-0 z-50 w-60 flex flex-col bg-bg-secondary border-r border-border transition-transform lg:translate-x-0 lg:z-30"
    :class="open ? 'translate-x-0' : '-translate-x-full invisible lg:visible'"
    :aria-label="t('shell.menu.label')"
  >
    <!-- Brand -->
    <div class="h-14 shrink-0 flex items-center gap-2.5 px-4 border-b border-border">
      <NuxtLink to="/" class="flex items-center gap-2.5 min-w-0" @click="emit('close')">
        <span
          class="w-7 h-7 shrink-0 rounded flex items-center justify-center overflow-hidden"
          :class="branding?.siteLogoImage ? 'bg-paper' : 'bg-white'"
        >
          <img
            v-if="branding?.siteLogoImage"
            :src="branding.siteLogoImage"
            alt=""
            class="w-full h-full object-contain"
          />
          <Icon v-else :name="branding?.siteLogo || 'ph:broadcast-bold'" class="text-black text-base" />
        </span>
        <span
          class="text-sm truncate"
          :class="(branding?.siteNameBold ?? true) ? 'font-semibold' : 'font-medium'"
          :style="{ color: branding?.siteNameColor || '' }"
          v-html="branding?.siteName"
        />
      </NuxtLink>
      <button
        type="button"
        class="ml-auto p-1.5 rounded btn-ghost lg:hidden"
        :aria-label="t('shell.menu.close')"
        @click="emit('close')"
      >
        <Icon name="ph:x" class="block" />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-2 py-3 space-y-5">
      <div v-for="group in visibleGroups" :key="group.label">
        <p class="px-2 mb-1 text-xs text-text-muted">{{ t(group.label) }}</p>
        <ul class="space-y-px">
          <li v-for="item in group.items" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="group flex items-center gap-2.5 px-2 py-1.5 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              :class="isActive(item) && 'bg-bg-hover text-text-primary font-medium'"
              :aria-current="isActive(item) ? 'page' : undefined"
              @click="emit('close')"
            >
              <Icon
                :name="item.icon"
                class="text-base shrink-0"
                :class="isActive(item) ? 'text-text-primary' : 'text-text-muted group-hover:text-text-secondary'"
              />
              <span class="truncate">{{ t(item.label) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <div class="shrink-0 px-4 py-3 border-t border-border text-xs text-text-muted num">
      v{{ appVersion }}
    </div>
  </aside>
</template>

<script setup lang="ts">
interface NavItem {
  to: string;
  label: string;
  icon: string;
  exact?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
  staff?: 'mod' | 'admin';
}

defineProps<{
  open: boolean;
  branding: {
    siteName?: string;
    siteLogo?: string;
    siteLogoImage?: string | null;
    siteNameColor?: string | null;
    siteNameBold?: boolean;
  } | null;
}>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const route = useRoute();
const { user } = useUserSession();
const appVersion = useRuntimeConfig().public.appVersion;

const groups = computed<NavGroup[]>(() => [
  {
    label: 'shell.groups.browse',
    items: [
      { to: '/', label: 'shell.nav.home', icon: 'ph:house', exact: true },
      { to: '/torrents', label: 'shell.nav.torrents', icon: 'ph:files' },
      { to: '/bounties', label: 'shell.nav.bounties', icon: 'ph:target' },
    ],
  },
  {
    label: 'shell.groups.community',
    items: [{ to: '/forum', label: 'shell.nav.forum', icon: 'ph:chats-circle' }],
  },
  {
    label: 'shell.groups.account',
    items: [
      { to: '/shop', label: 'shell.nav.shop', icon: 'ph:coins' },
      { to: '/invites', label: 'shell.nav.invites', icon: 'ph:envelope-simple' },
      ...(user.value ? [{ to: `/users/${user.value.id}`, label: 'shell.nav.profile', icon: 'ph:user' }] : []),
    ],
  },
  {
    label: 'shell.groups.staff',
    staff: 'mod',
    items: [
      { to: '/mod', label: 'shell.nav.mod', icon: 'ph:shield' },
      ...(user.value?.isAdmin ? [{ to: '/admin', label: 'shell.nav.admin', icon: 'ph:gear-six' }] : []),
    ],
  },
]);

const visibleGroups = computed(() =>
  groups.value.filter(
    (g) => !g.staff || user.value?.isAdmin || user.value?.isModerator
  )
);

function isActive(item: NavItem): boolean {
  return item.exact ? route.path === item.to : route.path === item.to || route.path.startsWith(`${item.to}/`);
}
</script>
