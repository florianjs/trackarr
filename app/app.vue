<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// Light/dark/system theme on <html>, for every layout (auth pages included)
useThemeAttribute();
</script>
