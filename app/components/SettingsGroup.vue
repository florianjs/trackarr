<template>
  <div class="md:grid md:grid-cols-3 md:gap-6 py-4 border-b border-border/50 last:border-0">
    <div class="md:col-span-1 space-y-1">
      <label class="text-[10px] font-bold uppercase tracking-widest text-text-muted block">
        {{ label }}
      </label>
      <p v-if="description" class="text-xs text-text-muted leading-relaxed">
        {{ description }}
      </p>
    </div>
    <div class="mt-2 md:mt-0 md:col-span-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  description?: string;
}>();
</script>
