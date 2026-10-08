<template>
  <span
    class="shrink-0 rounded-full overflow-hidden bg-bg-tertiary border border-border flex items-center justify-center text-text-secondary font-medium select-none"
    :class="size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'"
    aria-hidden="true"
  >
    <img v-if="url" :src="url" alt="" class="w-full h-full object-cover" />
    <template v-else>{{ initial }}</template>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  name?: string | null;
  url?: string | null;
  size?: 'sm' | 'md';
}>();

const initial = computed(() => (props.name?.trim()[0] ?? '?').toUpperCase());
</script>
