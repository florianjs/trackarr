<template>
  <div class="inline-flex items-center rounded border border-border p-0.5" role="group" :aria-label="t('shell.theme.label')">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="p-1 rounded-sm transition-colors"
      :class="preference === option.value ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary'"
      :aria-pressed="preference === option.value"
      :title="t(option.label)"
      @click="setTheme(option.value)"
    >
      <Icon :name="option.icon" class="text-sm block" aria-hidden="true" />
      <span class="sr-only">{{ t(option.label) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ThemePreference } from '~/composables/useTheme';

const { t } = useI18n();
const { preference, setTheme } = useTheme();

const options: { value: ThemePreference; icon: string; label: string }[] = [
  { value: 'light', icon: 'ph:sun', label: 'shell.theme.light' },
  { value: 'system', icon: 'ph:desktop', label: 'shell.theme.system' },
  { value: 'dark', icon: 'ph:moon', label: 'shell.theme.dark' },
];
</script>
