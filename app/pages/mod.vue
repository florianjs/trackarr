<template>
  <div class="flex flex-col md:flex-row gap-8">
    <!-- Sidebar -->
    <aside class="w-full md:w-64 flex-shrink-0">
      <div class="sticky top-24 space-y-1">
        <div class="px-3 mb-4">
          <h2
            class="text-xs font-bold text-text-muted uppercase tracking-widest"
          >
            {{ t('mod.layout.title') }}
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
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 min-w-0">
      <div class="mb-6">
        <h1
          class="text-2xl font-bold text-text-primary tracking-tight uppercase"
        >
          {{ currentTitle }}
        </h1>
        <p class="text-xs text-text-muted font-mono mt-1">
          {{ currentDescription }}
        </p>
      </div>

      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'moderator' as any,
});

const { t } = useI18n();
const route = useRoute();

const menuItems = computed(() => [
  {
    label: t('mod.nav.dashboard.label'),
    path: '/mod',
    icon: 'ph:shield-check',
    description: t('mod.nav.dashboard.description'),
  },
  {
    label: t('mod.nav.pending.label'),
    path: '/mod/pending',
    icon: 'ph:clock',
    description: t('mod.nav.pending.description'),
  },
  {
    label: t('mod.nav.users.label'),
    path: '/mod/users',
    icon: 'ph:users',
    description: t('mod.nav.users.description'),
  },
  {
    label: t('mod.nav.reports.label'),
    path: '/mod/reports',
    icon: 'ph:flag',
    description: t('mod.nav.reports.description'),
  },
  {
    label: t('mod.nav.hnr.label'),
    path: '/mod/hnr',
    icon: 'ph:lightning',
    description: t('mod.nav.hnr.description'),
  },
]);

const currentItem = computed(
  () => menuItems.value.find((item) => item.path === route.path) || menuItems.value[0]
);

const currentTitle = computed(() => currentItem.value?.label || '');
const currentDescription = computed(() => currentItem.value?.description || '');
</script>
