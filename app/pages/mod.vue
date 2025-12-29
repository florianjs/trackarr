<template>
  <div class="flex flex-col md:flex-row gap-8">
    <!-- Sidebar -->
    <aside class="w-full md:w-64 flex-shrink-0">
      <div class="sticky top-24 space-y-1">
        <div class="px-3 mb-4">
          <h2
            class="text-xs font-bold text-text-muted uppercase tracking-widest"
          >
            Moderation
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

const route = useRoute();

const menuItems = [
  {
    label: 'Dashboard',
    path: '/mod',
    icon: 'ph:shield-check',
    description: 'Moderation overview and quick actions',
  },
  {
    label: 'Pending Torrents',
    path: '/mod/pending',
    icon: 'ph:clock',
    description: 'Review and approve pending torrent uploads',
  },
  {
    label: 'Users',
    path: '/mod/users',
    icon: 'ph:users',
    description: 'Manage user accounts and bans',
  },
  {
    label: 'Reports',
    path: '/mod/reports',
    icon: 'ph:flag',
    description: 'Review and handle user reports',
  },
  {
    label: 'Hit & Run',
    path: '/mod/hnr',
    icon: 'ph:lightning',
    description: 'Monitor and manage H&R violations',
  },
];

const currentItem = computed(
  () => menuItems.find((item) => item.path === route.path) || menuItems[0]
);

const currentTitle = computed(() => currentItem.value?.label || '');
const currentDescription = computed(() => currentItem.value?.description || '');
</script>
