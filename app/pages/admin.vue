<template>
  <div class="flex flex-col md:flex-row gap-8">
    <!-- Sidebar -->
    <aside class="w-full md:w-64 flex-shrink-0">
      <div class="sticky top-24 space-y-1">
        <div class="px-3 mb-4">
          <h2
            class="text-xs font-bold text-text-muted"
          >
            {{ t('admin.layout.title') }}
          </h2>
        </div>

        <nav class="space-y-1">
          <NuxtLink
            v-for="item in menuItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors"
            :class="[
              $route.path === item.path
                ? 'bg-bg-secondary text-text-primary border border-border'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-secondary/50',
            ]"
          >
            <Icon :name="item.icon" class="w-4 h-4" />
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="mt-8 px-3">
          <div
            class="flex items-center gap-2 text-xs text-text-muted bg-bg-secondary px-2 py-1.5 rounded border border-border"
          >
            <span class="relative flex h-2 w-2">
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"
              ></span>
              <span
                class="relative inline-flex rounded-full h-2 w-2 bg-success"
              ></span>
            </span>
            {{ t('admin.layout.liveFeed') }}
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 min-w-0">
      <div class="mb-6">
        <h1
          class="text-2xl font-semibold tracking-tight text-text-primary"
        >
          {{ currentTitle }}
        </h1>
        <p class="text-sm text-text-muted mt-1">
          {{ currentDescription }}
        </p>
      </div>

      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'admin',
});

const { t } = useI18n();
const route = useRoute();

const menuItems = computed(() => [
  {
    label: t('admin.nav.dashboard.label'),
    path: '/admin',
    icon: 'ph:layout',
    description: t('admin.nav.dashboard.description'),
  },
  {
    label: t('admin.nav.users.label'),
    path: '/admin/users',
    icon: 'ph:users',
    description: t('admin.nav.users.description'),
  },
  {
    label: t('admin.nav.roles.label'),
    path: '/admin/roles',
    icon: 'ph:user-circle-gear',
    description: t('admin.nav.roles.description'),
  },
  {
    label: t('admin.nav.reports.label'),
    path: '/admin/reports',
    icon: 'ph:flag',
    description: t('admin.nav.reports.description'),
  },
  {
    label: t('admin.nav.categories.label'),
    path: '/admin/categories',
    icon: 'ph:folders',
    description: t('admin.nav.categories.description'),
  },
  {
    label: t('admin.nav.tags.label'),
    path: '/admin/tags',
    icon: 'ph:tag',
    description: t('admin.nav.tags.description'),
  },
  {
    label: t('admin.nav.hnr.label'),
    path: '/admin/hnr',
    icon: 'ph:lightning',
    description: t('admin.nav.hnr.description'),
  },
  {
    label: t('admin.nav.invites.label'),
    path: '/admin/invites',
    icon: 'ph:envelope-simple',
    description: t('admin.nav.invites.description'),
  },
  {
    label: t('admin.nav.torznab.label'),
    path: '/admin/torznab',
    icon: 'ph:plug',
    description: t('admin.nav.torznab.description'),
  },
  {
    label: t('admin.nav.branding.label'),
    path: '/admin/branding',
    icon: 'ph:paint-brush',
    description: t('admin.nav.branding.description'),
  },
  {
    label: t('admin.nav.settings.label'),
    path: '/admin/settings',
    icon: 'ph:gear',
    description: t('admin.nav.settings.description'),
  },
  {
    label: t('bonus.adminNav.label'),
    path: '/admin/bonus',
    icon: 'ph:coins',
    description: t('bonus.adminNav.description'),
  },
]);

const currentItem = computed(
  () => menuItems.value.find((item) => item.path === route.path) || menuItems.value[0]
);

const currentTitle = computed(() => currentItem?.value?.label);
const currentDescription = computed(() => currentItem?.value?.description);
</script>
