<template>
  <div class="w-16 h-16 bg-white rounded-lg flex items-center justify-center overflow-hidden">
    <img v-if="branding?.siteLogoImage" :src="branding.siteLogoImage" alt="Logo" class="w-full h-full object-contain" />
    <Icon v-else :name="branding?.siteLogo || 'ph:broadcast-bold'" class="text-black text-4xl" />
  </div>
</template>

<script setup lang="ts">
import type { AuthBranding } from '~/utils/authBranding';

defineProps<{ branding: AuthBranding | null | undefined }>();
</script>
