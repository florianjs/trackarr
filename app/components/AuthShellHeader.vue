<template>
  <div class="text-center mb-8">
    <AuthShellLogo :branding="branding" class="mx-auto mb-4" />
    <h1 class="text-2xl font-bold tracking-tighter" v-html="title"></h1>
    <div class="text-text-muted text-sm mt-1 [&>p]:m-0" v-html="subtitle"></div>
  </div>
</template>

<script setup lang="ts">
import type { AuthBranding } from '~/utils/authBranding';

// title and subtitle are sanitized rich text from /api/branding
defineProps<{ branding: AuthBranding | null | undefined; title: string; subtitle: string }>();
</script>
