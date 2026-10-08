<template>
  <div />
</template>

<script setup lang="ts">
// Search now lives on the torrent list (and the ⌘K palette); keep old links working
const route = useRoute();
await navigateTo(
  {
    path: '/torrents',
    query: {
      search: typeof route.query.q === 'string' ? route.query.q : undefined,
      categoryId: typeof route.query.c === 'string' ? route.query.c : undefined,
    },
  },
  { replace: true, redirectCode: 301 }
);
</script>
