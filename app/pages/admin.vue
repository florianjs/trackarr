<template>
  <div class="flex flex-col md:flex-row gap-8">
    <!-- Sidebar -->
    <aside class="w-full md:w-64 flex-shrink-0">
      <div class="sticky top-24 space-y-1">
        <div class="px-3 mb-4">
          <h2
            class="text-xs font-bold text-text-muted uppercase tracking-widest"
          >
            Administration
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
            class="flex items-center gap-2 text-[10px] font-mono text-text-muted bg-bg-secondary px-2 py-1.5 rounded border border-border"
          >
            <span class="relative flex h-2 w-2">
              <span
                v-if="trackerOnline"
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"
              ></span>
              <span
                class="relative inline-flex rounded-full h-2 w-2"
                :class="trackerOnline ? 'bg-success' : 'bg-error'"
              ></span>
            </span>
            LIVE TRACKER FEED
          </div>
        </div>
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
  middleware: 'admin',
});

const route = useRoute();

const menuItems = [
  {
    label: 'Dashboard',
    path: '/admin',
    icon: 'ph:layout',
    description: 'Tracker configuration and node management',
  },
  {
    label: 'Users',
    path: '/admin/users',
    icon: 'ph:users',
    description: 'Manage user accounts and permissions',
  },
  {
    label: 'Roles',
    path: '/admin/roles',
    icon: 'ph:user-circle-gear',
    description: 'Manage user roles and permissions',
  },
  {
    label: 'Reports',
    path: '/admin/reports',
    icon: 'ph:flag',
    description: 'Review and handle user reports',
  },
  {
    label: 'Categories',
    path: '/admin/categories',
    icon: 'ph:folders',
    description: 'Manage torrent categories',
  },
  {
    label: 'Tags',
    path: '/admin/tags',
    icon: 'ph:tag',
    description: 'Manage torrent tags',
  },
  {
    label: 'Hit & Run',
    path: '/admin/hnr',
    icon: 'ph:lightning',
    description: 'Monitor and manage H&R violations',
  },
  {
    label: 'Invitations',
    path: '/admin/invites',
    icon: 'ph:envelope-simple',
    description: 'Manage invitation system',
  },
  {
    label: 'Branding',
    path: '/admin/branding',
    icon: 'ph:paint-brush',
    description: 'Customize site appearance and branding',
  },
  {
    label: 'Settings',
    path: '/admin/settings',
    icon: 'ph:gear',
    description: 'System-wide registration and tracker settings',
  },
];

const currentItem = computed(
  () => menuItems.find((item) => item.path === route.path) || menuItems[0]
);

const currentTitle = computed(() => currentItem?.value?.label);
const currentDescription = computed(() => currentItem?.value?.description);

const { data: trackerStatus } = await useFetch('/api/tracker-status', {
  server: false,
});

const trackerOnline = computed(() => trackerStatus.value?.online ?? false);
</script>
