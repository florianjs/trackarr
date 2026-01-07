<template>
  <div class="card p-3 group">
    <div class="flex items-center gap-3">
      <div
        class="w-10 h-10 rounded bg-bg-tertiary flex items-center justify-center border border-border group-hover:border-white/20 transition-colors"
        :class="{
          'text-success bg-success/5': variant === 'success',
          'text-warning bg-warning/5': variant === 'warning',
          'text-error bg-error/5': variant === 'error',
          'text-white': !variant,
        }"
      >
        <Icon :name="icon || 'ph:chart-bar'" class="text-xl" />
      </div>
      <div class="flex-1 min-w-0">
        <p
          class="text-[10px] text-text-muted uppercase tracking-widest font-bold truncate"
        >
          {{ title }}
        </p>
        <p
          class="text-lg font-mono font-bold mt-0.5 leading-none"
          :class="{
            'text-success': variant === 'success',
            'text-warning': variant === 'warning',
            'text-error': variant === 'error',
            'text-text-primary': !variant,
          }"
        >
          {{ typeof value === 'number' ? formatNumber(value) : value }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  value: string | number;
  icon?: string;
  variant?: 'success' | 'warning' | 'error';
}>();

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
</script>
